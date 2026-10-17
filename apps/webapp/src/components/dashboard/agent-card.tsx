import Link from 'next/link';
import { ArrowUpRight, Bell } from 'lucide-react';
import { ViewTransition } from 'react';
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
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-xl)] border border-line bg-surface p-5 transition-[background-color,border-color,transform] duration-300 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface-2 active:scale-[0.99] sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <ViewTransition name={`agent-title-${account.contractId}`} share="auto" default="none">
            <h3 className="truncate text-xl font-semibold tracking-[-0.03em] text-fg">
              {account.label}
            </h3>
          </ViewTransition>
          <p className="mt-1 font-mono text-[0.8125rem] text-subtle">
            {truncateMiddle(account.contractId, 6, 4)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
          <ArrowUpRight
            className="size-5 text-subtle transition-[color,transform] duration-[var(--t-hover)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg"
            aria-hidden
          />
        </div>
      </div>
      <dl className="mt-8 grid grid-cols-2 gap-4">
        <div>
          <dt className="font-mono text-[0.75rem] tracking-[0.06em] text-subtle uppercase">
            Balance
          </dt>
          <dd className="mt-1.5 font-mono text-[1.5rem] leading-none font-medium tracking-[-0.02em] text-fg">
            {balance === null ? 'Unavailable' : formatAmount(balance)}
            <span className="ml-1 font-sans text-sm font-medium tracking-normal text-subtle">
              USDC
            </span>
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[0.75rem] tracking-[0.06em] text-subtle uppercase">
            Spent today
          </dt>
          <dd className="mt-1.5 font-mono text-[1.5rem] leading-none font-medium tracking-[-0.02em] text-fg">
            {formatAmount(spentToday)}
            <span className="ml-1 font-sans text-sm font-medium tracking-normal text-subtle">
              / {formatAmount(policy.dailyLimit)}
            </span>
          </dd>
        </div>
      </dl>
      <MeterBar value={used} label={`${account.label}: daily limit used`} className="mt-5" />
      <div className="mt-4 flex min-h-6 items-center justify-between text-sm text-subtle">
        <span>Up to {formatAmount(policy.perTxLimit)} USDC per payment</span>
        {pendingApprovals > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-warning-soft px-2 py-0.5 font-mono text-[0.8125rem] font-medium text-warning">
            <Bell className="size-3.5" aria-hidden />
            {pendingApprovals} waiting
          </span>
        )}
      </div>
      <span
        aria-hidden
        className="absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--halo-gold)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
    </Link>
  );
}
