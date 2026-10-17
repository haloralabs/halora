import { ArrowDown } from 'lucide-react';
import { LiveHalo } from './live-halo';

/**
 * Hero: two flat fields meet at a hard seam (the limit). The sentence sits across it and changes
 * ink where it crosses, as if the lower half were under the owner's control. The live halo sits
 * inside the sentence, between the agent and the payment, which is exactly where the account
 * contract sits.
 *
 * Line 2 carries its own deep-ink copy as a ::after (see .seam-ink in globals.css), clipped to the
 * part below the seam, so there is one headline element and nothing lies on top of it. Both lines
 * reveal from a mask on load.
 */

// The seam crosses the upper third of line 2's capitals (measured on Switzer at leading 0.92).
// Line 2 starts 0.92em down, so the cut inside line 2 is 1.47em - 0.92em = 0.55em.
const SEAM = '1.47em';

export function Hero() {
  return (
    <section
      data-reveal-root
      aria-labelledby="hero-title"
      className="relative isolate min-h-[130svh] overflow-hidden"
    >
      <div
        aria-hidden
        data-chapter="paper"
        className="absolute inset-x-0 top-0 h-[46svh] bg-paper md:h-[50svh]"
      />
      <div
        aria-hidden
        data-chapter="signal"
        className="absolute inset-x-0 top-[46svh] bottom-0 bg-signal md:top-[50svh]"
      />

      <div className="absolute inset-x-0 top-[46svh] px-4 md:top-[50svh] md:px-8">
        <h1
          id="hero-title"
          className="display mx-auto max-w-[16ch] text-center text-[11.4vw] text-carbon md:max-w-none md:text-[9vw] 2xl:text-[9.5rem]"
          style={{ marginTop: `-${SEAM}` }}
        >
          <span className="line-mask">
            <span data-line style={{ ['--i' as string]: 0 }}>
              Agents <LiveHalo /> pay.
            </span>
          </span>
          <span className="line-mask">
            <span
              data-line
              data-text="You decide."
              className="seam-ink"
              style={{ ['--i' as string]: 1, ['--cut' as string]: '0.55em' }}
            >
              You decide.
            </span>
          </span>
        </h1>
      </div>

      <div className="absolute inset-x-0 top-[calc(100svh-40px)] -translate-y-full px-5 text-center md:top-[calc(100svh-56px)]">
        <p
          data-reveal
          style={{ ['--i' as string]: 4 }}
          className="mx-auto max-w-[30ch] text-body leading-snug font-medium text-carbon md:max-w-[38ch] md:text-lead"
        >
          Halora gives every AI agent a Stellar wallet with limits it cannot break. Each payment is
          checked on-chain before any money moves.
        </p>
        <a
          data-reveal
          style={{ ['--i' as string]: 5 }}
          href="#try"
          className="group mt-5 inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-md)] bg-carbon px-6 text-body font-semibold text-paper transition-[background-color,transform] duration-[var(--t-hover)] hover:bg-carbon-2 active:scale-[0.97]"
        >
          Try a payment
          <ArrowDown
            aria-hidden
            className="size-4 transition-transform duration-[var(--t-hover)] group-hover:translate-y-0.5"
          />
        </a>
      </div>
    </section>
  );
}
