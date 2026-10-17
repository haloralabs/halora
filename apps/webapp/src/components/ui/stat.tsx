import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Stat({
  label,
  value,
  unit,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <dt className="text-xs font-medium tracking-wide text-subtle uppercase">{label}</dt>
      <dd className="flex items-baseline gap-1.5">
        <span className="tabular font-display text-[1.75rem] leading-none tracking-tight text-fg">
          {value}
        </span>
        {unit && <span className="text-xs font-medium text-subtle">{unit}</span>}
      </dd>
      {hint && <dd className="text-xs text-muted">{hint}</dd>}
    </div>
  );
}
