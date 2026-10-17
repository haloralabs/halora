'use client';

import { useState } from 'react';
import { CodeBlock, Tabs } from '@/components/ui';
import { PLACEHOLDER, installSnippet, mcpSnippet, sdkSnippet } from '@/lib/snippets';

export function DevTabs() {
  const [tab, setTab] = useState('sdk');
  return (
    <Tabs
      label="Integration options"
      value={tab}
      onValueChange={setTab}
      items={[
        {
          id: 'sdk',
          label: 'TypeScript SDK',
          content: (
            <div className="space-y-3">
              <CodeBlock label="terminal" code={installSnippet()} />
              <CodeBlock label="agent.ts" code={sdkSnippet(PLACEHOLDER)} />
            </div>
          ),
        },
        {
          id: 'mcp',
          label: 'MCP server',
          content: <CodeBlock label="mcp.json" code={mcpSnippet(PLACEHOLDER)} />,
        },
      ]}
    />
  );
}
