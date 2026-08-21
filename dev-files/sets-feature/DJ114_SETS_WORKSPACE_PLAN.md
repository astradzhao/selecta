# DJ-114 — SET-4: Sets tab and the two-pane sequence workspace (task plan)

> Ticket: [DJ-114 — SET-4: The Sets tab and the two-pane sequence workspace](https://linear.app/dj-project-astradzhao/issue/DJ-114)
> Architecture: [`../SETS_ARCHITECTURE.md`](../SETS_ARCHITECTURE.md) §4.1–§4.3, §8
> Design source: [`../UI_STYLE_GUIDE.md`](../UI_STYLE_GUIDE.md)
> Status: **plan only.** Implementation is a later `dj-114` branch.

This is the first dogfoodable Sets surface. After it ships, a DJ can create a night, put 10+ tracks
in order, link a transition to each join, mark the joins they intend to improvise, and do that
without leaving the page. Everything after SET-4 (block connectors, alternates, versions, Graph Set
mode, Follow) waits on using this.

---

## 1. Goal

Primary nav gains **Sets**. `/sets` is a browse list (Sets / Blocks sub-tabs). `/sets/:id` and
`/blocks/:id` are the same two-pane workspace: running order on the left, library palette on the
right.

Library stays a catalog (Tracks / Transitions / Submissions). Sets is assembly. Collapsing the
builder under `/library?view=sets` is the posture this ticket exists to reject.

---

## 2. What I verified (current tree)

Read this before you start. Linear and `SETS_ARCHITECTURE.md` §8 were written before DJ-138 and
DJ-113; several paths and the nav list are stale. SET-1 and SET-2 **are** on `main`.

### Already shipped (do not rebuild)

| Slice | Where | What SET-4 can call |
| --- | --- | --- |
| SET-1 (DJ-111, #73) | `packages/db` migration `0010_blocks.sql`, `packages/library/src/blocks.ts` | Gap states, seams, derived completeness, reorder-in-one-transaction, stale-pin clearing on **write** |
| SET-2 (DJ-112, #74) | `apps/api/app/blocks/**` | Full HTTP surface. Linear still says In Progress; the PR is merged. DJ-114 is unblocked in git. |
| SET-3 (DJ-113, #99) | `/library/add/transitions` | Manual transition create with `?fromTrackId=&toTrackId=` prefills |

Useful SET-2 routes for this slice:

| Method | Path | SET-4 use |
| --- | --- | --- |
| `GET` / `POST` | `/blocks` | Browse + create. `kind`, `q`, `complete`, `limit`, `offset` |
| `GET` / `PATCH` / `DELETE` | `/blocks/:id` | Load / rename / delete. `expectedUpdatedAt` on PATCH |
| `POST` | `/blocks/:id/steps` | Append or insert `{ trackId, position? \| "append", inTransitionId? }` |
| `PATCH` / `DELETE` | `/blocks/:id/steps/:stepId` | Link / unlink / seam / note / remove |
| `POST` | `/blocks/:id/reorder` | `{ stepIds, expectedUpdatedAt }` — full ordering, rejects a mismatched id set |

`GET /blocks/:id` already returns `steps[].gapState` (`linked \| available \| unmapped \| seam`) and
`candidateCount`. Completeness already excludes seams (covered by `packages/library/src/blocks.test.ts`).
Deleting a transition already `SET NULL`s the pin and recomputes; the step stays.

### Stale in the Linear description

- **Nav is not `Add · Library · Sets · Graph`.** DJ-138 deleted `/add` and the Add tab. Current
  primary nav is **Library · Graph** (`apps/web/components/app-shell.tsx`). SET-4 adds Sets:
  **Library · Sets · Graph**. Do not revive Add.
- **`app/sets/…` and `components/sequences/` do not exist.** There is no Sets UI at all.
- **Unmapped "Add transition" is not `/add?mode=transition`.** It is
  `/library/add/transitions?fromTrackId=&toTrackId=`. Sequence `returnTo` is DJ-118 — do not invent
  it here. After creating the edge, the user comes back and the gap should now read `available`.
- **`candidateCount` includes complete block connectors**, not just transitions. SET-4 cannot pick
  blocks. Treat a gap with zero *transition* candidates as `unmapped` in the chrome even if the API
  says `available` because of a block. Copy must say "N transitions", never "N connectors".
- **`GET /blocks/:id` is ids-only.** `SequenceStep` has `trackId` / `inTransitionId` / `inBlockId`
  and no nested track or transition. The workspace cannot render cards, BPM deltas, runtime, or
  mix labels from that payload. SET-4 embeds summaries on detail (D6).
- **Web never imports `@selecta/library` into client components** except `/constants`. Importing
  `compareNeighborhoodNeighbors` from the package barrel would pull drizzle into the browser.
  Extract the pure rank helper (D7).
- **AppShell is `max-w-5xl` with `py-8`.** A two-pane workspace does not fit. Add width/density
  variants; do not globally widen Library.
- **Architecture ASCII includes drag handles, version switcher, Follow, Open in graph, block
  connectors, and alternates.** Those are SET-5…SET-10. SET-4 ships `↑`/`↓` buttons, no versions,
  no graph buttons, transitions only.

### Patterns to copy

- Browse chrome: `PageHeader` + `SegmentedTabs` + `FilteredListShell` + `AddNewButton`, same as
  Library (`library-workspace.tsx`).
- List fetch: `useFilteredList` + `SearchField`.
- Destructive: `ConfirmDialog`. Never `window.confirm`.
- API client: `apiFetch` via `/backend` (`lib/api/client.ts`). No react-query, no server actions.
- Pages: thin async server shells that wrap `AppShell` and a client workspace. `params` and
  `searchParams` are `Promise<…>` (Next 16).
- Type names: `SequenceRecord` / `SequenceDetail` / `SequenceStep`. Never `set` or `block` as a
  variable (architecture §3).
- Track cards: crate geometry from `LibraryTrackRow` (artwork, title, artist, BPM/key) — compact,
  not a second track-row family. Palette rows can reuse `TrackRow` / transition-row fragments.
- Gap mix labels: `displayVocab` from `lib/transitions/vocab-labels.ts`.

### What SET-4 does *not* have to do

`GET` does **not** clear stale pins. Stale connectors are cleared on the next **write**
(`recomputeSequenceDerived`). The editor must still **display** a stale pin as unlinked: trust
`gapState` from the payload (already derived on read via `validateConnector`), and never render a
transition whose endpoints do not match the current neighbors.

---

## 3. Decisions

| ID | Question | Decision |
| --- | --- | --- |
| D1 | Primary nav | **Library · Sets · Graph.** Sets is active for `/sets`, `/sets/:id`, and `/blocks/:id`. Library is unchanged. |
| D2 | Browse vs workspace | `/sets` (and `/sets?view=blocks`) is a list. `/sets/:id` and `/blocks/:id` are the workspace. Same `sequence-workspace.tsx`; `kind` changes the header noun ("Set" / "Block") and the empty-state copy. Palette has Tracks and Transitions only. |
| D3 | Canonical URL after load | If the record's `kind` does not match the route (`set` on `/blocks/:id` or `block` on `/sets/:id`), `router.replace` to the matching path. Both routes always mount the same component. |
| D4 | Create | Dialog on the browse page: required title, kind from the active sub-tab. `POST /blocks` then navigate to the new workspace. No seed. Default title is not invented — the field starts empty and Create stays disabled. |
| D5 | Reorder | `↑`/`↓` per step. `POST /reorder` with the full `stepIds` plus `expectedUpdatedAt`. No drag-and-drop library. |
| D6 | Hydrate tracks / transitions | **Embed on `GET`/`POST`/`PATCH` sequence detail.** Each step gains `track` (summary: id, title, artists, artworkUrl, bpm, musicalKey, durationSec) and `inTransition` (mix fields + endpoint ids, or null). Implemented in `hydrateSteps` via `getTrackSummariesByIds` + a batch transition fetch. List (`GET /blocks`) stays ids-only. This is an allowed SET-4 API additive change; the workspace is not a client-side N+1 join. |
| D7 | Palette ranking | Extract `transitionQualityRank` / `compareNeighborhoodNeighbors` into `packages/library/src/neighborhood-rank.ts` with **no db imports**. Export `@selecta/library/neighborhood-rank`. Palette and gap picker sort with that. Do not import `@selecta/library` from a client component. |
| D8 | SET-4 gap chrome vs API `gapState` | Header completeness uses API `gapState` (domain truth, already excludes seams). Visible gap chrome is transition-only: `inBlockId` without a valid `inTransitionId` renders a muted "Block connector" placeholder (unlink allowed, no expand/detach). `available` with zero transition hits renders as `unmapped`. |
| D9 | Palette `+` | Tracks: no selection → append; gap selected → insert at that destination index; step selected → insert after that step. Transitions: `+` enabled only when a gap is selected and the edge matches `(from, to)`; it PATCHes `inTransitionId`. With no gap selected, Transitions is browse/search only. |
| D10 | Unmapped action | Link to `libraryAddHref("transitions")` plus `fromTrackId` / `toTrackId`. Do not build a second form. Do not add `returnTo` (DJ-118). |
| D11 | AppShell | Add `width?: "default" \| "wide"` (`max-w-5xl` / `max-w-7xl`) and `density?: "page" \| "workspace"` (`py-8` vs flush `flex-1 min-h-0`). Browse uses default/page. Workspace uses wide/workspace so the two panes fill the viewport under the 3.5rem nav. |
| D12 | Selection | `none \| { kind: "step"; stepId } \| { kind: "gap"; stepId }`. Gap id is the **destination** step (the one that owns `gapState`). Clicking a gap selects it and filters the palette; clicking the selected gap again clears. |
| D13 | Step note | Inline on the step card. `PATCH { note }`. Distinct from `transitions.notes`. Empty string → null. |
| D14 | Runtime | Sum `durationSec` minus overlap seconds where we can estimate: `barsOverlap * 4 * 60 / bpm` using the **from** track's BPM, 4/4. Missing duration, BPM, or overlap → skip that subtraction. Label **approx**. |
| D15 | BPM delta | Per gap, `to.bpm - from.bpm`, shown as `+2` / `−2` / `0`. Missing either BPM → no chip. No Camelot/key math (deferred, architecture §12). |
| D16 | Delete sequence | ConfirmDialog on the browse row and in the workspace header. `DELETE /blocks/:id`. 409-with-referrers will not happen until SET-5; still surface the API message. |
| D17 | Rename | Workspace title is an inline edit. `PATCH { title, expectedUpdatedAt }`. |
| D18 | First step | No inbound gap. No seam, no connector, no gap chrome above track 1. |
| D19 | Optimistic concurrency | Reorder and title PATCH send `expectedUpdatedAt`. Step add/patch/delete do not (API does not require it). On 409, reload detail and show an `Alert`. |
| D20 | New feature folder | `apps/web/components/sequences/` and `apps/web/lib/sequences/`. Style guide domain folders gain `sequences`. Graph/library/add do not own this UI. |

### Explicitly out of scope

- Block connectors, collapsed rows, detach, "Save trail as a block" (DJ-115 / SET-5).
- Alternates (DJ-116) and versions (DJ-117).
- `/add` sequence context, `returnTo`, `AddToSequenceMenu` (DJ-118).
- Graph Set mode and Follow (DJ-119, DJ-120).
- Pointer drag-and-drop.
- Key compatibility.
- Authoring transitions inside the workspace (the Library add page is the form).
- Changing Library views. No Sets list under `/library`.
- Reviving the Add nav item.

---

## 4. Surfaces

### 4.1 Browse — `/sets`

```text
Sets                                          [ New set ]
Nights you mean to play, in order.

[ Sets ] [ Blocks ]

⌕ search                          [ All / Complete / Incomplete ]  ← Blocks tab only

Sunset rooftop     11 tracks · 2 seams · approx 47 min     3h
Warmup block       incomplete                               2d
```

- Sets tab: `GET /blocks?kind=set&q=`.
- Blocks tab: `GET /blocks?kind=block&q=&complete=`. Completeness filter is a `Select`, default All.
- Empty: `EmptyState` + the same New button.
- Row click → workspace. Completeness: a quiet badge (`complete` → `success`, else muted). Track
  count is **not** on `SequenceRecord`; SET-4 does not add it. Show title, complete/incomplete,
  `formatCompactAge(updatedAt)`.
- New button label follows the tab: "New set" / "New block".

### 4.2 Workspace — `/sets/:id`, `/blocks/:id`

```text
← Sets
Sunset rooftop                              approx 47 min · 11 tracks
8 of 8 planned · 2 seams                    [Delete]

Left pane (~3/5)                            Right pane (~2/5)
─────────────────────────────────────────   ────────────────────────────────
 1  ▮ Midnight City     M83   124  8A       Library
    note: [ kill the bass early     ]       [ Tracks ] [ Transitions ]
    [↑][↓][Remove]                          ⌕
      │
      ├─ blend · 16 bars · great     ✎ 〜    ▮ Innerbloom   RÜFÜS  122  [+]
      │  +2 BPM                              ▮ You Were Right      120  [+]
      │
 2  ▮ Innerbloom        RÜFÜS 122  9A
      │
      ├─ ⚠ 3 transitions — pick one
      │
 3  ▮ Opus              Prydz 126  4A
      │
      ├─ 〜 open seam · improvise
      │
 4  ▮ Sun Rising        Blue Six 120 7A

 [ + Add track ]
```

Header facts, left to right under the title: `approx {runtime} · {n} tracks`, then
`{linked} of {planned} planned · {k} seams`. Omit the seams clause when `k === 0`. Empty sequence:
`0 tracks` and no planned line.

Left pane is a single vertical column. Right pane is a sticky `rounded-xl border` card (workbench,
same family as Library lists). On a narrow viewport the palette stacks **under** the running order;
do not invent a drawer.

### 4.3 Gap chrome (SET-4)

| State | Condition (display) | Primary actions |
| --- | --- | --- |
| **linked** | Valid `inTransitionId` | Mix label (`technique · overlap · quality`), BPM delta, Swap (opens picker), Unlink, Mark seam |
| **available** | No valid transition pin, `GET /transitions?fromTrackId&toTrackId` has hits | "N transitions — pick one", Mark seam |
| **unmapped** | No valid pin and no transition hits | "Add transition" (Library add, endpoints locked via query), Mark seam |
| **seam** | `isSeam` | "Open seam · improvise", Unmark |

Picker is a popover/panel listing matching transitions, ranked (D7), each with `+` / Select. Same
writer as the palette: `PATCH { inTransitionId }`. Marking a seam is `PATCH { isSeam: true }`
(API clears the connector). Unlink is `PATCH { inTransitionId: null }`.

---

## 5. Selection, insert, and the single writer

All structural edits go through `lib/sequences/api.ts`. The palette is a second **entrance**, not a
second writer.

```ts
type WorkspaceSelection =
  | { kind: "none" }
  | { kind: "step"; stepId: string }
  | { kind: "gap"; stepId: string };

function insertIndex(
  selection: WorkspaceSelection,
  steps: SequenceStep[],
): number | "append" {
  if (selection.kind === "none") return "append";
  const index = steps.findIndex((step) => step.id === selection.stepId);
  if (index < 0) return "append";
  // gap on destination i → insert at i (between previous and this step)
  // step selected → insert after it
  return selection.kind === "gap" ? index : index + 1;
}
```

After every mutation, replace local `SequenceDetail` with the response body (already the full
detail, including new `gapState`s). Reorder flipping `A→B→C` to `A→C→B` must show the previously
linked gaps as `available`/`unmapped`, never as the old mix. That is the load-bearing UX of this
ticket; the API already does the work if the client does not cache connectors by step id across the
swap.

---

## 6. File map

| Path | Disposition |
| --- | --- |
| `apps/web/app/sets/page.tsx` | **new** — browse shell, parse `view` |
| `apps/web/app/sets/[id]/page.tsx` | **new** — workspace shell, `kind` hint `"set"` |
| `apps/web/app/blocks/[id]/page.tsx` | **new** — workspace shell, `kind` hint `"block"` |
| `apps/web/components/app-shell.tsx` | edit — Sets nav; `width` + `density` |
| `apps/web/components/sequences/sequences-browse.tsx` | **new** — Sets/Blocks list + create dialog |
| `apps/web/components/sequences/sequence-workspace.tsx` | **new** — two-pane + selection |
| `apps/web/components/sequences/sequence-editor.tsx` | **new** — ordered line, ↑↓, remove, notes |
| `apps/web/components/sequences/sequence-gap.tsx` | **new** — four states + picker |
| `apps/web/components/sequences/library-palette.tsx` | **new** — Tracks / Transitions, gap-aware |
| `apps/web/components/sequences/sequence-step-card.tsx` | **new** — compact crate card |
| `apps/web/lib/sequences/api.ts` | **new** — typed `apiFetch` wrappers |
| `apps/web/lib/sequences/types.ts` | **new** — client types matching the (embedded) payload |
| `apps/web/lib/sequences/view.ts` | **new** — `parseSetsView`, `setsViewHref` |
| `apps/web/lib/sequences/view.test.ts` | **new** | 
| `apps/web/lib/sequences/metrics.ts` | **new** — planned/seams header, runtime, BPM delta, insert index |
| `apps/web/lib/sequences/metrics.test.ts` | **new** |
| `apps/web/lib/sequences/gap-display.ts` | **new** — SET-4 transition-only chrome vs API `gapState` |
| `apps/web/lib/sequences/gap-display.test.ts` | **new** |
| `packages/library/src/neighborhood-rank.ts` | **new** — pure rank helpers moved off `neighborhood.ts` |
| `packages/library/src/neighborhood.ts` | edit — re-export from the new file |
| `packages/library/package.json` | edit — `"./neighborhood-rank"` export |
| `packages/library/src/blocks.ts` | edit — embed `track` + `inTransition` on `SequenceStep` |
| `packages/library/src/blocks.test.ts` | edit — assert embeds round-trip on detail |
| `dev-files/UI_STYLE_GUIDE.md` | edit — mention `components/sequences` as a domain folder |
| `apps/web/app/page.tsx` | optional, tiny — "Open sets" outline button. Skip if it crowds Home; not required by the ticket. |

No schema / migration. No new `/transitions` writer. No Graph session-store changes.

`connector-picker.tsx`, `block-connector-row.tsx`, `alternate-list.tsx`, `version-switcher.tsx`,
`graph-set-rail.tsx`, `add-to-sequence-menu.tsx` stay uncreated.

---

## 7. Phases

### Phase 1 — shell: nav, routes, browse

- AppShell: Sets link; `width` / `density` props with today's look as the default.
- `/sets` browse with Sets/Blocks tabs, search, create dialog, empty state, delete.
- `/sets/:id` and `/blocks/:id` render a stub workspace ("loading" `StatePanel`).
- `lib/sequences/api.ts` + `view.ts`.

**Verify:** Sets appears between Library and Graph. Library tabs are still Tracks / Transitions /
Submissions. Creating a set from `/sets` lands on `/sets/:id`. Creating a block from
`/sets?view=blocks` lands on `/blocks/:id`. Unknown `?view=` coerces to Sets, and an unrecognized
value is never interpolated into an href.

### Phase 2 — embed tracks/transitions on sequence detail

- Extend `SequenceStep` in `packages/library/src/blocks.ts`.
- Batch-load tracks and pinned transitions inside `hydrateSteps`.
- Missing track should not happen (step FK cascades); if it does, skip the step rather than
  crashing the page.
- Keep list endpoint unchanged.

**Verify (unit):** after seeding two tracks and linking a transition, `getSequenceDetail` returns
`steps[1].track.title` and `steps[1].inTransition.technique`. After `deleteTransitionById`,
`inTransition` is null and `gapState !== "linked"` while both steps remain.

### Phase 3 — running order

- Step cards, ↑↓, remove (`ConfirmDialog`), append via "+ Add track" (opens the palette focused on
  Tracks, or a small `TrackPicker` popover — prefer focusing the palette).
- Inline step note.
- Gaps render the four states from `gap-display.ts`.
- Header metrics from `metrics.ts`.
- Rename.

**Verify (manual):** ten tracks, reorder two neighbors, the old mix label disappears immediately.
Mark a seam; header becomes `N of N planned · 1 seam` and `isComplete` can be true with an open
join. Delete a linked transition in Library, reload the set: the track is still there, the gap is
not linked.

### Phase 4 — palette + linking

- Palette Tracks / Transitions, `SearchField`, `+`.
- Selecting a gap filters Transitions to that pair, ranked with `compareNeighborhoodNeighbors`.
- Transition `+` / picker Select both `PATCH inTransitionId`.
- Unmapped "Add transition" deep-links to DJ-113's page.

**Verify:** with a gap selected, a transition between a different pair has no `+`. With nothing
selected, transition rows have no `+`. Adding a track from the palette with a gap selected inserts
between those neighbors, not at the end.

---

## 8. Testing

Only tests that catch a bug a human or typecheck would miss.

| Test | Bug it catches |
| --- | --- |
| `setsViewHref` / `parseSetsView` | Blocks tab silently 404s or interpolates `?view=` into an href |
| `insertIndex` none / gap / step | Palette `+` appends when a gap is selected, so "insert here" is a lie |
| Planned completeness: 2 linked + 1 seam + 1 unmapped → `1 of 2 planned · 1 seam` | Header counts seams in the denominator and nags the DJ about improvisation |
| `displayGapState` with `gapState: "available"` and 0 transition hits → `unmapped` | Block-only candidates show "pick one" with an empty picker |
| Runtime: 180s + 180s, overlap 8 bars at 120 BPM → `360 - 16 = 344` | Overlap subtracted in bars, or from the wrong BPM, silently inflates the night |
| BPM delta missing BPM → no chip; 124 → 122 → `−2` | `NaN` chips |
| Neighborhood-rank move: existing `neighborhood.test.ts` still passes | Extracting the helper changes sort order vs Graph |
| Detail embed after link/unlink (library test) | Workspace cards have ids and no titles |

No render/snapshot tests of the workspace. No Playwright. Reorder-invalidates-connectors and
transition-delete-degrades-not-cascades already exist in `blocks.test.ts` — do not duplicate them
on the client.

---

## 9. Acceptance (ticket, restated against the current tree)

- **Sets** is in the primary nav. Library still shows only Tracks / Transitions / Submissions.
- Create a set from `/sets`, order 10+ tracks, link transitions, mark seams, reorder with `↑`/`↓`,
  and watch gap states update from the mutation response (no full-page reload).
- Tracks and matching transitions can be pulled in from the palette without a modal and without
  leaving the page.
- Selecting a gap narrows the palette to transitions valid for that pair, ranked the same way as
  Graph.
- Reordering visibly flips affected gaps out of `linked`.
- Completeness excludes seams from the denominator.
- Deleting a transition in Library degrades the gap in any sequence using it, without removing the
  track.
- Blocks sub-tab browses `kind=block` with a completeness filter. Opening a block uses the same
  workspace.
- Unmapped gaps deep-link to `/library/add/transitions` with both endpoints filled.

---

## 10. Implementation notes

- Work on branch `dj-114` from an up-to-date `main` when this plan is executed. This plan file
  itself is not that implementation.
- `pnpm` only. Format with oxfmt.
- `expectedUpdatedAt` is an ISO string on the wire, parsed to `Date` in `apps/api/lib/blocks.ts`.
- After a successful structural edit, keep the same selection if that `stepId` still exists;
  otherwise clear it.
- Do not prefetch Graph or Follow. The architecture ASCII is the north star for later slices, not
  a checklist for this one.
