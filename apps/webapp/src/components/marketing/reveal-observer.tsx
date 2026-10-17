'use client';

import { useEffect } from 'react';

/**
 * One observer for the whole page: marks each [data-reveal-root] (and loose [data-reveal]
 * elements outside a root) with .is-in once it enters the viewport, which plays its staggered
 * entrance. The hidden state only exists under html.js, so content never depends on this.
 */
export function RevealObserver() {
  useEffect(() => {
    const targets = [
      ...document.querySelectorAll<HTMLElement>('[data-reveal-root]'),
      ...Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]')).filter(
        (el) => !el.closest('[data-reveal-root]'),
      ),
    ];
    if (!('IntersectionObserver' in window)) {
      targets.forEach((t) => t.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);
  return null;
}
