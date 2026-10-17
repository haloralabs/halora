'use client';

import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type TabItem = { id: string; label: string; content: ReactNode };

/** WAI-ARIA tabs with arrow-key navigation. Controlled by `value`. */
export function Tabs({
  items,
  value,
  onValueChange,
  label,
  className,
}: {
  items: TabItem[];
  value: string;
  onValueChange: (id: string) => void;
  label: string;
  className?: string;
}) {
  const base = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const index = Math.max(
    0,
    items.findIndex((i) => i.id === value),
  );

  const onKeyDown = (e: KeyboardEvent) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + items.length) % items.length;
    onValueChange(items[next]!.id);
    refs.current[next]?.focus();
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="inline-flex gap-1 rounded-full border border-line bg-surface-2 p-1"
      >
        {items.map((item, i) => (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${base}-tab-${item.id}`}
            role="tab"
            type="button"
            aria-selected={i === index}
            aria-controls={`${base}-panel-${item.id}`}
            tabIndex={i === index ? 0 : -1}
            onClick={() => onValueChange(item.id)}
            className={cn(
              'h-8 rounded-full px-4 text-sm font-medium transition-colors',
              i === index ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {items.map((item, i) => (
        <div
          key={item.id}
          id={`${base}-panel-${item.id}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${item.id}`}
          hidden={i !== index}
          className="mt-4"
        >
          {i === index && item.content}
        </div>
      ))}
    </div>
  );
}
