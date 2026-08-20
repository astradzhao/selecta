# DJ-93 — Semantic color schema (task plan)

> Ticket: [DJ-93 — UI-1: Semantic color schema](https://linear.app/dj-project-astradzhao/issue/DJ-93)
> Parent epic: [DJ-92 — UI Cleanup](https://linear.app/dj-project-astradzhao/issue/DJ-92)
> Epic plan: [`UI_CLEANUP_PLAN.md`](./UI_CLEANUP_PLAN.md)
> Status: **implemented on `dj-93`.** Decisions D1, D2, D4–D7 landed as
> recommended. D3 was opted in on review: `bg-muted/NN` swept to `--surface-*`.
> Blocks: DJ-96 (UI-2), DJ-95 (UI-3), DJ-100 (UI-5)

This is the foundation ticket for the UI cleanup. UI-2 through UI-14 assume
these tokens exist. This file is the implementation plan for **this ticket
only**; the epic-level audit, order, and parallel lanes live in
`UI_CLEANUP_PLAN.md`.

## 1. Goal

Establish the single color schema for the whole app in
`packages/ui/src/styles/globals.css`, then remove every color that bypasses it.

This is a **gap-filling job, not a rewrite.** There is one CSS file, Tailwind
v4 CSS-first (`@theme inline`, no `tailwind.config.*`), and
`apps/web/app/layout.tsx` already imports `@selecta/ui/globals.css` only.
Semantic tokens are already used in ~529 places. The app is grayscale, seven
call sites use raw Tailwind palette colors, and there is no brand / success /
warning / info / overlay / elevation vocabulary.

## 2. What I verified in the codebase

Re-audited against current `main` (2026-08-12). The ticket's inventory is
accurate, with two corrections called out below.

### 2.1 Single schema file

`packages/ui/src/styles/globals.css` (144 lines) is the only CSS file. `:root`
is almost entirely `oklch(L 0 0)`. The only chromatic light-theme token is
`--destructive: oklch(0.577 0.245 27.325)`. The only chromatic dark-theme
token besides destructive is `--sidebar-primary: oklch(0.488 0.243 264.376)`
— and nothing in `.tsx` references it.

`--destructive-foreground` does **not** exist today. Button / Badge
`destructive` variants paint `text-destructive` on `bg-destructive/10`, not a
solid fill.

### 2.2 The 7 hardcoded palette sites (confirmed)

Acceptance grep from the ticket still returns exactly these:

| File                                                   |     Line | Today                                  | Replace with                             |
| ------------------------------------------------------ | -------: | -------------------------------------- | ---------------------------------------- |
| `apps/web/components/library/proposal-source-span.tsx` |       40 | `bg-amber-200/80 dark:bg-amber-500/30` | `bg-highlight text-highlight-foreground` |
| `apps/web/components/notes/note-detail.tsx`            |      366 | `text-amber-700 dark:text-amber-400`   | `text-warning`                           |
| `apps/web/components/notes/note-detail.tsx`            | 374, 379 | `text-red-700 dark:text-red-400`       | `text-destructive`                       |
| `packages/ui/src/components/dialog.tsx`                |       34 | `bg-black/10`                          | `bg-overlay`                             |
| `apps/web/components/tracks/tag-editor.tsx`            |      106 | `hover:bg-black/10`                    | `hover:bg-overlay`                       |
| `apps/web/components/tracks/folder-tag-editor.tsx`     |      117 | `hover:bg-black/10`                    | `hover:bg-overlay`                       |

`note-detail.tsx` is on the doomed `/notes` surface (UI-4 / DJ-99 deletes it).
Still migrate the three class strings so the acceptance grep is green; do not
invest further in that file.

### 2.3 Selected-state inversion (not in the 7, still in scope)

Three identical nav/tab active states use `bg-foreground text-background`:

- `apps/web/components/app-shell.tsx:36`
- `apps/web/components/library/library-workspace.tsx:94`
- `apps/web/components/add/add-workspace.tsx:58`

These already use semantic tokens, so they would not fail the palette grep.
`--selected` exists specifically to name this role. See decision D2.

### 2.4 Dead tokens (confirmed)

`--chart-1`…`--chart-5` and all 8 `--sidebar-*` tokens appear **only** in
`globals.css` (`:root`, `.dark`, and `@theme inline`). Safe to delete.

**Correction vs. the ticket:** `--font-heading` is **not** dead.
`packages/ui/src/components/dialog.tsx` uses `font-heading` on `DialogTitle`,
and `apps/web/components/tracks/graph-landing.tsx` imports `Dialog`. Keep it.
`card.tsx` also uses it but is unused by `apps/web` — leave `card.tsx` alone
(UI-5 decides whether to adopt or delete unused primitives).

### 2.5 `bg-muted/NN` sprawl (out of the mechanical 7, optional sweep)

~50 `bg-muted/20`…`/80` call sites across list shells, empty states, hover
rows, and alerts. Named `--surface-1/2/3` tokens are the replacement
vocabulary. Default plan is **define the tokens now, do not sweep the ~50
sites** — UI-6 / UI-8 will rewrite those files. See decision D3.

### 2.6 Button and Badge today

`packages/ui/src/components/button.tsx` and `badge.tsx` are shadcn defaults:

- `default` → `bg-primary` (near-black / near-white, **not** chromatic)
- `destructive` → tinted wash `bg-destructive/10 text-destructive`
- No `brand`, `success`, `warning`, or `info` variants
- Secondary hover uses `color-mix(in_oklch, var(--secondary), var(--foreground) 5%)`

`--primary` is the high-contrast grayscale CTA. Home's primary button
("Add a transition") is this, not a brand hue.

### 2.7 Status badges already lie (not this ticket)

`proposalStatusVariant` and submissions `statusVariant` map `needs_review`
and `failed` both to `destructive`, and `committed` to `secondary`
(neutral grey). That is UI-10. This ticket only makes `success` / `warning`
/ `info` **possible**.

## 3. Decisions for review

Please confirm or rewrite these before implementation. Recommended answers
are marked.

### D1 — `--primary` stays grayscale; `--brand` is a separate accent

**Recommend: yes.**

If `--primary` becomes indigo, every default `Button` and `Badge` in the app
turns chromatic in one PR. That is a visual identity change, not schema
plumbing. Keep `--primary` as the on-color (near-black light / near-white
dark). `--brand` is the chromatic accent for selected chrome (if D2 says so),
links we later choose to tint, and an optional `variant="brand"`.

### D2 — Selected nav: named inversion, or brand fill?

**Recommend: named inversion (no visual change to nav).**

```text
--selected:            same as --foreground
--selected-foreground: same as --background
```

Then swap the three call sites to `bg-selected text-selected-foreground`.
Look stays identical; the role is named. Brand can move onto selected later
in one token edit.

Alternative: `--selected` = `--brand`. App chrome becomes indigo immediately.
Say so if you want to see brand in the product in this PR.

### D3 — Sweep `bg-muted/NN` → `bg-surface-*` in this ticket?

**Recommend: no.** _(Opted in on review.)_ Define the tokens and the mapping
table, then sweep call sites so later tickets cannot copy the opacity
guesswork. Opaque `--surface-*` will look slightly different from
translucent `muted`.

### D4 — Button / Badge variants to add now

**Recommend: add `brand` + status variants on both; do not remount existing
call sites onto them.**

| Variant                        | Recipe                                  | Who consumes it                     |
| ------------------------------ | --------------------------------------- | ----------------------------------- |
| `brand`                        | `bg-brand text-brand-foreground`        | available; no existing CTA switched |
| `success` / `warning` / `info` | `bg-*-subtle text-*`                    | UI-5 Alert, UI-10 status badges     |
| `destructive`                  | rewrite `/10` → `bg-destructive-subtle` | same look, uses the new token       |

UI-10 is what actually maps `committed` → success and splits `needs_review`
off destructive.

### D5 — Brand hue (ticket starting proposal fails AA)

The ticket's starting value `oklch(0.62 0.19 264)` is the dark-block
`--sidebar-primary` chroma, but at L=0.62 with white text it is **3.60:1**
(fails WCAG AA 4.5:1). Same value as _text on white_ is 3.76:1 (also fails).

Hue 264 (electric indigo) is still the right family — it is the one
chromatic leftover in the current file, and it reads as "DJ tool / night
club lighting" without looking like a generic SaaS teal.

**Proposed scale** (computed; AA against the paired foreground):

| Token                | Light                            | Dark                             |
| -------------------- | -------------------------------- | -------------------------------- |
| `--brand`            | `oklch(0.48 0.19 264)` `#2251c6` | `oklch(0.72 0.16 264)` `#70a1ff` |
| `--brand-foreground` | `oklch(0.985 0 0)`               | `oklch(0.205 0 0)`               |
| `--brand-subtle`     | `oklch(0.96 0.03 264)` `#e8f2ff` | `oklch(0.28 0.06 264)` `#192846` |

Light solid + white fg = **6.55:1**. Dark solid + dark fg = **7.10:1**.
Light brand as text on white = **6.84:1**. Dark brand as text on
`--background` = **8.48:1**.

Pattern (same as `--primary`): light theme uses a darker solid + light
foreground; dark theme inverts to a lighter solid + dark foreground. Then
`text-brand` works as ink in both themes.

### D6 — `--muted-foreground` on white

Current `oklch(0.556 0 0)` (`#737373`) on white is **4.73:1** — it **passes**
AA for small text, with 0.23:1 of headroom, and it is used on ~167 `text-xs`
captions.

**Recommend: leave it.** The ticket said to darken only if it fails. Dark
theme `oklch(0.708 0 0)` on `oklch(0.145 0 0)` is 7.63:1, fine.

Opt in to `oklch(0.50 0 0)` (`#636363`, 6.00:1) if you want more headroom on
caption text.

### D7 — Dark `--destructive` solid + white foreground

Existing dark `--destructive: oklch(0.704 0.191 22.216)` as a _text_ color on
dark background is 6.89:1 (good). As a _solid fill_ with white text it is
**2.75:1 (fail)**. Today's Button/Badge never use that solid fill.

**Recommend:** keep the current `--destructive` ink values. Add
`--destructive-foreground` / `--destructive-subtle`. Components keep the
tinted recipe (`bg-destructive-subtle text-destructive`), which already
works. Do not introduce a solid filled red button in this ticket.

## 4. Proposed token set

All values `oklch()`. Each new token is defined in **both** `:root` and
`.dark`, then mapped in `@theme inline` as `--color-*` so `bg-brand`,
`text-warning-foreground`, `bg-surface-2`, etc. work.

### 4.1 Chromatic scales

`--X` is ink / solid. `--X-foreground` is text on the solid. `--X-subtle` is
the wash behind `text-X` (alerts, badges).

| Token                      | Light                              | Dark                               | Role                                       |
| -------------------------- | ---------------------------------- | ---------------------------------- | ------------------------------------------ |
| `--brand`                  | `oklch(0.48 0.19 264)`             | `oklch(0.72 0.16 264)`             | accent ink / solid                         |
| `--brand-foreground`       | `oklch(0.985 0 0)`                 | `oklch(0.205 0 0)`                 | text on brand solid                        |
| `--brand-subtle`           | `oklch(0.96 0.03 264)`             | `oklch(0.28 0.06 264)`             | brand wash                                 |
| `--success`                | `oklch(0.45 0.15 145)`             | `oklch(0.78 0.14 145)`             | committed / ok                             |
| `--success-foreground`     | `oklch(0.985 0 0)`                 | `oklch(0.205 0 0)`                 |                                            |
| `--success-subtle`         | `oklch(0.96 0.03 145)`             | `oklch(0.28 0.05 145)`             |                                            |
| `--warning`                | `oklch(0.50 0.16 75)`              | `oklch(0.82 0.12 75)`              | review reasons, caution                    |
| `--warning-foreground`     | `oklch(0.205 0 0)`                 | `oklch(0.205 0 0)`                 | dark ink — amber solids stay light         |
| `--warning-subtle`         | `oklch(0.96 0.04 85)`              | `oklch(0.30 0.05 75)`              |                                            |
| `--info`                   | `oklch(0.48 0.14 250)`             | `oklch(0.76 0.10 250)`             | neutral informational                      |
| `--info-foreground`        | `oklch(0.985 0 0)`                 | `oklch(0.205 0 0)`                 |                                            |
| `--info-subtle`            | `oklch(0.96 0.02 250)`             | `oklch(0.28 0.04 250)`             |                                            |
| `--destructive`            | _keep_ `oklch(0.577 0.245 27.325)` | _keep_ `oklch(0.704 0.191 22.216)` | error ink                                  |
| `--destructive-foreground` | `oklch(0.985 0 0)`                 | `oklch(0.985 0 0)`                 | documented: do not use as dark solid+white |
| `--destructive-subtle`     | `oklch(0.96 0.03 27)`              | `oklch(0.30 0.08 22)`              | replaces `bg-destructive/10`               |

Warning is the exception to the invert-solid pattern: amber is too light to
put white text on, so `--warning-foreground` stays dark in both themes, and
the intended recipe is `bg-warning-subtle text-warning` (and `text-warning`
as inline ink).

### 4.2 Surfaces, overlay, selected, highlight

| Token                    | Light                    | Dark                  | Replaces                        |
| ------------------------ | ------------------------ | --------------------- | ------------------------------- |
| `--overlay`              | `oklch(0.145 0 0 / 10%)` | `oklch(0 0 0 / 50%)`  | `bg-black/10`                   |
| `--surface-1`            | `oklch(0.985 0 0)`       | `oklch(0.18 0 0)`     | `bg-muted/20`, `/30`            |
| `--surface-2`            | `oklch(0.97 0 0)`        | `oklch(0.205 0 0)`    | `bg-muted/40`, `/50`            |
| `--surface-3`            | `oklch(0.94 0 0)`        | `oklch(0.269 0 0)`    | `bg-muted/60`, `/80`            |
| `--selected`             | `oklch(0.145 0 0)`       | `oklch(0.985 0 0)`    | `bg-foreground` on active nav   |
| `--selected-foreground`  | `oklch(0.985 0 0)`       | `oklch(0.145 0 0)`    | `text-background` on active nav |
| `--highlight`            | `oklch(0.93 0.06 85)`    | `oklch(0.32 0.06 85)` | source-span amber mark          |
| `--highlight-foreground` | `oklch(0.25 0.04 85)`    | `oklch(0.93 0.04 85)` | text on that mark               |

`--highlight` is **not** `--warning`. Source-span emphasis is a location
marker, not a caution state.

`--overlay` in dark is a real scrim (`/50`), not `/10`. A 10% scrim on an
already-dark page is invisible. Light stays `/10` to match today's dialog.

### 4.3 Contrast pairs (document in `UI_CLEANUP_PLAN.md` at ship)

WCAG AA for normal text is 4.5:1. Values computed from the `oklch()` →
linear sRGB → relative luminance path.

| Pair                                         | Theme |   Ratio | AA                    |
| -------------------------------------------- | ----- | ------: | --------------------- |
| `--brand` / `--brand-foreground`             | light |  6.55:1 | pass                  |
| `--brand` as text on `--background`          | light |  6.84:1 | pass                  |
| `--brand` / `--brand-foreground`             | dark  |  7.10:1 | pass                  |
| `--success` / `--success-foreground`         | light |  6.64:1 | pass                  |
| `--success` as text on `--background`        | light |  6.93:1 | pass                  |
| `--warning` as text on `--background`        | light |  6.12:1 | pass                  |
| `--info` / `--info-foreground`               | light |  6.25:1 | pass                  |
| `--destructive` / `--destructive-foreground` | light |  4.56:1 | pass (tight)          |
| `--destructive` as text on `--background`    | light |  4.76:1 | pass                  |
| `--destructive` as text on `--background`    | dark  |  6.89:1 | pass                  |
| `--destructive` solid + white                | dark  |  2.75:1 | **fail — do not use** |
| `--highlight` / `--highlight-foreground`     | light | 13.03:1 | pass                  |
| `--muted-foreground` on `--background`       | light |  4.73:1 | pass (tight)          |
| `--muted-foreground` on `--background`       | dark  |  7.63:1 | pass                  |

Ticket starting brand `oklch(0.62 0.19 264)` + white = 3.60:1, **rejected**.

### 4.4 `@theme inline` mapping

Add `--color-<name>: var(--<name>)` for every new token. Delete the 13
`--color-chart-*` and `--color-sidebar-*` lines. Keep `--font-heading`.

Existing grayscale tokens (`--background`, `--primary`, `--muted`, `--card`,
`--border`, `--ring`, `--radius-*`) are untouched except the optional D6
muted-foreground tweak.

## 5. Implementation tasks (when approved)

One branch: `dj-93`, off up-to-date `main`. Do not mix UI-2 typography into
this PR.

### Task 1 — Tokens in `globals.css`

1. Add the variables in §4 to `:root` and `.dark`.
2. Map them in `@theme inline`.
3. Delete `--chart-1`…`--chart-5` and all `--sidebar-*` from all three
   blocks.

### Task 2 — Migrate the 7 palette sites + 3 selected sites

Exact class swaps in §2.2 and §2.3. No other edits in those files.

### Task 3 — Button and Badge

In `packages/ui/src/components/button.tsx` and `badge.tsx`:

- `destructive`: `bg-destructive/10` → `bg-destructive-subtle` (and the
  dark `/20` equivalents → the dark subtle token, so the `dark:` opacity
  hacks can drop).
- Add `brand`, `success`, `warning`, `info` variants using the subtle+ink
  recipe (warning/info/success) and solid recipe (brand).
- Re-read the secondary `color-mix(...)` hover. `--secondary` stays
  grayscale, so it should still be a 5% lift. No change expected; verify
  visually.

Do **not** change any `variant="default"` call site to `brand`.

### Task 4 — Record contrast in the epic doc

Append the §4.3 table to `UI_CLEANUP_PLAN.md` under "Color and theming"
(or a new "UI-1 shipped tokens" subsection). Linear ticket comments can
point at that table. `UI_STYLE_GUIDE.md` is UI-14's job — do not create it
here.

### Task 5 — Verify

```bash
rg -n '(bg|text|border|from|to|ring)-(amber|red|black|white|slate|gray|zinc|neutral|blue|green|emerald)(-\d+)?' \
  apps packages --glob '!node_modules' --glob '*.tsx'
# expect: zero matches

rg -n -- '--chart-|--sidebar-' packages/ui/src/styles/globals.css
# expect: zero matches

pnpm typecheck
pnpm lint
pnpm format:check
```

Visual spot-check (light is the only reachable theme until UI-3):

- Home (`/`) — primary vs outline buttons still grayscale; nav selected uses
  `--selected`
- Library Tracks / Transitions / Submissions tabs
- Graph landing + in-session (dialog overlay = `--overlay`)
- A submission / proposal detail (source-span highlight)

Dark: temporarily put `class="dark"` on `<html>` in `layout.tsx` (revert
before commit) and repeat the same pages. Do not install `next-themes`
(UI-3).

## 6. Out of scope

- Typography, spacing, radius (UI-2 / DJ-96)
- `next-themes`, `color-scheme`, theme toggle (UI-3 / DJ-95)
- Deleting `/notes` (UI-4 / DJ-99) — only the three class-string swaps
- Select / Checkbox / Alert / Skeleton (UI-5)
- PageHeader / StatePanel / EmptyState / SegmentedTabs (UI-6)
- Remapping status enums onto success/warning (UI-10)
- Domain color encoding (BPM heat, Camelot wheel, per-genre) — never this epic
- Sweeping `bg-muted/NN` _(done on review — mapped to `--surface-*`)_
- Painting default Buttons with brand (unless D1 is overridden)
- Tests — token CSS has no silent-break behavior a unit test would catch
  that typecheck / the acceptance grep would miss
- `UI_STYLE_GUIDE.md` (UI-14)

## 7. File touch list (default plan)

| File                                                   | Change                                         |
| ------------------------------------------------------ | ---------------------------------------------- |
| `packages/ui/src/styles/globals.css`                   | add tokens, prune chart/sidebar, `@theme` maps |
| `packages/ui/src/components/button.tsx`                | subtle destructive + new variants              |
| `packages/ui/src/components/badge.tsx`                 | same                                           |
| `packages/ui/src/components/dialog.tsx`                | overlay class                                  |
| `apps/web/components/library/proposal-source-span.tsx` | highlight                                      |
| `apps/web/components/notes/note-detail.tsx`            | warning + destructive text                     |
| `apps/web/components/tracks/tag-editor.tsx`            | overlay hover                                  |
| `apps/web/components/tracks/folder-tag-editor.tsx`     | overlay hover                                  |
| `apps/web/components/app-shell.tsx`                    | selected                                       |
| `apps/web/components/library/library-workspace.tsx`    | selected                                       |
| `apps/web/components/add/add-workspace.tsx`            | selected                                       |
| `dev-files/UI_CLEANUP_PLAN.md`                         | shipped contrast table                         |

## 8. Acceptance (from the ticket, plus plan-specific)

- Palette grep in §5 returns **zero** `.tsx` matches
- No `--chart-*` or `--sidebar-*` remain
- Every new token is defined in **both** `:root` and `.dark`
- Contrast pairs live in `UI_CLEANUP_PLAN.md`
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` pass
- Light (and temporary-class dark) spot-checked on Home, Library (3 tabs),
  Graph, and a submission detail page
- Default buttons are still grayscale (D1)
- Nav selected is `bg-selected` (D2)

## 9. How this feeds the rest of the epic

```text
UI-1 (this) ──→ UI-2 (type/space, same CSS file)
             └─→ UI-3 (theme switch; needs .dark tokens to be real)
                       UI-5 Alert/Badge status variants consume *-subtle
                       UI-10 status vocabulary consumes success/warning
```

After this lands: later tickets **must** consume tokens. If a later ticket
needs a value that is not here, it extends `globals.css` rather than
inlining a literal. Palette-lint enforcement is UI-14, not this PR.
