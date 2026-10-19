'use client';

import { Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { HaloField } from '@/components/marketing/halo-field';
import { Button, Callout } from '@/components/ui';
import { config } from '@/lib/config';
import { useSession } from '@/stores/session';

const OWNER_CAN = [
  'Deploy an account contract for each agent',
  'Set and change its spending limits',
  'Approve payments above your threshold',
  'Pause an agent, or take the funds back',
];

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
      <div className="flex flex-col gap-6 rounded-[var(--radius-xl)] border border-line bg-surface p-6 sm:p-8">
        <div className="relative mx-auto aspect-square w-full max-w-[320px]">
          <HaloField className="absolute inset-0 size-full" />
        </div>
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
