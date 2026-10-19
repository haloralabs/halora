import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

/** The close: the aurora returns over the night, and the opening idea is addressed to you. */
export function Closing() {
  return (
    <section
      data-reveal-root
      aria-labelledby="close-title"
      className="relative isolate overflow-hidden bg-night px-4 py-32 text-frost md:px-8 md:py-44"
    >
      <div aria-hidden className="horizon" />
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="stars absolute inset-0 opacity-70" />
        <div className="aurora top-[20%]! opacity-60!">
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="mx-auto max-w-[1400px] text-center">
        <h2
          id="close-title"
          className="display mx-auto max-w-[14ch] text-[13vw] md:text-[7.5vw] 2xl:text-[8rem]"
        >
          <span className="line-mask">
            <span data-reveal style={{ ['--rise' as string]: '0.6em' }} className="block">
              Give your agent
            </span>
          </span>
          <span className="line-mask">
            <span
              data-reveal
              style={{ ['--i' as string]: 1, ['--rise' as string]: '0.6em' }}
              className="block"
            >
              <span className="aurora-text">a halo.</span>
            </span>
          </span>
        </h2>
        <p
          data-reveal
          style={{ ['--i' as string]: 2 }}
          className="mx-auto mt-8 max-w-[46ch] text-lead leading-relaxed text-mist"
        >
          Create a wallet, set its rules and connect your agent on Stellar testnet. No sign-up: a
          Stellar wallet is your login, or explore with demo data.
        </p>
        <div
          data-reveal
          style={{ ['--i' as string]: 3 }}
          className="mt-10 flex flex-col justify-center gap-3 sm:flex-row"
        >
          <Link href="/dashboard/agents/new" className="btn-aurora group">
            Create an agent wallet
            <ArrowRight
              aria-hidden
              className="size-4 transition-transform duration-[var(--t-hover)] group-hover:translate-x-1"
            />
          </Link>
          <Link href="/dashboard" className="btn-ghost group">
            Explore the demo
            <ArrowUpRight aria-hidden className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
