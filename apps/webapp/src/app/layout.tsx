import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import './globals.css';

// Switzer (Indian Type Foundry, ITF Free Font License), self-hosted so the first paint uses it.
const switzer = localFont({
  src: [
    { path: './fonts/Switzer-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/Switzer-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/Switzer-600.woff2', weight: '600', style: 'normal' },
    { path: './fonts/Switzer-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-switzer',
  display: 'swap',
});
// Monospace is reserved for real code and on-chain identifiers.
const code = JetBrains_Mono({ subsets: ['latin'], variable: '--font-code', display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'Halora: wallets with rules for AI agents',
    template: '%s | Halora',
  },
  description:
    'Give AI agents a Stellar wallet with limits they cannot break. Per payment and daily limits, allowlists and approvals, enforced on-chain by the account contract.',
  applicationName: 'Halora',
};

export const viewport: Viewport = {
  themeColor: '#000000',
};

// Runs before first paint: marks that scripts run (entrance animations only hide content under
// html.js) and applies a saved theme so there is no flash.
const bootScript = `document.documentElement.classList.add('js');try{var t=localStorage.getItem('halora-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${switzer.variable} ${code.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-signal focus:px-4 focus:py-2 focus:text-signal-ink"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
