import { cn } from '@/lib/cn';

/**
 * How it works, drawn as the product's own progress bar enlarged to the width of the page. Each
 * segment's width follows how long the stage really takes, so setting up is a sliver and the rest
 * is the product working. On a phone the bar turns vertical and keeps the proportions.
 *
 * On entrance a paper-coloured cover slides off each segment (a transform on a separate layer),
 * so the segment's colour appears to grow while the words inside are never stretched.
 */

const STAGES = [
  {
    minutes: 2,
    duration: '2 minutes',
    clause: 'First, create the wallet and choose its limits from the dashboard.',
    tone: 'bg-signal',
    ink: 'text-carbon',
  },
  {
    minutes: 5,
    duration: '5 minutes',
    clause: 'Then connect your agent with the SDK or the MCP server.',
    tone: 'bg-cobalt',
    ink: 'text-white',
  },
  {
    minutes: 120,
    duration: 'Every payment after',
    clause: 'From then on, each payment is checked on-chain and settles in about 5 seconds.',
    tone: 'bg-carbon',
    ink: 'text-paper',
  },
] as const;

const MIN_SHARE = 12;

function shares(): number[] {
  const total = STAGES.reduce((s, x) => s + x.minutes, 0);
  const lifted = STAGES.map((s) => Math.max((s.minutes / total) * 100, MIN_SHARE));
  const extra = lifted.reduce((s, x) => s + x, 0) - 100;
  return lifted.map((r, i) => (i === lifted.length - 1 ? r - extra : r));
}

export function SetupBar() {
  const share = shares();

  return (
    <section
      id="how-it-works"
      data-chapter="paper"
      data-reveal-root
      aria-labelledby="how-title"
      className="chapter-paper scroll-mt-16 px-4 py-28 md:px-8 md:py-44"
    >
      <h2
        id="how-title"
        data-reveal
        className="display max-w-[12ch] text-[11vw] md:max-w-none md:text-[6.4vw] 2xl:text-[6.5rem]"
      >
        Minutes to set up.
      </h2>

      <ol
        data-ui
        className="mt-12 flex flex-col gap-1.5 md:mt-16 md:flex-row"
        aria-label="Stages, with how long each takes"
      >
        {STAGES.map((s, i) => (
          <li
            key={s.duration}
            className="flex flex-col md:min-w-0"
            style={{
              flexGrow: share[i],
              flexBasis: 0,
              ['--h' as string]: `max(8.5rem, ${(share[i]! * 0.62).toFixed(1)}svh)`,
            }}
          >
            <div
              className={cn(
                'relative isolate flex min-h-[var(--h)] flex-col justify-between overflow-hidden rounded-[var(--radius-md)] p-4 md:h-[22vh] md:min-h-0 md:p-5',
                s.tone,
                s.ink,
              )}
            >
              <span
                aria-hidden
                data-cover
                style={{ ['--i' as string]: i }}
                className="absolute inset-0 bg-paper"
              />
              <p
                data-reveal
                style={{ ['--i' as string]: i + 2, ['--rise' as string]: '10px' }}
                className="relative text-lead leading-tight font-semibold tracking-[-0.02em]"
              >
                {s.duration}
              </p>
              <p className="relative mt-6 max-w-[30ch] text-body leading-snug md:hidden">
                {s.clause}
              </p>
            </div>
            <p
              data-reveal
              style={{ ['--i' as string]: i + 3 }}
              className="mt-3 hidden max-w-[24ch] text-body leading-snug md:block"
            >
              {s.clause}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
