'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '#try', label: 'Try it' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#developers', label: 'Developers' },
];

type Chapter = 'paper' | 'signal' | 'carbon' | 'cobalt';

// The header takes the field colour beneath it, so it reads as chromeless while still keeping
// scrolled content from running under its links.
const FIELD: Record<Chapter, string> = {
  paper: 'bg-paper text-carbon',
  signal: 'bg-signal text-carbon',
  carbon: 'bg-carbon text-paper',
  cobalt: 'bg-cobalt text-white',
};

/**
 * Fixed, chromeless header. Its ink follows the colour chapter beneath it (the page's signature
 * move), switching with a 300ms colour transition as each section edge passes under it.
 */
export function SiteHeader() {
  const [chapter, setChapter] = useState<Chapter>('paper');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-chapter]'));
    // A thin band at the header's height: whichever chapter crosses it is under the header.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setChapter((e.target as HTMLElement).dataset.chapter as Chapter);
        }
      },
      { rootMargin: '-32px 0px -96% 0px' },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  // Open menu: lock the page behind it, focus the first link, close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.querySelector<HTMLAnchorElement>('#mobile-menu a')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = previous;
    };
  }, [open]);

  const onCobalt = chapter === 'cobalt';

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 transition-[background-color,color] duration-300 ease-[var(--ease-out)]',
        open ? 'bg-carbon text-paper' : FIELD[chapter],
      )}
    >
      <div className="relative z-10 flex h-16 items-center justify-between gap-4 px-4 md:h-20 md:px-8">
        <Link
          href="/"
          aria-label="Halora home"
          className="flex min-h-11 items-center"
          onClick={() => setOpen(false)}
        >
          <Logo ring={chapter === 'signal' && !open ? 'var(--carbon)' : 'var(--signal)'} />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="min-h-11 content-center text-body font-medium underline decoration-transparent decoration-2 underline-offset-[6px] transition-[text-decoration-color] duration-[var(--t-hover)] hover:decoration-current"
            >
              {n.label}
            </a>
          ))}
          <Link
            href="/dashboard"
            className={cn(
              'inline-flex min-h-11 items-center rounded-[var(--radius-md)] px-5 text-body font-semibold transition-[background-color,color,transform] duration-[var(--t-hover)] active:scale-[0.97]',
              onCobalt
                ? 'bg-white text-cobalt hover:bg-signal hover:text-carbon'
                : 'bg-cobalt text-white hover:bg-cobalt-hover',
            )}
          >
            Open dashboard
          </Link>
        </nav>
        <div className="flex items-center gap-3 md:hidden">
          {!open && (
            <Link
              href="/dashboard"
              className={cn(
                'inline-flex min-h-11 items-center rounded-[var(--radius-md)] px-4 text-small font-semibold transition-transform duration-[var(--t-press)] active:scale-[0.97]',
                onCobalt ? 'bg-white text-cobalt' : 'bg-cobalt text-white',
              )}
            >
              Dashboard
            </Link>
          )}
          <button
            type="button"
            className="min-h-11 px-1 text-body font-semibold"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? 'Close' : 'Menu'}
          </button>
        </div>
      </div>

      <div
        id="mobile-menu"
        hidden={!open}
        className="fixed inset-0 overscroll-contain bg-carbon px-4 pt-24 pb-[calc(2rem+env(safe-area-inset-bottom))] md:hidden"
      >
        <nav aria-label="Mobile" className="flex h-full flex-col justify-between">
          <ul className="space-y-2">
            {NAV.map((n, i) => (
              <li key={n.href} className="animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
                <a
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="display block py-2 text-[13vw] text-paper"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex min-h-14 items-center justify-center rounded-[var(--radius-md)] bg-cobalt text-body font-semibold text-white"
          >
            Open dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}
