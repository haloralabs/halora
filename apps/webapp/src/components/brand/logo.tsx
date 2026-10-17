import { cn } from '@/lib/cn';

type MarkProps = {
  size?: number;
  className?: string;
  /** Decorative by default. Pass a title when the mark stands alone as a link or image. */
  title?: string;
  /** Ring colour. Defaults to the aurora signal. */
  ring?: string;
};

/**
 * The Halora mark: a ring (the policy) around a solid core (the agent). The ring has a deliberate
 * gap at the top right, the one place where the owner's approval can let a larger payment through.
 */
export function HaloMark({ size = 28, className, title, ring = 'var(--aurora)' }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn('shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path d="M24.5 8.3A11 11 0 1 1 19.6 5.6" stroke={ring} strokeWidth="4" />
      <circle cx="16" cy="16" r="4.6" fill="currentColor" />
    </svg>
  );
}

export function Logo({
  className,
  size = 26,
  ring,
}: {
  className?: string;
  size?: number;
  ring?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <HaloMark size={size} ring={ring} />
      <span
        translate="no"
        className="text-[1.375rem] leading-none font-semibold tracking-[-0.04em]"
      >
        Halora
      </span>
    </span>
  );
}
