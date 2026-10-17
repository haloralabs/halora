import { truncateMiddle } from '@/lib/format';
import { cn } from '@/lib/cn';
import { CopyButton } from './copy-button';

/** A Stellar address or hash: monospace, truncated in the middle, full value in title and copy. */
export function Address({
  value,
  head = 4,
  tail = 4,
  copy = true,
  className,
}: {
  value: string;
  head?: number;
  tail?: number;
  copy?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1 align-middle', className)}>
      <span className="font-mono text-[0.8125rem] tracking-tight text-fg" title={value}>
        {truncateMiddle(value, head, tail)}
      </span>
      {copy && <CopyButton value={value} label="Copy address" />}
    </span>
  );
}
