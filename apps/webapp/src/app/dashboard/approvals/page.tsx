'use client';

import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { ApprovalCard } from '@/components/dashboard/approval-card';
import { PageHeader } from '@/components/dashboard/page-header';
import { Callout, EmptyState, Skeleton, Tabs } from '@/components/ui';
import { useResource } from '@/hooks/use-resource';
import type { AgentOverview, ApprovalRequest } from '@/lib/domain';
import { getDataService } from '@/services';
import { useOwnerSession, useSession } from '@/stores/session';

export default function ApprovalsPage() {
  const owner = useOwnerSession();
  const invalidate = useSession((s) => s.invalidate);
  const [tab, setTab] = useState('pending');
  const approvals = useResource(owner ? `approvals:${owner.publicKey}` : null, () =>
    getDataService().listApprovals(owner!),
  );
  const agents = useResource(owner ? `agents:${owner.publicKey}` : null, () =>
    getDataService().listAgents(owner!),
  );

  const byId = new Map<string, AgentOverview>(
    (agents.data ?? []).map((a) => [a.account.contractId, a]),
  );
  const pending = (approvals.data ?? []).filter((a) => a.status === 'pending');
  const history = (approvals.data ?? []).filter((a) => a.status !== 'pending');

  const list = (items: ApprovalRequest[], emptyTitle: string, emptyBody: string) => {
    if (approvals.loading && !approvals.data) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-64 rounded-[var(--radius-lg)]" />
          <Skeleton className="h-64 rounded-[var(--radius-lg)]" />
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <EmptyState icon={Inbox} title={emptyTitle}>
          {emptyBody}
        </EmptyState>
      );
    }
    return (
      <div className="space-y-4">
        {items.map((a) => {
          const agent = byId.get(a.contractId);
          return (
            <ApprovalCard
              key={a.id}
              approval={a}
              agentLabel={agent?.account.label ?? 'Agent'}
              limits={
                agent
                  ? {
                      spentToday: agent.spentToday,
                      dailyLimit: agent.policy.dailyLimit,
                      paused: agent.policy.paused,
                    }
                  : undefined
              }
              onApprove={async (expiresAt) => {
                await getDataService().approve(owner!, a.id, { expiresAt });
                invalidate();
              }}
              onReject={async (reason) => {
                await getDataService().reject(owner!, a.id, reason);
                invalidate();
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Approvals"
        description="Payments above an agent's approval threshold wait here. Approving signs an on-chain approval for that recipient and amount; the agent's next payment uses it once. Limits still apply."
      />
      {approvals.error && (
        <Callout tone="danger" title="Could not load approvals">
          {approvals.error}
        </Callout>
      )}
      <Tabs
        label="Approval lists"
        value={tab}
        onValueChange={setTab}
        items={[
          {
            id: 'pending',
            label: `Waiting${pending.length ? ` (${pending.length})` : ''}`,
            content: list(
              pending,
              'Nothing waiting for you',
              'When an agent needs your approval, the request appears here.',
            ),
          },
          {
            id: 'history',
            label: 'History',
            content: list(
              history,
              'No decisions yet',
              'Approved, rejected and expired requests appear here.',
            ),
          },
        ]}
      />
    </div>
  );
}
