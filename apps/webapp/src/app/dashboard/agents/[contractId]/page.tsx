'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Bell, Plug, ReceiptText, SlidersHorizontal } from 'lucide-react';
import { useState, ViewTransition, type ReactNode } from 'react';
import { agentStatus } from '@/components/dashboard/agent-status';
import { PageHeader } from '@/components/dashboard/page-header';
import { PaymentsTable } from '@/components/dashboard/payments-table';
import { PreApprovalsPanel } from '@/components/dashboard/pre-approvals-panel';
import {
  Address,
  Badge,
  ButtonLink,
  Callout,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  HaloMeter,
  Skeleton,
  Switch,
} from '@/components/ui';
import { useResource } from '@/hooks/use-resource';
import { formatDate, formatDuration, secondsUntilUtcReset, truncateMiddle } from '@/lib/format';
import { formatAmount, ratio, subtractFloor } from '@/lib/money';
import { describeApprovalRule } from '@/lib/policy';
import { getDataService } from '@/services';
import { useOwnerSession, useSession } from '@/stores/session';

export default function AgentPage() {
  const { contractId } = useParams<{ contractId: string }>();
  const owner = useOwnerSession();
  const invalidate = useSession((s) => s.invalidate);
  const agent = useResource(owner ? `agent:${contractId}` : null, () =>
    getDataService().getAgent(owner!, contractId),
  );
  const payments = useResource(owner ? `payments:${contractId}` : null, () =>
    getDataService().listPayments(owner!, { contractId, limit: 8 }),
  );
  const [pausing, setPausing] = useState(false);
  const [pauseError, setPauseError] = useState<string | null>(null);

  if (agent.loading && !agent.data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-72" />
        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <Skeleton className="h-80 rounded-[var(--radius-lg)]" />
          <Skeleton className="h-80 rounded-[var(--radius-lg)]" />
        </div>
      </div>
    );
  }
  if (agent.error)
    return (
      <Callout tone="danger" title="Could not load this agent">
        {agent.error}
      </Callout>
    );
  if (!agent.data) {
    return (
      <EmptyState
        icon={SlidersHorizontal}
        title="Agent wallet not found"
        action={
          <ButtonLink href="/dashboard" variant="secondary">
            Back to your agents
          </ButtonLink>
        }
      >
        It may belong to a different owner wallet, or it was never registered.
      </EmptyState>
    );
  }

  const { account, policy, spentToday, balance, pendingApprovals } = agent.data;
  const status = agentStatus(policy);
  const remaining = subtractFloor(policy.dailyLimit, spentToday);

  const togglePause = async (paused: boolean) => {
    if (!owner) return;
    setPausing(true);
    setPauseError(null);
    try {
      await getDataService().setPaused(owner, contractId, paused);
      invalidate();
    } catch (err) {
      setPauseError(err instanceof Error ? err.message : 'The change was not signed.');
    } finally {
      setPausing(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 hover:text-fg">
            <ArrowLeft className="size-3.5" aria-hidden />
            All agents
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            <ViewTransition name={`agent-title-${contractId}`} share="auto" default="none">
              <span>{account.label}</span>
            </ViewTransition>
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              Account <Address value={account.contractId} head={6} />
            </span>
            <span className="inline-flex items-center gap-1.5">
              Agent key <Address value={account.agentPublicKey} />
            </span>
          </span>
        }
        actions={
          <>
            <ButtonLink
              href={`/dashboard/agents/${contractId}/policy`}
              variant="secondary"
              icon={<SlidersHorizontal className="size-4" aria-hidden />}
            >
              Edit policy
            </ButtonLink>
            <ButtonLink
              href={`/dashboard/agents/${contractId}/connect`}
              icon={<Plug className="size-4" aria-hidden />}
            >
              Connect agent
            </ButtonLink>
          </>
        }
      />

      {pendingApprovals > 0 && (
        <Callout
          tone="warning"
          title={`${pendingApprovals} payment${pendingApprovals > 1 ? 's' : ''} waiting for your approval`}
        >
          <Link
            href="/dashboard/approvals"
            className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
          >
            <Bell className="size-3.5" aria-hidden /> Open the approval inbox
          </Link>
        </Callout>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <Card className="relative overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle>Today</CardTitle>
              <CardDescription>
                Resets in {formatDuration(secondsUntilUtcReset())}, at 00:00 UTC.
              </CardDescription>
            </div>
          </CardHeader>
          <CardBody className="flex flex-col items-center gap-6 sm:flex-row sm:items-center lg:flex-col xl:flex-row">
            <HaloMeter
              value={ratio(spentToday, policy.dailyLimit)}
              label="Daily limit used"
              valueText={`${formatAmount(spentToday)} of ${formatAmount(policy.dailyLimit)} USDC spent today`}
            >
              <div>
                <p className="font-mono text-[1.75rem] leading-none font-medium tracking-[-0.02em] text-fg">
                  {formatAmount(spentToday)}
                </p>
                <p className="mt-1.5 text-sm text-subtle">
                  of {formatAmount(policy.dailyLimit)} USDC
                </p>
              </div>
            </HaloMeter>
            <dl className="grid w-full grid-cols-2 gap-x-6 gap-y-5 xl:grid-cols-1">
              <div>
                <dt className="font-mono text-[0.75rem] tracking-[0.06em] text-subtle uppercase">
                  Balance
                </dt>
                <dd className="mt-1.5 font-mono text-[1.5rem] leading-none font-medium tracking-[-0.02em] text-fg">
                  {balance === null ? 'Unavailable' : formatAmount(balance)}{' '}
                  <span className="text-sm font-medium tracking-normal text-subtle">USDC</span>
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[0.75rem] tracking-[0.06em] text-subtle uppercase">
                  Left today
                </dt>
                <dd className="mt-1.5 font-mono text-[1.5rem] leading-none font-medium tracking-[-0.02em] text-fg">
                  {formatAmount(remaining)}{' '}
                  <span className="text-sm font-medium tracking-normal text-subtle">USDC</span>
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Policy</CardTitle>
              <CardDescription>{describeApprovalRule(policy)}</CardDescription>
            </div>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              <PolicyRow
                label="Per payment limit"
                value={`${formatAmount(policy.perTxLimit)} USDC`}
              />
              <PolicyRow label="Daily limit" value={`${formatAmount(policy.dailyLimit)} USDC`} />
              <PolicyRow
                label="Approval above"
                value={`${formatAmount(policy.approvalThreshold)} USDC`}
              />
              <PolicyRow
                label="Token"
                value={
                  <span className="font-mono text-[0.8125rem]">
                    USDC {truncateMiddle(policy.token)}
                  </span>
                }
              />
              <PolicyRow
                label="Recipients"
                value={
                  policy.allowlistEnabled
                    ? `Allowlist, ${policy.allowlist.length} address${policy.allowlist.length === 1 ? '' : 'es'}`
                    : 'Any address'
                }
              />
              <PolicyRow
                label="Expires"
                value={policy.expiresAt > 0 ? formatDate(policy.expiresAt) : 'Never'}
              />
            </dl>
            <div className="mt-6 border-t border-line pt-5">
              <Switch
                tone="danger"
                label={policy.paused ? 'Agent paused' : 'Pause agent'}
                description="Signed with your wallet. While paused the contract rejects every agent payment."
                checked={policy.paused}
                disabled={pausing}
                onCheckedChange={togglePause}
              />
              {pauseError && (
                <Callout tone="danger" className="mt-4">
                  {pauseError}
                </Callout>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recent payments</CardTitle>
              <CardDescription>
                Indexed from the token transfer events of this account.
              </CardDescription>
            </div>
            <ButtonLink
              href={`/dashboard/payments?agent=${contractId}`}
              variant="ghost"
              size="sm"
              icon={<ReceiptText className="size-3.5" aria-hidden />}
            >
              All payments
            </ButtonLink>
          </CardHeader>
          <div className="mt-4 border-t border-line">
            {payments.data && payments.data.length > 0 ? (
              <PaymentsTable payments={payments.data} />
            ) : payments.loading ? (
              <div className="space-y-3 p-6">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : (
              <p className="px-6 py-10 text-center text-sm text-muted">
                No payments yet. Fund the account and connect your agent.
              </p>
            )}
          </div>
        </Card>
        <PreApprovalsPanel contractId={contractId} />
      </div>
    </div>
  );
}

function PolicyRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/70 pb-3 sm:block sm:border-0 sm:pb-0">
      <dt className="font-mono text-[0.75rem] tracking-[0.06em] text-subtle uppercase">{label}</dt>
      <dd className="tabular font-medium text-fg sm:mt-0.5">{value}</dd>
    </div>
  );
}
