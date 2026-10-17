'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

type Theme = 'system' | 'light' | 'dark';
const ORDER: Theme[] = ['system', 'light', 'dark'];
const ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

function readTheme(): Theme {
  try {
    const t = localStorage.getItem('halora-theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('system');
  // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with the value applied before hydration
  useEffect(() => setTheme(readTheme()), []);

  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]!;
  const Icon = ICONS[theme];
  return (
    <button
      type="button"
      onClick={() => {
        setTheme(next);
        try {
          if (next === 'system') {
            localStorage.removeItem('halora-theme');
            delete document.documentElement.dataset.theme;
          } else {
            localStorage.setItem('halora-theme', next);
            document.documentElement.dataset.theme = next;
          }
        } catch {
          // Storage can be unavailable (private mode); the theme still applies for this page.
          if (next === 'system') delete document.documentElement.dataset.theme;
          else document.documentElement.dataset.theme = next;
        }
      }}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg',
        className,
      )}
      aria-label={`Theme: ${theme}. Switch to ${next}.`}
      title={`Theme: ${theme}`}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
