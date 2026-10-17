'use client';

import { useDeferredValue, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import {
  DEMO_EXAMPLES,
  evaluateIntent,
  formatDemoUsdc,
  type DemoVerdict,
} from '@/lib/payment-demo';

/**
 * The live thing: a terminal where the visitor types what an agent wants to pay. The verdict is
 * computed by the real policy checks (`evaluateAgentPayment` from @halora/shared), in the same
 * order as the contract's `__check_auth`.
 */

const VERDICT = {
  allowed: { label: 'ALLOWED', tone: 'bg-signal text-signal-ink' },
  approval: { label: 'HELD FOR OWNER', tone: 'bg-held text-night' },
  denied: { label: 'DENIED', tone: 'bg-deny text-night' },
} as const;

const PERSUASION = /\b(ignore|rules|instruction|override|urgent|now|trust me)\b/i;

function explain(v: DemoVerdict, text: string): string {
  if (v.kind === 'empty')
    return 'Type an amount and a recipient, for example 2 USDC to Searchwise.';
  const persuasion = PERSUASION.test(text)
    ? ' The contract does not read instructions, only the amount and the recipient.'
    : '';
  if (v.kind === 'allowed') {
    return `Settles in about 5 seconds. ${formatDemoUsdc(v.remainingToday ?? 0n)} left today.${persuasion}`;
  }
  if (v.kind === 'approval') {
    return `Held until you approve this recipient and amount from your dashboard.${persuasion}`;
  }
  return `Refused by the account contract. No funds moved.${persuasion}`;
}

export function VerdictDemo() {
  const [text, setText] = useState(DEMO_EXAMPLES[0]!);
  const deferred = useDeferredValue(text);
  const verdict = evaluateIntent(deferred);
  const inputId = useId();
  const resultId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const replayKey =
    verdict.kind === 'empty' ? 'empty' : `${verdict.kind}-${verdict.code}-${verdict.amount}`;

  return (
    <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
      <div
        data-ui
        data-reveal
        style={{ ['--i' as string]: 3 }}
        className="overflow-hidden rounded-[var(--radius-lg)] border border-night-line bg-night-1 lg:col-span-8"
      >
        <div className="flex items-center justify-between gap-3 border-b border-night-line px-4 py-3 font-mono text-[0.8125rem] text-mist">
          <span className="flex items-center gap-2">
            <span aria-hidden className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-night-line-2" />
              <span className="size-2.5 rounded-full bg-night-line-2" />
              <span className="size-2.5 rounded-full bg-signal" />
            </span>
            <span className="ml-2">halora / policy-check</span>
          </span>
          <span className="hidden items-center gap-2 sm:flex">
            <span className="status-dot" aria-hidden />
            halora-account
          </span>
        </div>

        <div className="p-4 sm:p-6">
          <p className="font-mono text-[0.8125rem] leading-relaxed text-mist">
            <span className="text-dim">policy</span> per_tx=25 daily=100 approval&gt;10 allowlist=4
            spent_today=41.30
          </p>

          <label htmlFor={inputId} className="sr-only">
            A payment your agent wants to make
          </label>
          <div className="mt-5 flex items-center gap-3 rounded-[var(--radius-md)] border border-night-line-2 bg-night px-4 py-3 transition-[border-color,box-shadow] duration-[var(--t-hover)] focus-within:border-signal focus-within:shadow-[0_0_0_3px_rgb(45_245_180/0.15)]">
            <span aria-hidden className="font-mono text-[1.25rem] text-signal sm:text-[1.5rem]">
              &gt;
            </span>
            <input
              ref={inputRef}
              id={inputId}
              name="payment"
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              enterKeyHint="done"
              aria-describedby={resultId}
              placeholder="2 USDC to Searchwise…"
              className="min-w-0 flex-1 bg-transparent font-mono text-[1.125rem] text-frost caret-signal outline-none placeholder:text-dim sm:text-[1.5rem]"
            />
          </div>

          <div id={resultId} aria-live="polite" className="mt-6">
            {verdict.kind === 'empty' ? (
              <p className="font-mono text-[0.9375rem] text-mist">
                waiting for a payment<span className="animate-blink">_</span>
              </p>
            ) : (
              <>
                <ol key={replayKey} className="space-y-2.5 font-mono" aria-label="Checks, in order">
                  {verdict.checks.map((c, i) => {
                    const status =
                      c.state === 'pass'
                        ? { text: 'PASS', tone: 'text-signal' }
                        : c.state === 'skip'
                          ? { text: 'SKIP', tone: 'text-dim' }
                          : verdict.kind === 'approval'
                            ? { text: 'HELD', tone: 'text-held' }
                            : { text: 'FAIL', tone: 'text-deny' };
                    return (
                      <li
                        key={c.id}
                        className="animate-rise flex items-baseline gap-3 text-[0.875rem] sm:text-[0.9375rem]"
                        style={{ animationDelay: `${i * 80 + 60}ms` }}
                      >
                        <span className="text-dim">[{String(i + 1).padStart(2, '0')}]</span>
                        <span className="min-w-0">
                          <span className={c.state === 'skip' ? 'text-dim' : 'text-frost'}>
                            {c.label}
                          </span>
                          <span className="block text-[0.8125rem] text-mist">
                            {c.state === 'skip' ? 'not checked after a failure' : c.detail}
                          </span>
                        </span>
                        <span
                          aria-hidden
                          className="mx-1 hidden flex-1 self-center border-b border-dotted border-night-line-2 sm:block"
                        />
                        <span className={cn('ml-auto shrink-0 font-semibold', status.tone)}>
                          {status.text}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-night-line pt-5">
                  <span
                    key={replayKey}
                    className={cn(
                      'animate-rise rounded-[var(--radius-sm)] px-2.5 py-1 font-mono text-[0.875rem] font-semibold',
                      VERDICT[verdict.kind].tone,
                    )}
                  >
                    {VERDICT[verdict.kind].label}
                  </span>
                  <span className="font-mono text-[0.9375rem] text-frost">
                    {formatDemoUsdc(verdict.amount)} to {verdict.recipientLabel}
                  </span>
                  {verdict.code && (
                    <code className="font-mono text-[0.8125rem] text-mist">{verdict.code}</code>
                  )}
                </div>
              </>
            )}
            <p className="mt-4 text-body leading-relaxed text-mist">{explain(verdict, deferred)}</p>
          </div>
        </div>
      </div>

      <div className="lg:col-span-4">
        <p data-reveal style={{ ['--i' as string]: 4 }} className="term-label">
          Try one
        </p>
        <ul className="mt-4 grid gap-2">
          {DEMO_EXAMPLES.map((example, i) => (
            <li key={example} data-reveal style={{ ['--i' as string]: 5 + i }}>
              <button
                type="button"
                onClick={() => {
                  setText(example);
                  inputRef.current?.focus();
                }}
                aria-pressed={text === example}
                className={cn(
                  'group flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-md)] border px-4 text-left font-mono text-[0.875rem] transition-[border-color,background-color,color,transform] duration-[var(--t-hover)] active:scale-[0.99]',
                  text === example
                    ? 'border-signal/60 bg-signal/10 text-frost'
                    : 'border-night-line bg-night-1 text-mist hover:border-night-line-2 hover:text-frost',
                )}
              >
                <span aria-hidden className="text-signal">
                  &gt;
                </span>
                {example}
              </button>
            </li>
          ))}
        </ul>
        <p
          data-reveal
          style={{ ['--i' as string]: 9 }}
          className="mt-6 text-small leading-relaxed text-mist"
        >
          The last example is a prompt injection. The agent may believe it. The contract only sees
          an unknown recipient.
        </p>
      </div>
    </div>
  );
}
