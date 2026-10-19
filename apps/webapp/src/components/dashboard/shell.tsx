'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, LayoutGrid, LogOut, Plus, ReceiptText } from 'lucide-react';
import { ViewTransition, type ReactNode } from 'react';
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

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact
    ? pathname === href || pathname.startsWith('/dashboard/agents')
    : pathname.startsWith(href);
}

function PendingCount({ pending }: { pending: number }) {
  if (pending <= 0) return null;
  return (
    <span className="tabular grid h-5 min-w-5 place-items-center rounded-[var(--radius-sm)] bg-held px-1 font-mono text-[0.75rem] font-semibold text-night">
      {pending}
      <span className="sr-only"> pending</span>
    </span>
  );
}

/**
 * Desktop tabs. The signal bar under the active tab is one shared element: on navigation it
 * travels to the new tab instead of blinking.
 */
function DesktopNav({ pending }: { pending: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="hidden md:block">
      <ul className="flex h-16 items-stretch gap-1">
        {NAV.map(({ href, label, exact }) => {
          const active = isActive(pathname, href, exact);
          return (
            <li key={href} className="relative flex">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 px-3 text-[0.9375rem] font-medium transition-colors duration-[var(--t-hover)]',
                  active ? 'text-fg' : 'text-muted hover:text-fg',
                )}
              >
                {label}
                {label === 'Approvals' && <PendingCount pending={pending} />}
              </Link>
              {active && (
                <ViewTransition name="nav-indicator" share="auto" default="none">
                  <span
                    aria-hidden
                    className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-[2px] bg-signal"
                  />
                </ViewTransition>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Phone: a bottom tab bar within thumb reach, clear of the home indicator. */
function MobileTabBar({ pending }: { pending: number }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Dashboard"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="grid grid-cols-4">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(pathname, href, exact);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-16 flex-col items-center justify-center gap-1 text-[0.75rem] font-medium transition-colors duration-[var(--t-hover)] active:scale-95',
                  active ? 'text-fg' : 'text-subtle',
                )}
              >
                {active && (
                  <span aria-hidden className="absolute inset-x-6 top-0 h-[3px] bg-signal" />
                )}
                <span className="relative">
                  <Icon className="size-5" aria-hidden />
                  {label === 'Approvals' && pending > 0 && (
                    <span className="absolute -top-1.5 -right-3">
                      <PendingCount pending={pending} />
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href="/dashboard/agents/new"
            className="flex min-h-16 flex-col items-center justify-center gap-1 text-[0.75rem] font-medium text-subtle active:scale-95"
          >
            <span className="grid size-6 place-items-center rounded-[var(--radius-sm)] bg-signal text-signal-ink">
              <Plus className="size-4" aria-hidden />
            </span>
            New agent
          </Link>
        </li>
      </ul>
    </nav>
  );
}

function OwnerChip() {
  const { publicKey, disconnect } = useSession();
  if (!publicKey) return null;
  return (
    <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-line bg-surface py-1 pr-1 pl-3">
      <span className="relative mr-1 flex size-2" aria-hidden>
        <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
        <span className="relative size-2 rounded-full bg-success" />
      </span>
      <span className="sr-only">Connected owner</span>
      <Address value={publicKey} copy={false} />
      <button
        type="button"
        onClick={disconnect}
        className="grid size-9 place-items-center rounded-[var(--radius-sm)] text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
        aria-label="Disconnect wallet"
        title="Disconnect"
      >
        <LogOut className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const connected = useSession((s) => s.status === 'connected');
  const disconnect = useSession((s) => s.disconnect);
  const pending = usePendingCount();
  const pathname = usePathname();

  return (
    <div className="relative isolate min-h-dvh bg-bg">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_70%_60%_at_50%_-10%,var(--halo-glow),transparent_70%)] opacity-60"
      />
      {config.dataMode === 'mock' && (
        <p className="flex items-center justify-center gap-2.5 border-b border-line bg-surface px-4 py-2 text-center font-mono text-[0.75rem] tracking-[0.06em] text-muted uppercase">
          <span className="size-1.5 shrink-0 rounded-full bg-held" aria-hidden />
          Demo mode: seeded data in your browser. No network, no real funds.
        </p>
      )}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Link href="/" aria-label="Halora home" className="flex min-h-11 items-center text-fg">
              <Logo size={24} />
            </Link>
            {connected && <DesktopNav pending={pending} />}
          </div>
          <div className="flex items-center gap-2">
            {connected && (
              <div className="hidden md:block">
                <ButtonLink
                  href="/dashboard/agents/new"
                  size="sm"
                  icon={<Plus className="size-4" aria-hidden />}
                >
                  New agent
                </ButtonLink>
              </div>
            )}
            <ThemeToggle />
            <div className="hidden sm:block">
              <OwnerChip />
            </div>
            {connected && (
              <button
                type="button"
                onClick={disconnect}
                className="grid size-11 place-items-center rounded-[var(--radius-md)] text-muted hover:bg-surface-2 hover:text-fg sm:hidden"
                aria-label="Disconnect wallet"
              >
                <LogOut className="size-5" aria-hidden />
              </button>
            )}
          </div>
        </div>
      </header>
      <main
        id="main"
        className={cn(
          'mx-auto max-w-7xl px-4 pt-6 pb-12 sm:px-6 sm:pt-10',
          connected && 'pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-16',
        )}
      >
        <ConnectGate>
          <ViewTransition key={pathname} default="none" enter="page-enter" exit="page-exit">
            <div>{children}</div>
          </ViewTransition>
        </ConnectGate>
      </main>
      {connected && <MobileTabBar pending={pending} />}
    </div>
  );
}
