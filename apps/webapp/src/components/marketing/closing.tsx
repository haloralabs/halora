import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/** The close: the page's colours flip and the opening idea returns, now addressed to you. */
export function Closing() {
  return (
    <section
      data-chapter="carbon"
      data-reveal-root
      aria-labelledby="close-title"
      className="chapter-carbon flex min-h-[80svh] flex-col justify-between px-4 pt-24 pb-6 md:min-h-[92svh] md:px-8 md:pt-32 md:pb-10"
    >
      <h2
        id="close-title"
        className="display text-[13vw] text-signal md:text-[9vw] 2xl:text-[9.5rem]"
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
            a halo.
          </span>
        </span>
      </h2>
      <div className="mt-16 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <p
          data-reveal
          style={{ ['--i' as string]: 2 }}
          className="max-w-[40ch] text-body leading-relaxed text-paper md:text-lead"
        >
          Create a wallet, set its rules and connect your agent on Stellar testnet. No sign-up: a
          Stellar wallet is your login, or explore with demo data.
        </p>
        <Link
          data-reveal
          style={{ ['--i' as string]: 3 }}
          href="/dashboard/agents/new"
          className="group inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-[var(--radius-md)] bg-cobalt px-8 text-body font-semibold text-white transition-[background-color,transform] duration-[var(--t-hover)] hover:bg-cobalt-hover active:scale-[0.97] md:w-auto"
        >
          Create an agent wallet
          <ArrowRight
            aria-hidden
            className="size-5 transition-transform duration-[var(--t-hover)] group-hover:translate-x-1"
          />
        </Link>
      </div>
    </section>
  );
}
