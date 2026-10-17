import { Logo } from '@/components/brand/logo';

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-2">
          <Logo size={22} />
          <p className="max-w-sm text-sm text-muted">
            Policy-bound wallets for AI agents. Testnet pilot. Halora never holds your keys.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <a className="hover:text-fg" href="#how-it-works">
            How it works
          </a>
          <a className="hover:text-fg" href="#developers">
            Developers
          </a>
          <a className="hover:text-fg" href="/dashboard">
            Dashboard
          </a>
        </nav>
      </div>
    </footer>
  );
}
