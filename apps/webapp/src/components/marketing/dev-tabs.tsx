'use client';

import { useState } from 'react';
import { CopyButton } from '@/components/ui/copy-button';
import { cn } from '@/lib/cn';
import { PLACEHOLDER, installSnippet, mcpSnippet, sdkSnippet } from '@/lib/snippets';

const TABS = [
  { id: 'sdk', label: 'TypeScript SDK', file: 'agent.ts', code: () => sdkSnippet(PLACEHOLDER) },
  { id: 'mcp', label: 'MCP server', file: 'mcp.json', code: () => mcpSnippet(PLACEHOLDER) },
] as const;

/** The integration code, shown as the product's own editor fragment on the night field. */
export function DevTabs() {
  const [active, setActive] = useState<(typeof TABS)[number]['id']>('sdk');
  const tab = TABS.find((t) => t.id === active)!;
  const code = tab.code();

  return (
    <div
      data-ui
      data-spotlight
      className="overflow-hidden rounded-[var(--radius-lg)] border border-night-line bg-night-1 text-frost"
    >
      <div className="flex items-center justify-between gap-2 border-b border-night-line px-2 pt-2">
        <div role="tablist" aria-label="Integration options" className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={active === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={active === t.id ? 0 : -1}
              onClick={() => setActive(t.id)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                const next =
                  TABS[
                    (TABS.indexOf(t) + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) %
                      TABS.length
                  ]!;
                setActive(next.id);
                document.getElementById(`tab-${next.id}`)?.focus();
              }}
              className={cn(
                '-mb-px min-h-11 px-4 font-mono text-[0.875rem] transition-colors duration-[var(--t-hover)]',
                active === t.id
                  ? 'border-b-2 border-signal text-frost'
                  : 'text-mist hover:text-frost',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel" id={`panel-${tab.id}`} aria-labelledby={`tab-${tab.id}`}>
        {tab.id === 'sdk' && (
          <div className="flex items-center justify-between gap-3 px-5 pt-4">
            <pre className="overflow-x-auto font-mono text-[0.875rem] text-signal">
              <code>$ {installSnippet()}</code>
            </pre>
            <CopyButton
              value={installSnippet()}
              label="Copy install command"
              className="text-mist hover:bg-night-2 hover:text-frost"
            />
          </div>
        )}
        <div className="flex items-center justify-between px-5 pt-4 text-[0.8125rem] text-mist">
          <span>{tab.file}</span>
          <CopyButton
            value={code}
            label={`Copy ${tab.file}`}
            className="text-mist hover:bg-night-2 hover:text-frost"
          />
        </div>
        <pre
          key={tab.id}
          className="animate-rise max-h-[460px] overflow-auto px-5 pt-2 pb-6 font-mono text-[0.8125rem] leading-[1.7] text-frost/90 sm:text-[0.875rem]"
        >
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
