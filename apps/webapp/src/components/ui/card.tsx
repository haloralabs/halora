import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...rest }: ComponentProps<'section'>) {
  return (
    <section
      className={cn(
        'rounded-[var(--radius-lg)] border border-line bg-surface shadow-md',
        className,
      )}
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
    <h2
      className={cn('text-[0.9375rem] font-semibold tracking-[-0.005em] text-fg', className)}
      {...rest}
    />
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
        'flex flex-wrap items-center justify-end gap-3 border-t border-line px-5 py-4 sm:px-6',
        className,
      )}
      {...rest}
    />
  );
}
