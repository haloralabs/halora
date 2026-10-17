import {
  ArrowRight,
  Ban,
  CalendarClock,
  CircleDollarSign,
  CreditCard,
  Gauge,
  KeyRound,
  ListChecks,
  PauseCircle,
  PenLine,
  ShieldCheck,
  Timer,
  Wallet,
  Zap,
} from 'lucide-react';
import { DevTabs } from '@/components/marketing/dev-tabs';
import { HaloVisual } from '@/components/marketing/halo-visual';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';
import { Badge, ButtonLink } from '@/components/ui';

const PROBLEMS = [
  {
    icon: CreditCard,
    title: 'A card on file per service',
    body: 'A person signs up, enters a card and tops up credits for every API the agent touches. It does not scale to an agent that uses dozens of services.',
    verdict: 'Slow',
  },
  {
    icon: Wallet,
    title: 'A plain wallet with funds',
    body: 'Fast, until a prompt injection or a bug sends everything to the wrong address. Nothing between the agent key and the money says no.',
    verdict: 'Unsafe',
  },
  {
    icon: ShieldCheck,
    title: 'A wallet with a halo',
    body: 'The agent pays on its own, and every payment is checked against your policy by the account contract before any funds move.',
    verdict: 'Halora',
  },
];

const STEPS = [
  {
    icon: PenLine,
    title: 'Set the rules',
    body: 'Create an agent wallet from the dashboard. You choose the per payment limit, the daily limit, who it can pay and when it needs you. Your wallet deploys the account.',
  },
  {
    icon: KeyRound,
    title: 'Hand the agent a key',
    body: 'The agent gets its own signing key and an API key. Drop them into the TypeScript SDK or the MCP server. The agent key can never change the policy.',
  },
  {
    icon: Zap,
    title: 'Let it pay, within bounds',
    body: 'The agent pays for APIs and data on its own, including x402 pay-per-request. Larger payments wait in your approval inbox until you approve them on-chain. Anything outside the policy is denied.',
  },
];

const RULES = [
  { icon: CircleDollarSign, title: 'Per payment limit', body: 'No single transfer can exceed it.' },
  {
    icon: Gauge,
    title: 'Daily limit',
    body: 'Spending resets each UTC day, tracked inside the contract.',
  },
  {
    icon: ListChecks,
    title: 'Recipient allowlist',
    body: 'Optionally restrict payments to known addresses.',
  },
  {
    icon: PenLine,
    title: 'Approval threshold',
    body: 'Above it, a payment needs your approval first.',
  },
  { icon: CalendarClock, title: 'Expiry', body: 'The agent key stops working on a date you pick.' },
  { icon: PauseCircle, title: 'Pause switch', body: 'Stop all agent payments with one signature.' },
];

const STELLAR = [
  {
    icon: CircleDollarSign,
    title: 'Sub-cent fees',
    body: 'Micropayments of a fraction of a cent stay economical.',
  },
  {
    icon: Timer,
    title: 'About 5 second finality',
    body: 'Agents do not wait long for a payment to settle.',
  },
  { icon: Wallet, title: 'Native USDC', body: 'Policies are denominated in USDC from day one.' },
  {
    icon: ShieldCheck,
    title: 'Programmable accounts',
    body: 'Soroban custom accounts run the policy in __check_auth.',
  },
];

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="surface-grain pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 md:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:pb-28">
            <div className="animate-rise">
              <Badge tone="gold" dot>
                Built on Stellar. Testnet pilot.
              </Badge>
              <h1 className="mt-6 font-display text-[3.25rem] leading-[0.98] tracking-[-0.02em] text-fg sm:text-7xl lg:text-[5.25rem]">
                A halo for <em className="halo-text pr-1">every agent.</em>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
                Halora gives AI agents a Stellar wallet with rules they cannot break. They pay for
                APIs and services on their own, never more than you allow, because every payment is
                enforced on-chain by the account contract.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <ButtonLink
                  href="/dashboard"
                  size="lg"
                  icon={<ArrowRight className="size-4" aria-hidden />}
                  className="flex-row-reverse"
                >
                  Open the dashboard
                </ButtonLink>
                <ButtonLink href="#developers" size="lg" variant="secondary">
                  See the code
                </ButtonLink>
              </div>
              <p className="mt-6 text-sm text-subtle">
                Works with x402 pay-per-request on Stellar. No sign-up: connect a Stellar wallet, or
                explore with demo data.
              </p>
            </div>
            <HaloVisual />
          </div>
        </section>

        {/* Problem */}
        <section aria-labelledby="problem-title" className="border-t border-line bg-sunken/60">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
            <p className="text-sm font-medium tracking-wide text-accent uppercase">The problem</p>
            <h2
              id="problem-title"
              className="mt-3 max-w-3xl font-display text-4xl leading-tight tracking-[-0.01em] text-fg sm:text-5xl"
            >
              Agents need to pay. Today that means paperwork, or a wallet anyone can talk into
              anything.
            </h2>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {PROBLEMS.map(({ icon: Icon, title, body, verdict }, i) => (
                <article
                  key={title}
                  className={
                    i === 2
                      ? 'relative rounded-[var(--radius-lg)] border border-gold/50 bg-surface p-6 shadow-halo'
                      : 'rounded-[var(--radius-lg)] border border-line bg-surface p-6'
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="grid size-10 place-items-center rounded-full border border-line bg-surface-2">
                      <Icon
                        className={i === 2 ? 'size-4.5 text-accent' : 'size-4.5 text-muted'}
                        aria-hidden
                      />
                    </span>
                    <Badge tone={i === 2 ? 'gold' : i === 1 ? 'danger' : 'neutral'}>
                      {verdict}
                    </Badge>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-fg">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          aria-labelledby="how-title"
          className="scroll-mt-20 border-t border-line"
        >
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
            <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="text-sm font-medium tracking-wide text-accent uppercase">
                  How it works
                </p>
                <h2
                  id="how-title"
                  className="mt-3 font-display text-4xl leading-tight tracking-[-0.01em] text-fg sm:text-5xl"
                >
                  Three steps. One contract that says no for you.
                </h2>
                <p className="mt-5 max-w-md leading-relaxed text-muted">
                  Each agent gets its own Soroban smart account. You hold the owner key, the agent
                  holds a separate key, and the policy lives in the contract, so it holds even if
                  the agent, the SDK or our servers are compromised.
                </p>
              </div>
              <ol className="relative space-y-4">
                {STEPS.map(({ icon: Icon, title, body }, i) => (
                  <li
                    key={title}
                    className="relative flex gap-5 rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-sm"
                  >
                    <div className="flex flex-col items-center">
                      <span className="grid size-11 place-items-center rounded-full border border-gold/40 bg-warning-soft font-display text-xl text-accent">
                        {i + 1}
                      </span>
                    </div>
                    <div>
                      <h3 className="flex items-center gap-2 text-lg font-semibold text-fg">
                        <Icon className="size-4 text-accent" aria-hidden />
                        {title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-16 rounded-[var(--radius-xl)] border border-line bg-surface p-6 sm:p-10">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h3 className="font-display text-3xl text-fg">The rules an agent cannot break</h3>
                <p className="text-sm text-subtle">
                  Checked in order, every payment. Anything unexpected is denied.
                </p>
              </div>
              <ul className="mt-8 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
                {RULES.map(({ icon: Icon, title, body }) => (
                  <li key={title} className="flex gap-3.5">
                    <Icon className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
                    <div>
                      <p className="font-medium text-fg">{title}</p>
                      <p className="mt-1 text-sm text-muted">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Developers */}
        <section
          id="developers"
          aria-labelledby="dev-title"
          className="scroll-mt-20 border-t border-line bg-sunken/60"
        >
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 md:py-28 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="text-sm font-medium tracking-wide text-accent uppercase">
                For developers
              </p>
              <h2
                id="dev-title"
                className="mt-3 font-display text-4xl leading-tight tracking-[-0.01em] text-fg sm:text-5xl"
              >
                Safe payments in a few lines.
              </h2>
              <p className="mt-5 leading-relaxed text-muted">
                Use the TypeScript SDK in your agent, or add the MCP server to any MCP-capable
                client. Both check the policy before signing and return a typed error early, but the
                contract remains the final word.
              </p>
              <ul className="mt-8 space-y-3 text-sm text-muted">
                {[
                  'Works with x402 pay-per-request on Stellar: pays on HTTP 402 within policy, then retries',
                  'Approval requests you grant with one on-chain approval',
                  'Typed errors that name the rule a payment broke',
                ].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="min-w-0">
              <DevTabs />
            </div>
          </div>
        </section>

        {/* Stellar */}
        <section
          id="stellar"
          aria-labelledby="stellar-title"
          className="scroll-mt-20 border-t border-line"
        >
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
            <p className="text-sm font-medium tracking-wide text-accent uppercase">
              Built on Stellar
            </p>
            <h2
              id="stellar-title"
              className="mt-3 max-w-3xl font-display text-4xl leading-tight tracking-[-0.01em] text-fg sm:text-5xl"
            >
              The network where a payment for one API call still makes sense.
            </h2>
            <dl className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {STELLAR.map(({ icon: Icon, title, body }) => (
                <div key={title} className="bg-surface p-6">
                  <Icon className="size-5 text-accent" aria-hidden />
                  <dt className="mt-4 font-semibold text-fg">{title}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-muted">{body}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-8 flex gap-3 rounded-[var(--radius-md)] border border-line bg-surface-2 p-5 text-sm leading-relaxed text-muted">
              <Ban className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
              <p>
                <span className="font-medium text-fg">What Halora does not do.</span> Halora never
                holds your keys, and it does not stop an agent key from leaking. It limits what a
                leaked or manipulated key can spend. Store the agent secret like any other
                credential.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section
          aria-labelledby="cta-title"
          className="relative overflow-hidden border-t border-line"
        >
          <div
            aria-hidden
            className="halo-ring animate-halo-spin absolute top-1/2 left-1/2 size-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.12] blur-3xl"
          />
          <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center sm:px-6 md:py-32">
            <h2
              id="cta-title"
              className="font-display text-5xl leading-[1.02] tracking-[-0.02em] text-fg sm:text-6xl"
            >
              Put a halo on your <em className="halo-text pr-1">first agent.</em>
            </h2>
            <p className="mt-5 max-w-lg text-lg text-muted">
              Create a wallet, set its rules, and connect your agent in minutes on testnet.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <ButtonLink
                href="/dashboard/agents/new"
                size="lg"
                icon={<ArrowRight className="size-4" aria-hidden />}
                className="flex-row-reverse"
              >
                Create an agent wallet
              </ButtonLink>
              <ButtonLink href="/dashboard" size="lg" variant="secondary">
                Explore the dashboard
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
