'use client';

import Link from 'next/link';
import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { installSnippet } from '@/lib/snippets';

/**
 * The footer is a designed close: on a cobalt field, the way to start is the display line itself,
 * the install command, as one button that copies it.
 */
export function SiteFooter() {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <footer
      data-chapter="cobalt"
      className="chapter-cobalt flex min-h-[80svh] flex-col justify-between px-4 pt-8 pb-6 md:min-h-[90svh] md:px-8 md:pt-10"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-3 text-small md:flex-row md:items-center md:gap-12">
          <Logo size={22} ring="var(--signal)" />
          <p className="max-w-[40ch]">
            Wallets with rules for AI agents, on Stellar. Testnet pilot.
          </p>
          <p className="max-w-[40ch]">Halora never holds your keys.</p>
        </div>
        <a
          href="#main"
          className="min-h-11 self-start whitespace-nowrap underline decoration-2 underline-offset-4 hover:decoration-signal"
        >
          Back to top
        </a>
      </div>

      <div className="mt-24">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(installSnippet());
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
          className="group flex w-full items-end justify-between gap-4 text-left transition-transform duration-[var(--t-press)] active:scale-[0.99]"
          aria-label={`Copy the install command: ${installSnippet()}`}
        >
          <span
            translate="no"
            className="display text-[11.4vw] break-words md:text-[9vw] 2xl:text-[9.5rem]"
          >
            bun add <span className="whitespace-nowrap">@halora/sdk</span>
          </span>
          <span className="mb-[1.2vw] grid size-12 shrink-0 place-items-center rounded-[var(--radius-md)] bg-white text-cobalt transition-colors duration-[var(--t-hover)] group-hover:bg-signal group-hover:text-carbon md:size-16">
            {copied ? (
              <Check className="size-6" aria-hidden />
            ) : (
              <Copy className="size-6" aria-hidden />
            )}
          </span>
        </button>
        <p aria-live="polite" className="sr-only">
          {copied ? 'Install command copied' : ''}
        </p>

        <div className="mt-10 flex flex-col gap-2 text-small md:flex-row md:items-center md:justify-between">
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-1">
            <Link className="min-h-11 content-center hover:underline" href="/dashboard">
              Dashboard
            </Link>
            <a className="min-h-11 content-center hover:underline" href="#developers">
              Developers
            </a>
            <a className="min-h-11 content-center hover:underline" href="#how-it-works">
              How it works
            </a>
          </nav>
          <p>Set in Switzer by the Indian Type Foundry.</p>
          <p>Stellar testnet, 2026</p>
        </div>
      </div>
    </footer>
  );
}
