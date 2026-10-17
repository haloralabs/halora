import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...rest }: ComponentProps<'section'>) {
  return (
    <section
      className={cn('rounded-[var(--radius-xl)] border border-line bg-surface', className)}
      {...rest}
    />
  );
}

export function CardHeader({ className, ...rest }: ComponentProps<'header'>) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6',
        className,
      )}
      {...rest}
    />
  );
}

export function CardTitle({ className, ...rest }: ComponentProps<'h2'>) {
  return (
    <h2 className={cn('text-base font-semibold tracking-[-0.01em] text-fg', className)} {...rest} />
  );
}

export function CardDescription({ className, ...rest }: ComponentProps<'p'>) {
  return <p className={cn('mt-1 text-sm text-muted', className)} {...rest} />;
}

export function CardBody({ className, ...rest }: ComponentProps<'div'>) {
  return <div className={cn('px-5 py-5 sm:px-6', className)} {...rest} />;
}

export function CardFooter({ className, ...rest }: ComponentProps<'footer'>) {
  return (
    <footer
      className={cn(
        'flex flex-wrap items-center justify-end gap-3 bg-surface-2/60 px-5 py-4 sm:px-6',
        className,
      )}
      {...rest}
    />
  );
}
