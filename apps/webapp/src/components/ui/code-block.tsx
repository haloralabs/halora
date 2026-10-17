import { cn } from '@/lib/cn';
import { CopyButton } from './copy-button';

/** Read-only code sample with a filename/language label and copy button. */
export function CodeBlock({
  code,
  label,
  className,
}: {
  code: string;
  label?: string;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        'overflow-hidden rounded-[var(--radius-md)] border border-line bg-sunken',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
        <span className="font-mono text-xs text-subtle">{label ?? 'code'}</span>
        <CopyButton value={code} label="Copy code" />
      </figcaption>
      <pre className="overflow-x-auto px-4 py-4 text-[0.8125rem] leading-relaxed">
        <code className="font-mono text-fg">{code}</code>
      </pre>
    </figure>
  );
}
