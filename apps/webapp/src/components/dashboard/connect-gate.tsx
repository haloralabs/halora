'use client';

import { Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { HaloMark } from '@/components/brand/logo';
import { Button, Callout } from '@/components/ui';
import { config } from '@/lib/config';
import { useSession } from '@/stores/session';

/** Renders children only once an owner wallet is connected. */
export function ConnectGate({ children }: { children: ReactNode }) {
  const { status, error, connect } = useSession();
  if (status === 'connected') return <>{children}</>;
  const demo = config.dataMode === 'mock';
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center sm:py-24">
      <div className="relative mb-8 grid size-28 place-items-center">
        <span
          className="halo-ring animate-halo-spin absolute inset-0 rounded-full opacity-40 blur-xl"
          aria-hidden
        />
        <span className="relative grid size-24 place-items-center rounded-full border border-line bg-surface text-fg shadow-md">
          <HaloMark size={52} />
        </span>
      </div>
      <h1 className="font-display text-4xl text-fg">Connect your owner wallet</h1>
      <p className="mt-3 leading-relaxed text-muted">
        {demo
          ? 'You are exploring with demo data. A temporary in-browser key stands in for your wallet, and nothing touches a network.'
          : 'Your wallet is the owner key. It deploys agent accounts, changes policies and approves large payments. Halora never sees your secret key.'}
      </p>
      <Button
        size="lg"
        className="mt-8"
        onClick={connect}
        loading={status === 'connecting'}
        icon={<Wallet className="size-4" aria-hidden />}
      >
        {demo ? 'Connect demo wallet' : 'Connect wallet'}
      </Button>
      {error && (
        <Callout tone="danger" title="The wallet did not connect" className="mt-6 text-left">
          {error}
        </Callout>
      )}
    </div>
  );
}
