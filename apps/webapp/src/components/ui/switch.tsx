'use client';

import { cn } from '@/lib/cn';

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  tone?: 'gold' | 'danger';
  id?: string;
};

/** Accessible on/off control (role="switch") with a visible label. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  tone = 'gold',
  id,
}: SwitchProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start justify-between gap-4',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-fg">{label}</span>
        {description && <span className="text-xs leading-relaxed text-subtle">{description}</span>}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200',
          checked
            ? tone === 'danger'
              ? 'border-danger bg-danger'
              : 'border-gold bg-gold'
            : 'border-line-strong bg-surface-2',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'inline-block size-4.5 rounded-full bg-surface shadow-sm transition-transform duration-200 ease-out',
            checked ? 'translate-x-[1.375rem]' : 'translate-x-[0.1875rem]',
          )}
        />
      </button>
    </label>
  );
}
