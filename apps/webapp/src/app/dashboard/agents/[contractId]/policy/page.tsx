'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, PenLine } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/dashboard/page-header';
import { PolicyFields } from '@/components/dashboard/policy-fields';
import { Button, ButtonLink, Callout, Card, CardBody, CardFooter, Skeleton } from '@/components/ui';
import { useResource } from '@/hooks/use-resource';
import { policyFromForm, policyToForm, type PolicyFormValues } from '@/lib/policy';
import { getDataService } from '@/services';
import { useOwnerSession, useSession } from '@/stores/session';

type Errors = Partial<Record<keyof PolicyFormValues | 'policy', string>>;

export default function EditPolicyPage() {
  const { contractId } = useParams<{ contractId: string }>();
  const router = useRouter();
  const owner = useOwnerSession();
  const invalidate = useSession((s) => s.invalidate);
  const agent = useResource(owner ? `agent:${contractId}` : null, () =>
    getDataService().getAgent(owner!, contractId),
  );
  const [values, setValues] = useState<PolicyFormValues | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed the form once the policy loads
    if (agent.data && values === null) setValues(policyToForm(agent.data.policy));
  }, [agent.data, values]);

  if (agent.error)
    return (
      <Callout tone="danger" title="Could not load this agent">
        {agent.error}
      </Callout>
    );
  if (!agent.data || !values) return <Skeleton className="h-[32rem] rounded-[var(--radius-lg)]" />;
  const { account, policy } = agent.data;

  const save = async () => {
    const result = policyFromForm(values, policy.token);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitError(null);
    setSaving(true);
    try {
      await getDataService().updatePolicy(owner!, contractId, result.policy);
      invalidate();
      router.push(`/dashboard/agents/${contractId}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'The policy was not updated.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
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
        title="Edit policy"
        description="Changes are a set_policy transaction signed by your owner wallet. They apply to the next payment. Spending already counted today is kept."
      />
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Card>
          <CardBody className="pt-6">
            <PolicyFields values={values} onChange={setValues} errors={errors} />
            {Object.keys(errors).length > 0 && (
              <Callout tone="danger" title="Check the highlighted fields" className="mt-6">
                Nothing was signed.
              </Callout>
            )}
            {submitError && (
              <Callout tone="danger" title="Not saved" className="mt-6">
                {submitError}
              </Callout>
            )}
          </CardBody>
          <CardFooter>
            <ButtonLink href={`/dashboard/agents/${contractId}`} variant="ghost">
              Cancel
            </ButtonLink>
            <Button
              type="submit"
              loading={saving}
              icon={<PenLine className="size-4" aria-hidden />}
            >
              Sign and save
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
