import { Compass } from 'lucide-react';
import { ButtonLink, EmptyState } from '@/components/ui';

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4">
      <EmptyState
        icon={Compass}
        title="This page is outside the halo"
        action={<ButtonLink href="/">Back to Halora</ButtonLink>}
      >
        The address may be mistyped, or the page moved.
      </EmptyState>
    </main>
  );
}
