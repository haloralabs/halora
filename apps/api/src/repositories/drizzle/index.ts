import { and, desc, eq, inArray, lte } from 'drizzle-orm';
import type { Database } from '../../db/client';
import {
  agentAccounts,
  approvalRequests,
  indexerCursors,
  ownerChallenges,
  ownerSessions,
  paymentRecords,
} from '../../db/schema';
import type { ApprovalRecord, PaymentRecord, StoredAccount } from '../../domain';
import { DuplicateError, type ApprovalFilter, type Repositories } from '../types';

type ApprovalRow = typeof approvalRequests.$inferSelect;
type PaymentRow = typeof paymentRecords.$inferSelect;
type AccountRow = typeof agentAccounts.$inferSelect;

const toAccount = (r: AccountRow): StoredAccount => ({
  contractId: r.contractId,
  ownerPublicKey: r.ownerPublicKey,
  agentPublicKey: r.agentPublicKey,
  label: r.label,
  network: r.network,
  token: r.token,
  createdAt: r.createdAt.toISOString(),
  apiKeyId: r.apiKeyId,
  apiKeyHash: r.apiKeyHash,
});

const toApproval = (r: ApprovalRow): ApprovalRecord => ({
  id: r.id,
  contractId: r.contractId,
  token: r.token,
  to: r.to,
  amount: r.amount,
  reason: r.reason,
  ...(r.approvalTxHash ? { approvalTxHash: r.approvalTxHash } : {}),
  status: r.status,
  ...(r.rejectionReason ? { rejectionReason: r.rejectionReason } : {}),
  createdAt: r.createdAt.toISOString(),
  expiresAt: r.expiresAt.toISOString(),
});

const toPayment = (r: PaymentRow): PaymentRecord => ({
  id: r.id,
  contractId: r.contractId,
  token: r.token,
  to: r.to,
  amount: r.amount,
  txHash: r.txHash,
  ledger: r.ledger,
  createdAt: r.createdAt.toISOString(),
  source: r.source,
  ...(r.resource ? { resource: r.resource } : {}),
});

function isUniqueViolation(err: unknown): boolean {
  const code =
    (err as { code?: string; cause?: { code?: string } })?.code ??
    (err as { cause?: { code?: string } })?.cause?.code;
  return code === '23505';
}

export function createDrizzleRepositories(db: Database): Repositories {
  return {
    challenges: {
      async create(c) {
        await db.insert(ownerChallenges).values(c);
      },
      async consume(nonce) {
        const rows = await db
          .delete(ownerChallenges)
          .where(eq(ownerChallenges.nonce, nonce))
          .returning();
        return rows[0] ?? null;
      },
      async deleteExpired(now) {
        const rows = await db
          .delete(ownerChallenges)
          .where(lte(ownerChallenges.expiresAt, now))
          .returning({ nonce: ownerChallenges.nonce });
        return rows.length;
      },
    },

    sessions: {
      async create(s) {
        await db.insert(ownerSessions).values(s);
      },
      async findByTokenHash(h) {
        const rows = await db.select().from(ownerSessions).where(eq(ownerSessions.tokenHash, h));
        return rows[0] ?? null;
      },
      async deleteExpired(now) {
        const rows = await db
          .delete(ownerSessions)
          .where(lte(ownerSessions.expiresAt, now))
          .returning({ h: ownerSessions.tokenHash });
        return rows.length;
      },
    },

    accounts: {
      async create(a) {
        try {
          await db.insert(agentAccounts).values({ ...a, createdAt: new Date(a.createdAt) });
        } catch (err) {
          if (isUniqueViolation(err)) throw new DuplicateError('Account already registered');
          throw err;
        }
      },
      async findByContractId(id) {
        const rows = await db.select().from(agentAccounts).where(eq(agentAccounts.contractId, id));
        return rows[0] ? toAccount(rows[0]) : null;
      },
      async findByApiKeyId(keyId) {
        const rows = await db.select().from(agentAccounts).where(eq(agentAccounts.apiKeyId, keyId));
        return rows[0] ? toAccount(rows[0]) : null;
      },
      async listByOwner(owner) {
        const rows = await db
          .select()
          .from(agentAccounts)
          .where(eq(agentAccounts.ownerPublicKey, owner))
          .orderBy(desc(agentAccounts.createdAt));
        return rows.map(toAccount);
      },
      async listAll() {
        return (await db.select().from(agentAccounts)).map(toAccount);
      },
    },

    approvals: {
      async create(a) {
        await db.insert(approvalRequests).values({
          ...a,
          approvalTxHash: a.approvalTxHash ?? null,
          rejectionReason: a.rejectionReason ?? null,
          createdAt: new Date(a.createdAt),
          expiresAt: new Date(a.expiresAt),
        });
      },
      async findById(id) {
        const rows = await db.select().from(approvalRequests).where(eq(approvalRequests.id, id));
        return rows[0] ? toApproval(rows[0]) : null;
      },
      async list(f: ApprovalFilter) {
        if (f.contractIds.length === 0) return [];
        const conds = [inArray(approvalRequests.contractId, f.contractIds)];
        if (f.status) conds.push(eq(approvalRequests.status, f.status));
        const rows = await db
          .select()
          .from(approvalRequests)
          .where(and(...conds))
          .orderBy(desc(approvalRequests.createdAt))
          .limit(f.limit);
        return rows.map(toApproval);
      },
      async transition(id, from, patch) {
        const rows = await db
          .update(approvalRequests)
          .set(patch)
          .where(and(eq(approvalRequests.id, id), eq(approvalRequests.status, from)))
          .returning();
        return rows[0] ? toApproval(rows[0]) : null;
      },
      async expirePending(now) {
        const rows = await db
          .update(approvalRequests)
          .set({ status: 'expired' })
          .where(and(eq(approvalRequests.status, 'pending'), lte(approvalRequests.expiresAt, now)))
          .returning({ id: approvalRequests.id });
        return rows.length;
      },
      async findApprovedForRecipient(contractId, to) {
        const rows = await db
          .select()
          .from(approvalRequests)
          .where(
            and(
              eq(approvalRequests.status, 'approved'),
              eq(approvalRequests.contractId, contractId),
              eq(approvalRequests.to, to),
            ),
          );
        return rows.map(toApproval);
      },
    },

    payments: {
      async insertMany(records) {
        if (records.length === 0) return 0;
        const rows = await db
          .insert(paymentRecords)
          .values(
            records.map((r) => ({
              ...r,
              resource: r.resource ?? null,
              createdAt: new Date(r.createdAt),
            })),
          )
          .onConflictDoNothing({ target: paymentRecords.id })
          .returning({ id: paymentRecords.id });
        return rows.length;
      },
      async listByContract(contractId, limit) {
        const rows = await db
          .select()
          .from(paymentRecords)
          .where(eq(paymentRecords.contractId, contractId))
          .orderBy(desc(paymentRecords.ledger), desc(paymentRecords.id))
          .limit(limit);
        return rows.map(toPayment);
      },
    },

    cursors: {
      async get(key) {
        const rows = await db.select().from(indexerCursors).where(eq(indexerCursors.key, key));
        return rows[0]?.value ?? null;
      },
      async set(key, value) {
        await db
          .insert(indexerCursors)
          .values({ key, value })
          .onConflictDoUpdate({ target: indexerCursors.key, set: { value } });
      },
    },
  };
}
