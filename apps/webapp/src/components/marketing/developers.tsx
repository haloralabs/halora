import { AgentChat } from './agent-chat';
import { DevTabs } from './dev-tabs';
import { SectionHeader } from './section-header';

/** For developers: what the agent sees, and the code behind it. */
export function Developers() {
  return (
    <section
      id="developers"
      data-reveal-root
      aria-labelledby="dev-title"
      className="relative bg-night px-4 py-28 text-frost md:px-8 md:py-36"
    >
      <div className="mx-auto max-w-[1400px]">
        <SectionHeader
          index="04"
          label="For developers"
          id="dev-title"
          title="A few lines"
          dimmed="in your agent."
        >
          Install the SDK, or add the MCP server to any MCP client such as Claude. Both check the
          policy before signing and name the rule a payment broke. Paying an API that answers with
          HTTP 402 is one call, and the agent needs no XLM for fees.
        </SectionHeader>

        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          <div data-reveal style={{ ['--i' as string]: 3 }} className="lg:col-span-5">
            <AgentChat />
          </div>
          <div data-reveal style={{ ['--i' as string]: 4 }} className="min-w-0 lg:col-span-7">
            <DevTabs />
          </div>
        </div>
      </div>
    </section>
  );
}
