# UI style guide

Durable reference for Selecta’s design system. Linear is authoritative for issue
status. This file is authoritative for **how UI should look and where it lives**.

The UI Cleanup epic
([DJ-92](https://linear.app/dj-project-astradzhao/issue/DJ-92)) established the
tokens and primitives. Guardrails live in `@selecta/eslint-config` (`ui.js`) and
`.cursor/rules/ui-design-system.mdc`.

Single stylesheet: `packages/ui/src/styles/globals.css` (Tailwind v4, `@theme
inline`). Apps import `@selecta/ui/globals.css` only.

## Color

Never a raw Tailwind palette class (`bg-zinc-*`, `text-gray-*`, `text-red-*`,
`bg-black/10`, …) and never a hex / `rgb()` / `hsl()` / `oklch()` literal in
`.ts`/`.tsx`. If you need a new value, add a token in `globals.css`.

`--X` is the ink or solid. `--X-foreground` is text on that solid. `--X-subtle`
is the wash behind `text-X`.

### Surfaces and chrome

| Token                                         | Use                                      |
| --------------------------------------------- | ---------------------------------------- |
| `--background` / `--foreground`               | Page canvas and default ink              |
| `--card` / `--popover`                        | Raised panels (dialogs, menus)           |
| `--muted` / `--muted-foreground`              | Recessed fill and secondary copy         |
| `--border` / `--input` / `--ring`             | Hairlines, field chrome, focus rings     |
| `--surface-1` / `--surface-2` / `--surface-3` | Elevation steps (replaces `bg-muted/NN`) |
| `--overlay`                                   | Dialog/scrim (`bg-overlay`)              |
| `--selected` / `--selected-foreground`        | Active nav/tab inversion                 |
| `--highlight` / `--highlight-foreground`      | Inline source-span highlight             |

`--primary` stays **grayscale** (high-contrast CTA). `--brand` is the chromatic
accent (indigo). Do not retint every `Button` by folding brand into primary.

### Status

| Token           | Use                              |
| --------------- | -------------------------------- |
| `--brand`       | Accent chrome, `variant="brand"` |
| `--success`     | Committed / complete             |
| `--warning`     | Needs review / caution           |
| `--info`        | Neutral notices                  |
| `--destructive` | Failed / irreversible            |

Recipe for status text on a wash: `bg-X-subtle text-X`. Warning is the
exception to invert-solid: `--warning-foreground` stays dark in both themes,
so prefer `bg-warning-subtle text-warning` rather than white-on-amber.

### Visualization (graph only)

`--viz-bar-strong|mid|weak|faint`, `--viz-meter-track|fill|empty`,
`--viz-connector-from|via`. These mix `--foreground` so they track both themes.
Do not recreate opacity ladders with `bg-foreground/45`.

### Contrast (WCAG AA 4.5:1, normal text)

Verified pairs from the UI-1 pass. Dark `--destructive` solid + white is
**2.75:1 — do not use**; components use `bg-destructive-subtle text-destructive`.

| Pair                                      | Light          | Dark   |
| ----------------------------------------- | -------------- | ------ |
| `--brand` / `--brand-foreground`          | 6.55:1         | 7.10:1 |
| `--success` / `--success-foreground`      | 6.64:1         | pass   |
| `--warning` as text on `--background`     | 6.12:1         | pass   |
| `--info` / `--info-foreground`            | 6.25:1         | pass   |
| `--destructive` as text on `--background` | 4.76:1         | 6.89:1 |
| `--muted-foreground` on `--background`    | 4.73:1 (tight) | 7.63:1 |
| `--highlight` / `--highlight-foreground`  | 13.03:1        | pass   |

Check **both** themes before merging UI.

## Typography

Map by **visual role**, not by heading tag. Recipes are `@utility` classes in
`globals.css`.

| Utility              | Recipe                                                     | Typical element                          |
| -------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| `text-page-title`    | `text-3xl font-semibold tracking-tight`                    | `h1` on a page                           |
| `text-section-title` | `text-lg font-semibold tracking-tight`                     | `h2` section                             |
| `text-card-title`    | `font-medium`                                              | Row / card title (`h2`/`h3`/`p`)         |
| `text-body`          | `text-sm text-pretty`                                      | Supporting copy (color at the call site) |
| `text-caption`       | `text-xs text-muted-foreground`                            | Meta, counts                             |
| `text-eyebrow`       | `text-xs font-medium uppercase` + `letter-spacing: 0.16em` | Labels, `dt`                             |
| `text-numeric`       | `font-mono tabular-nums`                                   | BPM, bars, timestamps, IDs               |

Documented one-offs: Home hero display size; App-shell wordmark
(`text-eyebrow` + `text-sm font-semibold text-foreground`); graph now-playing
title (`text-card-title text-xl`, not `text-page-title`).

Do not invent `tracking-[0.18em]`. Fonts stay Geist + Geist Mono.

## Spacing / radius / motion

### Spacing

| Role               | Value         |
| ------------------ | ------------- |
| Page section stack | `space-y-10`  |
| In-page section    | `space-y-6`   |
| Form field         | `space-y-2`   |
| Tight group        | `space-y-1.5` |
| List row           | `px-4 py-3`   |
| State panel        | `px-5 py-10`  |
| Inline alert       | `px-3 py-2`   |

### Radius

Three tiers. `rounded-full` stays for avatars / dots.

| Tier    | Class         | Use                                  |
| ------- | ------------- | ------------------------------------ |
| Control | `rounded-lg`  | Buttons, inputs, alerts, nav pills   |
| Card    | `rounded-xl`  | List shells, dialogs, inline panels  |
| Panel   | `rounded-2xl` | Large empty/hero wells, graph sticky |

### Motion

CSS tokens `--motion-fast` (200ms), `--motion-base` (300ms), `--motion-slow`
(500ms), `--motion-hop` (420ms), `--motion-ease`, `--motion-ease-out`. Tailwind:
`duration-fast|base|slow|hop`, `ease-standard`, `ease-out-soft`.

JS waits in `apps/web/lib/motion.ts` must match those numbers.
`prefers-reduced-motion` zeros the CSS durations; JS must call
`prefersReducedMotion()` / `motionDelay()`.

Arbitrary bar-chart `%` heights and the graph explorer grid template are the
documented exceptions.

## Component inventory

**Rule:** reused across features → `packages/ui`. App-shaped but not domain
specific → `apps/web/components/common`. Domain → a feature folder
(`tracks`, `graph`, `library`, `add`). Graph may import tracks; tracks must
not own graph UI (`components/graph`, `lib/graph`).

### `@selecta/ui`

Primitives: `Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `Label`,
`Badge`, `Separator`, `Dialog`, `ConfirmDialog`, `Field`.

Feedback: `Alert`, `Skeleton`, `ListSkeleton`, `EmptyState`, `StatePanel`.

Layout: `PageHeader` / `PageBreadcrumb` (`size="page"` is the default
destination header — title + description stack on the left, `actions` sit
opposite on the right; `size="section"` is the nested-task header — no
bottom border, `text-section-title` instead of `text-page-title`),
`SectionHeading`, `SegmentedTabs`, `SearchField`, `DataList`.

### `apps/web/components/common`

`FilteredListShell`, `FormField`, `StatusBadge`, `BackLink`, `AddNewButton`.

### Feature folders

`TrackRow` / `TrackPicker` / `TrackChips` / `LibraryTrackRow` /
`TransitionFields` stay in `components/tracks`. Graph explorer pieces stay in
`components/graph`.

## Patterns

- **Filtered list:** `FilteredListShell` + `SearchField` + `SegmentedTabs` +
  `DataList`. Filters, heading, and rows share one `rounded-xl border` card —
  a workbench, not a form stacked above a list. Filter labels are `sr-only`;
  placeholders (and selected `Select` values) name the controls. Empty →
  `EmptyState`. First load → `ListSkeleton`. Fetch errors →
  `Alert variant="destructive"`.
- **Library crate:** `PageHeader` holds crate facts (`N` tracks · transitions ·
  dead ends) under the title and the add button in `actions`. Tracks render
  through `LibraryTrackRow`: Track · BPM/Key · outbound count · time. Empty
  BPM/key cells show `—`; a dead end shows `none`. The outbound count is the
  one column no generic music library could have — it comes from
  `GET /tracks` `outboundTransitionCount`.
- **Detail page:** `PageHeader` + `PageBreadcrumb` / `BackLink`. Destructive
  actions go through `ConfirmDialog`.
- **Nested task page** (add sub-pages under `/library/add/*`): `PageHeader`
  `size="section"` plus a `BackLink` in `lead`. Never `text-page-title`, never
  a second page-header component.
- **Form:** `FormField` wrapping `@selecta/ui` `Field*` + `Input` / `Select` /
  `Textarea`. Field errors use `aria-invalid` / `aria-describedby` (see
  `omitFieldError`). Reuse `TransitionFields` instead of a second field grid.
- **Empty:** `EmptyState` with a title, description, and optional CTA.
- **Loading:** `StatePanel variant="loading"` or `ListSkeleton` — never a
  one-off “Loading…” paragraph.
- **Error:** `Alert variant="destructive"`. Do not style errors as muted
  info banners.

## Anti-patterns

These are the drifts the cleanup epic fixed. Treat them as review blockers.

- Raw palette colors (`bg-amber-200`, `text-red-700`, `hover:bg-black/10`)
  instead of `bg-highlight`, `text-destructive`, `bg-overlay`.
- Five `tracking-[Nem]` values for one eyebrow role — use `text-eyebrow`.
- Local copies of `formatTimestamp` / `artistLine` / `optionalNumber` —
  import `@/lib/format`.
- A second `TransitionFields` grid in a sibling file.
- A second page-header component in a sibling file — extend `PageHeader`
  with `size="page" | "section"` instead.
- Six alert looks, eleven loading looks, eight empty states.
- Native `<select>` and `<input type="checkbox">` in `apps/web`.
- `window.confirm` / `window.alert`.
- Graph UI under `components/tracks` or graph helpers under `lib/tracks`.
- Color literals in TSX; `globals.css` is the only place `oklch()` belongs
  (except token-based `color-mix(in_oklch, var(--token), …)` in primitives).
