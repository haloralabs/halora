'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button, Field, Input, Switch } from '@/components/ui';
import { isValidRecipient, MAX_ALLOWLIST, type PolicyFormValues } from '@/lib/policy';
import { truncateMiddle } from '@/lib/format';

type Errors = Partial<Record<keyof PolicyFormValues | 'policy', string>>;

/**
 * Controlled policy editor used by both "create agent" and "edit policy". Amounts are entered in
 * USDC and converted to base units by `policyFromForm` on submit.
 */
export function PolicyFields({
  values,
  onChange,
  errors = {},
  showPause = true,
}: {
  values: PolicyFormValues;
  onChange: (next: PolicyFormValues) => void;
  errors?: Errors;
  showPause?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string | undefined>();
  const set = <K extends keyof PolicyFormValues>(key: K, value: PolicyFormValues[K]) =>
    onChange({ ...values, [key]: value });

  const addRecipient = () => {
    const address = draft.trim();
    if (!isValidRecipient(address))
      return setDraftError('Enter a valid G... or C... Stellar address.');
    if (values.allowlist.includes(address))
      return setDraftError('That address is already on the list.');
    if (values.allowlist.length >= MAX_ALLOWLIST)
      return setDraftError(`At most ${MAX_ALLOWLIST} recipients.`);
    set('allowlist', [...values.allowlist, address]);
    setDraft('');
    setDraftError(undefined);
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      <fieldset className="space-y-5">
        <legend className="mb-4 text-base font-semibold text-fg">Spending limits</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Per payment limit"
            error={errors.perTxLimit}
            hint="The most a single transfer can move."
          >
            <Input
              inputMode="decimal"
              suffix="USDC"
              value={values.perTxLimit}
              onChange={(e) => set('perTxLimit', e.target.value)}
            />
          </Field>
          <Field
            label="Daily limit"
            error={errors.dailyLimit}
            hint="Total per UTC day, tracked inside the contract."
          >
            <Input
              inputMode="decimal"
              suffix="USDC"
              value={values.dailyLimit}
              onChange={(e) => set('dailyLimit', e.target.value)}
            />
          </Field>
        </div>
        <Field
          label="Approval threshold"
          error={errors.approvalThreshold}
          hint="Payments above this amount need your approval first. Set it at or above the per payment limit to never be asked."
        >
          <Input
            inputMode="decimal"
            suffix="USDC"
            value={values.approvalThreshold}
            onChange={(e) => set('approvalThreshold', e.target.value)}
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-5 border-t border-line pt-7">
        <legend className="sr-only">Recipients</legend>
        <Switch
          label="Only pay approved recipients"
          description="When on, the contract rejects any transfer to an address that is not on this list."
          checked={values.allowlistEnabled}
          onCheckedChange={(v) => set('allowlistEnabled', v)}
        />
        {values.allowlistEnabled && (
          <div className="space-y-3">
            <Field
              label="Add recipient"
              error={draftError ?? errors.allowlist}
              aside={`${values.allowlist.length} of ${MAX_ALLOWLIST}`}
            >
              <Input
                placeholder="G... or C..."
                className="font-mono"
                value={draft}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addRecipient();
                  }
                }}
              />
            </Field>
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus className="size-3.5" aria-hidden />}
              onClick={addRecipient}
            >
              Add to allowlist
            </Button>
            {values.allowlist.length > 0 && (
              <ul
                className="divide-y divide-line rounded-[var(--radius-md)] border border-line"
                aria-label="Allowed recipients"
              >
                {values.allowlist.map((a) => (
                  <li key={a} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="truncate font-mono text-[0.8125rem] text-fg" title={a}>
                      <span className="sm:hidden">{truncateMiddle(a, 6, 6)}</span>
                      <span className="hidden sm:inline">{a}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          'allowlist',
                          values.allowlist.filter((x) => x !== a),
                        )
                      }
                      className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-md)] text-subtle hover:bg-danger-soft hover:text-danger sm:size-9"
                      aria-label={`Remove ${truncateMiddle(a)}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-5 border-t border-line pt-7">
        <legend className="sr-only">Lifetime</legend>
        <Field
          label="Expires on"
          aside="optional"
          error={errors.expiresOn}
          hint="After the end of this day (UTC) the agent key can no longer pay. Leave empty for no expiry."
        >
          <Input
            type="date"
            min={today}
            value={values.expiresOn}
            onChange={(e) => set('expiresOn', e.target.value)}
          />
        </Field>
        {showPause && (
          <Switch
            tone="danger"
            label="Paused"
            description="Blocks every agent payment until you unpause. Your owner key still works."
            checked={values.paused}
            onCheckedChange={(v) => set('paused', v)}
          />
        )}
      </fieldset>
    </div>
  );
}
