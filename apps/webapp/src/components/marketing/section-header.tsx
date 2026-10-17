import type { ReactNode } from 'react';

/**
 * Section opener shared by the landing: a terminal label with its index, a two-tone headline
 * (the second line dimmed, as in Akkuea) and one supporting sentence.
 */
export function SectionHeader({
  index,
  label,
  id,
  title,
  dimmed,
  children,
}: {
  index: string;
  label: string;
  id: string;
  title: ReactNode;
  dimmed?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="max-w-3xl">
      <p data-reveal className="term-label">
        <span>
          <span className="text-signal">[{index}]</span> {label}
        </span>
      </p>
      <h2
        id={id}
        data-reveal
        style={{ ['--i' as string]: 1 }}
        className="mt-5 text-head leading-[0.98] font-semibold tracking-[-0.04em] text-frost"
      >
        {title}
        {dimmed && <span className="block text-dim">{dimmed}</span>}
      </h2>
      {children && (
        <p
          data-reveal
          style={{ ['--i' as string]: 2 }}
          className="mt-5 max-w-[56ch] text-body leading-relaxed text-mist"
        >
          {children}
        </p>
      )}
    </div>
  );
}
