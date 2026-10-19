import { ArrowDown, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { HaloField } from './halo-field';
import { LiveHalo } from './live-halo';
import { PaymentTicker } from './payment-ticker';

/**
 * Hero: a night sky (twinkling stars, a fading grid, a slow aurora with scroll parallax) over a
 * three-line sentence, with the halo field beside it: payments leaving the agent and meeting the
 * policy ring. The live halo also sits inside the first line, where the account contract sits.
 */

const FACTS = [
  { value: '~5s', label: 'Settlement on Stellar' },
  { value: '<$0.01', label: 'Network fee per payment' },
  { value: '0', label: 'Keys held by Halora' },
];

export function Hero() {
  return (
    <section
      data-reveal-root
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-night text-frost"
    >
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="stars absolute inset-0 opacity-80" />
        <div className="stars-twinkle absolute inset-0" />
        <div className="grid-night absolute inset-0 opacity-60" />
        <div className="aurora parallax-aurora">
          <span />
          <span />
          <span />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-night" />
      </div>

      <div className="hero-exit mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-1 items-center gap-10 px-4 pt-28 pb-14 md:px-8 md:pt-36 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-7">
          <p
            data-reveal
            className="inline-flex w-fit items-center gap-3 rounded-full border border-night-line bg-night-1/70 px-4 py-2 font-mono text-[0.8125rem] tracking-[0.08em] text-mist uppercase backdrop-blur"
          >
            <span className="status-dot animate-pulse-subtle" aria-hidden />
            Live on Stellar testnet
          </p>

          <h1
            id="hero-title"
            className="display mt-8 text-[12.2vw] md:text-[8vw] lg:text-[5.9vw] 2xl:text-[6.4rem]"
          >
            <span className="line-mask">
              <span data-line style={{ ['--i' as string]: 0 }}>
                Agents <LiveHalo /> pay.
              </span>
            </span>
            <span className="line-mask">
              <span data-line style={{ ['--i' as string]: 1 }} className="text-dim">
                Within limits.
              </span>
            </span>
            <span className="line-mask">
              <span data-line style={{ ['--i' as string]: 2 }}>
                <span className="aurora-text aurora-text-flow">You decide.</span>
              </span>
            </span>
          </h1>

          <p
            data-reveal
            style={{ ['--i' as string]: 4 }}
            className="mt-8 max-w-[50ch] text-lead leading-relaxed text-mist"
          >
            Halora gives every AI agent a Stellar wallet with limits it cannot break. Each payment
            is checked on-chain by the account contract{' '}
            <span className="text-frost">before any money moves</span>.
          </p>

          <div
            data-reveal
            style={{ ['--i' as string]: 5 }}
            className="mt-10 flex flex-col gap-3 sm:flex-row"
          >
            <a href="#try" className="btn-aurora group">
              Try a payment
              <ArrowDown
                aria-hidden
                className="size-4 transition-transform duration-[var(--t-hover)] group-hover:translate-y-0.5"
              />
            </a>
            <Link href="/dashboard" className="btn-ghost group">
              Open the dashboard
              <ArrowUpRight
                aria-hidden
                className="size-4 transition-transform duration-[var(--t-hover)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
          </div>

          <dl
            data-reveal
            style={{ ['--i' as string]: 6 }}
            className="mt-12 grid grid-cols-3 gap-4 border-t border-night-line pt-6 sm:flex sm:flex-wrap sm:gap-x-12 sm:gap-y-6 sm:pt-8"
          >
            {FACTS.map((f) => (
              <div key={f.label} className="group">
                <dd className="font-mono text-[1.25rem] font-medium sm:text-[1.75rem] tracking-tight text-frost transition-colors duration-[var(--t-hover)] group-hover:text-signal">
                  {f.value}
                </dd>
                <dt className="mt-1 font-mono text-[0.8125rem] leading-snug tracking-[0.06em] text-mist uppercase">
                  {f.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>

        <div
          data-reveal
          style={{ ['--i' as string]: 3, ['--rise' as string]: '0px' }}
          className="relative mx-auto aspect-square w-full max-w-[420px] lg:col-span-5 lg:max-w-none"
        >
          <HaloField className="absolute inset-0 size-full" />
          <p className="sr-only">
            Illustration: payments leave the agent and meet the policy ring. Allowed payments pass,
            denied ones fall back, and held ones wait for the owner.
          </p>
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute right-8 bottom-24 hidden text-right font-mono text-[0.8125rem] text-dim xl:block"
      >
        <div>[001] SCROLL</div>
        <div className="mt-1 animate-bounce motion-reduce:animate-none">↓</div>
      </div>

      <PaymentTicker />
    </section>
  );
}
