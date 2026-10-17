'use client';

import { Bell, Bot, Plus } from 'lucide-react';
import Link from 'next/link';
import { AgentCard } from '@/components/dashboard/agent-card';
import { PageHeader } from '@/components/dashboard/page-header';
import { ButtonLink, Callout, EmptyState, Skeleton, Stat } from '@/components/ui';
import { useResource } from '@/hooks/use-resource';
import { formatDuration, secondsUntilUtcReset } from '@/lib/format';
import { formatAmount } from '@/lib/money';
import { getDataService } from '@/services';
import { useOwnerSession } from '@/stores/session';

export default function DashboardHome() {
  const owner = useOwnerSession();
  const {
    data: agents,
    error,
    loading,
  } = useResource(owner ? `agents:${owner.publicKey}` : null, () =>
    getDataService().listAgents(owner!),
  );

  const totals = (agents ?? []).reduce(
    (acc, a) => ({
      balance: acc.balance + BigInt(a.balance ?? '0'),
      spent: acc.spent + BigInt(a.spentToday),
      pending: acc.pending + a.pendingApprovals,
    }),
    { balance: 0n, spent: 0n, pending: 0 },
  );

  return (
    <div className="space-y-10">
      <PageHeader
        title="Your agents"
        description="Every agent has its own account contract. Its policy is enforced on-chain, so it holds even if the agent is manipulated."
        actions={
          <ButtonLink href="/dashboard/agents/new" icon={<Plus className="size-4" aria-hidden />}>
            New agent wallet
          </ButtonLink>
        }
      />

      {error && (
        <Callout tone="danger" title="Could not load your agents">
          {error}
        </Callout>
      )}

      <dl className="grid grid-cols-1 gap-6 rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-sm sm:grid-cols-3">
        <Stat
          label="Total balance"
          value={agents ? formatAmount(totals.balance) : '...'}
          unit="USDC"
        />
        <Stat
          label="Spent today"
          value={agents ? formatAmount(totals.spent) : '...'}
          unit="USDC"
          hint={`Limits reset in ${formatDuration(secondsUntilUtcReset())} (00:00 UTC)`}
        />
        <Stat
          label="Waiting for you"
          value={agents ? totals.pending : '...'}
          hint={
            totals.pending > 0 ? (
              <Link
                href="/dashboard/approvals"
                className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
              >
                <Bell className="size-3.5" aria-hidden />
                Review approvals
              </Link>
            ) : (
              'No approvals pending'
            )
          }
        />
      </dl>

      <section aria-labelledby="agents-title">
        <h2 id="agents-title" className="sr-only">
          Agent wallets
        </h2>
        {loading && !agents && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-56 rounded-[var(--radius-lg)]" />
            ))}
          </div>
        )}
        {agents && agents.length === 0 && (
          <EmptyState
            icon={Bot}
            title="No agent wallets yet"
            action={
              <ButtonLink
                href="/dashboard/agents/new"
                icon={<Plus className="size-4" aria-hidden />}
              >
                Create your first agent wallet
              </ButtonLink>
            }
          >
            Create a wallet, set its spending rules and hand the agent a key. You stay the owner.
          </EmptyState>
        )}
        {agents && agents.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((a) => (
              <AgentCard key={a.account.contractId} agent={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
