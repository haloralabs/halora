import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type HaloMeterProps = {
  /** 0 to 1. */
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  /** Accessible value text, for example "12.40 of 25.00 USDC". */
  valueText: string;
  children?: ReactNode;
  className?: string;
};

/**
 * The signature data display: a ring that fills with light as the agent spends against its daily
 * limit. Turns amber past 75 percent and red at the limit, so state never relies on color alone
 * (the center text always states the numbers).
 */
export function HaloMeter({
  value,
  size = 168,
  stroke = 10,
  label,
  valueText,
  children,
  className,
}: HaloMeterProps) {
  const id = useId().replace(/:/g, '');
  const clamped = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2 - 4;
  const c = 2 * Math.PI * r;
  const state = clamped >= 1 ? 'full' : clamped >= 0.75 ? 'high' : 'ok';
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuetext={valueText}
      data-state={state}
      className={cn('relative inline-grid place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            {state === 'full' ? (
              <>
                <stop offset="0" stopColor="var(--danger)" />
                <stop offset="1" stopColor="var(--danger)" />
              </>
            ) : state === 'high' ? (
              <>
                <stop offset="0" stopColor="var(--halo-amber)" />
                <stop offset="1" stopColor="var(--halo-gold)" />
              </>
            ) : (
              <>
                <stop offset="0" stopColor="var(--halo-gold)" />
                <stop offset="1" stopColor="var(--halo-aurora)" />
              </>
            )}
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r + stroke / 2 + 3}
          fill="none"
          stroke="var(--line)"
          strokeWidth={1}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id}-g)`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{
            transition: 'stroke-dashoffset 700ms var(--ease-out)',
            filter: 'drop-shadow(0 0 6px var(--halo-glow))',
          }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** Compact linear version for lists and tables. */
export function MeterBar({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-2', className)}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-700 ease-out',
          clamped >= 1
            ? 'bg-danger'
            : clamped >= 0.75
              ? 'bg-amber'
              : 'bg-[linear-gradient(90deg,var(--halo-gold),var(--halo-aurora))]',
        )}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}
