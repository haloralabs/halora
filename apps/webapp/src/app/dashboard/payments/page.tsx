'use client';

import { ReceiptText } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader } from '@/components/dashboard/page-header';
import { PaymentsTable } from '@/components/dashboard/payments-table';
import { Callout, Card, EmptyState, Skeleton } from '@/components/ui';
import { useResource } from '@/hooks/use-resource';
import { formatAmount } from '@/lib/money';
import { getDataService } from '@/services';
import { useOwnerSession } from '@/stores/session';

function PaymentsView() {
  const owner = useOwnerSession();
  const router = useRouter();
  const agentFilter = useSearchParams().get('agent') ?? '';
  const agents = useResource(owner ? `agents:${owner.publicKey}` : null, () =>
    getDataService().listAgents(owner!),
  );
  const payments = useResource(owner ? `payments:${agentFilter || 'all'}` : null, () =>
    getDataService().listPayments(owner!, { contractId: agentFilter || undefined, limit: 200 }),
  );
  const labels = Object.fromEntries(
    (agents.data ?? []).map((a) => [a.account.contractId, a.account.label]),
  );
  const total = (payments.data ?? []).reduce((sum, p) => sum + BigInt(p.amount), 0n);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Payments"
        description="Every transfer out of your agent accounts, indexed from the token's transfer events."
        actions={
          <div className="flex flex-col gap-1">
            <label htmlFor="agent-filter" className="text-xs text-subtle">
              Agent
            </label>
            <select
              id="agent-filter"
              value={agentFilter}
              onChange={(e) =>
                router.replace(
                  e.target.value
                    ? `/dashboard/payments?agent=${e.target.value}`
                    : '/dashboard/payments',
                )
              }
              className="min-h-11 min-w-56 rounded-[var(--radius-md)] border border-line-strong bg-surface px-3.5 text-base text-fg focus-visible:border-focus"
            >
              <option value="">All agents</option>
              {(agents.data ?? []).map((a) => (
                <option key={a.account.contractId} value={a.account.contractId}>
                  {a.account.label}
                </option>
              ))}
            </select>
          </div>
        }
      />
      {payments.error && (
        <Callout tone="danger" title="Could not load payments">
          {payments.error}
        </Callout>
      )}
      <Card>
        {payments.data && (
          <p className="border-b border-line px-5 py-4 text-sm text-muted sm:px-6">
            <span className="font-medium text-fg">{payments.data.length}</span> payments,{' '}
            <span className="tabular font-medium text-fg">{formatAmount(total)}</span> USDC in total
          </p>
        )}
        {payments.loading && !payments.data ? (
          <div className="space-y-3 p-6">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : payments.data && payments.data.length === 0 ? (
          <EmptyState icon={ReceiptText} title="No payments yet">
            Payments appear here once an agent spends from its account.
          </EmptyState>
        ) : (
          payments.data && (
            <PaymentsTable payments={payments.data} agentLabels={labels} showAgent={!agentFilter} />
          )
        )}
      </Card>
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-[var(--radius-lg)]" />}>
      <PaymentsView />
    </Suspense>
  );
}
