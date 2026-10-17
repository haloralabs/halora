import {
  CalendarClock,
  CircleDollarSign,
  Gauge,
  ListChecks,
  PauseCircle,
  ShieldCheck,
} from 'lucide-react';
import { SectionHeader } from './section-header';

/** The six rules the account contract checks on every agent payment, with their contract names. */
const RULES = [
  {
    icon: CircleDollarSign,
    title: 'Per payment limit',
    param: 'per_tx_limit',
    body: 'No single transfer can exceed it, however the agent phrases the request.',
  },
  {
    icon: Gauge,
    title: 'Daily limit',
    param: 'daily_limit',
    body: 'The contract counts every transfer of the UTC day and refuses the one that crosses the line.',
  },
  {
    icon: ListChecks,
    title: 'Recipient allowlist',
    param: 'allowlist',
    body: 'Only addresses you approved can be paid. A prompt injection cannot add one.',
  },
  {
    icon: ShieldCheck,
    title: 'Owner approval',
    param: 'approval_threshold',
    body: 'Above your threshold a payment waits until you approve it on-chain. The approval works once.',
  },
  {
    icon: PauseCircle,
    title: 'Pause switch',
    param: 'paused',
    body: 'Stop every agent payment with one signature, and resume when you are ready.',
  },
  {
    icon: CalendarClock,
    title: 'Expiry',
    param: 'expires_at',
    body: 'The agent key stops working on a date you choose. It can never change its own rules.',
  },
];

export function RulesGrid() {
  return (
    <section
      id="rules"
      data-reveal-root
      aria-labelledby="rules-title"
      className="relative bg-night px-4 py-28 text-frost md:px-8 md:py-36"
    >
      <div aria-hidden className="stars absolute inset-0 opacity-40" />
      <div className="relative mx-auto max-w-[1400px]">
        <SectionHeader
          index="02"
          label="What the contract enforces"
          id="rules-title"
          title="Rules an agent"
          dimmed="cannot talk past."
        >
          Enforced in the account contract, not in the agent, the SDK or our servers. If any of them
          is compromised, the rules still hold.
        </SectionHeader>

        <ul className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RULES.map(({ icon: Icon, title, param, body }, i) => (
            <li
              key={param}
              data-reveal
              style={{ ['--i' as string]: i + 2 }}
              className="group relative overflow-hidden rounded-[var(--radius-lg)] border border-night-line bg-night-1 p-6 transition-[border-color,background-color,transform] duration-300 hover:-translate-y-0.5 hover:border-night-line-2 hover:bg-night-2"
            >
              <span className="absolute top-5 right-5 font-mono text-[0.8125rem] text-dim">
                [{String(i + 1).padStart(3, '0')}]
              </span>
              <span className="grid size-11 place-items-center rounded-[var(--radius-md)] border border-night-line bg-night-2 transition-colors duration-300 group-hover:border-signal/50">
                <Icon
                  aria-hidden
                  className="size-5 text-mist transition-colors duration-300 group-hover:text-signal"
                />
              </span>
              <h3 className="mt-5 text-lead font-semibold tracking-[-0.02em]">{title}</h3>
              <p className="mt-2 text-body leading-relaxed text-mist">{body}</p>
              <code className="mt-5 inline-block font-mono text-[0.8125rem] text-teal">
                {param}
              </code>
              <span
                aria-hidden
                className="absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-signal to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />
            </li>
          ))}
        </ul>

        <p
          data-reveal
          className="mt-14 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-mono text-[0.8125rem] tracking-[0.08em] text-dim uppercase"
        >
          <span aria-hidden>+</span>Enforced on-chain<span aria-hidden>×</span>No keys held
          <span aria-hidden>+</span>Open source<span aria-hidden>×</span>
        </p>
      </div>
    </section>
  );
}
