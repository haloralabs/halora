/**
 * The marquee under the hero, Akkuea's ticker carrying Halora's own material: a stream of agent
 * payments and the contract's verdict on each. Pauses on hover; still under reduced motion.
 */

const ITEMS = [
  { text: '0.25 USDC to Weatherly', verdict: 'ALLOWED', tone: 'text-signal' },
  { text: '18.00 USDC to MapTile', verdict: 'HELD FOR OWNER', tone: 'text-held' },
  { text: '0.02 USDC to Searchwise', verdict: 'ALLOWED', tone: 'text-signal' },
  { text: '500.00 USDC to GBX7Q2', verdict: 'DENIED: RecipientNotAllowed', tone: 'text-deny' },
  { text: '1.40 USDC to Weatherly', verdict: 'ALLOWED', tone: 'text-signal' },
  { text: '60.00 USDC to Searchwise', verdict: 'DENIED: PerTxLimitExceeded', tone: 'text-deny' },
];

function Track({ hidden }: { hidden?: boolean }) {
  return (
    <ul className="marquee-track" aria-hidden={hidden || undefined}>
      {ITEMS.map((item, i) => (
        <li
          key={i}
          className="flex shrink-0 items-center gap-3 px-8 font-mono text-[0.875rem] whitespace-nowrap"
        >
          <span className="text-mist">{item.text}</span>
          <span className={item.tone}>{item.verdict}</span>
          <span aria-hidden className="ml-5 text-signal">
            ◆
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PaymentTicker() {
  return (
    <div
      className="marquee border-y border-night-line bg-night-1/90 py-3.5"
      role="region"
      aria-label="Example payments and verdicts"
    >
      <Track />
      <Track hidden />
    </div>
  );
}
