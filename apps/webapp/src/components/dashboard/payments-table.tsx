import { ArrowUpRight, Globe, Send } from 'lucide-react';
import { Address, Badge } from '@/components/ui';
import { config } from '@/lib/config';
import type { PaymentRecord } from '@/lib/domain';
import { formatDateTime, formatRelative, truncateMiddle } from '@/lib/format';
import { formatAmount } from '@/lib/money';

function explorerTx(hash: string) {
  const net = config.network === 'mainnet' ? 'public' : 'testnet';
  return `https://stellar.expert/explorer/${net}/tx/${hash}`;
}

function resourceLabel(resource: string): string {
  try {
    const url = new URL(resource);
    return `${url.host}${url.pathname}`;
  } catch {
    return resource;
  }
}

/**
 * Payment log. A table on wide screens, stacked rows on phones. Explorer links only appear in
 * live mode, since demo hashes do not exist on any network.
 */
export function PaymentsTable({
  payments,
  agentLabels,
  showAgent = false,
}: {
  payments: PaymentRecord[];
  agentLabels?: Record<string, string>;
  showAgent?: boolean;
}) {
  const live = config.dataMode === 'live';
  return (
    <div className="overflow-hidden">
      <table className="w-full text-sm">
        <caption className="sr-only">Payments, newest first</caption>
        <thead className="hidden text-left text-xs text-subtle md:table-header-group">
          <tr className="border-b border-line">
            <th scope="col" className="px-5 py-3 font-medium sm:px-6">
              Payment
            </th>
            {showAgent && (
              <th scope="col" className="px-3 py-3 font-medium">
                Agent
              </th>
            )}
            <th scope="col" className="px-3 py-3 font-medium">
              Recipient
            </th>
            <th scope="col" className="px-3 py-3 text-right font-medium">
              Amount
            </th>
            <th scope="col" className="px-5 py-3 text-right font-medium sm:px-6">
              When
            </th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr
              key={p.id}
              className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-b border-line px-5 py-4 last:border-0 md:table-row md:p-0"
            >
              <td className="min-w-0 md:px-5 md:py-3.5 md:sm:px-6">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-surface-2">
                    {p.source === 'x402' ? (
                      <Globe className="size-3.5 text-accent" aria-hidden />
                    ) : (
                      <Send className="size-3.5 text-muted" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fg" title={p.resource}>
                      {p.resource ? resourceLabel(p.resource) : 'Direct payment'}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-subtle">
                      <Badge
                        tone={p.source === 'x402' ? 'gold' : 'neutral'}
                        className="h-5 px-2 text-[0.6875rem]"
                      >
                        {p.source === 'x402' ? 'x402' : 'direct'}
                      </Badge>
                      {live ? (
                        <a
                          href={explorerTx(p.txHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-0.5 font-mono hover:text-fg"
                        >
                          {truncateMiddle(p.txHash, 6, 4)}
                          <ArrowUpRight className="size-3" aria-hidden />
                          <span className="sr-only">(opens Stellar Expert)</span>
                        </a>
                      ) : (
                        <span className="font-mono">{truncateMiddle(p.txHash, 6, 4)}</span>
                      )}
                    </p>
                  </div>
                </div>
              </td>
              {showAgent && (
                <td className="col-span-2 text-xs text-muted md:col-span-1 md:px-3 md:py-3.5 md:text-sm">
                  {agentLabels?.[p.contractId] ?? truncateMiddle(p.contractId)}
                </td>
              )}
              <td className="col-span-2 md:col-span-1 md:px-3 md:py-3.5">
                <Address value={p.to} />
              </td>
              <td className="row-start-1 text-right md:row-auto md:px-3 md:py-3.5">
                <span className="tabular font-medium text-fg">{formatAmount(p.amount)}</span>
                <span className="ml-1 text-xs text-subtle">USDC</span>
              </td>
              <td className="col-start-2 row-start-2 text-right text-xs text-subtle md:col-auto md:row-auto md:px-5 md:py-3.5 md:sm:px-6">
                <span title={formatDateTime(p.createdAt)}>{formatRelative(p.createdAt)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
