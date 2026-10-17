'use client';

import { useEffect, useState } from 'react';

/**
 * The live fragment that sits inside the hero sentence, where a word would be: the halo checking
 * a stream of payments. Sized in em so it scales with the headline. Hover pauses it, it stops on
 * its own after a few loops (WCAG 2.2.2), and it stays still under reduced motion.
 */

const STREAM = [
  { amount: '0.25', to: 'Weatherly', verdict: 'allowed' },
  { amount: '18.00', to: 'MapTile', verdict: 'held' },
  { amount: '0.02', to: 'Searchwise', verdict: 'allowed' },
  { amount: '500.00', to: 'GBX7Q2', verdict: 'denied' },
  { amount: '1.40', to: 'Weatherly', verdict: 'allowed' },
] as const;

const VERDICT_LABEL = { allowed: 'ALLOWED', held: 'HELD', denied: 'DENIED' } as const;
const VERDICT_TONE = {
  allowed: 'text-signal',
  held: 'text-held',
  denied: 'text-deny',
} as const;
const CORE = { allowed: 'var(--aurora)', held: 'var(--held)', denied: 'var(--deny)' } as const;

const MAX_STEPS = STREAM.length * 4;

export function LiveHalo() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let id: number | undefined;
    let steps = 0;
    const start = () => {
      id = window.setInterval(() => {
        steps += 1;
        if (steps > MAX_STEPS) return window.clearInterval(id);
        setI((n) => (n + 1) % STREAM.length);
      }, 1900);
    };
    const onVisibility = () => {
      window.clearInterval(id);
      if (document.visibilityState === 'visible') start();
    };
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [paused]);

  const item = STREAM[i]!;

  return (
    <span
      data-ui
      role="img"
      aria-label="Halora checking a live stream of agent payments"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      className="relative mx-[0.06em] inline-flex h-[0.72em] w-[1.3em] items-center gap-[0.1em] overflow-hidden rounded-[0.08em] border border-night-line-2 bg-night-1 px-[0.1em] align-baseline text-frost md:w-[2.4em]"
    >
      <svg viewBox="0 0 40 40" className="h-[0.48em] w-[0.48em] shrink-0" aria-hidden>
        <circle cx="20" cy="20" r="15" stroke="var(--night-line-2)" strokeWidth="4" fill="none" />
        <g
          className="animate-halo-spin"
          style={{ transformOrigin: '20px 20px', transformBox: 'view-box' }}
        >
          <path
            d="M33.6 12.4A15 15 0 1 1 26.3 6.4"
            stroke="var(--aurora)"
            strokeWidth="4"
            fill="none"
          />
        </g>
        <circle
          cx="20"
          cy="20"
          r="5.5"
          fill={CORE[item.verdict]}
          style={{ transition: 'fill 300ms var(--ease-out)' }}
        />
      </svg>
      <span className="hidden min-w-0 flex-1 flex-col justify-center font-mono text-[0.115em] leading-[1.2] tracking-normal md:flex">
        <span key={`a${i}`} className="animate-rise truncate text-[1.55em] font-medium text-frost">
          {item.amount} USDC
        </span>
        <span key={`b${i}`} className="animate-rise mt-[0.3em] flex items-center gap-[0.6em]">
          <span className="truncate text-mist">to {item.to}</span>
          <span className={`shrink-0 font-semibold ${VERDICT_TONE[item.verdict]}`}>
            {VERDICT_LABEL[item.verdict]}
          </span>
        </span>
      </span>
    </span>
  );
}
