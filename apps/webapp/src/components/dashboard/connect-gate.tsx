'use client';

import { Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, Callout } from '@/components/ui';
import { config } from '@/lib/config';
import { useSession } from '@/stores/session';

const OWNER_CAN = [
  'Deploy an account contract for each agent',
  'Set and change its spending limits',
  'Approve payments above your threshold',
  'Pause an agent, or take the funds back',
];

/** A large, live halo: the policy ring turning around the agent core. */
function HaloDial() {
  return (
    <svg viewBox="0 0 200 200" className="size-40 sm:size-56" aria-hidden>
      <circle cx="100" cy="100" r="84" fill="none" stroke="var(--surface-2)" strokeWidth="18" />
      <g
        className="animate-halo-spin"
        style={{ transformOrigin: '100px 100px', transformBox: 'view-box' }}
      >
        <path
          d="M171 55A84 84 0 1 1 136 24"
          fill="none"
          stroke="var(--halo-gold)"
          strokeWidth="18"
        />
      </g>
      <circle cx="100" cy="100" r="28" fill="var(--fg)" />
    </svg>
  );
}

/** Renders children only once an owner wallet is connected. */
export function ConnectGate({ children }: { children: ReactNode }) {
  const { status, error, connect } = useSession();
  if (status === 'connected') return <>{children}</>;
  const demo = config.dataMode === 'mock';
  return (
    <div className="grid items-center gap-10 py-8 sm:py-16 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
      <div className="animate-rise">
        <h1 className="max-w-[12ch] text-[3rem] leading-[0.95] font-semibold tracking-[-0.045em] text-fg sm:text-[4.5rem]">
          Connect your owner wallet.
        </h1>
        <p className="mt-6 max-w-[48ch] text-lg leading-relaxed text-muted">
          {demo
            ? 'You are exploring with demo data. A temporary in-browser key stands in for your wallet, and nothing touches a network.'
            : 'Your wallet is the owner key. Halora never sees your secret key: every change is signed in your wallet.'}
        </p>
        <Button
          size="lg"
          className="mt-8 w-full sm:w-auto"
          onClick={connect}
          loading={status === 'connecting'}
          icon={<Wallet className="size-5" aria-hidden />}
        >
          {demo ? 'Connect demo wallet' : 'Connect wallet'}
        </Button>
        {error && (
          <Callout tone="danger" title="The wallet did not connect" className="mt-6">
            {error}
          </Callout>
        )}
      </div>
      <div className="flex flex-col gap-8 rounded-[var(--radius-xl)] bg-surface p-6 sm:flex-row sm:items-center sm:p-8 lg:flex-col lg:items-start">
        <HaloDial />
        <div>
          <h2 className="text-base font-semibold text-fg">With the owner key you can</h2>
          <ul className="mt-3 space-y-2.5">
            {OWNER_CAN.map((item, i) => (
              <li
                key={item}
                className="animate-rise flex gap-3 text-base text-muted"
                style={{ animationDelay: `${i * 80 + 200}ms` }}
              >
                <span aria-hidden className="mt-2 size-2 shrink-0 bg-signal" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
