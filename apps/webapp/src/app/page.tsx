import { BuiltWith } from '@/components/marketing/built-with';
import { Closing } from '@/components/marketing/closing';
import { Developers } from '@/components/marketing/developers';
import { Hero } from '@/components/marketing/hero';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { RevealObserver } from '@/components/marketing/reveal-observer';
import { RulesGrid } from '@/components/marketing/rules-grid';
import { SectionHeader } from '@/components/marketing/section-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';
import { VerdictDemo } from '@/components/marketing/verdict-demo';

/*
 * Halora's landing, a sibling of Akkuea's: the same night ground and terminal vernacular, with
 * its own light (the aurora) and its own material (the halo, the live policy check).
 *   1. Hero: agents pay, within limits, you decide. Live halo inside the sentence, payment ticker.
 *   2. [01] Try to break the rules: a terminal running the real policy checks.
 *   3. [02] The six rules the contract enforces.
 *   4. [03] Minutes to set up: steps with their commands.
 *   5. [04] For developers: the agent session and the code.
 *   6. [05] Built on Stellar, and what Halora does not do.
 *   7. The close, then the footer with the install command.
 */
export default function LandingPage() {
  return (
    <div className="bg-night text-frost">
      <SiteHeader />
      <main id="main" className="overflow-x-clip">
        <Hero />
        <section
          id="try"
          data-reveal-root
          aria-labelledby="try-title"
          className="relative bg-night px-4 py-28 md:px-8 md:py-36"
        >
          <div className="mx-auto max-w-[1400px]">
            <SectionHeader
              index="01"
              label="Live policy check"
              id="try-title"
              title="Try to break the rules."
              dimmed="The contract holds."
            >
              Type what an agent wants to pay. These are the real checks the SDK runs before
              signing, in the same order as the account contract.
            </SectionHeader>
            <VerdictDemo />
          </div>
        </section>
        <RulesGrid />
        <HowItWorks />
        <Developers />
        <BuiltWith />
        <Closing />
      </main>
      <SiteFooter />
      <RevealObserver />
    </div>
  );
}
