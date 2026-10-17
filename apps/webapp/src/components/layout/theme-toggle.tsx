'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

// Night is the default (as in Akkuea); Day is opt-in.
type Theme = 'light' | 'dark';
const ICONS = { light: Sun, dark: Moon } as const;

function readTheme(): Theme {
  try {
    return localStorage.getItem('halora-theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('dark');
  // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with the value applied before hydration
  useEffect(() => setTheme(readTheme()), []);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const Icon = ICONS[theme];
  return (
    <button
      type="button"
      onClick={() => {
        setTheme(next);
        try {
          localStorage.setItem('halora-theme', next);
          document.documentElement.dataset.theme = next;
        } catch {
          // Storage can be unavailable (private mode); the theme still applies for this page.
          document.documentElement.dataset.theme = next;
        }
      }}
      className={cn(
        'inline-flex size-11 items-center justify-center rounded-[var(--radius-md)] text-muted transition-[background-color,color,transform] duration-[var(--t-hover)] hover:bg-surface-2 hover:text-fg active:scale-95 sm:size-10',
        className,
      )}
      aria-label={`Switch to the ${next === 'dark' ? 'night' : 'day'} theme`}
      title={next === 'dark' ? 'Night theme' : 'Day theme'}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
