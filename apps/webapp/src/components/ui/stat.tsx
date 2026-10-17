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
      <dt className="font-mono text-[0.75rem] tracking-[0.06em] text-subtle uppercase">{label}</dt>
      <dd className="flex items-baseline gap-1.5">
        <span className="font-mono text-[2rem] leading-none font-medium tracking-[-0.02em] text-fg">
          {value}
        </span>
        {unit && <span className="text-sm font-medium text-subtle">{unit}</span>}
      </dd>
      {hint && <dd className="text-sm text-muted">{hint}</dd>}
    </div>
  );
}
