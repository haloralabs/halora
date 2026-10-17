'use client';

import { Check, Clock, PenLine, X } from 'lucide-react';
import { useState } from 'react';
import { Address, Badge, Button, Callout, Field, Textarea, type BadgeTone } from '@/components/ui';
import type { ApprovalRequest, ApprovalStatus } from '@/lib/domain';
import { formatAmount } from '@/lib/money';
import { formatDateTime, formatRelative } from '@/lib/format';

const STATUS: Record<ApprovalStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Waiting for you', tone: 'gold' },
  approved: { label: 'Approved', tone: 'success' },
  submitted: { label: 'Paid', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'neutral' },
};

type ApprovalCardProps = {
  approval: ApprovalRequest;
  agentLabel: string;
  /** Agent's spent-today and daily limit, to warn when an approval would fail on-chain anyway. */
  limits?: { spentToday: string; dailyLimit: string; paused: boolean };
  /** Receives the chosen on-chain approval expiry, unix seconds. */
  onApprove: (expiresAt: number) => Promise<void>;
  onReject: (reason?: string) => Promise<void>;
  now?: number;
};

export const APPROVAL_WINDOWS = [
  { minutes: 15, label: '15 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 24 * 60, label: '24 hours' },
] as const;

export function ApprovalCard({
  approval,
  agentLabel,
  limits,
  onApprove,
  onReject,
  now,
}: ApprovalCardProps) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [windowMinutes, setWindowMinutes] = useState<number>(APPROVAL_WINDOWS[0].minutes);
  const status = STATUS[approval.status];
  const pending = approval.status === 'pending';
  const overDaily =
    limits && BigInt(limits.spentToday) + BigInt(approval.amount) > BigInt(limits.dailyLimit);

  const run = async (kind: 'approve' | 'reject', fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <article
      aria-label={`${formatAmount(approval.amount)} USDC request from ${agentLabel}`}
      className="rounded-[var(--radius-xl)] bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            <span className="font-medium text-fg">{agentLabel}</span> wants to pay
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="tabular text-[2.75rem] leading-none font-semibold tracking-[-0.045em] text-fg">
              {formatAmount(approval.amount)}
            </span>
            <span className="text-sm font-medium text-subtle">USDC</span>
          </p>
        </div>
        <Badge tone={status.tone} dot={pending}>
          {status.label}
        </Badge>
      </div>

      <blockquote className="mt-4 border-l-2 border-gold/60 pl-4 text-[0.9375rem] leading-relaxed text-fg">
        {approval.reason}
      </blockquote>
      <p className="mt-1.5 pl-4 text-xs text-subtle">
        Reason provided by the agent. Verify it before signing.
      </p>

      <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-subtle">Recipient</dt>
          <dd className="mt-0.5">
            <Address value={approval.to} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-subtle">Requested</dt>
          <dd className="mt-0.5 text-fg" title={formatDateTime(approval.createdAt)}>
            {formatRelative(approval.createdAt, now)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-subtle">{pending ? 'Expires' : 'Expired at'}</dt>
          <dd
            className="mt-0.5 flex items-center gap-1.5 text-fg"
            title={formatDateTime(approval.expiresAt)}
          >
            <Clock className="size-3.5 text-subtle" aria-hidden />
            {pending ? formatRelative(approval.expiresAt, now) : formatDateTime(approval.expiresAt)}
          </dd>
        </div>
      </dl>

      {pending && limits?.paused && (
        <Callout tone="warning" title="This agent is paused" className="mt-5">
          The contract will reject this payment until you unpause the agent, even with your
          approval.
        </Callout>
      )}
      {pending && overDaily && !limits?.paused && (
        <Callout tone="warning" title="This payment would exceed today's limit" className="mt-5">
          Your approval does not override the daily limit. The contract will reject it until the
          limit resets at 00:00 UTC or you raise it.
        </Callout>
      )}
      {error && (
        <Callout tone="danger" title="Not completed" className="mt-5">
          {error}
        </Callout>
      )}

      {pending && rejecting && (
        <div className="mt-5 space-y-3">
          <Field
            label="Reason for rejecting"
            aside="optional"
            hint="Shared with the agent so it can adjust."
          >
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={280} />
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejecting(false)} disabled={busy !== null}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={<X className="size-4" aria-hidden />}
              loading={busy === 'reject'}
              onClick={() => run('reject', () => onReject(reason.trim() || undefined))}
            >
              Reject request
            </Button>
          </div>
        </div>
      )}

      {pending && !rejecting && (
        <div className="mt-6 flex flex-col gap-4 border-t border-line pt-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 text-xs text-subtle sm:flex-row sm:items-center sm:gap-3">
            <p className="flex items-center gap-2">
              <PenLine className="size-3.5 shrink-0" aria-hidden />
              Approving signs an on-chain approval for this recipient and amount, usable once, valid
              for
            </p>
            <label className="sr-only" htmlFor={`window-${approval.id}`}>
              Approval valid for
            </label>
            <select
              id={`window-${approval.id}`}
              value={windowMinutes}
              onChange={(e) => setWindowMinutes(Number(e.target.value))}
              className="min-h-11 w-fit rounded-[var(--radius-md)] border border-line-strong bg-surface px-3 text-sm font-medium text-fg sm:min-h-9"
            >
              {APPROVAL_WINDOWS.map((w) => (
                <option key={w.minutes} value={w.minutes}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejecting(true)} disabled={busy !== null}>
              Reject
            </Button>
            <Button
              icon={<Check className="size-4" aria-hidden />}
              loading={busy === 'approve'}
              disabled={busy !== null}
              onClick={() =>
                run('approve', () =>
                  onApprove(Math.floor((now ?? Date.now()) / 1000) + windowMinutes * 60),
                )
              }
            >
              Approve and sign
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
