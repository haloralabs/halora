# Halora component library

Status: v0 (2026-10-17). Components live in `apps/webapp/src/components/ui` and are exported from `@/components/ui`. They are unstyled-by-default React 19 components styled with Tailwind 4 utilities bound to the tokens in [foundations.md](./foundations.md). Brand components are in `components/brand`, dashboard compositions in `components/dashboard`.

All components:

- work in both themes without props,
- are keyboard reachable with a visible gold focus ring (`:focus-visible`),
- use `lucide-react` icons with `aria-hidden` when a text label is present,
- fit a 360px wide screen.

## Primitives

| Component                                                                      | Purpose                               | Key props                                                                                           | Accessibility                                                                                         |
| ------------------------------------------------------------------------------ | ------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Button`                                                                       | Actions                               | `variant` (`primary`, `secondary`, `ghost`, `danger`), `size` (`sm`, `md`, `lg`), `loading`, `icon` | Defaults to `type="button"`. While `loading` it is disabled and `aria-busy`.                          |
| `ButtonLink`                                                                   | Navigation styled as a button         | same as `Button` plus `next/link` props                                                             | Renders a real link.                                                                                  |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardBody`, `CardFooter` | Grouped content                       | `className`                                                                                         | `Card` is a `section`; give it a heading via `CardTitle`.                                             |
| `Badge`                                                                        | Short status                          | `tone` (`neutral`, `gold`, `success`, `warning`, `danger`, `info`), `dot`                           | Always carries text, never color alone.                                                               |
| `Field`                                                                        | Label, hint and error for one control | `label`, `hint`, `error`, `aside`                                                                   | Generates ids and sets `aria-describedby` and `aria-invalid` on the child; errors use `role="alert"`. |
| `Input`, `Textarea`                                                            | Text entry                            | `suffix` (unit, for example "USDC")                                                                 | Gold focus glow, danger border when `aria-invalid`.                                                   |
| `Switch`                                                                       | Binary setting                        | `checked`, `onCheckedChange`, `label`, `description`, `tone`                                        | `role="switch"` with `aria-checked`.                                                                  |
| `Tabs`                                                                         | Switch between views                  | `items`, `value`, `onValueChange`, `label`                                                          | WAI-ARIA tabs pattern, arrow-key navigation, roving tabindex.                                         |
| `Callout`                                                                      | Inline message                        | `tone` (`info`, `success`, `warning`, `danger`), `title`                                            | `role="status"`, or `role="alert"` for danger.                                                        |
| `EmptyState`                                                                   | Nothing to show yet                   | `icon`, `title`, `action`                                                                           | Heading plus explanation plus one action.                                                             |
| `Skeleton`                                                                     | Loading placeholder                   | `className`                                                                                         | `aria-hidden`; pulse is disabled with reduced motion.                                                 |
| `Stat`                                                                         | Labeled metric                        | `label`, `value`, `unit`, `hint`                                                                    | Renders `dt`/`dd`; wrap in a `dl`.                                                                    |

## Data display

| Component    | Purpose                                                   | Notes                                                                                                                                                                                                                                                |
| ------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HaloMeter`  | Signature ring meter: spent today against the daily limit | `value` 0 to 1, `label`, `valueText`, children render in the center. `role="meter"` with `aria-valuenow` and `aria-valuetext`. States: `ok` (gold to aurora), `high` at 75 percent (amber), `full` at 100 percent (danger), exposed as `data-state`. |
| `MeterBar`   | Compact linear meter for cards and lists                  | Same thresholds as `HaloMeter`.                                                                                                                                                                                                                      |
| `Address`    | Stellar address or hash                                   | Monospace, truncated in the middle, full value in `title` and in the copy button.                                                                                                                                                                    |
| `CopyButton` | Copy a value                                              | Announces "Copied to clipboard" through a polite live region.                                                                                                                                                                                        |
| `CodeBlock`  | Read-only snippet                                         | Filename label and copy button; scrolls horizontally on small screens instead of overflowing the page.                                                                                                                                               |

## Brand

| Component  | Purpose                                                                               |
| ---------- | ------------------------------------------------------------------------------------- |
| `HaloMark` | The ring-and-core mark. Decorative by default; pass `title` to expose it as an image. |
| `Logo`     | Mark plus wordmark.                                                                   |

## Dashboard compositions (`components/dashboard`)

| Component           | Purpose                                                                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DashboardShell`    | Sticky header, primary navigation with pending-approval count, owner chip, demo-mode banner, wallet gate.                                                                                            |
| `ConnectGate`       | Shows the connect-wallet screen until an owner wallet is connected.                                                                                                                                  |
| `AgentCard`         | One agent: status, balance, spent today against the daily limit.                                                                                                                                     |
| `PolicyFields`      | Controlled policy editor (limits, threshold, allowlist up to 50 recipients, expiry, pause) shared by create and edit.                                                                                |
| `ApprovalCard`      | One approval request: amount, agent reason, recipient, expiry, daily-limit and paused warnings, approve (choose a 15 minute, 1 hour or 24 hour on-chain approval) or reject with an optional reason. |
| `PreApprovalsPanel` | Active on-chain pre-approvals for an account, with grant and revoke.                                                                                                                                 |
| `PaymentsTable`     | Payment log; a table from `md`, stacked rows on phones.                                                                                                                                              |
| `PageHeader`        | Eyebrow, title, description and actions for each page.                                                                                                                                               |

## Usage rules

1. One primary button per view. Secondary actions use `secondary` or `ghost`.
2. Amounts are shown with `formatAmount` and the unit ("USDC") next to them, never inside a sentence fragment that loses the unit.
3. Any action that signs with the owner wallet names what is signed in its label or adjacent text ("Sign and save", "Approve and sign").
4. Status is never color alone: badges have text, meters have numbers.
5. New components get a short entry here and a test when they hold behavior.
