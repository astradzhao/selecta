# UI cleanup — audit and execution plan

> Execution plan for the **UI Cleanup epic**
> ([DJ-92](https://linear.app/dj-project-astradzhao/issue/DJ-92)) and the durable
> record of what the audit found.
>
> Linear is authoritative for issue status. This file is authoritative for the
> recommended order, the parallel lanes, and the raw findings behind each ticket.
>
> Companion docs: [`TICKET_ORDER.md`](./TICKET_ORDER.md) (overall critical path),
> [`ARCHITECTURE.md`](./ARCHITECTURE.md).
>
> When the epic closes, the durable output is `dev-files/UI_STYLE_GUIDE.md`
> (created in UI-14). This file can be archived at that point.
>
> Audited against `main`: 2026-08-12.

## Executive summary

The foundation is in better shape than the epic description implies:

- Exactly **one** CSS file in the whole repo —
  `packages/ui/src/styles/globals.css` (144 lines).
- Tailwind v4, CSS-first via `@theme inline`. No `tailwind.config.*` anywhere.
- `apps/web/app/layout.tsx` imports `@selecta/ui/globals.css` and nothing else.
- Semantic tokens are already used in ~**529** places.
- **No** `apps/web/components/ui/` folder shadowing `@selecta/ui`;
  `components.json` correctly aliases `ui` → `@selecta/ui/components`.
- Only **7** sites in the entire repo use a raw Tailwind palette color.

The problem is one level up: **primitives are shared, composites are not.**
Every page header, search field, tab nav, empty state, loading state, alert, and
track row is written inline and copy-pasted across features. Three Library list
views independently re-implement the same ~200-line filter → fetch → list →
empty-state shell.

Secondary problem: the app is **entirely grayscale** with no brand color, and
**dark mode is defined but never activated**, so `.dark` and 18 `dark:`
utilities are dead code.

## Decisions

| Question              | Decision                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| Color direction       | Neutral surfaces + **one brand hue** + semantic status scales. Domain color encoding out of scope. |
| Dark mode             | **Support both** light and dark, wired with `next-themes`.                                        |
| Legacy `/notes`       | **Delete.** Do it early so later tickets don't migrate doomed code.                                |
| `graph-explorer.tsx`  | Own sub-issue (UI-13), sequenced near the end.                                                    |

Explicitly deferred: BPM/energy heat scales, Camelot/key color wheels, per-genre
colors, waveform rendering. File separately if wanted.

## Findings

### Duplicated composites

| Pattern                                | Copies | Notes                                                     |
| -------------------------------------- | -----: | --------------------------------------------------------- |
| Filtered list view shell               |      3 | `library-list` 261 + `submissions-list` 339 + `transitions-list` 365 lines |
| Page header block                      |      6 | plus 3 `embedded` props existing only to suppress it      |
| Search input with icon                 |     8+ | one uses `ps-9` where the rest use `pl-10`                |
| Segmented tab nav                      |      4 | one adds `rounded-[5px]` + `shadow-sm`                    |
| Track row rendering                    |      6 | artwork at 40px, 44px, **and** 48px                       |
| Track search-and-pick flow             |      8 | debounce delays of 200ms, 220ms, and 280ms                |
| Alert / message pattern                |      6 | **errors styled as neutral info** in ~15 files            |
| Loading state                          |     11 | zero skeletons, zero spinners in the repo                 |
| Empty state                            |      8 | one already extracted locally, never promoted             |
| Detail-page breadcrumb                 |      3 | all bare `<p>`, none a `<nav>`                            |
| Native `<select>` styled inline        |      3 | no `Select` primitive exists                              |
| Native `<input type="checkbox">`       |      3 | no focus or disabled styling                              |

### Duplicated logic

| Helper                    | Copies | Notes                                                       |
| ------------------------- | -----: | ----------------------------------------------------------- |
| `formatTimestamp`         |      5 | byte-identical                                              |
| `artistLine`              |      5 | one overloads for `string[]`                                |
| `optionalNumber`          |      3 | one is **already exported** and ignored twice               |
| preview-text truncator    |      5 | differ only in max length and fallback string               |
| `isReviewable`            |      2 | identical                                                   |
| Status label map          |      5 | across 2 enums                                              |
| debounced-search block    |      8 | same `isFirstFetch` + `setTimeout` + `cancelled` shape      |
| offset pagination         |      2 | same `PAGE_SIZE = 50` and `loadMore`                        |
| db-not-configured copy    |      5 | same string inlined verbatim                                |

**The single worst offender:** `library/transition-detail.tsx:231–304` hand-rolls
the exact field grid that `tracks/transition-fields.tsx:91–180` already provides
and that three other call sites use correctly. It also re-declares
`optionalNumber` instead of importing the exported one.

**Concrete user-visible bug from the label drift:** extraction status
`extracting` renders as "Processing" in the Submissions list and "Processing…" in
the note detail. `needs_review` (an action prompt) renders in the same
destructive red as `failed` and `commit_failed` (actual errors), while
`committed` (a success) renders as neutral grey.

### Color and theming

- Every `:root` token is `oklch(L 0 0)` — pure grayscale. `--destructive` is the
  only chromatic value in the light theme.
- **Dead tokens:** `--chart-1`…`--chart-5` and all 8 `--sidebar-*` have zero
  references in any `.tsx`. That is 24 lines of dead `@theme` config.
- **Dark mode is unreachable.** `.dark` block exists (`globals.css:89–121`),
  `@custom-variant dark` exists, 18 `dark:` utilities exist — but `next-themes`
  is not installed and `.dark` is never applied to `<html>`.
- **No `color-scheme` property**, so native selects and scrollbars would not
  follow the theme even once switching works.
- **No overlay or elevation vocabulary.** Surfaces are ad-hoc `bg-muted/20`,
  `/30`, `/40`, `/50`, `/60`, `/80`.
- Active nav/tab state is the inversion hack `bg-foreground text-background`.
- Check `--muted-foreground: oklch(0.556 0 0)` on white — it sits near the 4.5:1
  line and carries ~167 pieces of small `text-xs` copy.

The 7 raw-palette sites:

| File                                     | Line(s)   | Usage                          |
| ---------------------------------------- | --------- | ------------------------------ |
| `library/proposal-source-span.tsx`       | 40        | `bg-amber-200/80` highlight    |
| `notes/note-detail.tsx`                  | 366       | `text-amber-700` warning       |
| `notes/note-detail.tsx`                  | 374, 379  | `text-red-700` errors          |
| `packages/ui/src/components/dialog.tsx`  | 34        | `bg-black/10` scrim            |
| `tracks/tag-editor.tsx`                  | 106       | `hover:bg-black/10`            |
| `tracks/folder-tag-editor.tsx`           | 117       | `hover:bg-black/10`            |

### Typography and spacing

- **7** distinct page-title combos, **6** section-heading combos, **5**
  card-title combos, **8** eyebrow combos using **five different** `tracking`
  values (`0.12em`, `0.14em`, `0.16em`, `0.18em`, `0.2em`, plus `tracking-wide`).
- **`tabular-nums` is used zero times.** Mono is applied to BPM and key in the
  graph but not to duration, timestamps, release dates, or the combined
  BPM/key/energy line on track detail.
- Radius tokens `--radius-sm`…`--radius-4xl` exist in `globals.css` and
  `apps/web` **never uses them** — 8 tiers of `rounded-*` literals instead.
- **~45 arbitrary bracket values**, ~20 of them concentrated in
  `graph-explorer.tsx`.

### Component package adoption

| Used in `apps/web`                                              | Never imported                                             |
| --------------------------------------------------------------- | ---------------------------------------------------------- |
| `button`, `badge`, `input`, `label`, `textarea`, `separator` (3×), `dialog` (1×) | `card`, `field`, `combobox`, `command`, `input-group`, `popover` |

`field.tsx` shipping unused is why validation display is inconsistent
everywhere else — `FieldError` exists and nothing uses it.

### Accessibility

- **List row links have no `focus-visible` style at all**, and neither do the app
  nav links. Keyboard navigation of the primary surface is invisible.
- Focus ring width is `ring-3` in the package but `ring-2` on graph cards.
- Headings are semantically correct (`h1`×18, `h2`×22, `h3`×2, no styled divs),
  but `h4`–`h6` are never used and panel sub-headings are `<p>`. The graph
  in-session `<h1>` is a **track title**, so the page outline changes meaning
  mid-session.
- No `aria-expanded` on any disclosure toggle.
- `window.confirm` for destructive delete in 3 places.

### File sizes

| File                        | Lines |
| --------------------------- | ----: |
| `tracks/graph-explorer.tsx` |  1151 |
| `notes/note-detail.tsx`     |   709 |
| `library/proposal-review.tsx`|   687 |
| `tracks/track-detail.tsx`   |   518 |
| `library/proposal-endpoint-picker.tsx` | 423 |

## Recommended order

### Foundation — serial, `globals.css` conflicts otherwise

1. [DJ-93](https://linear.app/dj-project-astradzhao/issue/DJ-93) — **UI-1**
   Semantic color schema: brand hue, status scales, surface/overlay tokens
2. [DJ-96](https://linear.app/dj-project-astradzhao/issue/DJ-96) — **UI-2**
   Typography, spacing, and radius scale
3. [DJ-95](https://linear.app/dj-project-astradzhao/issue/DJ-95) — **UI-3**
   Wire up light/dark theme switching

### Clear the decks

4. [DJ-99](https://linear.app/dj-project-astradzhao/issue/DJ-99) — **UI-4**
   Retire the legacy `/notes` surface

### Build the shared layer

5. [DJ-100](https://linear.app/dj-project-astradzhao/issue/DJ-100) — **UI-5**
   Primitive gaps: Select, Checkbox, Alert, Skeleton
6. [DJ-101](https://linear.app/dj-project-astradzhao/issue/DJ-101) — **UI-6**
   PageHeader, StatePanel, EmptyState, SegmentedTabs, SearchField
7. [DJ-102](https://linear.app/dj-project-astradzhao/issue/DJ-102) — **UI-7**
   Shared formatters and list-state hooks

### Migrate the features

8. [DJ-103](https://linear.app/dj-project-astradzhao/issue/DJ-103) — **UI-8**
   `FilteredListShell`: unify Tracks / Transitions / Submissions
9. [DJ-104](https://linear.app/dj-project-astradzhao/issue/DJ-104) — **UI-9**
   One `TrackRow` + `TrackPicker`
10. [DJ-105](https://linear.app/dj-project-astradzhao/issue/DJ-105) — **UI-10**
    One status vocabulary
11. [DJ-106](https://linear.app/dj-project-astradzhao/issue/DJ-106) — **UI-11**
    Form standardization

### Polish and lock in

12. [DJ-107](https://linear.app/dj-project-astradzhao/issue/DJ-107) — **UI-12**
    Accessibility and interaction consistency
13. [DJ-108](https://linear.app/dj-project-astradzhao/issue/DJ-108) — **UI-13**
    Decompose `graph-explorer.tsx`
14. [DJ-109](https://linear.app/dj-project-astradzhao/issue/DJ-109) — **UI-14**
    Lint guardrails and UI style guide

## Parallel lanes

```text
UI-1 ──→ UI-2 ──→ UI-5 ──→ UI-6 ──→ UI-8 ──→ UI-9 ──→ UI-12 ──→ UI-13 ──→ UI-14
  └─→ UI-3 (theme)             │
                               ├──→ UI-10
                               └──→ UI-11

UI-4 (delete /notes)  — no blockers, do early
UI-7 (helpers/hooks)  — no blockers, any time
```

UI-1 and UI-2 both edit `globals.css`; keep them serial. UI-3, UI-4, and UI-7 are
independent and can run on their own branches alongside the main lane.

## Target conventions

These are proposals that UI-1 and UI-2 finalize, and UI-14 records durably in
`UI_STYLE_GUIDE.md`.

### Color tokens to add

Each status gets a solid, a `-foreground`, and a `-subtle` background so alerts
and badges are buildable without opacity guesswork:

```text
--brand / --brand-foreground / --brand-subtle
--success / --success-foreground / --success-subtle
--warning / --warning-foreground / --warning-subtle
--info / --info-foreground / --info-subtle
--destructive-foreground / --destructive-subtle
--overlay                                  (replaces bg-black/10)
--surface-1 / --surface-2 / --surface-3    (named elevation)
--selected / --selected-foreground         (replaces the inversion hack)
--highlight / --highlight-foreground       (source-span mark)
```

Brand hue starting proposal: electric indigo/violet near
`oklch(0.62 0.19 264)` — already present as `--sidebar-primary` in the dark
block. Verify AA contrast against its paired foreground in both themes.

### Text roles

```text
text-page-title      text-section-title   text-card-title
text-body            text-caption         text-eyebrow
text-numeric         (font-mono tabular-nums — all BPM, keys, bars,
                      durations, timestamps, IDs)
```

One `tracking` value for `text-eyebrow`. Responsive steps live inside the recipe,
not at call sites.

### Spacing rhythm

| Role                | Value          |
| ------------------- | -------------- |
| Page section stack  | `space-y-10`   |
| In-page section     | `space-y-6`    |
| Form field          | `space-y-2`    |
| Tight group         | `space-y-1.5`  |
| List row padding    | `px-4 py-3`    |
| State panel         | `px-5 py-10`   |
| Inline alert        | `px-3 py-2`    |

### Where components live

- `packages/ui` — anything reused across features or app-agnostic: primitives,
  `PageHeader`, `StatePanel`, `EmptyState`, `SegmentedTabs`, `SearchField`,
  `DataList`, `Alert`, `Skeleton`, `Breadcrumb`.
- `apps/web/components/common/` — app-shaped composites that aren't domain
  specific, e.g. `FilteredListShell`.
- `apps/web/components/<feature>/` — domain components: `TrackRow`,
  `TransitionFields`, proposal review UI.

Rule of thumb: if a second feature needs it, it moves up a level.

## Epic acceptance

- One shell backs all three Library tabs; no page header, search input, tab nav,
  alert, empty state, or loading state is implemented more than once.
- Zero raw palette colors and zero color literals outside `globals.css`,
  enforced by lint.
- Light and dark both work on every route.
- One recipe per text role; numeric data is mono + `tabular-nums` everywhere.
- No file in `apps/web/components/` over ~350 lines.
- `dev-files/UI_STYLE_GUIDE.md` documents the system and lint prevents
  regression.

## Maintenance rules

- Update this file when a UI sub-issue is added, canceled, or materially
  rewritten, and keep the blocking relations in Linear in sync with the lanes
  above.
- Each sub-issue gets its own `dj-XXXX` branch off an up-to-date `main`. Do not
  batch several UI tickets into one branch — the migration tickets touch
  overlapping files and reviews get unreadable.
- After UI-1 and UI-2 land, every later ticket must consume tokens rather than
  add new literals. If a ticket needs a value the system doesn't have, extend
  the system in `globals.css` rather than inlining it.
- Verify **both** themes before opening a PR once UI-3 has landed.
