import Link from 'next/link';
import { ArrowUpRight, Bell } from 'lucide-react';
import { Badge, MeterBar } from '@/components/ui';
import type { AgentOverview } from '@/lib/domain';
import { formatAmount, ratio } from '@/lib/money';
import { truncateMiddle } from '@/lib/format';
import { agentStatus } from './agent-status';

export function AgentCard({ agent }: { agent: AgentOverview }) {
  const { account, policy, spentToday, balance, pendingApprovals } = agent;
  const status = agentStatus(policy);
  const used = ratio(spentToday, policy.dailyLimit);
  return (
    <Link
      href={`/dashboard/agents/${account.contractId}`}
      className="group relative flex flex-col rounded-[var(--radius-lg)] border border-line bg-surface p-5 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-halo sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-fg">{account.label}</h3>
          <p className="mt-0.5 font-mono text-xs text-subtle">
            {truncateMiddle(account.contractId, 6, 4)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
          <ArrowUpRight
            className="size-4 text-subtle transition-colors group-hover:text-accent"
            aria-hidden
          />
        </div>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-subtle">Balance</dt>
          <dd className="tabular mt-0.5 font-display text-2xl text-fg">
            {balance === null ? 'Unavailable' : formatAmount(balance)}
            <span className="ml-1 font-sans text-xs text-subtle">USDC</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-subtle">Spent today</dt>
          <dd className="tabular mt-0.5 font-display text-2xl text-fg">
            {formatAmount(spentToday)}
            <span className="ml-1 font-sans text-xs text-subtle">
              / {formatAmount(policy.dailyLimit)}
            </span>
          </dd>
        </div>
      </dl>
      <MeterBar value={used} label={`${account.label}: daily limit used`} className="mt-4" />
      <div className="mt-4 flex min-h-5 items-center justify-between text-xs text-subtle">
        <span>Per payment up to {formatAmount(policy.perTxLimit)} USDC</span>
        {pendingApprovals > 0 && (
          <span className="inline-flex items-center gap-1 font-medium text-accent">
            <Bell className="size-3.5" aria-hidden />
            {pendingApprovals} waiting
          </span>
        )}
      </div>
    </Link>
  );
}
