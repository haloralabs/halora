'use client';

import { Check, Minus, X } from 'lucide-react';
import { useDeferredValue, useId, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import {
  DEMO_EXAMPLES,
  evaluateIntent,
  formatDemoUsdc,
  type DemoVerdict,
} from '@/lib/payment-demo';

const HEADLINE = {
  allowed: 'Allowed',
  approval: 'Waits for your approval',
  denied: 'Denied',
} as const;

const TONE = {
  allowed: 'bg-paper text-carbon',
  approval: 'bg-signal text-carbon',
  denied: 'bg-deny text-white',
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
  const [focused, setFocused] = useState(false);
  const deferred = useDeferredValue(text);
  const verdict = evaluateIntent(deferred);
  const inputId = useId();
  const resultId = useId();

  const inputRef = useRef<HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLSpanElement>(null);
  const [caretX, setCaretX] = useState(0);

  // Places the block caret after the last character when the field is not focused.
  useLayoutEffect(() => {
    const input = inputRef.current;
    const mirror = mirrorRef.current;
    if (!input || !mirror) return;
    setCaretX(Math.min(mirror.offsetWidth, input.clientWidth - 8) - input.scrollLeft);
  }, [text, focused]);

  const replayKey =
    verdict.kind === 'empty' ? 'empty' : `${verdict.kind}-${verdict.code}-${verdict.amount}`;

  return (
    <div className="mx-auto max-w-[1600px] px-4 md:px-8">
      <label htmlFor={inputId} className="sr-only">
        A payment your agent wants to make
      </label>
      <div className="relative" data-reveal style={{ ['--i' as string]: 0 }}>
        <input
          ref={inputRef}
          id={inputId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          name="payment"
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          enterKeyHint="done"
          aria-describedby={resultId}
          data-ui
          className="display block w-full bg-transparent pb-[0.08em] text-[11vw] text-paper caret-signal outline-none placeholder:text-paper/40 md:text-[6.4vw] 2xl:text-[6.5rem]"
          placeholder="2 USDC to Searchwise…"
        />
        <span
          ref={mirrorRef}
          aria-hidden
          className="display invisible absolute top-0 left-0 text-[11vw] whitespace-pre md:text-[6.4vw] 2xl:text-[6.5rem]"
        >
          {text}
        </span>
        {!focused && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-[0.08em] h-[0.78em] w-[0.08em] animate-[caret-blink_1.1s_steps(1)_infinite] bg-signal text-[11vw] md:text-[6.4vw] 2xl:text-[6.5rem]"
            style={{ left: caretX + 6 }}
          />
        )}
        <span
          aria-hidden
          className={cn(
            'absolute right-0 bottom-0 left-0 h-1 origin-left bg-signal transition-transform duration-[var(--t-ui)] ease-[var(--ease-out)]',
            focused ? 'scale-x-100' : 'scale-x-0',
          )}
        />
      </div>

      <div className="mt-10 grid gap-10 md:mt-12 lg:grid-cols-12">
        <div
          id={resultId}
          data-ui
          data-reveal
          style={{ ['--i' as string]: 1 }}
          className="max-w-[560px] rounded-[var(--radius-lg)] bg-carbon-2 p-5 text-paper sm:p-6 lg:col-span-6"
        >
          <p className="text-small text-paper/75">
            Policy: 25 USDC per payment, 100 per day, your approval above 10, 4 allowed recipients.
            41.30 USDC spent today.
          </p>

          <div aria-live="polite" className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            {verdict.kind === 'empty' ? (
              <p className="text-lead font-semibold tracking-[-0.02em] text-paper/80">
                Waiting for a payment
              </p>
            ) : (
              <>
                <p
                  key={replayKey}
                  className={cn(
                    'animate-rise rounded-[var(--radius-md)] px-3 py-1.5 text-lead leading-tight font-semibold tracking-[-0.02em]',
                    TONE[verdict.kind],
                  )}
                >
                  {HEADLINE[verdict.kind]}
                </p>
                <p className="tabular text-body text-paper/85">
                  {formatDemoUsdc(verdict.amount)} to {verdict.recipientLabel}
                </p>
              </>
            )}
          </div>

          {verdict.kind !== 'empty' && (
            <ol key={replayKey} className="mt-5 space-y-2.5" aria-label="Checks, in order">
              {verdict.checks.map((c, i) => (
                <li
                  key={c.id}
                  className="animate-rise flex items-start gap-3"
                  style={{ animationDelay: `${i * 70 + 80}ms` }}
                >
                  <span
                    className={cn(
                      'mt-0.5 grid size-6 shrink-0 place-items-center rounded-[var(--radius-sm)]',
                      c.state === 'pass' && 'bg-allow text-white',
                      c.state === 'fail' && verdict.kind === 'approval' && 'bg-signal text-carbon',
                      c.state === 'fail' && verdict.kind !== 'approval' && 'bg-deny text-white',
                      c.state === 'skip' && 'bg-carbon text-paper/60',
                    )}
                  >
                    {c.state === 'pass' ? (
                      <Check className="size-3.5" aria-hidden />
                    ) : c.state === 'fail' ? (
                      <X className="size-3.5" aria-hidden />
                    ) : (
                      <Minus className="size-3.5" aria-hidden />
                    )}
                    <span className="sr-only">
                      {c.state === 'pass'
                        ? 'Passed'
                        : c.state === 'fail'
                          ? 'Failed'
                          : 'Not checked'}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'block text-body leading-snug',
                        c.state === 'skip' ? 'text-paper/60' : 'text-paper',
                      )}
                    >
                      {c.label}
                    </span>
                    <span className="tabular block text-small text-paper/70">
                      {c.state === 'skip' ? 'Not checked after a failure' : c.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}

          <p className="mt-5 text-body leading-relaxed text-paper">
            {verdict.kind !== 'empty' && verdict.code && (
              <code className="mr-2 rounded-[var(--radius-sm)] bg-carbon px-1.5 py-0.5 font-mono text-small text-signal">
                {verdict.code}
              </code>
            )}
            {explain(verdict, deferred)}
          </p>
        </div>

        <div className="lg:col-span-5 lg:col-start-8 lg:self-end">
          <p data-reveal style={{ ['--i' as string]: 2 }} className="text-body text-paper/80">
            Or try one of these:
          </p>
          <ul className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {DEMO_EXAMPLES.map((example, i) => (
              <li key={example} data-reveal style={{ ['--i' as string]: 3 + i }}>
                <button
                  type="button"
                  onClick={() => {
                    setText(example);
                    inputRef.current?.focus();
                  }}
                  aria-pressed={text === example}
                  className={cn(
                    'min-h-11 rounded-[var(--radius-md)] px-3 text-left text-body transition-[background-color,color,transform] duration-[var(--t-hover)] active:scale-[0.98] lg:px-0 lg:hover:translate-x-1',
                    text === example
                      ? 'bg-signal text-carbon lg:bg-transparent lg:text-signal'
                      : 'bg-carbon-2 text-paper hover:text-signal lg:bg-transparent',
                  )}
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
