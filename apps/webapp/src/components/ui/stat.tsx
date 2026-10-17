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
      <dt className="text-sm text-subtle">{label}</dt>
      <dd className="flex items-baseline gap-1.5">
        <span className="tabular text-[2.25rem] leading-none font-semibold tracking-[-0.035em] text-fg">
          {value}
        </span>
        {unit && <span className="text-sm font-medium text-subtle">{unit}</span>}
      </dd>
      {hint && <dd className="text-sm text-muted">{hint}</dd>}
    </div>
  );
}
