'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Rocket, Sparkles } from 'lucide-react';
import { Keypair } from '@stellar/stellar-sdk';
import { useState } from 'react';
import { PageHeader } from '@/components/dashboard/page-header';
import { PolicyFields } from '@/components/dashboard/policy-fields';
import {
  Address,
  Button,
  ButtonLink,
  Callout,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  CopyButton,
  Field,
  Input,
  Tabs,
} from '@/components/ui';
import {
  DEFAULT_POLICY_FORM,
  isValidAccountKey,
  policyFromForm,
  type PolicyFormValues,
} from '@/lib/policy';
import { defaultToken, getDataService } from '@/services';
import type { CreateAgentResult } from '@/services/types';
import { useOwnerSession, useSession } from '@/stores/session';

type Errors = Partial<Record<keyof PolicyFormValues | 'policy' | 'label' | 'agentKey', string>>;

export default function NewAgentPage() {
  const owner = useOwnerSession();
  const invalidate = useSession((s) => s.invalidate);
  const [label, setLabel] = useState('');
  const [keyMode, setKeyMode] = useState('generate');
  const [generated, setGenerated] = useState<{ publicKey: string; secret: string } | null>(null);
  const [pasted, setPasted] = useState('');
  const [values, setValues] = useState<PolicyFormValues>(DEFAULT_POLICY_FORM);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateAgentResult | null>(null);
  const [stored, setStored] = useState(false);

  const agentPublicKey = keyMode === 'generate' ? (generated?.publicKey ?? '') : pasted.trim();

  const generate = () => {
    // Generated locally in this tab. The secret is never sent anywhere.
    const kp = Keypair.random();
    setGenerated({ publicKey: kp.publicKey(), secret: kp.secret() });
  };

  const submit = async () => {
    const next: Errors = {};
    if (label.trim().length < 2) next.label = 'Give the agent a name of at least 2 characters.';
    if (!isValidAccountKey(agentPublicKey)) {
      next.agentKey =
        keyMode === 'generate' ? 'Generate an agent key first.' : 'Enter a valid G... public key.';
    } else if (agentPublicKey === owner?.publicKey) {
      next.agentKey = 'The agent key must be different from your owner key.';
    }
    const policy = policyFromForm(values, defaultToken());
    if (!policy.ok) Object.assign(next, policy.errors);
    setErrors(next);
    if (Object.keys(next).length > 0 || !policy.ok || !owner) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      setResult(
        await getDataService().createAgent(owner, {
          label: label.trim(),
          agentPublicKey,
          policy: policy.policy,
        }),
      );
      invalidate();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'The account was not deployed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const { account, apiKey } = result;
    const secret = keyMode === 'generate' ? generated?.secret : undefined;
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-[var(--radius-lg)] bg-signal text-carbon">
            <CheckCircle2 className="size-6" aria-hidden />
          </span>
          <h1 className="mt-6 text-[2.5rem] leading-[1] font-semibold tracking-[-0.045em] text-fg sm:text-5xl">
            {account.label} has its halo
          </h1>
          <p className="mt-2 text-muted">
            The account contract is deployed with your policy. You are its owner.
          </p>
        </div>
        <Card>
          <CardBody className="space-y-5">
            <div>
              <p className="text-xs text-subtle">Account contract ID</p>
              <Address value={account.contractId} head={10} tail={8} />
            </div>
            <div>
              <p className="mb-1.5 text-xs text-subtle">API key (shown once)</p>
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-surface-2 px-4 py-2.5">
                <code className="min-w-0 flex-1 truncate font-mono text-sm text-fg">{apiKey}</code>
                <CopyButton value={apiKey} label="Copy API key" />
              </div>
            </div>
            {secret && (
              <div>
                <p className="mb-1.5 text-xs text-subtle">
                  Agent secret key (shown once, never stored by Halora)
                </p>
                <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-gold/50 bg-warning-soft px-4 py-2.5">
                  <code className="min-w-0 flex-1 truncate font-mono text-sm text-fg">
                    {secret}
                  </code>
                  <CopyButton value={secret} label="Copy agent secret" />
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm text-fg">
                  <input
                    type="checkbox"
                    checked={stored}
                    onChange={(e) => setStored(e.target.checked)}
                    className="size-4 accent-[var(--halo-gold)]"
                  />
                  I stored the agent secret and API key somewhere safe
                </label>
              </div>
            )}
            <Callout tone="info" title="Next: fund the account">
              Send USDC to the account contract ID from any Stellar wallet. The agent can only spend
              it within the policy.
            </Callout>
          </CardBody>
          <CardFooter>
            <ButtonLink href={`/dashboard/agents/${account.contractId}`} variant="ghost">
              View agent
            </ButtonLink>
            {secret && !stored ? (
              <Button disabled>Connect your agent</Button>
            ) : (
              <ButtonLink
                href={`/dashboard/agents/${account.contractId}/connect`}
                icon={<ArrowRight className="size-4" aria-hidden />}
                className="flex-row-reverse"
              >
                Connect your agent
              </ButtonLink>
            )}
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow={
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 hover:text-fg">
            <ArrowLeft className="size-3.5" aria-hidden />
            All agents
          </Link>
        }
        title="New agent wallet"
        description="Deploys a halora-account contract owned by your wallet. The policy below is enforced on-chain by the account contract from the first payment."
      />
      <form
        noValidate
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Agent</CardTitle>
              <CardDescription>
                A name for you, and the key the agent will sign payments with.
              </CardDescription>
            </div>
          </CardHeader>
          <CardBody className="space-y-6">
            <Field label="Name" error={errors.label}>
              <Input
                placeholder="Research assistant"
                value={label}
                maxLength={60}
                onChange={(e) => setLabel(e.target.value)}
              />
            </Field>
            <Tabs
              label="Agent key source"
              value={keyMode}
              onValueChange={setKeyMode}
              items={[
                {
                  id: 'generate',
                  label: 'Generate a key',
                  content: (
                    <div className="space-y-3">
                      {generated ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] bg-surface-2 px-4 py-3">
                          <span className="text-sm text-muted">
                            Agent public key{' '}
                            <Address value={generated.publicKey} head={6} tail={6} />
                          </span>
                          <Button variant="ghost" size="sm" onClick={generate}>
                            Regenerate
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={generate}
                          icon={<Sparkles className="size-4" aria-hidden />}
                        >
                          Generate agent key in this browser
                        </Button>
                      )}
                      <p className="text-xs text-subtle">
                        Created locally. You will see the secret once, after deployment, to hand to
                        your agent.
                      </p>
                      {errors.agentKey && keyMode === 'generate' && (
                        <p role="alert" className="text-xs font-medium text-danger">
                          {errors.agentKey}
                        </p>
                      )}
                    </div>
                  ),
                },
                {
                  id: 'paste',
                  label: 'Use my own key',
                  content: (
                    <Field
                      label="Agent public key"
                      error={errors.agentKey}
                      hint="Only the public key. Keep the secret with your agent."
                    >
                      <Input
                        className="font-mono"
                        placeholder="G..."
                        spellCheck={false}
                        value={pasted}
                        onChange={(e) => setPasted(e.target.value)}
                      />
                    </Field>
                  ),
                },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-4 text-accent" aria-hidden />
                Policy
              </CardTitle>
              <CardDescription>
                Amounts in USDC. You can change any of this later with your owner wallet.
              </CardDescription>
            </div>
          </CardHeader>
          <CardBody>
            <PolicyFields values={values} onChange={setValues} errors={errors} showPause={false} />
          </CardBody>
          <CardFooter className="justify-between">
            <p className="text-xs text-subtle">Your wallet signs one deployment transaction.</p>
            <Button
              type="submit"
              size="lg"
              loading={submitting}
              icon={<Rocket className="size-4" aria-hidden />}
            >
              Deploy agent wallet
            </Button>
          </CardFooter>
        </Card>
        {Object.keys(errors).length > 0 && (
          <Callout tone="danger" title="Check the highlighted fields">
            Nothing was signed.
          </Callout>
        )}
        {submitError && (
          <Callout tone="danger" title="Not deployed">
            {submitError}
          </Callout>
        )}
      </form>
    </div>
  );
}
