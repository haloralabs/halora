import { cn } from '@/lib/cn';

/**
 * Four guarantees, each on its own full-bleed field of colour. The phrase is big and hugs a bottom
 * corner; its explanation sits small near the top on the opposite side, so the eye travels the
 * diagonal. The first phrase is the section heading.
 */

const FIELDS = [
  {
    chapter: 'paper',
    phrase: ['Caps that', 'hold.'],
    body: 'Set a ceiling per payment and per day. The account contract counts every transfer and refuses the one that would cross the line, however hard the agent insists.',
  },
  {
    chapter: 'signal',
    phrase: ['Deaf to', 'persuasion.'],
    body: 'A prompt injection can talk an agent into anything. It cannot talk the contract into anything. Unknown recipients and unexpected calls are denied before funds move.',
  },
  {
    chapter: 'carbon',
    phrase: ['Big ones', 'wait.'],
    body: 'Above your approval threshold a payment is held until you approve that recipient and amount on-chain, from your dashboard. The approval works once, then it is gone.',
  },
  {
    chapter: 'cobalt',
    phrase: ['Off in one', 'tap.'],
    body: 'Pause the wallet whenever you like, or let it expire on a date you choose. The agent key can pay within the rules. It can never change them.',
  },
] as const;

export function GuaranteeFields() {
  return (
    <section id="rules" aria-labelledby="rules-title" className="scroll-mt-0">
      {FIELDS.map((f, i) => {
        const mirrored = i % 2 === 1;
        const Heading = i === 0 ? 'h2' : 'h3';
        return (
          <div
            key={f.chapter}
            data-chapter={f.chapter}
            data-reveal-root
            className={cn(
              `chapter-${f.chapter}`,
              'relative flex min-h-[64svh] flex-col justify-between px-4 py-6 md:min-h-[76svh] md:px-8 md:py-8',
            )}
          >
            <p
              data-reveal
              style={{ ['--i' as string]: 1, ['--rise' as string]: '16px' }}
              className={cn(
                'max-w-[30ch] text-body leading-relaxed md:w-[30ch]',
                mirrored ? 'md:ml-[8.33%]' : 'md:ml-[58.33%]',
                f.chapter === 'cobalt' ? 'text-white' : '',
              )}
            >
              {f.body}
            </p>
            <Heading
              id={i === 0 ? 'rules-title' : undefined}
              className={cn(
                'display mt-16 text-[13vw] md:text-[9vw] 2xl:text-[9.4rem]',
                mirrored && 'md:text-right',
              )}
            >
              {f.phrase.map((line, j) => (
                <span key={line} className="line-mask">
                  <span
                    data-reveal
                    style={{ ['--i' as string]: j + 2, ['--rise' as string]: '0.6em' }}
                    className="block"
                  >
                    {line}
                  </span>
                </span>
              ))}
            </Heading>
          </div>
        );
      })}
    </section>
  );
}
