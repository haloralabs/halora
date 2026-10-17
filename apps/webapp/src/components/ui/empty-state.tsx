import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <span className="mb-5 grid size-14 place-items-center rounded-[var(--radius-lg)] bg-signal text-carbon">
        <Icon className="size-6" aria-hidden />
      </span>
      <h3 className="text-2xl font-semibold tracking-[-0.03em] text-fg">{title}</h3>
      {children && (
        <div className="mt-2 max-w-md text-sm leading-relaxed text-muted">{children}</div>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
