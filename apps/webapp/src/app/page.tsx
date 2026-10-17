import { BuiltWith } from '@/components/marketing/built-with';
import { Closing } from '@/components/marketing/closing';
import { Developers } from '@/components/marketing/developers';
import { GuaranteeFields } from '@/components/marketing/guarantee-fields';
import { Hero } from '@/components/marketing/hero';
import { RevealObserver } from '@/components/marketing/reveal-observer';
import { SetupBar } from '@/components/marketing/setup-bar';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';
import { VerdictDemo } from '@/components/marketing/verdict-demo';

/*
 * The page is a series of short statements, each on its own field of colour, each with its proof:
 *   1. Agents pay, you decide (hero, with the live halo inside the sentence).
 *   2. Try it: type a payment and watch the real policy checks decide (the live thing).
 *   3. Four guarantees, one per field.
 *   4. Minutes to set up (the product's progress bar).
 *   5. A few lines in your agent (the code).
 *   6. Built with Stellar and friends, and what Halora does not do.
 *   7. The close, colours inverted. 8. The footer: the install command as the display line.
 */
export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="overflow-x-clip">
        <Hero />
        <section
          id="try"
          data-chapter="carbon"
          data-reveal-root
          aria-labelledby="try-title"
          className="chapter-carbon flex min-h-[88svh] scroll-mt-0 flex-col justify-center py-28 md:py-36"
        >
          <h2 id="try-title" className="sr-only">
            Try a payment
          </h2>
          <VerdictDemo />
        </section>
        <GuaranteeFields />
        <SetupBar />
        <Developers />
        <BuiltWith />
        <Closing />
      </main>
      <SiteFooter />
      <RevealObserver />
    </>
  );
}
