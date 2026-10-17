'use client';

import Link from 'next/link';
import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { installSnippet } from '@/lib/snippets';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '#try', label: 'Try a payment' },
      { href: '#rules', label: 'Rules' },
      { href: '#how-it-works', label: 'How it works' },
    ],
  },
  {
    title: 'Build',
    links: [
      { href: '#developers', label: 'SDK and MCP' },
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/dashboard/agents/new', label: 'New agent wallet' },
    ],
  },
];

/** Footer: Akkuea's column layout, with Halora's install command as the closing line. */
export function SiteFooter() {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <footer className="border-t border-night-line bg-night px-4 pt-16 pb-8 text-frost md:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
          <div className="md:col-span-6">
            <Logo size={24} />
            <p className="mt-4 max-w-[40ch] text-body leading-relaxed text-mist">
              Wallets with rules for AI agents, on Stellar. Testnet pilot. Halora never holds your
              keys.
            </p>
            <p className="mt-6 inline-flex items-center gap-3 rounded-full border border-night-line px-3 py-1.5 font-mono text-[0.8125rem] text-mist">
              <span className="status-dot" aria-hidden />
              Running on Stellar testnet
            </p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title} className="md:col-span-3">
              <p className="font-mono text-[0.8125rem] tracking-[0.08em] text-dim uppercase">
                {col.title}
              </p>
              <ul className="mt-4 space-y-1">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="inline-flex min-h-11 items-center text-body text-mist transition-colors duration-[var(--t-hover)] hover:text-signal"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

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
          aria-label={`Copy the install command: ${installSnippet()}`}
          className="group mt-20 flex w-full items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-night-line bg-night-1 px-5 py-6 text-left transition-[border-color,background-color] duration-[var(--t-hover)] hover:border-signal/50 hover:bg-night-2 md:px-8 md:py-8"
        >
          <span
            translate="no"
            className="font-mono text-[1.25rem] break-all text-frost sm:text-[2rem] md:text-[3rem]"
          >
            <span className="text-signal">$</span> {installSnippet()}
            <span aria-hidden className="animate-blink text-signal">
              _
            </span>
          </span>
          <span className="grid size-12 shrink-0 place-items-center rounded-[var(--radius-md)] border border-night-line-2 text-mist transition-colors duration-[var(--t-hover)] group-hover:border-signal group-hover:text-signal">
            {copied ? (
              <Check className="size-5" aria-hidden />
            ) : (
              <Copy className="size-5" aria-hidden />
            )}
          </span>
        </button>
        <p aria-live="polite" className="sr-only">
          {copied ? 'Install command copied' : ''}
        </p>

        <div className="mt-12 flex flex-col gap-2 border-t border-night-line pt-6 font-mono text-[0.8125rem] text-dim md:flex-row md:justify-between">
          <p>[HALORA_V0.1] Stellar testnet, 2026</p>
          <p>Set in Switzer and JetBrains Mono.</p>
          <a
            href="#main"
            className="inline-flex min-h-11 items-center hover:text-signal md:min-h-0"
          >
            Back to top ↑
          </a>
        </div>
      </div>
    </footer>
  );
}
