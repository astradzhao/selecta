# DJ-96 — Typography, spacing, and radius scale (task plan)

> Ticket: [DJ-96 — UI-2: Typography, spacing, and radius scale](https://linear.app/dj-project-astradzhao/issue/DJ-96)
> Parent epic: [DJ-92 — UI Cleanup](https://linear.app/dj-project-astradzhao/issue/DJ-92)
> Epic plan: [`UI_CLEANUP_PLAN.md`](./UI_CLEANUP_PLAN.md)
> Blocked-by: DJ-93 (merged — [`DJ93_SEMANTIC_COLOR_PLAN.md`](./DJ93_SEMANTIC_COLOR_PLAN.md))
> Blocks: DJ-100 (UI-5), DJ-101 (UI-6)
> Status: **implemented on `dj-96`.** Decisions D1–D8 landed as recommended.
> Graph in-session title is `text-card-title` + `text-xl` (not `text-page-title`).
> Home hero and wordmark are documented one-offs. `--radius-3xl` / `--radius-4xl`
> were deleted.

This is the second foundation ticket. Same CSS file as UI-1, so it had to wait.
UI-5 and UI-6 assume these recipes exist so new primitives ship with one class
per text role instead of four.

## 1. Goal

Define the text / space / radius vocabulary in
`packages/ui/src/styles/globals.css` and collapse the current sprawl down to
**one recipe per role**. Fonts stay Geist + Geist Mono (`apps/web/app/layout.tsx`).

This is a **class-recipe job**, not a layout rewrite. Do not extract PageHeader,
EmptyState, or Alert — those are UI-6. Do not change heading _semantics_ (h1 vs
h2 vs p) — that is UI-12. Swap the visual classes.

## 2. What I verified on current `main` (post DJ-93)

The ticket's inventory is accurate. A few mappings need a decision because
blindly applying "every h1 → `text-page-title`" would blow up Graph.

### 2.1 Page titles (`h1`) — 7 combos, 13 call sites

| Combo                                   | Where                                                                                               |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `text-3xl font-semibold tracking-tight` | Library, Add, Add track, Add transition, Notes, note detail, transition detail, track detail (view) |
| `text-3xl … text-balance`               | transition detail                                                                                   |
| `text-3xl … sm:text-4xl`                | graph landing                                                                                       |
| `text-2xl … sm:text-3xl`                | proposal review                                                                                     |
| `text-2xl …`                            | track detail (edit mode)                                                                            |
| `text-xl … sm:text-2xl`                 | **graph in-session now-playing title** (`graph-explorer.tsx:1005`)                                  |
| `text-4xl … sm:text-5xl`                | Home hero (`app/page.tsx:12`)                                                                       |

Standard page chrome is already `text-3xl font-semibold tracking-tight`. The
outliers are Home (display), Graph landing (one step up), proposal review / edit
track (one step down), and Graph session (a track title, not a page title).

### 2.2 Section headings (`h2`) — mixed _roles_, not just mixed sizes

| Combo                                  | Role in practice                                            |
| -------------------------------------- | ----------------------------------------------------------- |
| `font-medium` (no size)                | Empty-state titles ("Library unavailable", "No notes yet")  |
| `text-sm font-medium`                  | List-group labels ("Needs review", "Why this needs review") |
| `text-lg font-semibold tracking-tight` | Real section ("Linked tracks")                              |
| `text-lg font-medium`                  | Add-track "Create" heading                                  |
| `text-sm font-medium tracking-tight`   | Graph "Up next" (UI-13)                                     |

Many `h2`s are empty-state / row titles, not sections. Forcing every `h2` onto
one size would either shrink "Linked tracks" or inflate "Library unavailable".
Map by **visual role**, not by tag. Heading-tag cleanup is UI-12.

### 2.3 Card / list-item titles — 5 combos

- `truncate font-medium` — Library track rows (inherits 16px)
- `truncate text-sm font-medium` — Graph picker, proposal picker
- `line-clamp-2 font-medium text-pretty` — Submissions / notes list
- `truncate font-medium tracking-tight` — Graph neighbor card (UI-13)
- `line-clamp-2 text-sm text-pretty` — proposal preview lines (body, not title)

### 2.4 Eyebrows — 8 combos, 5 tracking values

Confirmed `tracking-[…]` in apps/web:

| Value           | Sites                                                                                 |
| --------------- | ------------------------------------------------------------------------------------- |
| `0.16em`        | add-track, new-note, transition-detail, track-detail ×2, note-detail, endpoint-picker |
| `0.18em`        | App-shell wordmark "Selecta"; graph "Now playing"                                     |
| `0.20em`        | Graph landing "Graph explorer"                                                        |
| `0.14em`        | Graph bars label + empty artwork (UI-13)                                              |
| `0.12em`        | Graph BPM/Key dt (UI-13)                                                              |
| `tracking-wide` | track-detail `<dt>`s; note-detail / submission-proposals group labels                 |

Ticket pick: **one tracking value, `0.16em`**, folded into `text-eyebrow`.

The App-shell wordmark is `text-sm font-semibold tracking-[0.18em] uppercase`
— a brand lockup, not an eyebrow. See D2.

### 2.5 Numeric / mono — `tabular-nums` is still zero

Mono today:

| Site                                                | What                |
| --------------------------------------------------- | ------------------- |
| `graph-explorer.tsx` BPM / key `<dd>`               | `font-mono text-sm` |
| `graph-explorer.tsx` bar counts, energy fill label  | `font-mono`         |
| `track-detail.tsx:503` external IDs                 | `font-mono text-sm` |
| `note-detail.tsx` / `proposal-review.tsx` debug ids | `font-mono text-xs` |

**Not** mono, and they jitter as digits change:

- Combined BPM / key / energy line (`track-detail.tsx:489`)
- Duration (`track-detail.tsx:495`, add-track search result)
- Release date (`track-detail.tsx:499`)
- Every `formatTimestamp(…)` in submissions, transitions, notes lists and
  details (plain text inside `text-sm` / `text-xs` muted copy)

### 2.6 Spacing drift (ticket callouts, confirmed)

| Canonical                | Drift                                                                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page stack `space-y-10`  | `add-track-flow.tsx` and `new-note-form.tsx` use `space-y-8` when not embedded                                                                                         |
| Form field `space-y-2`   | `transition-fields.tsx` uses `space-y-1.5`; track-detail / transition-detail already `space-y-2`                                                                       |
| List row `px-4 py-3`     | Library lists already match. Drift: proposal picker and note-detail rows `px-3 py-2.5`; graph landing picker `px-3 py-2.5`; graph neighbor cards `px-4 py-3.5` (UI-13) |
| State panel `px-5 py-10` | Already used on library empty states                                                                                                                                   |
| Inline alert `px-3 py-2` | Already used on `bg-surface-2` notices                                                                                                                                 |

### 2.7 Radius — tokens exist; usage is 8 literal tiers

`--radius-sm`…`--radius-4xl` are already in `@theme inline`, so `rounded-md`
**does** resolve to `--radius-md`. The problem is we use too many tiers, plus
two arbitrary radii.

`apps/web` counts: `rounded-lg` 29, `rounded-xl` 22, `rounded-md` 20,
`rounded-full` 9, `rounded-2xl` 5, `rounded-sm` 1 (source-span mark),
`rounded-3xl` 1 (graph sticky panel), `rounded-[5px]` 1 (endpoint-picker tabs),
`rounded-[1px]` 1 (graph energy bar, UI-13).

`packages/ui` Button / Input already use `rounded-lg` as the control radius.
Do not restyle shadcn internals except dropping `rounded-[5px]` in apps/web.

### 2.8 Arbitrary brackets outside `graph-explorer.tsx`

| Value                                                       | File                               | Verdict                                                     |
| ----------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| `rounded-[5px]`                                             | `proposal-endpoint-picker.tsx:260` | replace with `rounded-md`                                   |
| `text-[11px]`                                               | `note-detail.tsx:389`              | replace with `text-caption` (12px)                          |
| `max-h-[min(50vh,22rem)]`                                   | `graph-landing.tsx:122`            | **keep** — viewport-capped scroller; add a one-line comment |
| `max-w-[calc(100%-2rem)]`                                   | `dialog.tsx`                       | leave (shadcn overlay math)                                 |
| Button `rounded-[min(var(--radius-md),…)]`, `text-[0.8rem]` | `button.tsx`                       | leave (shadcn size variants)                                |
| combobox / input-group calc brackets                        | unused primitives                  | leave for UI-5                                              |

~20 brackets in `graph-explorer.tsx` stay until UI-13.

## 3. Decisions for review

Recommended answers are marked.

### D1 — Graph in-session `<h1>` is not a page title

**Recommend: map it to `text-card-title` (plus a size override if needed), not
`text-page-title`.**

`text-3xl` on the now-playing track would dominate Live Mode. The ticket's
"all 7 h1 combos → `text-page-title`" should exclude this site. UI-12 still
owns whether that heading should even be an `h1`.

### D2 — Home hero and App-shell wordmark are documented one-offs

**Recommend: yes.**

- Home: keep `text-4xl font-semibold tracking-tight sm:text-5xl`. Comment:
  `/* display one-off — not text-page-title */`
- Wordmark: keep `text-sm font-semibold uppercase tracking-[0.16em]` after
  the eyebrow tracking lands (today 0.18em → 0.16em so the grep allows one
  tracking value). Or fold tracking into a `text-wordmark` utility. See D2b.

**D2b — Wordmark utility?** Recommend **no**. One call site. Tighten tracking
to 0.16em so `tracking-[0.` grep has a single value (the wordmark), _or_ use
`tracking-[0.16em]` only there and put 0.16em inside `text-eyebrow` so the
grep is only the wordmark.

Cleaner: `text-eyebrow` contains `tracking-[0.16em]`, wordmark uses
`text-eyebrow` plus `text-sm font-semibold text-foreground` overrides.
Then `tracking-[` grep is **zero** in tsx. **Recommend that.**

### D3 — `text-page-title` has no `sm:` step

**Recommend: `text-3xl font-semibold tracking-tight` only.**

A responsive step inside the recipe would enlarge Library/Add/Notes on `sm`,
which nobody asked for. Graph landing loses `sm:text-4xl` (becomes 3xl
everywhere) — acceptable. Proposal review and edit-track grow from 2xl to 3xl
— also acceptable (they were the undersized ones).

### D4 — `text-section-title` vs `text-card-title` by role, not by tag

**Recommend:**

| Recipe               | Class                                  | Use on                                                                                              |
| -------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `text-section-title` | `text-lg font-semibold tracking-tight` | Real sections: Linked tracks, Delete, Add-track create, list group headers that are actual sections |
| `text-card-title`    | `font-medium` (no size)                | Track/submission/note row titles, empty-state titles, picker row titles                             |

List-group labels ("Needs review", "Why this needs review", "Other proposals")
are closer to **eyebrows or captions** than section titles. Map those to
`text-eyebrow` or `text-caption` + `font-medium`, not `text-section-title`.

Empty-state titles stay `text-card-title` until UI-6 extracts EmptyState.

### D5 — `text-body` does not bake in muted color

**Recommend: `text-sm text-pretty` only.** Color stays `text-muted-foreground`
at call sites that are secondary copy. Primary body (rare) can be
`text-body text-foreground`.

Home lede stays a one-off (`text-base sm:text-lg`) next to the display hero.

`text-caption` **does** bake muted: `text-xs text-muted-foreground`. That is
the metadata role.

### D6 — Form fields become `space-y-2`; `space-y-1.5` stays for tight in-row stacks

**Recommend: yes.** `transition-fields.tsx` field stacks `space-y-1.5` →
`space-y-2`. Keep `space-y-1.5` for title+artist stacks inside a list row
(`library-list.tsx:225`).

Non-embedded Add pages `space-y-8` → `space-y-10`.

Picker / note-detail rows `px-3 py-2.5` → `px-4 py-3`. Leave graph-explorer
neighbor `py-3.5` for UI-13.

### D7 — Three radius tiers; prune 3xl/4xl

**Recommend:**

| Tier    | Class         | Token                             | Use                                                  |
| ------- | ------------- | --------------------------------- | ---------------------------------------------------- |
| Control | `rounded-lg`  | `--radius-lg` = `--radius` (10px) | buttons, inputs, alerts, nav pills, source-span mark |
| Card    | `rounded-xl`  | `--radius-xl`                     | list shells, dialogs, inline panels                  |
| Panel   | `rounded-2xl` | `--radius-2xl`                    | large empty/hero wells                               |

Sweep:

- Nav pills `rounded-md` → `rounded-lg` (match Button)
- Source-span `rounded-sm` → `rounded-lg` (or keep sm if the mark looks
  wrong — default to `rounded-sm` still, it is a highlight not a control)
- `rounded-[5px]` → `rounded-lg`
- Graph `rounded-3xl` sticky panel → `rounded-2xl` (one site, in
  graph-explorer; small enough to do now)

Delete `--radius-3xl` and `--radius-4xl` from `@theme inline` (zero remaining
uses after the 3xl → 2xl swap). Keep sm/md because Button size variants
reference `--radius-md`.

`rounded-full` stays for avatars / radio dots / tag remove hits.

### D8 — Do not invent `text-display`

Home stays a commented one-off. Adding a third title recipe for one page is
how the sprawl started.

## 4. Proposed recipes

Add to `packages/ui/src/styles/globals.css` via Tailwind v4 `@utility`
(static, `@apply` allowed). Names match the epic conventions.

```css
@utility text-page-title {
  @apply text-3xl font-semibold tracking-tight;
}

@utility text-section-title {
  @apply text-lg font-semibold tracking-tight;
}

@utility text-card-title {
  @apply font-medium;
}

@utility text-body {
  @apply text-sm text-pretty;
}

@utility text-caption {
  @apply text-xs text-muted-foreground;
}

@utility text-eyebrow {
  @apply text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground;
}

@utility text-numeric {
  @apply font-mono tabular-nums;
}
```

Call-site shape:

```tsx
<h1 className="text-page-title">Library</h1>
<p className="text-body text-muted-foreground max-w-xl">{description}</p>
<p className="text-eyebrow">Track</p>
<dd className="text-numeric text-sm">{track.bpm ?? "—"}</dd>
<time className="text-numeric text-caption">{formatTimestamp(iso)}</time>
```

`text-numeric` stacks with a size utility. It does not set size or color.

Verify `@utility` + `@apply` against the installed Tailwind v4 docs under
`node_modules/tailwindcss` before writing — if `@apply` of `tracking-[0.16em]`
is fussy, set `letter-spacing: 0.16em` in the utility body instead.

## 5. Implementation tasks (when approved)

One branch: `dj-96`, off up-to-date `main`. Do not mix UI-3 theme switching.

### Task 1 — Recipes in `globals.css`

Add the seven `@utility` blocks. Delete `--radius-3xl` and `--radius-4xl`.

### Task 2 — Page titles + eyebrows + body/caption

Migrate every call site in §2.1 and §2.4 except Graph in-session h1 (D1) and
Home hero (D2). Wordmark uses `text-eyebrow` + `text-sm font-semibold
text-foreground` (D2).

Page descriptions: `text-body text-muted-foreground max-w-xl`.

Track-detail `<dt>`s: `text-eyebrow` (replaces `tracking-wide`).

`/notes` files still get the class swap so greps are green; UI-4 deletes the
surface later.

### Task 3 — Section vs card titles

Per D4. Empty-state `h2.font-medium` → `text-card-title`. Linked tracks /
Delete / Add-track create → `text-section-title`. List-group labels →
`text-eyebrow` or `text-caption`.

### Task 4 — `text-numeric` on technical data

Apply to: BPM, key, energy, bar numbers, overlap, duration, release date,
timestamps (`formatTimestamp` output), external IDs, debug ids already on
`font-mono`.

Do **not** extract `formatTimestamp` (UI-7). Only wrap the rendered string.

Form inputs with `inputMode="decimal"` (BPM, bars) get `className="text-numeric"`
on the Input so typed digits don't jitter either.

### Task 5 — Spacing rhythm

- `add-track-flow.tsx` / `new-note-form.tsx` non-embedded: `space-y-8` →
  `space-y-10`
- `transition-fields.tsx` field stacks: `space-y-1.5` → `space-y-2`
- proposal picker + note-detail rows: `px-3 py-2.5` → `px-4 py-3`
- Leave graph-explorer spacing for UI-13

### Task 6 — Radius sweep

Per D7. `rounded-[5px]` → `rounded-lg`. Graph sticky `rounded-3xl` →
`rounded-2xl`. Nav `rounded-md` → `rounded-lg`.

### Task 7 — Record in the epic doc

Replace the "Text roles" / "Spacing rhythm" proposals in
`UI_CLEANUP_PLAN.md` with the shipped recipes (same pattern as UI-1's
contrast table). `UI_STYLE_GUIDE.md` is still UI-14.

### Task 8 — Verify

```bash
rg -n 'tracking-\[' apps packages --glob '*.tsx'
# expect: zero (folded into text-eyebrow), or only shadcn leftovers in packages/ui

rg -n 'text-3xl|text-2xl|text-4xl|text-5xl' apps/web --glob '*.tsx'
# expect: Home hero only (plus a comment). Graph session must not be text-3xl.

rg -n 'tabular-nums|text-numeric' apps/web --glob '*.tsx'
# expect: every timestamp, BPM, key, duration, bars site

rg -n 'rounded-\[5px\]|rounded-\[1px\]' apps/web --glob '*.tsx'
# expect: only graph-explorer rounded-[1px] (UI-13)

pnpm typecheck
pnpm lint          # changed files only; repo-wide lint still has pre-existing errors
pnpm format:check  # do not oxfmt the whole repo (rewrites drizzle snapshots)
```

Spot-check: Home (hero unchanged), Library 3 tabs (titles + row padding +
timestamps), Add, a track detail (BPM/duration mono), a submission detail
(eyebrows), Graph landing + in-session (now-playing title must not jump to 3xl).

## 6. Out of scope

- Theme switching (UI-3 / DJ-95)
- Deleting `/notes` (UI-4) — class swaps only
- Select / Checkbox / Alert / Skeleton (UI-5)
- PageHeader / EmptyState / SegmentedTabs extraction (UI-6)
- Deduping `formatTimestamp` (UI-7)
- Heading semantics / focus rings (UI-12)
- `graph-explorer.tsx` arbitrary layout values (UI-13), except the one
  `rounded-3xl` → `rounded-2xl` if D7 is approved
- Status badge vocabulary (UI-10)
- Tests — CSS utilities have no silent-break behavior a unit test would
  catch that grep / typecheck would miss

## 7. File touch list (expected)

`globals.css` plus most `apps/web` page/list/detail components and
`transition-fields.tsx`. `packages/ui` Button/Input radii stay `rounded-lg`.
Dialog leftover calc brackets stay.

## 8. Acceptance

- `tracking-[0.` grep is zero in `apps/web` (folded into `text-eyebrow`)
- Ad-hoc `text-3xl|2xl|4xl|5xl` in `apps/web` is only the Home hero
- Graph in-session title is **not** `text-page-title`
- BPM, key, bars, duration, energy, timestamps, IDs use `text-numeric`
- `rounded-[5px]` gone; `rounded-[1px]` only in graph-explorer
- `--radius-3xl` / `--radius-4xl` gone
- Recipes documented in `UI_CLEANUP_PLAN.md`
- `pnpm typecheck` passes on `@selecta/ui` and `@selecta/web`

## 9. How this feeds the rest of the epic

```text
UI-1 (done) → UI-2 (this) → UI-5 primitives / UI-6 composites
                           → UI-3 theme (independent after UI-1)
```

After this lands: later tickets use `text-page-title` / `text-eyebrow` /
`text-numeric` / the spacing table / the three radius tiers. If a later
ticket needs a fourth title size, it extends `globals.css` rather than
inlining `text-4xl`.
