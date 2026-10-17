import { AgentChat } from './agent-chat';
import { DevTabs } from './dev-tabs';

/** For developers: the statement, then its proof: what the agent sees, and the code behind it. */
export function Developers() {
  return (
    <section
      id="developers"
      data-chapter="carbon"
      data-reveal-root
      aria-labelledby="dev-title"
      className="chapter-carbon scroll-mt-0 px-4 py-28 md:px-8 md:py-44"
    >
      <h2
        id="dev-title"
        data-reveal
        className="display max-w-[12ch] text-[11vw] md:max-w-[16ch] md:text-[6.4vw] 2xl:text-[6.5rem]"
      >
        A few lines in your agent.
      </h2>

      <div className="mt-14 grid gap-10 lg:mt-20 lg:grid-cols-12 lg:gap-8">
        <div className="space-y-8 lg:col-span-5">
          <p
            data-reveal
            style={{ ['--i' as string]: 1 }}
            className="max-w-[44ch] text-body leading-relaxed text-paper"
          >
            Install the SDK, or add the MCP server to any MCP client such as Claude. Both check the
            policy before signing and name the rule a payment broke. The contract still has the
            final word. Paying an API that answers with HTTP 402 is one call, and the agent needs no
            XLM for fees.
          </p>
          <div data-reveal style={{ ['--i' as string]: 2 }}>
            <AgentChat />
          </div>
        </div>
        <div data-reveal style={{ ['--i' as string]: 3 }} className="min-w-0 lg:col-span-7">
          <DevTabs />
        </div>
      </div>
    </section>
  );
}
