import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

const control =
  'w-full rounded-[var(--radius-md)] border border-line-strong bg-surface px-3.5 text-base text-fg placeholder:text-subtle transition-[border-color] duration-150 hover:border-subtle focus-visible:border-focus aria-[invalid=true]:border-danger disabled:opacity-60';

export function Input({
  className,
  suffix,
  ...rest
}: ComponentProps<'input'> & { suffix?: ReactNode }) {
  if (!suffix) return <input className={cn(control, 'h-11', className)} {...rest} />;
  return (
    <div className="relative">
      <input className={cn(control, 'h-11 pr-16', className)} {...rest} />
      <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs font-medium tracking-wide text-subtle">
        {suffix}
      </span>
    </div>
  );
}

export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return <textarea className={cn(control, 'min-h-24 py-3 leading-relaxed', className)} {...rest} />;
}
