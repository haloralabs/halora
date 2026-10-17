import type { CSSProperties, ReactNode } from 'react';
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

const TICKS = 48;

/**
 * The signature data display: an instrument dial whose ring fills in signal yellow as the agent
 * spends against its daily limit, and turns red at the limit. State never relies on colour alone:
 * the centre always states the numbers. The ring fills from empty on first render through
 * `@starting-style`, with no script.
 */
export function HaloMeter({
  value,
  size = 176,
  stroke = 12,
  label,
  valueText,
  children,
  className,
}: HaloMeterProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2 - 10;
  const c = 2 * Math.PI * r;
  const state = clamped >= 1 ? 'full' : clamped >= 0.75 ? 'high' : 'ok';
  const center = size / 2;
  const lit = Math.round(clamped * TICKS);

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuetext={valueText}
      data-state={state}
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        {Array.from({ length: TICKS }, (_, i) => {
          const a = (i / TICKS) * 2 * Math.PI;
          const outer = center - 2;
          const inner = outer - (i % 6 === 0 ? 6 : 3);
          return (
            <line
              key={i}
              x1={center + Math.cos(a) * inner}
              y1={center + Math.sin(a) * inner}
              x2={center + Math.cos(a) * outer}
              y2={center + Math.sin(a) * outer}
              stroke={i < lit ? 'var(--fg-muted)' : 'var(--line-strong)'}
              strokeWidth={1.5}
            />
          );
        })}
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={state === 'full' ? 'var(--danger)' : 'var(--halo-gold)'}
          strokeWidth={stroke}
          strokeDasharray={c}
          style={
            {
              '--c': c,
              strokeDashoffset: c * (1 - clamped),
              transition: 'stroke-dashoffset 1000ms var(--ease-out), stroke 300ms ease',
            } as CSSProperties
          }
          className="starting:[stroke-dashoffset:var(--c)]"
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
      className={cn('h-2 w-full overflow-hidden rounded-[2px] bg-surface-2', className)}
    >
      <div
        className={cn(
          'h-full origin-left transition-transform duration-700 ease-[var(--ease-out)] starting:scale-x-0',
          clamped >= 1 ? 'bg-danger' : 'bg-gold',
        )}
        style={{ transform: `scaleX(${clamped})` }}
      />
    </div>
  );
}
