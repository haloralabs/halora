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
      <div className="relative mb-5 grid size-14 place-items-center">
        <span className="halo-ring absolute inset-0 rounded-full opacity-40 blur-md" aria-hidden />
        <span className="relative grid size-14 place-items-center rounded-full border border-line bg-surface">
          <Icon className="size-5 text-accent" aria-hidden />
        </span>
      </div>
      <h3 className="font-display text-2xl text-fg">{title}</h3>
      {children && (
        <div className="mt-2 max-w-md text-sm leading-relaxed text-muted">{children}</div>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
