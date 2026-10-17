# Halora design foundations

Status: v0 (2026-10-17). Source of truth for tokens is `apps/webapp/src/app/globals.css`; this file explains them. If the two disagree, fix both in the same change.

## Idea: the halo

Halora puts a ring of rules around an agent. The visual language says exactly that: a solid **core** (the agent) inside a luminous **ring** (the policy). The ring is warm gold that cools into a pale aurora green, the way light behaves around a bright source at night.

Use the halo sparingly. It marks the brand (logo, hero, final CTA) and the one number an owner cares about most (spent today against the daily limit, the `HaloMeter`). Everything else is calm, neutral and legible. A page full of glow reads as a template; one ring of light reads as a signature.

## Themes

| Theme | Name  | Character                                                                                                       |
| ----- | ----- | --------------------------------------------------------------------------------------------------------------- |
| Dark  | Night | Deep blue-black background (`#070811`), surfaces lifted by only a few percent, gold accent that glows.          |
| Light | Dawn  | Warm paper background (`#f8f6f1`), white cards, ink-black primary buttons, a deeper gold for text-safe accents. |

The theme follows `prefers-color-scheme` by default. The theme toggle cycles system, light, dark and stores the choice in `localStorage` (`halora-theme`); an inline script applies it before first paint, so there is no flash. Tokens are redefined under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme='light'])`, and again under `:root[data-theme='dark']`.

## Color tokens

All colors are CSS custom properties on `:root`, mapped into Tailwind 4 with `@theme inline` (so `bg-surface`, `text-muted`, `border-line` and so on follow the theme automatically).

| Token                                                          | Tailwind                          | Dawn                  | Night                 | Use                                           |
| -------------------------------------------------------------- | --------------------------------- | --------------------- | --------------------- | --------------------------------------------- |
| `--bg`                                                         | `bg-bg`                           | `#f8f6f1`             | `#070811`             | Page background                               |
| `--bg-sunken`                                                  | `bg-sunken`                       | `#f1eee6`             | `#05060c`             | Alternating sections, code blocks             |
| `--surface`                                                    | `bg-surface`                      | `#ffffff`             | `#0d0f1c`             | Cards                                         |
| `--surface-2`                                                  | `bg-surface-2`                    | `#f4f1ea`             | `#141729`             | Tracks, inactive tabs, hover                  |
| `--line` / `--line-strong`                                     | `border-line`                     | `#e5e0d4` / `#cfc7b6` | `#1e2236` / `#2d3350` | Hairlines, control borders                    |
| `--fg`                                                         | `text-fg`                         | `#12131c`             | `#eeeaf6`             | Primary text                                  |
| `--fg-muted`                                                   | `text-muted`                      | `#4f5264`             | `#a6a9c2`             | Body copy, descriptions                       |
| `--fg-subtle`                                                  | `text-subtle`                     | `#676a7d`             | `#8a8ea9`             | Labels, captions, metadata                    |
| `--accent`                                                     | `text-accent`                     | `#8a5800`             | `#f3c97a`             | Links, eyebrow text, icons that carry meaning |
| `--primary-bg` / `--primary-fg`                                | `bg-primary` / `text-on-primary`  | ink / paper           | gold / near-black     | Primary buttons                               |
| `--halo-gold`, `--halo-amber`, `--halo-aurora`, `--halo-lilac` | `bg-gold` etc.                    | deeper                | brighter              | Halo gradients only, never body text          |
| `--success`, `--warning`, `--danger`, `--info` (+ `-soft`)     | `text-success`, `bg-success-soft` |                       |                       | Status, always paired with text or an icon    |

### Contrast (WCAG 2.1 AA)

Computed with the WCAG relative-luminance formula against the background each token is used on:

- `--fg` on `--bg`: above 15:1 in both themes.
- `--fg-muted` on `--bg`: 7.1:1 (Dawn) and 8.6:1 (Night).
- `--fg-subtle` on `--bg` and `--surface`: at least 4.7:1 in both themes (also on `--surface-2`), so it is allowed for small text.
- `--accent` on `--surface`: 6.0:1 (Dawn `#8a5800` on white) and 12.2:1 (Night gold on `#0d0f1c`).
- Status text on its own soft background: at least 4.9:1 in Dawn (for example `--danger` `#b42318` on `#fde8e6` is 5.6:1); Night soft backgrounds are 10 percent tints, so status text stays above 7:1.
- Primary button text: paper on ink (Dawn) and `#1a1305` on gold (Night), 17.4:1 and 11.8:1.

Halo gradient colors are decorative and are never the only carrier of information. The `HaloMeter` always prints the numbers in its center, and changes state (ok, high, full) by color **and** by its accessible `aria-valuetext`.

## Typography

Loaded with `next/font/google` (self-hosted at build time, no runtime request to Google):

| Role        | Family                         | Token          | Notes                                                                                       |
| ----------- | ------------------------------ | -------------- | ------------------------------------------------------------------------------------------- |
| Display     | Instrument Serif (400, italic) | `font-display` | Headlines, big numbers. The italic carries the halo gradient on key words ("every agent."). |
| Body / UI   | Hanken Grotesk                 | `font-sans`    | Everything else. Neutral, slightly humanist, good at 13 to 15px.                            |
| Code / keys | JetBrains Mono                 | `font-mono`    | Addresses, hashes, snippets, API keys.                                                      |

A serif display face against a grotesk UI face keeps the product from looking like a default dashboard while staying readable. Amounts use `tabular-nums` (`.tabular`) so columns align.

Scale (rem): display 3.25 to 5.25 (hero), 2.75 (page title), 2.25 (section), 1.75 (stat), body 0.9375 to 1.125, captions 0.75.

## Space, radius, elevation

- Spacing follows Tailwind's 4px grid. Page gutters are 16px on phones (`px-4`) and 24px from `sm`. Sections breathe: 80 to 112px vertical on the landing page.
- Radius tokens: `--radius-sm` 8, `--radius-md` 12 (controls), `--radius-lg` 18 (cards), `--radius-xl` 28 (feature panels). Buttons and pills are fully rounded.
- Elevation is mostly borders. `--shadow-md` for cards; `--shadow-halo` (a gold ring plus soft glow) only on hover of primary actions and on the highlighted card.

## Motion

- Durations: 140ms (fast), 220ms (base), 480ms (slow, entrances). Easing `--ease-out` `cubic-bezier(0.22, 1, 0.36, 1)`.
- Signature motion: the halo ring rotates very slowly (28 to 40s per turn) and the core glow "breathes" over 6s. Entrance of hero elements uses a short rise (`animate-rise`).
- `prefers-reduced-motion: reduce` disables all animations and transitions globally.

## Iconography

`lucide-react` only, 16px in controls and 20px in feature lists, `aria-hidden` when next to a text label. No emojis anywhere, including UI copy.

## Logo

`HaloMark` (in `apps/webapp/src/components/brand/logo.tsx`): a ring with a gradient from amber through gold to aurora around a solid core, on a faint radial glow. The ring has one deliberate gap at the upper right: the single place where the owner's approval lets a larger payment through. The core uses `currentColor`, so the mark works on both themes. `Logo` pairs the mark with the wordmark set in Instrument Serif. The favicon (`src/app/icon.svg`) is the mark on a Night tile.

## Voice

Plain, specific, calm. Say what the contract does ("enforced on-chain by the account contract"), never "trustless" or "unhackable". Name the limits of the product honestly (Halora does not prevent a key leak; it limits the damage). No em dashes.
