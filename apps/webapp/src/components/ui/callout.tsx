import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const styles: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: { box: 'border-info/25 bg-info-soft text-info', Icon: Info },
  success: { box: 'border-success/25 bg-success-soft text-success', Icon: CheckCircle2 },
  warning: { box: 'border-warning/30 bg-warning-soft text-warning', Icon: AlertTriangle },
  danger: { box: 'border-danger/30 bg-danger-soft text-danger', Icon: ShieldAlert },
};

export function Callout({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { box, Icon } = styles[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-sm',
        box,
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed text-fg/85">{children}</div>}
      </div>
    </div>
  );
}
