'use client';

import { useEffect, useState } from 'react';

/**
 * What Halora is built with, written as one sentence. The names are dimmed so the block reads as
 * texture; one at a time is lit in aurora and the light moves through the list. These are the
 * real building blocks of the product, not customers.
 */

const NAMES = ['Stellar', 'Soroban', 'USDC', 'x402', 'the Model Context Protocol', 'Freighter'];

export function BuiltWith() {
  const [lit, setLit] = useState(0);
  const [paused, setPaused] = useState(false);

  // Cycles three times, then rests (WCAG 2.2.2). Hover pauses it; reduced motion keeps it still.
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
      data-reveal-root
      aria-labelledby="built-title"
      className="relative overflow-hidden border-y border-night-line bg-night-1 px-4 py-28 text-frost md:px-8 md:py-36"
    >
      <div aria-hidden className="stars absolute inset-0 opacity-60" />
      <div className="relative mx-auto max-w-[1400px]">
        <p data-reveal className="term-label">
          <span>
            <span className="text-signal">[05]</span> Built on Stellar
          </span>
        </p>
        <h2 id="built-title" className="sr-only">
          Built with
        </h2>
        <p
          data-reveal
          style={{ ['--i' as string]: 1 }}
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          className="mt-6 max-w-[30ch] text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.03em] md:text-[2rem]"
        >
          Built with{' '}
          {NAMES.map((name, i) => (
            <span key={name}>
              <span
                className={
                  i === lit
                    ? 'text-signal transition-colors duration-[400ms]'
                    : 'text-dim transition-colors duration-[400ms]'
                }
              >
                {name}
              </span>
              {i < NAMES.length - 2 ? ', ' : i === NAMES.length - 2 ? ' and ' : '.'}
            </span>
          ))}
        </p>
        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
          <p
            data-reveal
            style={{ ['--i' as string]: 2 }}
            className="max-w-[52ch] text-body leading-relaxed text-mist"
          >
            On Stellar a payment for a single API call still makes sense: fees are a fraction of a
            cent and payments settle in about 5 seconds.
          </p>
          <p
            data-reveal
            style={{ ['--i' as string]: 3 }}
            className="max-w-[52ch] text-body leading-relaxed text-mist"
          >
            <span className="text-frost">What Halora does not do.</span> It never holds your keys,
            and it does not stop an agent key from leaking. It limits what a leaked or manipulated
            key can spend.
          </p>
        </div>
      </div>
    </section>
  );
}
