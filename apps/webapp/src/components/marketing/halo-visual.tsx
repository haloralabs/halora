import { Ban, Check, Clock } from 'lucide-react';
import { HaloMark } from '@/components/brand/logo';

/**
 * Hero illustration: concentric rings of light around an agent core, with three example
 * outcomes of the on-chain policy check. Purely decorative content is aria-hidden; the
 * outcomes are a real list so screen readers get the same story.
 */
export function HaloVisual() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[460px]">
      <div aria-hidden className="absolute inset-0">
        <div className="halo-ring animate-halo-spin absolute inset-[6%] rounded-full opacity-25 blur-2xl" />
        <div className="absolute inset-[10%] rounded-full border border-line" />
        <div className="absolute inset-[22%] rounded-full border border-line-strong/70" />
        <div className="halo-ring animate-halo-spin absolute inset-[30%] rounded-full p-[2px] [animation-duration:40s]">
          <div className="size-full rounded-full bg-bg" />
        </div>
        <div className="animate-halo-breathe absolute inset-[38%] rounded-full bg-[radial-gradient(circle,var(--halo-glow),transparent_70%)]" />
        <div className="absolute inset-0 grid place-items-center text-fg">
          <HaloMark size={76} />
        </div>
      </div>

      <ul className="absolute inset-0 text-[0.8125rem]" aria-label="Example policy decisions">
        <li className="animate-rise absolute top-[6%] left-0 flex items-center gap-2.5 rounded-2xl border border-line bg-surface/90 px-3.5 py-2.5 shadow-md backdrop-blur [animation-delay:150ms] sm:left-[-4%]">
          <span className="grid size-6 place-items-center rounded-full bg-success-soft text-success">
            <Check className="size-3.5" aria-hidden />
          </span>
          <span>
            <span className="block font-medium text-fg">0.25 USDC to weather API</span>
            <span className="text-xs text-subtle">Within policy, settled</span>
          </span>
        </li>
        <li className="animate-rise absolute top-[44%] right-0 flex items-center gap-2.5 rounded-2xl border border-line bg-surface/90 px-3.5 py-2.5 shadow-md backdrop-blur [animation-delay:350ms] sm:right-[-6%]">
          <span className="grid size-6 place-items-center rounded-full bg-warning-soft text-warning">
            <Clock className="size-3.5" aria-hidden />
          </span>
          <span>
            <span className="block font-medium text-fg">240 USDC license renewal</span>
            <span className="text-xs text-subtle">Above threshold, waits for you</span>
          </span>
        </li>
        <li className="animate-rise absolute bottom-[6%] left-[4%] flex items-center gap-2.5 rounded-2xl border border-line bg-surface/90 px-3.5 py-2.5 shadow-md backdrop-blur [animation-delay:550ms]">
          <span className="grid size-6 place-items-center rounded-full bg-danger-soft text-danger">
            <Ban className="size-3.5" aria-hidden />
          </span>
          <span>
            <span className="block font-medium text-fg">4,800 USDC to unknown address</span>
            <span className="text-xs text-subtle">Denied by the contract</span>
          </span>
        </li>
      </ul>
    </div>
  );
}
