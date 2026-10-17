import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { PolicyRefusal, type WalletBackend } from './backend';
import { scrub } from './redact';

export const SERVER_NAME = 'halora';
export const SERVER_VERSION = '0.1.0';

const MAX_BODY_CHARS = 100_000;

/** Shared preamble so every tool tells the calling model the rules it operates under. */
const LIMITS_NOTE =
  'You are spending from a Halora wallet: a Stellar smart account whose owner set a spending policy ' +
  '(per-payment limit, daily limit, optional recipient allowlist, an approval threshold above which ' +
  'the owner must approve, an expiry and a pause switch). These limits are enforced on-chain by the ' +
  'account contract. A refusal is a policy decision by the owner, not a transient error: do not ' +
  'retry with altered amounts, split a payment into smaller ones to get under a limit, or look for ' +
  'another way around it. Report the refusal to the user instead.';

const STROOP_AMOUNT = /^[1-9][0-9]{0,38}$/;

export type ServerOptions = {
  /** Exact secret values to scrub from any output (agent secret, API key). */
  secrets: string[];
};

export function createServer(backend: WalletBackend, opts: ServerOptions): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        `${LIMITS_NOTE} Call halora_status before spending to see the remaining daily budget. ` +
        'Amounts are integer strings in the token base unit (USDC has 7 decimals, so 1 USDC is "10000000").',
    },
  );

  const ok = (data: unknown): CallToolResult => ({
    content: [{ type: 'text', text: scrub(JSON.stringify(data, null, 2), opts.secrets) }],
  });

  const fail = (err: unknown): CallToolResult => {
    if (err instanceof PolicyRefusal) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: scrub(
              `Refused by policy (${err.code}): ${err.message}\n` +
                'This is a policy decision enforced on-chain by the account contract. Do not retry ' +
                'or work around it. Tell the user what was refused and why; only the wallet owner ' +
                'can change the policy or approve the payment.',
              opts.secrets,
            ),
          },
        ],
      };
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      isError: true,
      content: [{ type: 'text', text: scrub(`Halora error: ${message}`, opts.secrets) }],
    };
  };

  const run = async (fn: () => Promise<unknown>): Promise<CallToolResult> => {
    try {
      return ok(await fn());
    } catch (err) {
      return fail(err);
    }
  };

  server.registerTool(
    'halora_status',
    {
      title: 'Wallet status',
      description:
        'Returns the wallet balance, the full spending policy, the amount spent today (UTC) and the ' +
        'remaining daily budget. Read-only and free. Call this before paying so you know your limits. ' +
        LIMITS_NOTE,
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    () =>
      run(async () => {
        const s = await backend.status();
        const remaining = BigInt(s.policy.dailyLimit) - BigInt(s.spentToday);
        return {
          contractId: s.contractId,
          network: s.network,
          balance: s.balance,
          policy: s.policy,
          spentToday: s.spentToday,
          remainingToday: (remaining > 0n ? remaining : 0n).toString(),
          notes: [
            `A single payment above perTxLimit (${s.policy.perTxLimit}) is always refused.`,
            `A payment above approvalThreshold (${s.policy.approvalThreshold}) needs the owner's approval first.`,
            s.policy.allowlistEnabled
              ? 'Only recipients in the allowlist can be paid.'
              : 'Any recipient can be paid (no allowlist).',
            s.policy.paused
              ? 'The wallet is PAUSED by its owner: every payment will be refused.'
              : '',
          ].filter(Boolean),
        };
      }),
  );

  server.registerTool(
    'halora_pay',
    {
      title: 'Pay',
      description:
        'Sends a token payment from the wallet to a Stellar address. Moves real funds: only pay when ' +
        'the task the user gave you requires it, and give an honest `reason` (the owner sees it). ' +
        'Possible outcomes: `paid` with a transaction hash; `approval_pending` with an approval id when ' +
        'the amount is above the approval threshold (check it later with halora_approval_status, then ' +
        'call halora_pay again with the same recipient and amount once it is approved); or a refusal ' +
        'by policy. ' +
        LIMITS_NOTE,
      inputSchema: {
        to: z
          .string()
          .regex(/^[GC][A-Z2-7]{55}$/, 'must be a Stellar G... or C... address')
          .describe('Recipient Stellar address (G... account or C... contract).'),
        amount: z
          .string()
          .regex(STROOP_AMOUNT, 'must be a positive integer string')
          .describe('Amount in token base units as an integer string, e.g. "10000000" for 1 USDC.'),
        reason: z
          .string()
          .min(1)
          .max(500)
          .describe('Why this payment is needed. Shown to the wallet owner.'),
      },
      annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    ({ to, amount, reason }) => run(() => backend.pay({ to, amount: BigInt(amount), reason })),
  );

  server.registerTool(
    'halora_fetch_paid',
    {
      title: 'Fetch a paid resource (x402)',
      description:
        'Performs an HTTP request. If the server answers 402 Payment Required (x402), the wallet pays ' +
        'the requested price automatically, but only within the policy, and retries once. Returns the ' +
        'status, content type, body (truncated to 100k characters) and the payment made, if any. Use it ' +
        'only for resources the task needs. ' +
        LIMITS_NOTE,
      inputSchema: {
        url: z.string().url().describe('Absolute http(s) URL.'),
        method: z
          .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
          .optional()
          .describe('HTTP method, default GET.'),
        body: z.string().max(100_000).optional().describe('Request body for POST, PUT or PATCH.'),
      },
      annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    ({ url, method, body }) =>
      run(async () => {
        const protocol = new URL(url).protocol;
        if (protocol !== 'https:' && protocol !== 'http:') {
          throw new Error('Only http and https URLs are supported');
        }
        const res = await backend.fetchPaid({ url, method: method ?? 'GET', body });
        const truncated = res.body.length > MAX_BODY_CHARS;
        return {
          ...res,
          body: truncated ? res.body.slice(0, MAX_BODY_CHARS) : res.body,
          ...(truncated ? { truncated: true } : {}),
        };
      }),
  );

  server.registerTool(
    'halora_approval_status',
    {
      title: 'Approval status',
      description:
        'Returns the status of an approval request created by halora_pay: pending, approved, rejected, ' +
        'expired or submitted. When it is `approved`, call halora_pay again with the same recipient and ' +
        'amount to complete the payment. A `rejected` or `expired` request is final: do not resubmit ' +
        'it unless the user asks. Read-only.',
      inputSchema: { id: z.string().uuid().describe('Approval id returned by halora_pay.') },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    ({ id }) => run(() => backend.approvalStatus(id)),
  );

  server.registerTool(
    'halora_recent_payments',
    {
      title: 'Recent payments',
      description:
        'Lists the most recent payments made from this wallet, newest first, as indexed from on-chain ' +
        'token transfer events (a payment can take a few seconds to appear). Read-only.',
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional().describe('How many, default 20.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    ({ limit }) => run(async () => ({ payments: await backend.recentPayments(limit ?? 20) })),
  );

  return server;
}
