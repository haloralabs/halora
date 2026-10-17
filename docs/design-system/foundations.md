# Design foundations

Tokens live in `apps/webapp/src/app/globals.css`. Components use tokens only, never raw hex.

## Idea

Halora is a safety signal between an AI agent and its money. Carbon and signal yellow are the vernacular of things that protect you (hazard marking, instrument panels), cobalt is the one colour that means "act", and a hard red means "denied". The future-facing feel comes from scale, flat fields of colour, motion and a live product demo, not from gradients or glows.

The landing page was art-directed with the taste skill (direction "The sentence is the layout", seed 1710265302): one short sentence at poster scale with a live fragment of the product sitting inside it, where a word would be.

## Colour

| Token | Value | Role |
| --- | --- | --- |
| `--carbon` | `#111214` | Ink on light fields, ground of the dashboard in dark mode |
| `--signal` | `#e1ac10` | The halo: meters, active indicators, held payments, attention |
| `--signal-deep` | `#5c4400` | Ink "under the seam" on signal fields; dimmed text on signal |
| `--paper` | `#f0f0eb` | Light ground |
| `--cobalt` | `#2f45d0` | Primary action, and nothing else |
| `--deny` | `#d23a26` | Denied payments, destructive states |
| `--allow` | `#1e7b4f` | Passed checks |

Rules: no gradients, no glows, no shadows at rest (only on things that float: menus, dialogs). Surfaces are separated by a tone step, not a line. Form fields and tables keep their borders.

Light ("Paper") and dark ("Carbon") dashboard themes map these onto semantic tokens (`--bg`, `--surface`, `--fg`, `--muted`, `--primary-bg`, status tokens). All text pairs meet WCAG AA.

## Type

One family: **Switzer** (Indian Type Foundry, ITF Free Font License), self-hosted in `src/app/fonts`. JetBrains Mono only for real code and on-chain identifiers.

Five steps (`--step-small`, `--step-body`, `--step-lead`, `--step-head`, `--step-display`, exposed as `text-small`, `text-body`, `text-lead`, `text-head`, `text-display`), plus viewport-sized display lines on the landing. Display: weight 600, tracking -0.045em, leading 0.92 (`.display`). Sentence case everywhere; no all-caps labels, no eyebrows.

## Shape

Near-square: `--radius-sm` 3px, `--radius-md` 4px, `--radius-lg` 6px, `--radius-xl` 8px. Every control keeps a 44px touch target.

## Motion

Tokens: `--ease-out`, `--ease-in-out`, `--t-press` 140ms, `--t-hover` 180ms, `--t-ui` 240ms, `--t-reveal` 800ms. Transform and opacity only.

- Landing signature: colour by chapter. Each section is one flat field; the fixed header takes the field colour beneath it.
- Entrances: `[data-reveal]` (staggered with `--i`), `[data-line]` (masked line reveal), `[data-cover]` (a ground-coloured cover slides off a field). Hidden states exist only under `html.js`, so content never depends on scripts.
- Live: the hero halo slot and the "Built with" sentence cycle a few times, pause on hover, then stop (WCAG 2.2.2).
- `@starting-style` animates meters from empty on first render without script.
- Dashboard: React `<ViewTransition>` for page enter and exit, a shared `nav-indicator` that travels between tabs, and a shared agent title from card to detail page.
- `prefers-reduced-motion: reduce` removes travel everywhere and disables view transitions.

## Layout

Landing: full-bleed fields, 16px (phone) and 32px (desktop) margins, 112 to 176px between sections. Dashboard: max width 80rem, top tabs on desktop, bottom tab bar on phones with safe-area insets.
