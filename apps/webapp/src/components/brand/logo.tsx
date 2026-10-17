import { useId } from 'react';
import { cn } from '@/lib/cn';

type MarkProps = {
  size?: number;
  className?: string;
  /** Decorative by default. Pass a title when the mark stands alone as a link or image. */
  title?: string;
};

/**
 * The Halora mark: a luminous ring (the policy) around a solid core (the agent). The ring has a
 * deliberate gap at the top right, the one place where the owner's signature can let a payment through.
 */
export function HaloMark({ size = 28, className, title }: MarkProps) {
  const id = useId().replace(/:/g, '');
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
      <defs>
        <linearGradient
          id={`${id}-ring`}
          x1="4"
          y1="28"
          x2="28"
          y2="4"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--halo-amber)" />
          <stop offset="0.5" stopColor="var(--halo-gold)" />
          <stop offset="1" stopColor="var(--halo-aurora)" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="16" cy="16" r="16" gradientUnits="userSpaceOnUse">
          <stop offset="0.35" stopColor="var(--halo-gold)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--halo-gold)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill={`url(#${id}-glow)`} />
      <path
        d="M24.5 8.3A11 11 0 1 1 19.6 5.6"
        stroke={`url(#${id}-ring)`}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="4.2" fill="currentColor" />
    </svg>
  );
}

export function Logo({ className, size = 26 }: { className?: string; size?: number }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 text-fg', className)}>
      <HaloMark size={size} />
      <span className="font-display text-[1.45rem] leading-none tracking-[-0.01em]">Halora</span>
    </span>
  );
}
