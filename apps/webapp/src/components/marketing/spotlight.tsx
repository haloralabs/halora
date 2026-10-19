'use client';

import { useEffect } from 'react';

/**
 * Moves the soft light inside any [data-spotlight] element to follow the pointer. One passive
 * listener for the whole page; only fine pointers (mouse, trackpad), never touch.
 */
export function Spotlight() {
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    let frame = 0;
    let target: HTMLElement | null = null;
    let x = 0;
    let y = 0;
    const apply = () => {
      frame = 0;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty('--mx', `${x - rect.left}px`);
      target.style.setProperty('--my', `${y - rect.top}px`);
    };
    const onMove = (e: PointerEvent) => {
      target = (e.target as Element | null)?.closest<HTMLElement>('[data-spotlight]') ?? null;
      x = e.clientX;
      y = e.clientY;
      if (target && !frame) frame = requestAnimationFrame(apply);
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      document.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
