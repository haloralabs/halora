'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, KeyRound, RefreshCw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/dashboard/page-header';
import {
  Button,
  Callout,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  CodeBlock,
  CopyButton,
  Skeleton,
  Tabs,
} from '@/components/ui';
import { useResource } from '@/hooks/use-resource';
import { config } from '@/lib/config';
import {
  MCP_TOOLS,
  envSnippet,
  installSnippet,
  mcpSnippet,
  sdkSnippet,
  type SnippetParams,
} from '@/lib/snippets';
import { getDataService } from '@/services';
import { useOwnerSession } from '@/stores/session';

export default function ConnectAgentPage() {
  const { contractId } = useParams<{ contractId: string }>();
  const owner = useOwnerSession();
  const agent = useResource(owner ? `agent:${contractId}` : null, () =>
    getDataService().getAgent(owner!, contractId),
  );
  const [tab, setTab] = useState('sdk');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);

  if (agent.error)
    return (
      <Callout tone="danger" title="Could not load this agent">
        {agent.error}
      </Callout>
    );
  if (!agent.data) return <Skeleton className="h-96 rounded-[var(--radius-lg)]" />;
  const { account } = agent.data;
  const params: SnippetParams = { contractId, network: account.network, apiUrl: config.apiUrl };

  const rotate = async () => {
    if (!owner) return;
    setRotating(true);
    setRotateError(null);
    try {
      setApiKey(await getDataService().rotateApiKey(owner, contractId));
    } catch (err) {
      setRotateError(err instanceof Error ? err.message : 'A new key was not issued.');
    } finally {
      setRotating(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        eyebrow={
          <Link
            href={`/dashboard/agents/${contractId}`}
            className="inline-flex items-center gap-1.5 hover:text-fg"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            {account.label}
          </Link>
        }
        title="Connect your agent"
        description="Your agent needs three things: this account's contract ID, its own agent secret key, and an API key for approvals and the payment log."
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-accent" aria-hidden />
              API key
            </CardTitle>
            <CardDescription>
              Lets the agent open approval requests and read its payment log. It cannot move funds
              or change the policy.
            </CardDescription>
          </div>
          <Button
            variant="secondary"
            size="sm"
            loading={rotating}
            onClick={rotate}
            icon={<RefreshCw className="size-3.5" aria-hidden />}
          >
            {apiKey ? 'Rotate again' : 'Issue new key'}
          </Button>
        </CardHeader>
        <CardBody className="space-y-4">
          {apiKey ? (
            <>
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-gold/50 bg-warning-soft px-4 py-3">
                <code className="min-w-0 flex-1 truncate font-mono text-sm text-fg">{apiKey}</code>
                <CopyButton value={apiKey} label="Copy API key" />
              </div>
              <Callout tone="warning" title="Copy it now">
                This key is shown once. Halora stores only a hash. The previous key stopped working.
              </Callout>
            </>
          ) : (
            <p className="text-sm text-muted">
              Keys are shown only when issued. If you lost the key from setup, issue a new one; the
              old key stops working.
            </p>
          )}
          {rotateError && <Callout tone="danger">{rotateError}</Callout>}
        </CardBody>
      </Card>

      <section aria-labelledby="env-title" className="space-y-3">
        <h2 id="env-title" className="text-sm font-semibold text-fg">
          Environment
        </h2>
        <CodeBlock label=".env" code={envSnippet(params, apiKey ?? undefined)} />
        <p className="flex items-start gap-2 text-xs leading-relaxed text-subtle">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          The agent secret key belongs in your secret manager. Halora never stores it. If it leaks,
          the policy limits what it can spend; rotate it with a new agent key.
        </p>
      </section>

      <section aria-labelledby="int-title" className="space-y-3">
        <h2 id="int-title" className="text-sm font-semibold text-fg">
          Integration
        </h2>
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
                  <CodeBlock label="agent.ts" code={sdkSnippet(params)} />
                </div>
              ),
            },
            {
              id: 'mcp',
              label: 'MCP server',
              content: (
                <div className="space-y-4">
                  <CodeBlock label="mcp.json" code={mcpSnippet(params)} />
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {MCP_TOOLS.map((t) => (
                      <li key={t.name} className="rounded-[var(--radius-lg)] bg-surface-2 p-4">
                        <code className="font-mono text-[0.8125rem] text-accent">{t.name}</code>
                        <p className="mt-1 text-sm text-muted">{t.description}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}
