import type { Metadata, Viewport } from 'next';
import { Hanken_Grotesk, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const body = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const display = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-display-serif',
  display: 'swap',
});
const code = JetBrains_Mono({ subsets: ['latin'], variable: '--font-code', display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'Halora: a halo for every agent',
    template: '%s | Halora',
  },
  description:
    'Give AI agents a Stellar wallet with rules they cannot break. Spending limits, allowlists and approvals, enforced on-chain by the account contract.',
  applicationName: 'Halora',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f6f1' },
    { media: '(prefers-color-scheme: dark)', color: '#070811' },
  ],
};

// Applies a saved theme before first paint so there is no flash. Without a saved choice the
// CSS follows prefers-color-scheme.
const themeScript = `try{var t=localStorage.getItem('halora-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${body.variable} ${display.variable} ${code.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
