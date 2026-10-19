'use client';

import { useEffect, useRef } from 'react';

/**
 * The signature visual: the product, drawn as physics. Payments leave the agent (the core) as
 * particles and meet the policy (the halo ring). Allowed ones pass through and keep their aurora
 * trail; denied ones strike the ring in red and fall back; held ones wait on the ring in amber
 * until the owner approves, then pass.
 *
 * Canvas 2D, device-pixel-ratio aware, paused when off screen or when the tab is hidden, and a
 * single still frame under prefers-reduced-motion. Decorative: the page states the same facts in
 * text, so the canvas is hidden from assistive technology.
 */

type Kind = 'allowed' | 'held' | 'denied';
type Particle = {
  angle: number;
  r: number;
  speed: number;
  kind: Kind;
  state: 'out' | 'waiting' | 'passed' | 'bounced';
  wait: number;
  life: number;
  trail: { x: number; y: number }[];
  wobble: number;
};
type Ripple = { angle: number; t: number; kind: Kind };
type Label = { angle: number; t: number; text: string; kind: Kind };

const COLORS = {
  allowed: [45, 245, 180],
  held: [255, 194, 75],
  denied: [255, 90, 106],
  teal: [25, 211, 224],
} as const;

const rgba = (c: readonly number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

const AMOUNTS = {
  allowed: ['0.25 USDC', '0.02 USDC', '1.40 USDC', '3.00 USDC'],
  held: ['18.00 USDC', '12.50 USDC'],
  denied: ['500.00 USDC', '60.00 USDC'],
} as const;

function pickKind(): Kind {
  const r = Math.random();
  return r < 0.68 ? 'allowed' : r < 0.84 ? 'held' : 'denied';
}

export function HaloField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let running = false;
    let last = performance.now();
    let spawnClock = 0;
    let ringAngle = 0;
    const particles: Particle[] = [];
    const ripples: Ripple[] = [];
    const labels: Label[] = [];
    const font = getComputedStyle(document.documentElement).getPropertyValue('--font-code');

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const geometry = () => {
      const size = Math.min(width, height);
      return {
        cx: width / 2,
        cy: height / 2,
        ring: size * 0.3,
        edge: size * 0.5,
        core: size * 0.045,
      };
    };

    const spawn = () => {
      const kind = pickKind();
      particles.push({
        angle: Math.random() * Math.PI * 2,
        r: 0,
        speed: 70 + Math.random() * 50,
        kind,
        state: 'out',
        wait: 0,
        life: 1,
        trail: [],
        wobble: (Math.random() - 0.5) * 0.6,
      });
    };

    const step = (dt: number) => {
      const { ring, edge } = geometry();
      ringAngle += dt * 0.25;
      spawnClock += dt;
      if (spawnClock > 0.42 && particles.length < 36) {
        spawnClock = 0;
        spawn();
      }
      for (const p of particles) {
        if (p.state === 'waiting') {
          p.wait -= dt;
          if (p.wait <= 0) {
            p.state = 'passed';
            ripples.push({ angle: p.angle, t: 1, kind: 'allowed' });
          }
          continue;
        }
        const dir = p.state === 'bounced' ? -1 : 1;
        p.r += dir * p.speed * dt;
        p.angle += p.wobble * dt * 0.4;
        if (p.state === 'out' && p.r >= ring) {
          p.r = ring;
          ripples.push({ angle: p.angle, t: 1, kind: p.kind });
          if (p.kind === 'allowed') p.state = 'passed';
          else if (p.kind === 'held') {
            p.state = 'waiting';
            p.wait = 1.4;
            labels.push({
              angle: p.angle,
              t: 1,
              text: `HELD ${AMOUNTS.held[Math.floor(Math.random() * 2)]}`,
              kind: 'held',
            });
          } else {
            p.state = 'bounced';
            p.speed *= 0.6;
            labels.push({
              angle: p.angle,
              t: 1,
              text: `DENIED ${AMOUNTS.denied[Math.floor(Math.random() * 2)]}`,
              kind: 'denied',
            });
          }
        }
        if (p.state === 'passed' && p.r > edge) p.life -= dt * 1.6;
        if (p.state === 'bounced') p.life -= dt * 0.9;
      }
      for (let i = particles.length - 1; i >= 0; i--)
        if (particles[i]!.life <= 0) particles.splice(i, 1);
      for (const r of ripples) r.t -= dt * 1.4;
      for (let i = ripples.length - 1; i >= 0; i--) if (ripples[i]!.t <= 0) ripples.splice(i, 1);
      for (const l of labels) l.t -= dt * 0.45;
      for (let i = labels.length - 1; i >= 0; i--) if (labels[i]!.t <= 0) labels.splice(i, 1);
    };

    const draw = () => {
      const { cx, cy, ring, edge, core } = geometry();
      ctx.clearRect(0, 0, width, height);

      // Orbits: faint guides of the policy space.
      ctx.lineWidth = 1;
      for (const f of [0.55, 1.35, 1.62]) {
        ctx.beginPath();
        ctx.setLineDash(f === 1 ? [] : [2, 6]);
        ctx.strokeStyle = 'rgba(52,58,62,0.7)';
        ctx.arc(cx, cy, ring * f, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Halo glow and ring (with its approval gap).
      const glow = ctx.createRadialGradient(cx, cy, ring * 0.7, cx, cy, ring * 1.35);
      glow.addColorStop(0, 'rgba(45,245,180,0)');
      glow.addColorStop(0.5, 'rgba(45,245,180,0.07)');
      glow.addColorStop(1, 'rgba(45,245,180,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, ring * 1.35, 0, Math.PI * 2);
      ctx.fill();

      const gap = 0.32;
      let stroke: CanvasGradient | string = rgba(COLORS.allowed, 0.95);
      if ('createConicGradient' in ctx) {
        const g = ctx.createConicGradient(ringAngle, cx, cy);
        g.addColorStop(0, rgba(COLORS.allowed, 1));
        g.addColorStop(0.5, rgba(COLORS.teal, 1));
        g.addColorStop(1, rgba(COLORS.allowed, 1));
        stroke = g;
      }
      ctx.save();
      ctx.shadowColor = rgba(COLORS.allowed, 0.8);
      ctx.shadowBlur = 18;
      ctx.lineWidth = Math.max(3, ring * 0.035);
      ctx.lineCap = 'round';
      ctx.strokeStyle = stroke;
      ctx.beginPath();
      ctx.arc(cx, cy, ring, ringAngle + gap / 2, ringAngle + Math.PI * 2 - gap / 2);
      ctx.stroke();
      ctx.restore();

      // Ripples where payments meet the ring.
      for (const r of ripples) {
        ctx.beginPath();
        ctx.lineWidth = 2 + (1 - r.t) * 6;
        ctx.strokeStyle = rgba(COLORS[r.kind], r.t * 0.9);
        ctx.arc(cx, cy, ring + (1 - r.t) * 10, r.angle - 0.18, r.angle + 0.18);
        ctx.stroke();
      }

      // Particles and their trails.
      for (const p of particles) {
        const c = p.state === 'passed' ? COLORS.allowed : COLORS[p.kind];
        const x = cx + Math.cos(p.angle) * p.r;
        const y = cy + Math.sin(p.angle) * p.r;
        p.trail.push({ x, y });
        if (p.trail.length > 14) p.trail.shift();
        for (let i = 1; i < p.trail.length; i++) {
          const a = (i / p.trail.length) * 0.5 * p.life;
          ctx.strokeStyle = rgba(c, a);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(p.trail[i - 1]!.x, p.trail[i - 1]!.y);
          ctx.lineTo(p.trail[i]!.x, p.trail[i]!.y);
          ctx.stroke();
        }
        const pulse = p.state === 'waiting' ? 1 + Math.sin(performance.now() / 120) * 0.35 : 1;
        ctx.save();
        ctx.shadowColor = rgba(c, 0.9);
        ctx.shadowBlur = 12;
        ctx.fillStyle = rgba(c, p.life);
        ctx.beginPath();
        ctx.arc(x, y, 2.6 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Verdict labels drifting off the ring.
      ctx.font = `500 11px ${font || 'ui-monospace'}, monospace`;
      ctx.textAlign = 'center';
      for (const l of labels) {
        const d = ring + 26 + (1 - l.t) * 18;
        ctx.fillStyle = rgba(COLORS[l.kind], Math.min(1, l.t * 1.6));
        ctx.fillText(l.text, cx + Math.cos(l.angle) * d, cy + Math.sin(l.angle) * d);
      }

      // The agent core.
      const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, core * 4);
      coreGlow.addColorStop(0, 'rgba(242,245,244,0.35)');
      coreGlow.addColorStop(1, 'rgba(242,245,244,0)');
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, core * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2f5f4';
      ctx.beginPath();
      ctx.arc(cx, cy, core, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba(COLORS.allowed, 1);
      ctx.beginPath();
      ctx.arc(cx, cy, core * 0.38, 0, Math.PI * 2);
      ctx.fill();

      void edge;
    };

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      step(dt);
      draw();
      if (running) raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running || reduced) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    resize();
    if (reduced) {
      // One composed still frame: a few payments at different moments.
      for (let i = 0; i < 160; i++) step(1 / 30);
      draw();
    }

    const ro = new ResizeObserver(() => {
      resize();
      if (!running) draw();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => (entry?.isIntersecting ? start() : stop()), {
      threshold: 0.05,
    });
    io.observe(canvas);
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop());
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
