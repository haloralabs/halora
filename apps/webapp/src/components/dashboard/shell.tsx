'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, LayoutGrid, LogOut, Plus, ReceiptText } from 'lucide-react';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Address, ButtonLink } from '@/components/ui';
import { useResource } from '@/hooks/use-resource';
import { cn } from '@/lib/cn';
import { config } from '@/lib/config';
import { getDataService } from '@/services';
import { useOwnerSession, useSession } from '@/stores/session';
import { ConnectGate } from './connect-gate';

const NAV = [
  { href: '/dashboard', label: 'Agents', icon: LayoutGrid, exact: true },
  { href: '/dashboard/approvals', label: 'Approvals', icon: Bell },
  { href: '/dashboard/payments', label: 'Payments', icon: ReceiptText },
];

function usePendingCount(): number {
  const owner = useOwnerSession();
  const { data } = useResource(owner ? `pending:${owner.publicKey}` : null, () =>
    getDataService().listApprovals(owner!, { status: 'pending' }),
  );
  return data?.length ?? 0;
}

function NavLinks({
  pending,
  orientation,
}: {
  pending: number;
  orientation: 'vertical' | 'horizontal';
}) {
  const pathname = usePathname();
  return (
    <ul className={cn('flex gap-1', orientation === 'vertical' ? 'flex-col' : 'flex-row')}>
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact
          ? pathname === href || pathname.startsWith('/dashboard/agents')
          : pathname.startsWith(href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-surface text-fg shadow-sm ring-1 ring-line'
                  : 'text-muted hover:text-fg',
              )}
            >
              <Icon className={cn('size-4', active && 'text-accent')} aria-hidden />
              {label}
              {label === 'Approvals' && pending > 0 && (
                <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1.5 text-[0.6875rem] font-semibold text-[#1a1305]">
                  {pending}
                  <span className="sr-only"> pending</span>
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function OwnerChip() {
  const { publicKey, disconnect } = useSession();
  if (!publicKey) return null;
  return (
    <div className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-1 pl-3">
      <span className="size-2 rounded-full bg-success" aria-hidden />
      <span className="sr-only">Connected owner</span>
      <Address value={publicKey} copy={false} />
      <button
        type="button"
        onClick={disconnect}
        className="grid size-7 place-items-center rounded-full text-subtle hover:bg-surface-2 hover:text-fg"
        aria-label="Disconnect wallet"
        title="Disconnect"
      >
        <LogOut className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

function MobileDisconnect() {
  const disconnect = useSession((s) => s.disconnect);
  return (
    <button
      type="button"
      onClick={disconnect}
      className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg sm:hidden"
      aria-label="Disconnect wallet"
    >
      <LogOut className="size-4" aria-hidden />
    </button>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const connected = useSession((s) => s.status === 'connected');
  const pending = usePendingCount();
  return (
    <div className="min-h-dvh bg-bg">
      {config.dataMode === 'mock' && (
        <div className="border-b border-line bg-warning-soft px-4 py-2 text-center text-xs font-medium text-warning">
          Demo mode: seeded data in your browser. No network, no real funds.
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Link href="/" aria-label="Halora home" className="rounded-full">
              <Logo size={24} />
            </Link>
            {connected && (
              <nav aria-label="Dashboard" className="hidden md:block">
                <NavLinks pending={pending} orientation="horizontal" />
              </nav>
            )}
          </div>
          <div className="flex items-center gap-2">
            {connected && (
              <ButtonLink
                href="/dashboard/agents/new"
                size="sm"
                icon={<Plus className="size-3.5" aria-hidden />}
                className="hidden sm:inline-flex"
              >
                New agent
              </ButtonLink>
            )}
            <ThemeToggle />
            <div className="hidden sm:block">
              <OwnerChip />
            </div>
            {connected && <MobileDisconnect />}
          </div>
        </div>
        {connected && (
          <nav
            aria-label="Dashboard"
            className="overflow-x-auto border-t border-line/70 px-3 py-2 md:hidden"
          >
            <NavLinks pending={pending} orientation="horizontal" />
          </nav>
        )}
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <ConnectGate>{children}</ConnectGate>
      </main>
    </div>
  );
}
