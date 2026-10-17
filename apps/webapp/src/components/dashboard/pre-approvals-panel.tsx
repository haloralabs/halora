'use client';

import { Clock, Plus, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import {
  Address,
  Button,
  Callout,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
} from '@/components/ui';
import { useResource } from '@/hooks/use-resource';
import { formatDateTime, formatRelative } from '@/lib/format';
import { formatAmount, tryToBaseUnits } from '@/lib/money';
import { isValidRecipient } from '@/lib/policy';
import { getDataService } from '@/services';
import { useOwnerSession, useSession } from '@/stores/session';

const HOURS = [
  { value: 1, label: '1 hour' },
  { value: 24, label: '24 hours' },
  { value: 24 * 7, label: '7 days' },
];

/**
 * Active on-chain pre-approvals for one account, plus a form to grant one proactively. A
 * pre-approval lets the next agent payment to that recipient, up to the amount, pass the approval
 * threshold once. Per payment and daily limits still apply.
 */
export function PreApprovalsPanel({ contractId }: { contractId: string }) {
  const owner = useOwnerSession();
  const invalidate = useSession((s) => s.invalidate);
  const { data, loading, error } = useResource(owner ? `preapprovals:${contractId}` : null, () =>
    getDataService().listPreApprovals(owner!, contractId),
  );
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [hours, setHours] = useState(24);
  const [errors, setErrors] = useState<{ to?: string; amount?: string; form?: string }>({});
  const [busy, setBusy] = useState<string | null>(null);

  const submit = async () => {
    const next: typeof errors = {};
    if (!isValidRecipient(to.trim())) next.to = 'Enter a valid G... or C... Stellar address.';
    const units = tryToBaseUnits(amount);
    if (!units || BigInt(units) <= 0n) next.amount = 'Enter an amount above zero.';
    setErrors(next);
    if (Object.keys(next).length > 0 || !owner || !units) return;
    setBusy('grant');
    try {
      await getDataService().preApprove(owner, contractId, {
        to: to.trim(),
        amount: units,
        expiresAt: Math.floor(Date.now() / 1000) + hours * 3600,
      });
      setOpen(false);
      setTo('');
      setAmount('');
      invalidate();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'The approval was not saved.' });
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (recipient: string) => {
    if (!owner) return;
    setBusy(recipient);
    try {
      await getDataService().revokePreApproval(owner, contractId, recipient);
      invalidate();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'The approval was not revoked.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Active approvals</CardTitle>
          <CardDescription>
            One-time, on-chain permissions above the approval threshold.
          </CardDescription>
        </div>
        {!open && (
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus className="size-3.5" aria-hidden />}
            onClick={() => setOpen(true)}
          >
            Pre-approve
          </Button>
        )}
      </CardHeader>
      <CardBody className="space-y-4">
        {errors.form && (
          <Callout tone="danger" title="Not completed">
            {errors.form}
          </Callout>
        )}
        {open && (
          <div className="space-y-4 rounded-[var(--radius-lg)] bg-surface-2 p-4">
            <Field label="Recipient" error={errors.to}>
              <Input
                className="font-mono"
                placeholder="G... or C..."
                value={to}
                spellCheck={false}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Up to" error={errors.amount}>
                <Input
                  inputMode="decimal"
                  suffix="USDC"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
              <Field label="Valid for">
                <select
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  className="h-11 w-full rounded-[var(--radius-md)] border border-line-strong bg-surface px-3.5 text-base text-fg"
                >
                  {HOURS.map((h) => (
                    <option key={h.value} value={h.value}>
                      {h.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="text-xs text-subtle">
              Replaces any existing approval for this recipient. Used once by the next matching
              payment.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy !== null}>
                Cancel
              </Button>
              <Button
                loading={busy === 'grant'}
                onClick={submit}
                icon={<ShieldCheck className="size-4" aria-hidden />}
              >
                Sign approval
              </Button>
            </div>
          </div>
        )}
        {error && <Callout tone="danger">{error}</Callout>}
        {loading && !data && (
          <p className="text-sm text-subtle">Reading approvals from the contract...</p>
        )}
        {data && data.length === 0 && !open && (
          <p className="text-sm text-muted">
            No active approvals. Payments above the threshold will wait for you.
          </p>
        )}
        {data && data.length > 0 && (
          <ul className="divide-y divide-line">
            {data.map((a) => (
              <li
                key={a.to}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="tabular font-medium text-fg">
                    Up to {formatAmount(a.amount)} <span className="text-xs text-subtle">USDC</span>
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-subtle">
                    <Address value={a.to} />
                    <span
                      className="inline-flex items-center gap-1"
                      title={formatDateTime(new Date(a.expiresAt * 1000).toISOString())}
                    >
                      <Clock className="size-3" aria-hidden />
                      expires {formatRelative(new Date(a.expiresAt * 1000).toISOString())}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busy === a.to}
                  icon={<X className="size-3.5" aria-hidden />}
                  onClick={() => revoke(a.to)}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
