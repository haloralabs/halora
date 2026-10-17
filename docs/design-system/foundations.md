# Design foundations ("Aurora")

Tokens live in `apps/webapp/src/app/globals.css`. Components use tokens only, never raw hex.

## Idea

Halora is a sibling of [Akkuea](https://github.com/akkuea/akkuea) with its own identity. From Akkuea it takes the night ground, the terminal vernacular and one rule: a single signal colour that never changes between themes. Its own light is the **aurora**, mint green with a turquoise second voice over a night sky, because it lives on Stellar. Its own material is the halo (the policy ring around the agent) and the live policy check.

| Shared with Akkuea | Halora's own |
| --- | --- |
| Pure black ground, `#0a0b0c` / `#121416` surfaces, hairline borders | Aurora signal (`#2df5b4`) and turquoise (`#19d3e0`) instead of red-orange |
| Monospace for on-chain values, tabular figures, slashed zero | Star field and a slow aurora in the hero and the close |
| `[01]` markers, terminal labels, `> command_` prompts | The live halo inside the hero sentence |
| Live status dot, marquee ticker, corner marks | A ticker of payments and the contract's verdicts |
| Feature cards with tags and a hover accent line | Rule cards that name the contract parameter |
| Dark by default, light opt-in | Switzer for display and text |

## Colour

| Token | Value | Role |
| --- | --- | --- |
| `--night` | `#000000` | Ground |
| `--night-1`, `--night-2` | `#0a0b0c`, `#121416` | Surfaces |
| `--night-line`, `--night-line-2` | `#1f2326`, `#343a3e` | Borders, hover borders |
| `--frost` | `#f2f5f4` | Primary text |
| `--mist` | `#9aa5a0` | Secondary text |
| `--dim` | `#808b86` | Tertiary text, dimmed headline lines (4.5:1 on black) |
| `--aurora` | `#2df5b4` | The signal: primary action, allowed, active, focus |
| `--aurora-teal` | `#19d3e0` | Second aurora voice: contract parameters, gradients |
| `--held` | `#ffc24b` | Held for owner approval, pending |
| `--deny` | `#ff5a6a` | Denied, destructive |

Text on a filled aurora surface uses `--aurora-ink` (`#00140d`). The dashboard's Day theme (`data-theme="light"`) maps the same roles onto darker, AA-safe values.

Gradient use is deliberate and limited: the aurora curtains, one aurora phrase per screen (`.aurora-text`), and hover accent lines.

## Type

**Switzer** (Indian Type Foundry, ITF Free Font License) for display and text, self-hosted in `src/app/fonts`. **JetBrains Mono** for on-chain values, labels, prompts and code; `.font-mono` enables tabular figures and a slashed zero. Display: weight 600, tracking -0.045em, leading 0.92 (`.display`). Section headlines are two-tone: the second line in `--dim`.

## Motion

Tokens: `--ease-out`, `--ease-in-out`, `--t-press` 140ms, `--t-hover` 180ms, `--t-ui` 240ms. Transform and opacity only, except the aurora's blur, which is static.

- Hero: masked line reveal, the aurora drifting (18 to 26 s loops), the live halo, the payment ticker (pauses on hover).
- Entrances: `[data-reveal]` staggered by `--i`, hidden only under `html.js`.
- Live elements stop on their own after a few loops and pause on hover (WCAG 2.2.2).
- Dashboard: React `<ViewTransition>` for page enter and exit, a shared `nav-indicator`, and a shared agent title from card to detail. `@starting-style` fills meters on first render.
- `prefers-reduced-motion: reduce` stops all of it.

## Shape and layout

Radius 4, 6, 8 and 10px. Every control keeps a 44px touch target. Landing content is capped at 1400px with 16px (phone) and 32px (desktop) margins; dashboard at 80rem, top tabs on desktop, a bottom tab bar on phones with safe-area insets. Grids always declare `grid-cols-1` at the base so long code never widens a phone layout.
