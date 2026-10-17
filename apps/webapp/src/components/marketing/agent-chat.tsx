import { Check, Hourglass } from 'lucide-react';

/**
 * A real interface fragment: an MCP client conversation in which an agent uses Halora's tools.
 * Tool names and results follow the MCP server in docs/architecture/interfaces.md section 5.
 */
export function AgentChat() {
  return (
    <figure
      data-ui
      className="h-full overflow-hidden rounded-[var(--radius-lg)] border border-night-line bg-night-1"
    >
      <figcaption className="flex items-center justify-between border-b border-night-line px-4 py-3 font-mono text-[0.8125rem] text-mist">
        <span>agent / session</span>
        <span className="flex items-center gap-2">
          <span className="status-dot" aria-hidden />
          mcp: halora
        </span>
      </figcaption>
      <ol className="space-y-5 p-5 text-body">
        <li className="ml-auto max-w-[32ch] rounded-[var(--radius-lg)] bg-night-2 px-4 py-3 text-frost">
          Get tomorrow&apos;s forecast for Lisbon and a tile map of the route.
        </li>
        <li className="space-y-2">
          <p className="flex flex-wrap items-center gap-2 font-mono text-[0.8125rem] text-mist">
            <code className="rounded-[var(--radius-sm)] border border-signal/30 bg-signal/10 px-1.5 py-0.5 text-signal">
              halora_fetch_paid
            </code>
            api.weatherly.dev/forecast
          </p>
          <p className="flex items-start gap-2 text-frost">
            <Check aria-hidden className="mt-1 size-4 shrink-0 text-signal" />
            Paid 0.25 USDC to Weatherly. 58.45 USDC left today.
          </p>
        </li>
        <li className="space-y-2">
          <p className="flex flex-wrap items-center gap-2 font-mono text-[0.8125rem] text-mist">
            <code className="rounded-[var(--radius-sm)] border border-signal/30 bg-signal/10 px-1.5 py-0.5 text-signal">
              halora_pay
            </code>
            18 USDC to MapTile
          </p>
          <p className="flex items-start gap-2 text-frost">
            <Hourglass aria-hidden className="mt-1 size-4 shrink-0 text-held" />
            Above your 10 USDC threshold. I asked the owner to approve it and will continue once
            they do.
          </p>
        </li>
      </ol>
    </figure>
  );
}
