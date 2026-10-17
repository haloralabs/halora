'use client';

import { useEffect, useState } from 'react';

/**
 * What Halora is built with, written as one sentence. The names are dimmed so the block reads as
 * texture; one name at a time is lit and the light moves through the list. These are the real
 * building blocks of the product, not customers.
 */

const NAMES = ['Stellar', 'Soroban', 'USDC', 'x402', 'the Model Context Protocol', 'Freighter'];

export function BuiltWith() {
  const [lit, setLit] = useState(0);

  const [paused, setPaused] = useState(false);

  // Cycles through the list three times, then rests on the first name (WCAG 2.2.2: ambient motion
  // stops on its own). Hover or focus pauses it; reduced motion keeps it still.
  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let steps = 0;
    const id = window.setInterval(() => {
      steps += 1;
      if (steps > NAMES.length * 3) {
        window.clearInterval(id);
        setLit(0);
        return;
      }
      setLit((n) => (n + 1) % NAMES.length);
    }, 2000);
    return () => window.clearInterval(id);
  }, [paused]);

  return (
    <section
      id="stellar"
      data-chapter="signal"
      data-reveal-root
      aria-labelledby="built-title"
      className="chapter-signal scroll-mt-0 px-4 py-32 md:px-8 md:py-48"
    >
      <h2 id="built-title" className="sr-only">
        Built with
      </h2>
      <p
        data-reveal
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
        className="max-w-[34ch] text-[1.5rem] leading-[1.15] font-semibold tracking-[-0.03em] md:text-[2rem]"
      >
        Built with{' '}
        {NAMES.map((name, i) => (
          <span key={name}>
            <span
              className={
                i === lit
                  ? 'text-carbon transition-colors duration-[400ms]'
                  : 'text-signal-deep transition-colors duration-[400ms]'
              }
            >
              {name}
            </span>
            {i < NAMES.length - 2 ? ', ' : i === NAMES.length - 2 ? ' and ' : '.'}
          </span>
        ))}
      </p>
      <p
        data-reveal
        style={{ ['--i' as string]: 1 }}
        className="mt-10 max-w-[52ch] text-body leading-relaxed"
      >
        On Stellar a payment for a single API call still makes sense: fees are a fraction of a cent
        and payments settle in about 5 seconds. Halora never holds your keys, and it does not stop
        an agent key from leaking. It limits what a leaked or manipulated key can spend.
      </p>
    </section>
  );
}
