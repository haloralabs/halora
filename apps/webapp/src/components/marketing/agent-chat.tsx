import { Check, Hourglass } from 'lucide-react';

/**
 * A real interface fragment: an MCP client conversation in which an agent uses Halora's tools.
 * Tool names and results follow the MCP server in docs/architecture/interfaces.md section 5.
 */
export function AgentChat() {
  return (
    <figure data-ui className="rounded-[var(--radius-lg)] bg-paper p-5 text-carbon sm:p-6">
      <figcaption className="sr-only">
        An agent using the Halora MCP tools: one payment allowed, one held for approval
      </figcaption>
      <ol className="space-y-4 text-body">
        <li className="ml-auto max-w-[32ch] rounded-[var(--radius-lg)] bg-paper-2 px-4 py-3">
          Get tomorrow&apos;s forecast for Lisbon and a tile map of the route.
        </li>
        <li className="space-y-2">
          <p className="flex flex-wrap items-center gap-2 text-small text-carbon/80">
            <code className="rounded-[var(--radius-sm)] bg-carbon px-1.5 py-0.5 font-mono text-signal">
              halora_fetch_paid
            </code>
            api.weatherly.dev/forecast
          </p>
          <p className="flex items-start gap-2">
            <Check aria-hidden className="mt-1 size-4 shrink-0 text-allow" />
            Paid 0.25 USDC to Weatherly. 58.45 USDC left today.
          </p>
        </li>
        <li className="space-y-2">
          <p className="flex flex-wrap items-center gap-2 text-small text-carbon/80">
            <code className="rounded-[var(--radius-sm)] bg-carbon px-1.5 py-0.5 font-mono text-signal">
              halora_pay
            </code>
            18 USDC to MapTile
          </p>
          <p className="flex items-start gap-2">
            <Hourglass aria-hidden className="mt-1 size-4 shrink-0 text-signal-deep" />
            Above your 10 USDC threshold. I asked the owner to approve it and will continue once
            they do.
          </p>
        </li>
      </ol>
    </figure>
  );
}
