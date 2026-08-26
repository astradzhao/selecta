# DJ-114 — SET-4: Sets tab and the two-pane sequence workspace (task plan)

> Ticket: [DJ-114 — SET-4: The Sets tab and the two-pane sequence workspace](https://linear.app/dj-project-astradzhao/issue/DJ-114)
> Architecture: [`../SETS_ARCHITECTURE.md`](../SETS_ARCHITECTURE.md) §4.1–§4.3, §8
> **Design source: [`Sets feature mockup/Selecta Sets.dc.html`](./Sets%20feature%20mockup/Selecta%20Sets.dc.html)**
> Tokens / type / motion: [`../UI_STYLE_GUIDE.md`](../UI_STYLE_GUIDE.md)
> Status: **plan only.** Implementation is a later `dj-114` branch.

This is the first dogfoodable Sets surface. After it ships, a DJ can create a night, put 10+ tracks
in order, link a transition to each join, mark the joins they intend to improvise, and do that
without leaving the page. Everything after SET-4 (block connectors, alternates, versions, Graph Set
mode, Follow) waits on using this.

---

## 1. Goal

Primary nav gains **Sets**. `/sets` is a browse list (Sets / Blocks sub-tabs). `/sets/:id` and
`/blocks/:id` are the same two-pane workspace: running order on the left, library palette on the
right, built to the mockup.

Library stays a catalog (Tracks / Transitions / Submissions). Sets is assembly. Collapsing the
builder under `/library?view=sets` is the posture this ticket exists to reject.

---

## 2. The mockup is the design source

Open `Sets feature mockup/Selecta Sets.dc.html` in a browser and use it before writing code. It is
interactive: create a set, drag tracks in, select a gap, switch palette tabs, toggle a seam, drag a
block, flip versions. `support.js` in the same folder is the runtime — keep them together.

Read it as follows:

- **The `<x-dc>` markup owns layout, spacing, and copy.** Geometry (`3fr / minmax(320px,2fr)`,
  `max-w-1280` workspace, `max-w-1024` browse, the 34px gap rail indent, the step-card grid
  `18px 20px 36px 1fr auto auto auto`) is decided. Do not re-derive it.
- **The `DCLogic` script owns interaction semantics.** `gapState`, `dropFit`, `insertIndex`,
  `unitRange`, `candidatesFor`, `runtime`, and `addTrack`'s auto-link are the behavior spec. Where
  the prose in this plan and that script disagree, the script is what the design intends.
- **Inline `oklch()` and `var(--…)` are prototype-only.** They are the same values as
  `packages/ui/src/styles/globals.css`, so translate them to semantic Tailwind classes
  (`bg-surface-1`, `text-warning`, `bg-brand-subtle`). No hex, no `oklch()`, no `bg-zinc-*` in
  TS/TSX.
- **The mockup is the end state of the epic, not this slice.** It renders block connectors (SET-5),
  alternates (SET-6), versions (SET-7), and Follow / Open in graph (SET-9 / SET-10). SET-4 **omits**
  those controls — see D3.

### Deliberate divergences from the mockup

| Mockup | SET-4 | Why |
| --- | --- | --- |
| Blocks palette tab, block gap rows, Expand / Edit block / Detach, "moves as one" unit | Omitted | SET-5. Reorder is still written unit-aware (D8) so SET-5 does not rewrite it. |
| `+ alt` on every gap, `⤷ alt · …` rows | Omitted | SET-6. |
| Version `<select>` in the header | Omitted | SET-7. Sequence detail already carries `versions`; nothing reads it yet. |
| Follow, Open in graph | Omitted | SET-9 / SET-10. No disabled placeholders (D3). |
| Browse row shows `· approx 47 min` | Omitted | Runtime per row needs the full step → track → transition join for every row. `stepCount` and `seamCount` are cheap; runtime is the one fact you get by opening the set. Revisit if it is actually missed. |
| Browse badge reads `3 open` | `complete` / `incomplete` / `empty` | `N open` needs gap-state derivation per row (a candidate-existence query per gap). `blocks.is_complete` is already cached and free. |
| Alternates keyed by `intoStepId` (one gap) | n/a in SET-4 | The SET-1 schema models an alternate as a **span** (`fromStepId` / `toStepId`). The mockup is the single-gap case. SET-6 must build for spans, not widen a per-gap UI later. |

---

## 3. What I verified (current tree)

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

**`POST /blocks/:id/steps` already accepts `inTransitionId`**, so the mockup's two best moves —
"add the transition and the track it lands on" and "auto-link the only edge" — need no API change.

### Stale in the Linear description

- **Nav is not `Add · Library · Sets · Graph`.** DJ-138 deleted `/add` and the Add tab. Current
  primary nav is **Library · Graph** (`apps/web/components/app-shell.tsx`, `max-w-5xl`, `h-14`,
  `py-8`). SET-4 adds Sets: **Library · Sets · Graph**. Do not revive Add.
- **`app/sets/…` and `components/sequences/` do not exist.** There is no Sets UI at all.
- **Unmapped "Add transition" is not `/add?mode=transition`.** It is
  `/library/add/transitions?fromTrackId=&toTrackId=` (`libraryAddHref` in
  `apps/web/lib/library/add-routes.ts`). Sequence `returnTo` is DJ-118 — do not invent it here.
- **`candidateCount` includes complete block connectors**, not just transitions. SET-4 cannot pick
  blocks. Treat a gap with zero *transition* candidates as `unmapped` in the chrome even if the API
  says `available` because of a block. Copy must say "N transitions", never "N connectors".
- **`GET /blocks/:id` is ids-only.** `SequenceStep` has `trackId` / `inTransitionId` / `inBlockId`
  and no nested track or transition. The mockup's step card (artwork initial, title, artist,
  `bpm · key`, duration) and its gap chip (mix label, BPM delta) cannot be rendered from that
  payload. SET-4 embeds summaries on detail (D14).
- **Web never imports `@selecta/library` into client components** except `/constants`. Importing
  `compareNeighborhoodNeighbors` from the package barrel would pull drizzle into the browser.
  Extract the pure rank helper (D15).
- **`packages/ui` has no toast primitive.** 23 components; none is a toast, and there is no
  `sonner`. The mockup uses a toast as the primary feedback channel for every mutation, so SET-4
  builds one (D11).
- **There is no drag-and-drop anywhere in the repo.** No `dnd-kit`, no `draggable`, no
  `onDragStart`. The mockup's DnD is hand-rolled HTML5 with no library; SET-4 does the same (D9).
- **`SequenceRecord` has no step count.** It is `id, kind, title, description, startTrackId,
  endTrackId, isComplete, libraryId, createdAt, updatedAt`, passed straight through by
  `serializeSequenceRecord`. The mockup's browse row meta needs an additive aggregate (D19).
- **`SequenceDetail` already carries `alternates` and `versions`** from SET-1. SET-4 ignores both;
  do not delete them from the client type, just do not render them.

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
- Track cards: crate geometry from `LibraryTrackRow`. The mockup's step card is a compact variant of
  it, not a second track-row family.
- Gap mix labels: `displayVocab` from `lib/transitions/vocab-labels.ts`.
- Relative ages: `formatCompactAge` from `lib/format.ts`.

### What SET-4 does *not* have to do

`GET` does **not** clear stale pins. Stale connectors are cleared on the next **write**
(`recomputeSequenceDerived`). The editor must still **display** a stale pin as unlinked: trust
`gapState` from the payload (already derived on read via `validateConnector`), and never render a
transition whose endpoints do not match the current neighbors.

---

## 4. Decisions

### Structure and routing

| ID | Question | Decision |
| --- | --- | --- |
| D1 | Primary nav | **Library · Sets · Graph.** Sets is active for `/sets`, `/sets/:id`, and `/blocks/:id`. Library is unchanged. |
| D2 | Browse vs workspace | `/sets` (and `/sets?view=blocks`) is a list. `/sets/:id` and `/blocks/:id` are the workspace. Same `sequence-workspace.tsx`; `kind` changes the header noun, the back-link label ("← Sets" / "← Blocks"), and the empty-state copy. |
| D3 | Later-slice chrome | **Omit, do not disable.** No version select, no `+ alt`, no Blocks palette tab, no Follow, no Open in graph. The mockup toasts "lands in SET-9 / SET-10" for those; a shipped product should not advertise buttons that do nothing. Leave the header's right-hand slot laid out so they drop in. |
| D4 | Canonical URL after load | If the record's `kind` does not match the route (`set` on `/blocks/:id` or `block` on `/sets/:id`), `router.replace` to the matching path. Both routes always mount the same component. |
| D5 | Create | Dialog on the browse page, copy from the mockup: required title, kind from the active sub-tab, body text differing per kind ("A night you mean to play, in order." / "A reusable run you can drop into any set as one connector."). `POST /blocks` then navigate to the new workspace. No seed. Create stays disabled while the field is empty. |
| D6 | AppShell | Add `width?: "default" \| "wide"` (`max-w-5xl` / `max-w-7xl`) and `density?: "page" \| "workspace"` (`py-8` vs flush `flex-1 min-h-0`). **`width` applies to the header bar too** — the mockup keeps header and content on the same 1280 measure, and a nav narrower than the content looks broken. Browse uses default/page; workspace uses wide/workspace. |
| D7 | New feature folder | `apps/web/components/sequences/` and `apps/web/lib/sequences/`. Style guide domain folders gain `sequences`. |

### Reorder, drag, and drop

| ID | Question | Decision |
| --- | --- | --- |
| D8 | Reorder | **Drag and `↑`/`↓`, both.** Drag is the primary motion in the mockup; the buttons stay because drag is not keyboard-reachable and precise moves are easier with them. Both call the same `moveUnit` reducer, then `POST /reorder` with the full `stepIds` plus `expectedUpdatedAt`. |
| D9 | DnD implementation | **Native HTML5 DnD, no library**, as the mockup does. The typed payload lives in React state (`dragPayload`); `dragstart` must still call `e.dataTransfer.setData("text/plain", …)` and set `effectAllowed`, or Firefox refuses the drag. No `dnd-kit` dependency for a single surface. |
| D10 | Drop targets | Three, matching `dropFit` in the mockup: **gap** (destination index `i`), **step** (insert *after* step `i`, i.e. index `i+1`), and an **end zone** below the last step that only appears while a palette drag is active. Only fitting targets arm (`ring` border); the hovered target tints `brand-subtle` and shows a worded drop hint ("Insert Cola here", "Link blend"). A payload that fits nowhere arms nothing. |
| D11 | Unit-aware reorder | Reorder operates on **units**, not steps, via `unitRange(steps, i): [number, number]`. In SET-4 it always returns `[i, i]`. SET-5 changes only that helper to make a block connector and its anchor step travel together. A test asserts the single-step contract so SET-5 is a helper change, not a reorder rewrite. |

### Palette

| ID | Question | Decision |
| --- | --- | --- |
| D12 | Tabs | **Tracks and Transitions.** Blocks is SET-5. Selecting a gap auto-switches to Transitions; clearing the selection switches back to Tracks (mockup `onSelectGap`). |
| D13 | Transitions palette, two modes | **Gap selected:** list transitions for exactly that `(from, to)`, ranked; `+` PATCHes `inTransitionId`. **Nothing selected:** list transitions *out of the anchor track* (the last step, or the step after the current selection) and `+` **adds the transition and the track it lands on** in one `POST /steps { trackId: to, inTransitionId }`. On an empty sequence, `+` seeds both endpoints (two POSTs). This is the fastest way to build a line and the plan's previous "disable `+` unless a gap is selected" was wrong. |
| D14 | Non-fitting rows | **Disabled with an explanatory `title`, not hidden** ("Starts from Innerbloom — select a step there first", "Does not fit the selected gap"). Hiding them makes the palette look empty and hides the reason. |
| D15 | Context banner | When a gap is selected or an anchor exists, show `Fits the selected gap · A → B` / `Out of A · end of the set` in a `brand-subtle` strip with a `clear` action. A footer hint always states what `+` does right now. |
| D16 | Hydrate tracks / transitions | **Embed on `GET`/`POST`/`PATCH` sequence detail.** Each step gains `track` (id, title, artists, artworkUrl, bpm, musicalKey, durationSec) and `inTransition` (mix fields + endpoint ids, or null). Implemented in `hydrateSteps` via `getTrackSummariesByIds` + a batch transition fetch. List (`GET /blocks`) stays ids-only. The workspace is not a client-side N+1 join. |
| D17 | Palette ranking | Extract `transitionQualityRank` / `compareNeighborhoodNeighbors` into `packages/library/src/neighborhood-rank.ts` with **no db imports**. Export `@selecta/library/neighborhood-rank`. Palette and gap picker sort with that. Do not import `@selecta/library` from a client component. |
| D18 | Auto-link the only edge | When adding a track after a step, first fetch candidates for that pair; if **exactly one** transition exists, pass its `inTransitionId` on the POST and say so in the toast ("Inserted Cola · linked blend"). Zero or 2+ → no pin, let the gap be `available`. One edge per pair is the common case and a fresh `available` gap for it is busywork. |

### Chrome and data

| ID | Question | Decision |
| --- | --- | --- |
| D19 | Browse row meta | Add `stepCount` and `seamCount` to `SequenceRecord` from one grouped aggregate over `block_steps` in `listSequences`. Row reads `11 tracks · 2 seams` (omit the seam clause at 0, `empty` at 0 steps) plus a badge from cached `isComplete`. No runtime, no `N open` (§2). |
| D20 | Gap chrome vs API `gapState` | Header completeness uses API `gapState` (domain truth, already excludes seams). Visible gap chrome is transition-only: `available` with zero *transition* hits renders as `unmapped`; an `inBlockId` without a valid `inTransitionId` renders as a muted "Block connector" row with unlink only — no expand, edit, or detach. |
| D21 | Gap state colors | From the architecture §4.3 table: `linked` → `surface-1`/`⟶`, `available` → `warning-subtle`/`⚠`, `unmapped` → `destructive-subtle`/`○`, `seam` → transparent/`〜`. The left rail takes the same color. `unmapped` is the only destructive one, deliberately: `available` is one click, `unmapped` needs authoring. |
| D22 | Unmapped action | Link to `libraryAddHref("transitions")` plus `fromTrackId` / `toTrackId`. Do not build a second form. Do not add `returnTo` (DJ-118). |
| D23 | Toasts | New `packages/ui` primitive: `ToastProvider` + `useToast`, one toast at a time, bottom-center, `role="status"` `aria-live="polite"`, auto-dismiss on the `--motion-*` scale. Provider mounts in `apps/web/app/layout.tsx`. Copy names the library consequence where that is the anxious question ("Unlinked — the transition stays in your library"). |
| D24 | Selection | `none \| { kind: "step"; stepId } \| { kind: "gap"; stepId }`. Gap id is the **destination** step (the one that owns `gapState`). Clicking the selected gap again clears it. |
| D25 | Step note | Toggled by `✎` on the step card, auto-open when non-empty (mockup `noteOpen`). `PATCH { note }`. Distinct from `transitions.notes`. Empty string → null. |
| D26 | Runtime | Computed in TS from the embedded step data: sum `durationSec`, minus `barsOverlap * 4 * 60 / bpm` using the **from** track's BPM, 4/4. Missing duration, BPM, or overlap → skip that subtraction. Label **approx**. Kept client-side (not SQL) because SET-7 must compute it over a *resolved* path that the database does not know. |
| D27 | BPM delta | Per linked gap, `to.bpm - from.bpm`, shown as `+2` / `−2` / `0`. Missing either BPM → no chip. No Camelot/key math (deferred, architecture §12). |
| D28 | First step | No inbound gap. No seam, no connector, no gap chrome above track 1. |
| D29 | Delete / rename | Delete: `ConfirmDialog` on the browse row and in the workspace header, copy from the mockup ("The tracks and transitions stay in your library…"). Rename: inline edit on the workspace title, `PATCH { title, expectedUpdatedAt }`. |
| D30 | Optimistic concurrency | Reorder and title PATCH send `expectedUpdatedAt`. Step add/patch/delete do not (the API does not require it). On 409, reload detail and show an `Alert`. |

### Explicitly out of scope

- Blocks palette tab, block gap rows, collapsed/expand/detach, "Save trail as a block" (SET-5).
- Alternates (SET-6) and versions (SET-7).
- `/add` sequence context, `returnTo`, `AddToSequenceMenu` (SET-8).
- Graph Set mode and Follow (SET-9, SET-10).
- Key compatibility.
- Authoring transitions inside the workspace (the Library add page is the form).
- Changing Library views. No Sets list under `/library`. No reviving the Add nav item.

---

## 5. Surfaces

### 5.1 Browse — `/sets`

```text
Sets                                                    [ + New set ]
Nights you mean to play, in order.

[ Sets ] [ Blocks ]
┌────────────────────────────────────────────────────────────────────┐
│ ⌕ search sets            [ All blocks ▾ ] ← Blocks tab only  3 sets│
├────────────────────────────────────────────────────────────────────┤
│ Sunset rooftop            11 tracks · 2 seams   (complete)  3h   ✕ │
│ Basement, Friday          3 tracks · 1 seam     (incomplete) 2d  ✕ │
│ Beach club, day two       empty                 (empty)     1w   ✕ │
└────────────────────────────────────────────────────────────────────┘
```

- Sets tab: `GET /blocks?kind=set&q=`. Blocks tab: `GET /blocks?kind=block&q=&complete=`, with the
  completeness `Select` defaulting to All. Switching tabs clears the query (mockup `showSets`).
- Row click → workspace. `✕` → `ConfirmDialog`, and it must `stopPropagation` so it does not also
  open the row.
- Count on the toolbar right (`3 sets` / `2 blocks`), mono, tabular.
- Empty state carries the same New button, and its copy differs per tab.
- New button label follows the tab: "New set" / "New block".

### 5.2 Workspace — `/sets/:id`, `/blocks/:id`

```text
← Sets
Sunset rooftop                                                   [✕]
approx 47 min · 11 tracks · 8 of 8 planned · (2 seams)

Left pane (3fr)                          Right pane (minmax(320px,2fr))
──────────────────────────────────────   ──────────────────────────────
 ⠿ 01 [M] Midnight City  124 · 8A  4:03  LIBRARY  [Tracks][Transitions]
          M83            ↑ ↓ ✎ ✕        ⌕ search transitions
      │                                  ── Fits the gap · Mid → Inner ──
      ├─ ⟶ blend · 16 bars · great       ⟶ blend · 16 bars    great  [+]
      │   (+2 BPM)   Swap  Unlink  〜    ⟶ echo out · 8 bars   ok    [+]
      │                                  ⟶ cut on the drop    rough [+]
 ⠿ 02 [I] Innerbloom     122 · 9A  9:54  ──────────────────────────────
          RÜFÜS          ↑ ↓ ✎ ✕        + links a matching transition,
    NOTE [ kill the bass early      ]    or inserts a track here.
      │
      ├─ ⚠ 3 transitions — pick one   Pick  〜
      │
 ⠿ 03 [O] Opus           126 · 4A  9:06
      │
      ├─ ○ no transition for this pair yet   Add transition  〜
      │
 ⠿ 04 [S] Sun Rising     120 · 7A  6:42

      ↳ Insert Cola here            ← drop hint, only while dragging
      [ + Add track ]
```

Header facts, one line under the title: `approx {runtime} · {n} tracks · {linked} of {planned}
planned`, then a `seams` pill when `k > 0`. Empty sequence: `0 tracks` and "nothing planned yet".

Left pane is a single vertical column; the gap rail is indented 34px with a 2px left border in the
state color. Right pane is a sticky `rounded-xl border` card. On a narrow viewport the palette
stacks **under** the running order — no drawer.

### 5.3 Gap chrome (SET-4)

| State | Condition (display) | Actions |
| --- | --- | --- |
| **linked** | Valid `inTransitionId` | Mix label (`technique · overlap · quality`), BPM delta chip, **Swap** (opens the picker), **Unlink**, **〜** |
| **available** | No valid transition pin, transition candidates exist | "N transitions — pick one", **Pick** (opens the picker), **〜** |
| **unmapped** | No valid pin and no transition candidates | "no transition for this pair yet", **Add transition** (Library add, endpoints locked), **〜** |
| **seam** | `isSeam` | "open seam · improvise", **〜** (unmark) |
| *(block placeholder)* | `inBlockId`, no valid transition | Muted "Block connector", **Unlink** only (D20) |

The picker is an inline popover under the gap row listing matching transitions ranked by D17, each
with `technique · N bars` and a quality badge. Same writer as the palette:
`PATCH { inTransitionId }`. Seam is `PATCH { isSeam: true }` (the API clears the connector). Unlink
is `PATCH { inTransitionId: null }`.

---

## 6. Interaction model: one writer, three entrances

All structural edits go through `lib/sequences/api.ts`. The palette `+`, a drop, and the gap picker
are three **entrances** to the same writers, never three implementations.

```ts
type WorkspaceSelection =
  | { kind: "none" }
  | { kind: "step"; stepId: string }
  | { kind: "gap"; stepId: string };

type DragPayload =
  | { kind: "track"; id: string }
  | { kind: "transition"; id: string };

type DropTarget =
  | { kind: "gap"; index: number }   // destination step index
  | { kind: "step"; index: number }  // insert position = i + 1
  | { kind: "end"; index: number };  // steps.length
```

`insertIndex(selection, steps)` → `"append"` with no selection, the gap's own index for a gap
(insert between `i-1` and `i`), and `i + 1` for a step. Dropping *on* a step card and selecting a
step then pressing `+` must agree: both insert after it.

`dropFit(payload, target, steps)` is the whole permission model, and it is worth writing as a pure
function with a test matrix:

- **track** → fits every target.
- **transition** → on a **gap**, requires `from === steps[i-1].trackId && to === steps[i].trackId`.
  On a **step** or **end**, requires `from === steps[index-1].trackId`; on an empty sequence it fits
  (it seeds both endpoints).

After every mutation, replace local `SequenceDetail` with the response body (already the full
detail, including recomputed `gapState`s). Reorder flipping `A→B→C` to `A→C→B` must show the
previously linked gaps as `available`/`unmapped`, never as the old mix. That is the load-bearing UX
of this ticket; the API already does the work, provided the client does not cache connectors by step
id across the swap.

---

## 7. File map

| Path | Disposition |
| --- | --- |
| `apps/web/app/sets/page.tsx` | **new** — browse shell, parse `view` |
| `apps/web/app/sets/[id]/page.tsx` | **new** — workspace shell, `kind` hint `"set"` |
| `apps/web/app/blocks/[id]/page.tsx` | **new** — workspace shell, `kind` hint `"block"` |
| `apps/web/app/layout.tsx` | edit — mount `ToastProvider` |
| `apps/web/components/app-shell.tsx` | edit — Sets nav; `width` + `density` (header included) |
| `apps/web/components/sequences/sequences-browse.tsx` | **new** — Sets/Blocks list + create dialog |
| `apps/web/components/sequences/sequence-workspace.tsx` | **new** — two panes, selection, drag state |
| `apps/web/components/sequences/sequence-running-order.tsx` | **new** — the ordered column + end drop zone |
| `apps/web/components/sequences/sequence-step-card.tsx` | **new** — compact crate card, ↑↓✎✕, note row |
| `apps/web/components/sequences/sequence-gap.tsx` | **new** — four states + rail + picker |
| `apps/web/components/sequences/transition-picker.tsx` | **new** — ranked candidate popover |
| `apps/web/components/sequences/library-palette.tsx` | **new** — Tracks / Transitions, context banner, footer hint |
| `apps/web/lib/sequences/api.ts` | **new** — typed `apiFetch` wrappers (the only writers) |
| `apps/web/lib/sequences/types.ts` | **new** — client types matching the embedded payload |
| `apps/web/lib/sequences/view.ts` + `.test.ts` | **new** — `parseSetsView`, `setsViewHref` |
| `apps/web/lib/sequences/reorder.ts` + `.test.ts` | **new** — `unitRange`, `moveUnit`, `reorderTo` |
| `apps/web/lib/sequences/drag.ts` + `.test.ts` | **new** — `dropFit`, `dropLabel`, `insertIndex` |
| `apps/web/lib/sequences/metrics.ts` + `.test.ts` | **new** — planned/seams header, runtime, BPM delta |
| `apps/web/lib/sequences/gap-display.ts` + `.test.ts` | **new** — transition-only chrome vs API `gapState` |
| `packages/ui/src/components/toast.tsx` | **new** — `ToastProvider`, `useToast` |
| `packages/ui/package.json` | edit — `"./components/toast"` export |
| `packages/library/src/neighborhood-rank.ts` | **new** — pure rank helpers, no db imports |
| `packages/library/src/neighborhood.ts` | edit — re-export from the new file |
| `packages/library/package.json` | edit — `"./neighborhood-rank"` export |
| `packages/library/src/blocks.ts` | edit — embed `track` + `inTransition` on `SequenceStep`; `stepCount` + `seamCount` on `SequenceRecord` |
| `packages/library/src/blocks.test.ts` | edit — assert embeds and counts |
| `dev-files/UI_STYLE_GUIDE.md` | edit — `components/sequences` as a domain folder |

No schema / migration. No new `/transitions` writer. No Graph session-store changes. No new npm
dependency.

`block-connector-row.tsx`, `alternate-list.tsx`, `version-switcher.tsx`, `graph-set-rail.tsx`, and
`add-to-sequence-menu.tsx` stay uncreated.

---

## 8. Phases

Each phase is independently reviewable, and phases 1–3 are usable without 4.

### Phase 1 — shell: nav, routes, browse

- AppShell: Sets link; `width` / `density` props with today's look as the default.
- `listSequences` aggregate for `stepCount` / `seamCount` (D19).
- `/sets` browse: tabs, search, completeness filter, create dialog, empty state, delete.
- `/sets/:id` and `/blocks/:id` render a stub workspace (`StatePanel`), with the `kind` redirect.
- `lib/sequences/api.ts`, `view.ts`. `ToastProvider` mounted and used by create/delete.

**Verify:** Sets appears between Library and Graph. Library tabs are still Tracks / Transitions /
Submissions and still `max-w-5xl`. Creating a set from `/sets` lands on `/sets/:id`; creating a
block from `/sets?view=blocks` lands on `/blocks/:id`. Unknown `?view=` coerces to Sets and is never
interpolated into an href. Opening `/blocks/:id` on a `set` redirects to `/sets/:id`.

### Phase 2 — embed tracks/transitions on sequence detail

- Extend `SequenceStep` in `packages/library/src/blocks.ts`; batch-load inside `hydrateSteps`.
- Missing track should not happen (step FK cascades); if it does, skip the step rather than crashing.
- Keep the list endpoint ids-only.

**Verify (unit):** after seeding two tracks and linking a transition, `getSequenceDetail` returns
`steps[1].track.title` and `steps[1].inTransition.technique`. After `deleteTransitionById`,
`inTransition` is null and `gapState !== "linked"` while both steps remain.

### Phase 3 — running order

- Step cards to the mockup's grid; `↑`/`↓` via `moveUnit`; remove (`ConfirmDialog`); note toggle.
- Gaps: four states, rail colors, picker, seam toggle, unlink, BPM delta.
- Header metrics; inline rename; delete.
- Toasts on every mutation, with the library-consequence copy.

**Verify (manual):** ten tracks; reorder two neighbors and the old mix label disappears immediately.
Mark a seam; the header becomes `N of N planned · 1 seam` and `isComplete` can be true with an open
join. Delete a linked transition in Library, reload the set: the track is still there, the gap is
not linked.

### Phase 4 — palette, extension, and drag-and-drop

- Palette Tracks / Transitions with `SearchField`, context banner, footer hint, disabled non-fitting
  rows.
- Gap-selected mode links; unselected mode extends by transition (D13); auto-link the only edge (D18).
- Unmapped "Add transition" deep-links to DJ-113's page.
- HTML5 DnD: palette rows draggable; gap / step / end drop targets; armed and hovered styling; worded
  drop hints; drag-to-reorder steps.

**Verify:** with a gap selected, a transition between a different pair is disabled with a reason.
With nothing selected, the Transitions tab lists edges out of the last track and `+` brings the
destination track with it. Adding a track with a gap selected inserts between those neighbors, not
at the end. Dragging a track onto a gap inserts there; dragging a non-matching transition onto a gap
arms nothing. Keyboard-only, everything except drag is still reachable.

---

## 9. Testing

Only tests that catch a bug a human or typecheck would miss. The pure helpers in `lib/sequences/`
exist largely so this list is possible without rendering the workspace.

| Test | Bug it catches |
| --- | --- |
| `setsViewHref` / `parseSetsView` | Blocks tab silently 404s, or `?view=` is interpolated into an href |
| `insertIndex` none / gap / step | Palette `+` appends when a gap is selected, so "insert here" is a lie |
| `dropFit` matrix: track anywhere; transition→gap needs both endpoints; transition→step needs `from === that step`; transition→end on an empty sequence | A drop creates a pin whose endpoints do not match its neighbors — a stale connector authored on purpose |
| `unitRange` returns `[i, i]` for every index | SET-5 changes reorder semantics without noticing SET-4 assumed single steps |
| `moveUnit` at first/last index is a no-op | `↑` on step 1 sends a reorder that drops a step |
| Planned completeness: 2 linked + 1 seam + 1 unmapped → `1 of 2 planned · 1 seam` | Header counts seams in the denominator and nags the DJ about improvisation |
| `displayGapState` with `gapState: "available"` and 0 transition candidates → `unmapped` | Block-only candidates show "pick one" over an empty picker |
| Runtime: 180s + 180s, overlap 8 bars at 120 BPM → `360 - 16 = 344` | Overlap subtracted in bars, or from the wrong BPM, silently inflates the night |
| BPM delta missing BPM → no chip; 124 → 122 → `−2` | `NaN` chips |
| `autoLinkTransitionId`: 1 candidate → its id; 0 or 2 → null | Auto-link picks an arbitrary edge when the pair is ambiguous |
| Neighborhood-rank move: existing `neighborhood.test.ts` still passes | Extracting the helper changes sort order vs Graph |
| Detail embed after link/unlink (library test) | Workspace cards have ids and no titles |
| `listSequences` returns `stepCount` / `seamCount` for a seeded sequence | Browse rows read `0 tracks` for a full set |

No render/snapshot tests of the workspace. No Playwright. Reorder-invalidates-connectors and
transition-delete-degrades-not-cascades already exist in `blocks.test.ts` — do not duplicate them on
the client.

---

## 10. Acceptance

- **Sets** is in the primary nav. Library still shows only Tracks / Transitions / Submissions.
- Create a set from `/sets`, order 10+ tracks, link transitions, mark seams, reorder by drag **and**
  by `↑`/`↓`, and watch gap states update from the mutation response with no full-page reload.
- Tracks and matching transitions can be pulled in from the palette by `+` **or** by dragging onto a
  gap, a step, or the end zone — no modal, no navigation.
- With nothing selected, the Transitions palette extends the line: `+` adds the transition and the
  track it lands on.
- Adding a track between two tracks with exactly one transition links it automatically.
- Selecting a gap narrows the palette to transitions valid for that pair, ranked the same way as
  Graph, and non-fitting rows say why they are disabled.
- Reordering visibly flips affected gaps out of `linked`.
- Completeness excludes seams from the denominator.
- Deleting a transition in Library degrades the gap in any sequence using it, without removing the
  track.
- Blocks sub-tab browses `kind=block` with a completeness filter; opening a block uses the same
  workspace with "← Blocks" and block-flavored copy.
- Unmapped gaps deep-link to `/library/add/transitions` with both endpoints filled.
- Every mutation confirms in a toast, and destructive-sounding ones say what stayed in the library.
- Side-by-side with the mockup, the browse list and the workspace read as the same product: same
  geometry, same copy, same state colors.

---

## 11. Implementation notes

- Work on branch `dj-114` from an up-to-date `main` when this plan is executed. This plan file is
  not that implementation.
- `pnpm` only. Format with oxfmt. Semantic tokens only — translate the mockup's `var(--…)`, never
  copy its inline `oklch()`.
- `expectedUpdatedAt` is an ISO string on the wire, parsed to `Date` in `apps/api/lib/blocks.ts`.
- After a successful structural edit, keep the same selection if that `stepId` still exists;
  otherwise clear it. Clear `dragPayload` and `dropTarget` on `dragend` unconditionally — a dropped
  drag that failed `dropFit` still has to reset.
- Drag is a progressive enhancement: `↑`/`↓`, `+`, and the gap picker must cover every drag
  affordance for keyboard and screen-reader users.
- Do not prefetch Graph or Follow. The mockup's later-slice chrome is the north star for SET-5
  onward, not a checklist for this one.
