import { KeyRound, SlidersHorizontal, Zap } from 'lucide-react';
import { SectionHeader } from './section-header';

/**
 * How it works, as Akkuea tells it: a vertical sequence with a terminal command per step. Each
 * step also states how long it really takes.
 */
const STEPS = [
  {
    icon: SlidersHorizontal,
    title: 'Set the rules',
    time: '~2 min',
    body: 'Create the agent wallet from the dashboard and choose its limits. Your wallet signs the deployment; you stay the owner.',
    command: 'client.deployAccount({ owner, agentPublicKey, policy })',
  },
  {
    icon: KeyRound,
    title: 'Connect the agent',
    time: '~5 min',
    body: 'Give the agent its own key through the TypeScript SDK or the MCP server. That key can pay within the rules and nothing else.',
    command: 'bunx @halora/mcp',
  },
  {
    icon: Zap,
    title: 'Let it pay',
    time: '~5 s per payment',
    body: 'The agent pays for APIs and data on its own, including x402 pay-per-request. Larger payments wait in your approval inbox.',
    command: "agent.fetch('https://api.weatherly.dev/forecast')",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      data-reveal-root
      aria-labelledby="how-title"
      className="relative overflow-hidden border-y border-night-line bg-night-1 px-4 py-28 text-frost md:px-8 md:py-36"
    >
      <div aria-hidden className="grid-night absolute inset-0 opacity-40" />
      <div className="relative mx-auto grid grid-cols-1 max-w-[1400px] gap-14 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SectionHeader
            index="03"
            label="Getting started"
            id="how-title"
            title="Minutes to set up."
            dimmed="Safe all day after."
          >
            Three steps from nothing to an agent that pays for what it needs, and never more.
          </SectionHeader>
        </div>

        <ol className="relative min-w-0 space-y-4 lg:col-span-7">
          <span
            aria-hidden
            className="absolute top-6 bottom-6 left-[23px] hidden w-px bg-gradient-to-b from-night-line via-signal/50 to-night-line sm:block"
          />
          {STEPS.map(({ icon: Icon, title, time, body, command }, i) => (
            <li
              key={title}
              data-reveal
              style={{ ['--i' as string]: i + 2, ['--rise' as string]: '0px' }}
              className="group relative flex gap-5"
            >
              <span className="relative z-10 grid size-12 shrink-0 place-items-center rounded-[var(--radius-lg)] border border-night-line bg-night transition-colors duration-300 group-hover:border-signal">
                <Icon
                  aria-hidden
                  className="size-5 text-mist transition-colors duration-300 group-hover:text-signal"
                />
              </span>
              <div className="min-w-0 flex-1 border-b border-night-line pb-8 group-last:border-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-[0.8125rem] text-signal">
                    [{String(i + 1).padStart(2, '0')}]
                  </span>
                  <h3 className="text-lead font-semibold tracking-[-0.02em]">{title}</h3>
                  <span className="rounded-[var(--radius-sm)] border border-night-line px-2 py-0.5 font-mono text-[0.8125rem] text-mist">
                    {time}
                  </span>
                </div>
                <p className="mt-2 max-w-[56ch] text-body leading-relaxed text-mist">{body}</p>
                <div className="mt-4 inline-flex max-w-full items-center gap-2 overflow-x-auto rounded-[var(--radius-md)] border border-night-line bg-night px-3 py-2">
                  <code className="font-mono text-[0.8125rem] whitespace-nowrap text-frost">
                    <span className="text-signal">&gt;</span> {command}
                    <span aria-hidden className="animate-blink ml-0.5 text-signal">
                      _
                    </span>
                  </code>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
