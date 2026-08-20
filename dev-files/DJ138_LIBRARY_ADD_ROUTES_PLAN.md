# DJ-138 — Move Add under Library as sub-pages (task plan)

> Ticket: [DJ-138 — Move Add under Library as sub-pages and retire the top-level `/add` route](https://linear.app/dj-project-astradzhao/issue/DJ-138)
> Related: [DJ-113](https://linear.app/dj-project-astradzhao/issue/DJ-113) (SET-3, manual transition form — its scope text becomes stale, see §9), [DJ-118](https://linear.app/dj-project-astradzhao/issue/DJ-118) (SET-8, `/add` deep links), [DJ-99](https://linear.app/dj-project-astradzhao/issue/DJ-99) (precedent for deleting a route instead of aliasing it)
> Design source: [`UI_STYLE_GUIDE.md`](./UI_STYLE_GUIDE.md)
> Status: **not started.**

Work on branch `dj-138`. Commit per phase (five commits), one PR.

---

## 1. Goal

Creating anything starts on `/library`. Each of the three Library sections has a persistent add
button at the top of its list; that button opens a focused sub-page under `/library/add/*` that
looks like a task, not a destination, and has a back link to the section that opened it. The
top-level `/add` route and its nav item stop existing.

This is a **navigation and presentation** ticket. No API route changes, no schema changes, and no
change to what the two forms actually submit.

---

## 2. What I verified (current tree)

Read this before you start; several things are not where you would guess.

- `/add` is **one page with a `?mode=` query param**, not two routes. `apps/web/app/add/page.tsx`
  (18 lines) parses the param via `apps/web/lib/add/mode.ts` and hands it to `AddWorkspace`.
- `apps/web/components/add/add-workspace.tsx` (65 lines) is the whole "top-level page" costume:
  a `PageHeader` titled "Add", a per-mode description, a `SegmentedTabs` row, and a two-way
  conditional render. **Nothing else in it is worth keeping** — the two forms it renders are
  self-contained.
- Only `components/add/` file besides the workspace is `new-submission-form.tsx` (102 lines). The
  track form lives elsewhere: `apps/web/components/tracks/add-track-flow.tsx` (225 lines).
- `AddTrackFlow` has its own internal two-step `mode` state (`"search"` → `"review"`) with a
  "Back to search" ghost button. **That is unrelated to the URL `?mode=` param** and must not be
  touched. Do not confuse the two.
- `/add?mode=transition` **is** the submission form. It POSTs a submission and redirects to
  `/library/submissions/:id`. There is no separate "add transition" surface anywhere except the
  Graph explorer's inline `AddTransitionPanel`. This is why D2 in the ticket defers Transitions.
- Only the **Submissions** list has a persistent add button today
  (`submissions-list.tsx:119-126`, in `FilteredListShell`'s `toolbar` slot). Tracks and Transitions
  only surface "add" inside their `EmptyState`.
- `apps/web/components/tracks/library-list.tsx:96-106` already uses the `toolbar` slot — for
  `ClearFiltersButton`. Transitions puts its clear button in `filterBar` instead. So the three lists
  are already inconsistent about which slot holds what; §6 standardizes it.
- `FilteredListShell` decides whether to render the count row with
  `countRowVisible = showCountRow ?? (!error || hasFilters || Boolean(toolbar))`
  (`filtered-list-shell.tsx:107`). Passing a `toolbar` therefore makes that row appear **even in the
  error state**. See §6.4 — this is expected, not a bug you introduced.
- `parseLibraryView` (`apps/web/lib/library/view.ts`) coerces anything unrecognized to `"tracks"`.
  That is fine for `?view=` but wrong for the back-link `?from=` param (§5.2).
- The `next === "tracks" ? "/library" : \`/library?view=${next}\`` ternary is written out three times
  in `library-workspace.tsx` (lines 60, 83) and once as a constant in `submission-detail.tsx:26`.
  §5.2 replaces it with one helper.
- `apps/web/app/tracks/new/page.tsx` is **dead code**. `next.config.ts:26-29` already redirects
  `/tracks/new` at the config level, which runs before routing, so the page never renders.
- Tests use `node:test` + `node:assert/strict` (see `apps/web/lib/library/list-view-state.test.ts`).
  There is no Playwright / e2e suite, and no test currently touches `/add`.

---

## 3. Decisions

Copied from the ticket so you do not need to switch tabs. Do not relitigate these.

| ID  | Question                                       | Decision                                                                                                                                                                                                 |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Keep `/add` as a redirect?                     | **No — delete it, let it 404.** Only `/tracks/new` and `/songs/new` keep their existing config redirects, retargeted at `/library/add/tracks`.                                                              |
| D2  | Does Transitions get its own add page?          | **No.** Its button points at `/library/add/submissions?from=transitions`. `/library/add/transitions` is DJ-113's job. Do not build a transition form in this ticket.                                        |
| D3  | Where do the add buttons go?                    | The `toolbar` slot of `FilteredListShell`, in all three lists. Not `PageHeader actions` (already occupied by the needs-review link).                                                                        |
| D4  | Do the add components move folders?             | **No.** `components/add/` stays. Only `add-workspace.tsx` is deleted.                                                                                                                                     |
| D5  | How does Back know where to return?             | A `?from=<library view>` param, matched against the exact list of views. An unrecognized value falls back to the page's own default view. **Never interpolate the raw param into an href.**                 |
| D6  | New header component or a variant of `PageHeader`? | **Variant.** Add `size?: "page" \| "section"` to `packages/ui/src/components/page-header.tsx`. A near-duplicate sibling component is a documented anti-pattern in the style guide.                        |

### Explicitly out of scope

- Any manual/no-LLM transition form (DJ-113).
- `sequenceId` / `returnTo` deep-link context (DJ-118).
- Changing the Library page's own `PageHeader`, its tabs, or the needs-review link.
- Changing any `apps/api` route, any payload key, or anything in `packages/db`.
- Turning the add pages into modals or dialogs. They are routes.

---

## 4. File map

| Path                                                       | Disposition                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| `apps/web/app/add/page.tsx`                                | **delete** (and the now-empty `app/add/` directory)           |
| `apps/web/app/tracks/new/page.tsx`                         | **delete** (dead code, §2)                                    |
| `apps/web/components/add/add-workspace.tsx`                | **delete**                                                    |
| `apps/web/lib/add/mode.ts`                                 | **delete** (and the now-empty `lib/add/` directory)           |
| `apps/web/app/library/add/tracks/page.tsx`                 | **new**                                                       |
| `apps/web/app/library/add/submissions/page.tsx`            | **new**                                                       |
| `apps/web/components/add/add-page-shell.tsx`               | **new** — shared chrome for both add pages                    |
| `apps/web/components/common/add-new-button.tsx`            | **new** — the toolbar button, used by all three lists         |
| `apps/web/lib/library/add-routes.ts`                       | **new** — href builders                                       |
| `apps/web/lib/library/add-routes.test.ts`                  | **new** — the only test in this ticket (§8)                   |
| `packages/ui/src/components/page-header.tsx`               | edit — add the `size` variant                                 |
| `apps/web/lib/library/view.ts`                             | edit — export an exact-match helper                           |
| `apps/web/components/app-shell.tsx`                        | edit — drop the Add nav link                                  |
| `apps/web/components/library/library-workspace.tsx`        | edit — use `libraryViewHref`                                  |
| `apps/web/components/tracks/library-list.tsx`              | edit — toolbar button + empty CTA                             |
| `apps/web/components/library/transitions-list.tsx`         | edit — toolbar button + empty CTA                             |
| `apps/web/components/library/submissions-list.tsx`         | edit — retarget existing toolbar button + empty CTA           |
| `apps/web/components/tracks/add-track-flow.tsx`            | edit — sub-page density pass (§7.2)                           |
| `apps/web/components/add/new-submission-form.tsx`          | edit — dynamic cancel href (§7.3)                             |
| `apps/web/app/page.tsx`                                    | edit — retarget two home CTAs                                 |
| `apps/web/components/library/proposal-endpoint-picker.tsx` | edit — retarget one link                                      |
| `apps/web/components/graph/add-transition-panel.tsx`       | edit — retarget one link                                      |
| `apps/web/components/graph/next-transitions.tsx`           | edit — retarget one link                                      |
| `apps/web/next.config.ts`                                  | edit — retarget two redirect destinations                     |
| `dev-files/UI_STYLE_GUIDE.md`                              | edit — document the `PageHeader` variant (§10)                |

---

## 5. Phase 1 — shared plumbing

Nothing user-visible changes in this phase. It compiles and the app still works exactly as before.

### 5.1 `packages/ui/src/components/page-header.tsx`

Add a `size` prop. The `"page"` branch must render byte-identical output to today so no existing
page shifts.

```tsx
function PageHeader({
  lead,
  title,
  description,
  actions,
  size = "page",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"header">, "title"> & {
  lead?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  size?: "page" | "section";
}) {
  return (
    <header
      data-slot="page-header"
      data-size={size}
      className={cn(
        "space-y-4",
        size === "page" ? "border-border border-b pb-6" : null,
        className,
      )}
      {...props}
    >
      {lead}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className={cn(size === "page" ? "text-page-title" : "text-section-title", "text-balance")}>
            {title}
          </h1>
          {actions}
        </div>
        {description ? (
          <div className="text-body text-muted-foreground max-w-xl">{description}</div>
        ) : null}
      </div>
      {children}
    </header>
  );
}
```

Rules:

- The element stays an `<h1>` in both sizes. It is still the page's only top-level heading; only the
  *visual* role changes. Do not switch it to `<h2>`.
- Do not invent a new spacing value. `space-y-4` is shared; the section variant just drops the
  border and the `pb-6`.

### 5.2 `apps/web/lib/library/view.ts`

`parseLibraryView` must keep its current coerce-to-tracks behavior — `/library?view=garbage` should
still show Tracks. Add an exact-match variant next to it for the `?from=` case, and derive the
existing function from it so the list of views lives in one place:

```ts
export const LIBRARY_VIEWS = ["tracks", "transitions", "submissions"] as const;

export type LibraryView = (typeof LIBRARY_VIEWS)[number];

export function matchLibraryView(raw: string | undefined | null): LibraryView | null {
  return LIBRARY_VIEWS.includes(raw as LibraryView) ? (raw as LibraryView) : null;
}

export function parseLibraryView(raw: string | undefined | null): LibraryView {
  return matchLibraryView(raw) ?? "tracks";
}
```

### 5.3 `apps/web/lib/library/add-routes.ts` (new)

Every `/library/add/*` and `/library?view=*` href in the app comes from here after this ticket. No
component hand-builds one.

```ts
import { matchLibraryView, type LibraryView } from "@/lib/library/view";

export type LibraryAddCategory = "tracks" | "submissions";

const ADD_PATHS: Record<LibraryAddCategory, string> = {
  tracks: "/library/add/tracks",
  submissions: "/library/add/submissions",
};

/** Href for a Library section. Tracks is the default view, so it has no query param. */
export function libraryViewHref(view: LibraryView): string {
  return view === "tracks" ? "/library" : `/library?view=${view}`;
}

/**
 * Href for an add sub-page. `from` records which section the user left, so Back can return there;
 * it is omitted when it would be redundant with the page's own default.
 */
export function libraryAddHref(category: LibraryAddCategory, from?: LibraryView): string {
  const path = ADD_PATHS[category];
  return from && from !== category ? `${path}?from=${from}` : path;
}

/**
 * Where an add sub-page's Back link points. `from` arrives from the URL and is untrusted: anything
 * not an exact known view falls back to the page's own section.
 */
export function libraryAddBackHref(
  from: string | undefined | null,
  fallback: LibraryView,
): string {
  return libraryViewHref(matchLibraryView(from) ?? fallback);
}
```

Then replace the hand-built hrefs in `library-workspace.tsx` (lines 60 and 83) and
`submission-detail.tsx:26` with `libraryViewHref(...)`. This is a pure refactor — the strings
produced are identical.

### 5.4 `apps/web/components/common/add-new-button.tsx` (new)

Lives in `common/` because all three lists use it and one of them (`library-list.tsx`) sits in
`components/tracks/`, which should not reach into `components/library/`. Matches the button that
already exists in `submissions-list.tsx:119-126`, so the Submissions toolbar does not change
appearance.

```tsx
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { Button } from "@selecta/ui/components/button";

export function AddNewButton({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild size="sm" variant="outline">
      <Link href={href}>
        <PlusIcon />
        {label}
      </Link>
    </Button>
  );
}
```

### 5.5 `apps/web/components/add/add-page-shell.tsx` (new)

The single source of truth for what an add sub-page looks like. Both pages — and DJ-113's third one
— go through it, which is what guarantees they stay consistent.

```tsx
import { PageHeader } from "@selecta/ui/components/page-header";

import { BackLink } from "@/components/common/back-link";

export function AddPageShell({
  title,
  description,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-2xl space-y-6">
      <PageHeader
        size="section"
        title={title}
        description={description}
        lead={<BackLink href={backHref}>{backLabel}</BackLink>}
      />
      <div className="border-border bg-surface-1 rounded-xl border px-5 py-6">{children}</div>
    </div>
  );
}
```

Why each piece is there — keep all four, they are the redesign:

| Choice                                | Signal it sends                                                                        |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| `max-w-2xl` inside the 5xl `AppShell` | A narrow column reads as a focused task, not a browsing surface                         |
| `size="section"` + no bottom border   | Removes the two strongest "top-level page" cues (`text-page-title` and the header rule) |
| `BackLink` in `lead`                  | An explicit way out that does not go through the nav                                    |
| One `rounded-xl` `surface-1` panel    | Contains the form as a single object; card radius tier per the style guide              |

There is no `SegmentedTabs` anywhere in this component. That is the point — the tab bar was the main
reason `/add` read as a peer of `/library`.

**Commit:** `feat(ui): add PageHeader section size and Library add route helpers`

---

## 6. Phase 2 — the two routes and the three toolbar buttons

### 6.1 `apps/web/app/library/add/tracks/page.tsx` (new)

```tsx
import { AppShell } from "@/components/app-shell";
import { AddPageShell } from "@/components/add/add-page-shell";
import { AddTrackFlow } from "@/components/tracks/add-track-flow";
import { libraryAddBackHref } from "@/lib/library/add-routes";

type PageProps = {
  searchParams: Promise<{ from?: string }>;
};

export default async function AddTrackPage({ searchParams }: PageProps) {
  const { from } = await searchParams;
  const backHref = libraryAddBackHref(from, "tracks");

  return (
    <AppShell currentPath="/library">
      <AddPageShell
        title="Add a track"
        description="Search the catalog, confirm the details, then tag it with subgenres and folders."
        backHref={backHref}
        backLabel="Back to library"
      >
        <AddTrackFlow />
      </AddPageShell>
    </AppShell>
  );
}
```

`currentPath="/library"` is load-bearing: `AppShell` lights the nav pill when
`currentPath === href || currentPath.startsWith(href + "/")` (`app-shell.tsx:30-31`), so this keeps
Library active while you are on a sub-page. Do not pass `/library/add/tracks`.

`searchParams` is a Promise and must be awaited — match the existing pages
(`app/library/page.tsx:10`).

### 6.2 `apps/web/app/library/add/submissions/page.tsx` (new)

Same shape, with `libraryAddBackHref(from, "submissions")` and:

- title: `"New submission"`
- description: `"Paste free-form mix notes describing one or many transitions. Extraction starts in the background."`
- body: `<NewSubmissionForm backHref={backHref} />` (the prop is added in §7.3)

Reuse the existing description copy from `add-workspace.tsx:23-24` rather than writing new prose.

### 6.3 Toolbar buttons

| File                                               | Change                                                                                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `components/tracks/library-list.tsx:96-106`        | The `toolbar` already holds a conditional `ClearFiltersButton`. Wrap both in `<div className="flex items-center gap-2">{hasFilters ? <ClearFiltersButton … /> : null}<AddNewButton href={libraryAddHref("tracks")} label="Add track" /></div>` so the toolbar is now unconditionally present. |
| `components/library/transitions-list.tsx`          | Add `toolbar={<AddNewButton href={libraryAddHref("submissions", "transitions")} label="Add transition" />}`. Leave its `ClearFiltersButton` in `filterBar` where it already is — do not move it.                                                                                             |
| `components/library/submissions-list.tsx:119-126`  | Replace the inline `Button`/`Link` with `<AddNewButton href={libraryAddHref("submissions")} label="New submission" />`. Visual output is unchanged.                                                                                                                                          |

The Transitions button is labelled "Add transition" but lands on the submission page. That is
correct and intentional: today writing a submission *is* how you author a transition. DJ-113
changes the destination, not the label.

### 6.4 Expected side effect — do not "fix" this

Giving Tracks and Transitions a `toolbar` flips `countRowVisible` to always-true (§2). In the error
state, `library-list.tsx` renders `count={null}`, so you get a row with an empty left side and the
add button on the right. That is the desired outcome — the API being down should not remove your
ability to add a track. Do not add a `showCountRow` override to suppress it.

**Commit:** `feat(web): add /library/add routes and per-section add buttons`

---

## 7. Phase 3 — retire `/add` and rewire every link

Do this as one commit so the tree is never in a state where a live link points at a deleted route.

### 7.1 Deletions and link rewrites

Delete, in order:

1. `apps/web/app/add/page.tsx`, then the empty `apps/web/app/add/` directory
2. `apps/web/components/add/add-workspace.tsx`
3. `apps/web/lib/add/mode.ts`, then the empty `apps/web/lib/add/` directory
4. `apps/web/app/tracks/new/page.tsx` (dead code — the config redirect already handles that path)

Then rewrite every remaining reference. This table is complete; it was produced by
`rg -n '"/add' apps/web` against the current tree. Prefer `libraryAddHref(...)` over a literal
string in every `.tsx` case.

| File                                                | Line | Was                     | Becomes                                                     |
| --------------------------------------------------- | ---- | ----------------------- | ----------------------------------------------------------- |
| `components/app-shell.tsx`                          | 8    | `{ href: "/add", … }`   | **delete the entry** — `links` becomes Library + Graph       |
| `app/page.tsx`                                      | 21   | `/add?mode=transition`  | `libraryAddHref("submissions")`                             |
| `app/page.tsx`                                      | 27   | `/add`                  | `libraryAddHref("tracks")`                                  |
| `components/tracks/library-list.tsx`                | 130  | `/add` (empty CTA)      | `libraryAddHref("tracks")`                                  |
| `components/library/transitions-list.tsx`           | 243  | `/add?mode=transition`  | `libraryAddHref("submissions", "transitions")`               |
| `components/library/submissions-list.tsx`           | 173  | `/add?mode=transition`  | `libraryAddHref("submissions")`                             |
| `components/library/proposal-endpoint-picker.tsx`   | 288  | `/add`                  | `libraryAddHref("tracks")`                                  |
| `components/graph/add-transition-panel.tsx`         | 75   | `/add`                  | `libraryAddHref("tracks")`                                  |
| `components/graph/next-transitions.tsx`             | 86   | `/add` ("Add a track")  | `libraryAddHref("tracks")`                                  |
| `next.config.ts`                                    | 27   | `/add?mode=track`       | `/library/add/tracks` (literal — config cannot import `@/`)  |
| `next.config.ts`                                    | 32   | `/add?mode=track`       | `/library/add/tracks` (literal)                              |

The three links reached from Graph and from proposal review are the ones most likely to be
forgotten. They are not in the Library UI, but they all mean "I need a track that isn't in my
library yet".

### 7.2 `components/tracks/add-track-flow.tsx` — density pass

Two concrete edits. The component's internal `"search"` / `"review"` state machine, its validation,
and its save behavior are all unchanged.

1. **Search step (line 114):** delete `searchClassName="h-12 text-base"`. That oversized field
   existed because `/add` was a landing page; inside a `max-w-2xl` panel the default `TrackPicker`
   sizing is correct. Keep `autoFocus`.
2. **Review step (lines 143-176):** the 160px artwork block currently sits on its own row above the
   fields. Put a small thumbnail beside them instead: change the wrapper to
   `h-20 w-20 shrink-0` and lay it out in a `flex items-start gap-4` row with the title/artists
   grid, so the artwork stops dominating a form whose actual content is two text inputs. If
   `catalog?.artworkUrl` is absent (manual entry), render the fields at full width with no
   placeholder box. Update the `sizes` prop on `next/image` to match the new box (`80px`).

Do not restyle the three `TagEditor` blocks, the `Separator`, or the action row. Do not change
button variants or copy.

### 7.3 `components/add/new-submission-form.tsx` — dynamic cancel

Cancel currently hardcodes `/library?view=submissions` (line 97), which would send a user who came
from Transitions to the wrong tab. Accept the href instead:

```tsx
export function NewSubmissionForm({ backHref }: { backHref: string }) {
```

and use `<Link href={backHref}>Cancel</Link>`. The page computes it once with
`libraryAddBackHref` and passes the same value to both the shell's back link and the form's cancel
button, so they can never disagree. The success redirect to `/library/submissions/:id` (line 60)
stays exactly as it is.

**Commit:** `refactor(web): delete /add and route every add entry through Library`

---

## 8. Phase 4 — test

One new test file: `apps/web/lib/library/add-routes.test.ts`, using `node:test` and
`node:assert/strict` like `list-view-state.test.ts`.

What bug does it catch that typecheck and review would miss? `from` is a `string` off the URL, so
the type system cannot tell a valid view from `"../../evil"` or `"submissions&foo=1"`. Both the
fallback rule and the exact-match rule are one-line predicates that are easy to "simplify" into
`parseLibraryView(from)`, which silently sends every bad value to Tracks instead of the page's own
section. That is a real regression with no visible symptom until someone clicks Back.

Cover exactly this:

- `libraryAddBackHref("transitions", "submissions")` → `"/library?view=transitions"`
- `libraryAddBackHref("tracks", "submissions")` → `"/library"` (default view drops the param)
- `libraryAddBackHref(undefined, "submissions")` → `"/library?view=submissions"` (falls back to the
  page's own section, **not** to tracks)
- `libraryAddBackHref("../../evil", "submissions")` → `"/library?view=submissions"` (unknown value
  is discarded, never interpolated)
- `libraryAddHref("submissions", "transitions")` → `"/library/add/submissions?from=transitions"`
- `libraryAddHref("submissions", "submissions")` → `"/library/add/submissions"` (redundant `from`
  omitted)

Add nothing else. Per `.cursor/rules/valuable-tests-only.mdc`: no render test for `AddPageShell`, no
test for the `PageHeader` variant, no snapshot of either page.

**Commit:** `test(web): cover Library add route href builders`

---

## 9. Phase 5 — docs and stale tickets

- `dev-files/UI_STYLE_GUIDE.md`: in the "Component inventory → `@selecta/ui`" and page-header
  discussion, note that `PageHeader` takes `size="page" | "section"`, and that a nested task page
  (an add sub-page) uses `size="section"` plus a `BackLink` in `lead` — never `text-page-title`.
  Add "a second page-header component in a sibling file" to the anti-patterns list.
- This file: set Status to implemented.
- **DJ-113 and DJ-118 are now partly stale.** A comment already sits on each pointing back at
  DJ-138; you do not need to add another. Do not silently rewrite their scope. For context, the
  specific breaks are:
  - DJ-113 specifies a "second-level method switch under Transition mode in
    `components/add/add-workspace.tsx`". That file no longer exists. Its form belongs at
    `/library/add/transitions`, built with `AddPageShell`, reached from the Transitions toolbar
    button whose href just moves from `libraryAddHref("submissions", "transitions")` to the new
    route.
  - DJ-118 specifies parsing `sequenceId` / `stepId` / `returnTo` in `lib/add/mode.ts`, which is
    deleted. Those params belong in `lib/library/add-routes.ts`, and its `returnTo` idea overlaps
    with this ticket's `from` — reconcile them into one mechanism rather than shipping both.

**Commit:** `docs: record the Library add sub-page pattern`

---

## 10. Verify

Per phase:

```bash
pnpm typecheck
pnpm lint
pnpm --filter @selecta/web test
```

Before opening the PR:

```bash
pnpm format
pnpm format:check
pnpm test

# Must all return nothing:
rg -n '"/add|href="/add|/add\?mode' apps/web
rg -n 'add-workspace|parseAddMode|lib/add' apps/web
```

Then run the stack (`pnpm dev`) and walk it manually:

1. `/library` — Tracks tab shows an "Add track" button next to the count, with a non-empty list.
2. Click it. The page has a back link, a `text-section-title` heading, no tab bar, and a narrow
   column. Search a track, save it, land on `/tracks/:id`.
3. Back to `/library?view=transitions` → "Add transition" → lands on the submission page → its back
   link and its Cancel button both return to **Transitions**, not Tracks.
4. `/library?view=submissions` → "New submission" → submit → lands on `/library/submissions/:id`
   and extraction still runs.
5. Nav shows two pills. `/add` 404s. `/tracks/new` redirects to `/library/add/tracks`.
6. Toggle the theme on both add pages and confirm the surface panel and back link read correctly in
   dark mode (style guide requires checking both themes).
7. With the API stopped, load `/library` — the add buttons are still visible and clickable in the
   error state (§6.4).

---

## 11. Acceptance

- No `app/add/`, no `components/add/add-workspace.tsx`, no `lib/add/`. `/add` returns 404.
- Primary nav is Library + Graph. Both add pages keep the Library pill active.
- All three Library sections show an add button at the top of the list regardless of list contents,
  and every empty-state CTA points at a `/library/add/*` route.
- Every `/library/add/*` and `/library?view=*` href in `apps/web` comes from
  `lib/library/add-routes.ts`. No component hand-builds one.
- Neither add page renders `text-page-title`, a bordered page header, or `SegmentedTabs`.
- Back and Cancel on an add page return to the section that opened it; an unrecognized `?from=`
  falls back to that page's own section.
- Saving a track lands on `/tracks/:id`; submitting a submission lands on
  `/library/submissions/:id`. Neither form's request payload changed.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` all pass.
