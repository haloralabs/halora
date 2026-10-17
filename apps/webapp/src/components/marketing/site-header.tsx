import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { ButtonLink } from '@/components/ui';

const NAV = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#developers', label: 'Developers' },
  { href: '#stellar', label: 'Stellar' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Halora home" className="rounded-full">
          <Logo />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="rounded-full px-3.5 py-2 text-sm text-muted transition-colors hover:text-fg"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <ButtonLink
            href="/dashboard"
            size="sm"
            icon={<ArrowRight className="size-3.5" aria-hidden />}
            className="flex-row-reverse"
          >
            Dashboard
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
