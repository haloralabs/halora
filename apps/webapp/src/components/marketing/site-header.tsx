'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '#try', label: 'Try it' },
  { href: '#rules', label: 'Rules' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#developers', label: 'Developers' },
];

/**
 * Fixed header. Transparent over the night sky at the top; once the page scrolls it gains a
 * black, blurred ground and a hairline, so content never runs under the links.
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 border-b text-frost transition-[background-color,border-color] duration-300',
        scrolled || open
          ? 'border-night-line bg-night/85 backdrop-blur-xl'
          : 'border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 md:h-18 md:px-8">
        <Link
          href="/"
          aria-label="Halora home"
          className="flex min-h-11 items-center"
          onClick={() => setOpen(false)}
        >
          <Logo />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="inline-flex min-h-11 items-center px-3 text-[0.9375rem] text-mist transition-colors duration-[var(--t-hover)] hover:text-frost"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="group hidden min-h-10 items-center gap-1.5 rounded-[var(--radius-md)] bg-frost px-4 text-[0.9375rem] font-semibold text-night transition-[background-color,transform] duration-[var(--t-hover)] hover:bg-signal active:scale-[0.98] sm:inline-flex"
          >
            Open dashboard
            <ArrowUpRight
              aria-hidden
              className="size-4 transition-transform duration-[var(--t-hover)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </Link>
          <button
            type="button"
            className="min-h-11 px-1 font-mono text-[0.875rem] tracking-[0.08em] text-frost uppercase md:hidden"
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
        className="fixed inset-x-0 top-16 bottom-0 overscroll-contain bg-night px-4 pt-8 pb-[calc(2rem+env(safe-area-inset-bottom))] md:hidden"
      >
        <nav aria-label="Mobile" className="flex h-full flex-col justify-between">
          <ul className="space-y-1">
            {NAV.map((n, i) => (
              <li key={n.href} className="animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
                <a
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="flex items-baseline gap-4 py-3 text-[2.25rem] font-semibold tracking-[-0.04em] text-frost"
                >
                  <span className="font-mono text-[0.875rem] text-signal">
                    [{String(i + 1).padStart(2, '0')}]
                  </span>
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex min-h-14 items-center justify-center rounded-[var(--radius-md)] bg-signal text-body font-semibold text-signal-ink"
          >
            Open dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}
