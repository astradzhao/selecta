# DJ-115 — SET-5: Block connectors (task plan)

> Ticket: [DJ-115 — SET-5: Block connectors — picker, collapsed rows, detach, and save-trail-as-block](https://linear.app/dj-project-astradzhao/issue/DJ-115)
> Architecture: [`../SETS_ARCHITECTURE.md`](../SETS_ARCHITECTURE.md) §2.2, §4.2, §4.3, §4.4, §5.5–§5.8
> **Design source: [`Sets feature mockup/Selecta Sets.dc.html`](./Sets%20feature%20mockup/Selecta%20Sets.dc.html)**
> Predecessor: [`DJ114_SETS_WORKSPACE_PLAN.md`](./DJ114_SETS_WORKSPACE_PLAN.md) — SET-4 shipped in #101
> Status: **plan only.** Implementation is a later `dj-115` branch.

SET-4 made a night orderable. SET-5 makes prep **reusable**: a saved block drops into any gap exactly
like a single transition, and a Graph exploration you liked becomes a block in one click.

Do not start this until SET-4 has been used on a real gig (architecture §11).

---

## 1. The headline: this is a web slice

**The block-connector backend already exists and is tested.** SET-1 landed the whole connector model
and SET-2 exposed it. I verified all of the following on `main`:

| Capability                        | Where                                                                                                                                                                                                                                 | State    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Set a block as a step's connector | `addSequenceStep` / `updateSequenceStep` accept `inBlockId`; `POST` and `PATCH /blocks/:id/steps[/:stepId]` accept it on the wire                                                                                                     | **done** |
| Endpoint validation               | `validateConnector` — child must exist, have non-null endpoints, and `startTrackId === previous.trackId && endTrackId === step.trackId`                                                                                               | **done** |
| Cycle + depth rejection           | `assertAcyclicReference` (self-reference, DFS over `nestedBlockIds`, depth cap `SEQUENCE_MAX_NESTING_DEPTH = 8`), wired via `assertConnectorMatchesGap` on every connector write. Throws `MusicWriteError("invalid_input")` → **422** | **done** |
| Stale-pin clearing                | `clearStaleStepConnectors` inside `recomputeSequenceDerived`                                                                                                                                                                          | **done** |
| Transitive completeness           | `computeIsComplete` requires `childComplete` for block connectors (`blocks.ts:648-650`); `recomputeSequenceDerived` walks ancestors                                                                                                   | **done** |
| Read-time expansion               | `expandResolvedSteps` → `SequenceExpansion` with `truncated` + `reason: "incomplete" \| "broken" \| "depth_exceeded"`, via `GET /blocks/:id?expand=1`                                                                                 | **done** |
| Detach                            | `detachSequenceStep` + `POST /blocks/:id/detach/:stepId`                                                                                                                                                                              | **done** |
| Find blocks by endpoints          | `listSequences` filters `startTrackId` / `endTrackId`; index `blocks_endpoints_idx` in `0010_blocks.sql`                                                                                                                              | **done** |
| Block candidate counting          | `countConnectorsForPairs` counts complete `kind='block'` sequences, excluding self; `candidateCount` includes them, `transitionCandidateCount` excludes them                                                                          | **done** |
| Delete guard                      | `deleteSequence` throws 409 with `details.referrers` when the block is still used                                                                                                                                                     | **done** |
| Trail seed                        | `createSequence({ seed: { trail: SequenceTrailSeed[] } })`, parsed by `parseTrail` on `POST /blocks`                                                                                                                                  | **done** |

Existing integration tests in `packages/library/src/blocks.test.ts` already cover the hard parts:
`"detects endpoint drift when a nested block's first track changes"`,
`"propagates completeness to ancestors when a nested block breaks"`,
`"rejects cyclic block connectors"`,
`"expands a nested block inline and detaches it to editable copies"`,
`"rejects deleting a sequence that is still used as a connector"`.

**Do not rebuild any of it.** SET-5's server work is three small additive things (D2, D3, D11) plus
one new read route (D12). Everything else is `apps/web`.

Also worth knowing: **the alternates and versions API routes are already implemented too**
(`/blocks/:id/alternates`, `/blocks/:id/versions`, with `altBlockId` validated the same way). SET-6
and SET-7 are web-only slices as well. That is not this ticket, but do not plan API work for them.

---

## 2. Three things SET-4 left behind

These are not new features. They are defects that only become visible once a block connector exists,
and SET-5 is the slice that has to fix them.

### 2.1 A valid block connector currently renders as an empty `linked` row — bug

`deriveGapState` (`packages/library/src/blocks.ts:619-632`) returns `"linked"` for **any** valid
connector, block or transition:

```619:632:packages/library/src/blocks.ts
async function deriveGapState(
  previous: BlockStepRow,
  step: BlockStepRow,
  candidateCount: number,
): Promise<GapState> {
  if (step.isSeam) {
    return "seam";
  }
  const validity = await validateConnector(previous.trackId, step.trackId, step);
  if (validity.valid) {
    return "linked";
  }
  return candidateCount > 0 ? "available" : "unmapped";
}
```

But `displayGapState` tests `linked` **before** it tests `inBlockId`:

```11:17:apps/web/lib/sequences/gap-display.ts
  if (step.gapState == null) return null;
  if (step.gapState === "seam") return "seam";
  if (step.gapState === "linked") return "linked";
  if (step.inBlockId && !step.inTransitionId) return "block";
  if (step.gapState === "available" && step.transitionCandidateCount === 0) return "unmapped";
  return step.gapState;
```

So a **working** block connector takes the `linked` branch, and `sequence-gap.tsx` then computes its
label from `step.inTransition`, which is `null` for a block — producing a row that renders as just
`⟶` with an empty label. The `"block"` branch is only reachable for a **stale** pin. SET-4's D20
conflated "linked by a block" with "broken block pin"; the ordering has to be inverted (D5).

### 2.2 `linked` does not imply the child is complete

`validateConnector` returns `{ valid: true, kind: "block", childComplete }` — validity is about
**endpoints only**. `computeIsComplete` additionally requires `childComplete` (`blocks.ts:648-650`),
but `deriveGapState` does not. So this state is reachable and currently unrepresentable:

> every gap is `linked`, the header says `8 of 8 planned`, and `isComplete` is `false` because a
> child block has open joins inside it.

A DJ seeing "8 of 8 planned" next to an `incomplete` badge will assume the badge is broken. SET-5
needs a third block visual and a header note (D5, D9).

### 2.3 Referrers are computed but never exposed

`listSequenceReferrers` exists (`blocks.ts:1317`) and `SequenceReferrer` is exported, but the only
consumer is `deleteSequence`'s 409 body. There is no route. "Edit block" cannot honestly warn that
edits apply everywhere without one (D12).

---

## 3. The mockup, and where SET-5 diverges from it

Open `Sets feature mockup/Selecta Sets.dc.html` and drive it: drag a block from the Blocks palette
tab onto a matching gap, then onto the end of the line, then reorder the resulting unit with the
drag handle and with `↑`/`↓`, then Expand / Detach it. The `DCLogic` helpers `blockValid`,
`unitRange`, `insertBlock`, `dropFit`, and `onDetach` are the behavior spec.

| Mockup                                                             | SET-5                                                  | Why                                                                                                                                                                                                       |
| ------------------------------------------------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One block visual (brand tint, `▸`)                                 | **Three**: `block`, `block-incomplete`, `block-broken` | The mockup only ever links complete blocks with matching endpoints, so it never renders drift or an incomplete child. Real data does (§2.1, §2.2), and the ticket's endpoint-drift criterion requires it. |
| `insertBlock` writes the anchor + host step in one local mutation  | Two sequential `POST`s                                 | No batch step endpoint exists. Same shape as SET-4's empty-sequence transition insert (`sequence-workspace.tsx:199-208`). Partial-failure handling in D8.                                                 |
| Block palette rows show `startTrack.title → endTrack.title`        | Same, but needs an API addition                        | `SequenceRecord` carries endpoint **ids** only (D3).                                                                                                                                                      |
| Header reads `11 tracks · approx 47 min` counting only spine steps | Counts block interiors                                 | The mockup under-reports a night built from blocks, which is the whole point of the feature. D11.                                                                                                         |
| `+ alt`, version select, Follow, Open in graph                     | Omitted                                                | SET-6 / SET-7 / SET-9 / SET-10. Same posture as SET-4: omit, never disable.                                                                                                                               |

---

## 4. Decisions

### Server (additive only)

| ID  | Question                        | Decision                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Touch the connector write path? | **No.** `addSequenceStep`, `updateSequenceStep`, `validateConnector`, `assertAcyclicReference`, `detachSequenceStep`, and `recomputeSequenceDerived` are done and tested. SET-5 adds reads only.                                                                                                                                                                |
| D2  | Collapsed row data              | Embed `inBlock` on `SequenceStep`, populated only when `inBlockId` is set: `{ id, title, stepCount, seamCount, isComplete, runtimeSec }`. Batch-loaded in `hydrateSteps` alongside the existing `track` / `inTransition` embeds. **Not** the child's steps — those load lazily (D7).                                                                            |
| D3  | Palette + browse row data       | Add `startTrack` / `endTrack` (nullable `SequenceStepTrack` summaries) to `SequenceRecord`, from one batched track fetch in `listSequences` and `buildDetail`. The Blocks palette row and the Blocks browse row both need endpoint **titles**, and only ids exist today.                                                                                        |
| D4  | Shared runtime formula          | Move the runtime math into `packages/library/src/sequence-runtime.ts` — pure, no db imports, exported as `@selecta/library/sequence-runtime`, same pattern as `neighborhood-rank`. The server uses it to compute `inBlock.runtimeSec`; the client uses it for the header. One formula, two callers, so the parent and its embedded children can never disagree. |
| D11 | `inBlock.runtimeSec` recursion  | Compute it in the domain layer with a small **memoized recursive** helper (memo keyed by sequence id, per request), capped by `SEQUENCE_MAX_NESTING_DEPTH`. Blocks are 2–5 tracks and nesting is capped at 8, so the read cost is bounded — and this is the same recursive-read shape `expandResolvedSteps` already uses. No new column, no migration.          |
| D12 | Referrers route                 | New `GET /blocks/:id/referrers` → `{ ok: true, referrers: SequenceReferrer[] }` over the existing `listSequenceReferrers`. Used by the "Edit block" warning (D14) and by the child workspace's own banner.                                                                                                                                                      |

### Gap display

| ID  | Question            | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D5  | Block visual states | `displayGapState` must test `inBlockId` **before** `linked` (§2.1). Three states: **`block`** — `gapState === "linked"` and `inBlock.isComplete` → `bg-brand-subtle`, `▸`, full actions. **`block-incomplete`** — `linked` but `inBlock.isComplete === false` → `bg-warning-subtle`, `▸`, label says the child has open joins. **`block-broken`** — `inBlockId` set but `gapState !== "linked"` (endpoints drifted, or the FK was `SET NULL`'d) → `bg-destructive-subtle`, `⚠`, "this block no longer fits". `inTransitionId` and `inBlockId` cannot both be set — the DB constraint `block_steps_single_connector` guarantees it — so no ambiguity. |
| D6  | Collapsed row label | `{title} · {stepCount} tracks · {startTrackTitle} → {endTrackTitle}`. The endpoint titles come free from the neighboring steps' embedded `track` — the endpoint-match invariant means the anchor step **is** the start track and the host step **is** the end track. Do not fetch them.                                                                                                                                                                                                                                                                                                                                                              |
| D7  | Expand              | Lazily `GET /blocks/:childId` on first expand, cache by child id in workspace state, render the child's steps read-only under an "Inside this block · read-only" eyebrow. SET-4 already embeds `track` on every step, so this needs **no API change**. Collapsed costs nothing.                                                                                                                                                                                                                                                                                                                                                                      |
| D8  | Actions per state   | `block` → Expand, Edit block, Detach, Unlink, seam. `block-incomplete` → same, plus the label carries the warning. `block-broken` → Unlink and Detach only; no Expand (there is nothing coherent to show), no Edit block.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| D9  | Header honesty      | Leave `plannedMetrics` alone — a gap filled by an incomplete block **is** a planned join, and the unfinished part is the child's interior. Instead add a `Badge variant="warning"` reading `{n} block incomplete` when any step is `block-incomplete`. That resolves the "8 of 8 planned" vs `incomplete` badge contradiction without corrupting the planned count.                                                                                                                                                                                                                                                                                  |

### Units, drag, and insert

| ID  | Question                        | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D10 | `unitRange` becomes block-aware | This is the whole point of SET-4's D10. A block spans **two** steps: the anchor holding its start track and the host whose inbound connector is the block. `unitRange(steps, i)` returns `[i-1, i]` when step `i` is a live block unit, `[i, i+1]` when step `i+1` is, else `[i, i]`. `moveUnit`, `reorderTo`, and `spliceUnit` in `apps/web/lib/sequences/reorder.ts` are already written against it and **must not change**. Only `block-broken` steps are excluded from unit-hood — a broken pin should be individually movable so the user can fix it.     |
| D13 | Remove                          | Removing either step of a unit removes both, via the unit range, and the toast says "Block removed — it stays in your library". `ConfirmDialog` copy must name the block.                                                                                                                                                                                                                                                                                                                                                                                      |
| D14 | Drag payload + fit              | Add `{ kind: "block"; id; title; stepCount; startTrackId; endTrackId; isComplete }` to `FitPayload` / `DragPayload`. `dropFit`: incomplete → **false everywhere**; on a **gap** → `startTrackId === steps[i-1].trackId && endTrackId === steps[i].trackId`; on a **step** or **end** → true (inserts as a unit). Drop hints: "Use {title} as the connector" / "Insert {title} as one block".                                                                                                                                                                   |
| D15 | Insert as a unit                | Dropping on a step or the end zone inserts the block as a unit: a `POST /steps { trackId: startTrackId, position }` for the anchor **only when** the previous step is not already that track, then `POST /steps { trackId: endTrackId, position, inBlockId }`. Its interior tracks stay **inside** the block — never loose steps in the parent. Not atomic: if the second POST fails, surface the API message and leave the anchor (the user sees a normal unlinked step and can undo it). Do not paper over it with a silent rollback that could itself fail. |
| D16 | Cycles and depth                | The client cannot know the reference graph, so it does not pre-filter. Rely on the server's 422 and surface `describeApiError`'s message verbatim — the domain already says "Block connectors must be acyclic: this reference would create a cycle." and names the depth cap. Verify the message reaches the toast; that is the ticket's "clear message" criterion.                                                                                                                                                                                            |

### Palette

| ID  | Question                  | Decision                                                                                                                                                                                                                                                                                                                                                   |
| --- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D17 | Blocks tab                | Third `SegmentedTab` in `library-palette.tsx`. `listSequences({ kind: "block", startTrack, endTrack })`. **Do not** filter by `complete` — incomplete blocks stay visible and disabled with the reason (mockup behavior, and hiding them hides the why).                                                                                                   |
| D18 | Query-param trap          | The HTTP layer names these **`startTrack` / `endTrack`**, while the domain type uses `startTrackId` / `endTrackId` (`parseListQuery` in `apps/api/lib/blocks.ts`). `apps/web/lib/sequences/api.ts::listSequences` currently sends neither. Send the short names; a typo here silently returns every block and the picker looks broken rather than failing. |
| D19 | Exclude self              | Filter the sequence being edited out of the Blocks tab client-side. `listSequences` has no exclude param (unlike `countConnectorsForPairs`, which does exclude self), and offering a set itself as its own connector is a guaranteed 422.                                                                                                                  |
| D20 | Sets are never connectors | Only `kind = "block"`. This matches `countConnectorsForPairs` and architecture §2.1.                                                                                                                                                                                                                                                                       |
| D21 | Disabled reasons          | Verbatim from the mockup: "Incomplete blocks cannot be used as connectors" / "Does not fit the selected gap". Follow SET-4's `paletteTransitionReason` shape with a `paletteBlockReason` sibling.                                                                                                                                                          |
| D22 | Connector picker          | The gap picker gains blocks: `transition-picker.tsx` becomes `connector-picker.tsx`, listing ranked transitions and then complete blocks for the pair. Blocks are visually distinct (`▸`, brand) and sort after transitions — a single rehearsed mix is the more common answer, and the block is the deliberate choice.                                    |
| D23 | `+ Insert block` CTA      | Add the mockup's second CTA next to `+ Add track`, switching the palette to Blocks.                                                                                                                                                                                                                                                                        |

### Save trail as a block

| ID  | Question                                               | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D24 | The trail does not record transitions — fix that first | `GraphSessionState` is `{ activeId: string \| null; trail: string[] }` (`apps/web/lib/graph/session-store.ts:7-10`) and `hopGraphSession(fromId, toId)` takes two track ids. `NeighborCard` **does** track which edge the user selected, but `onChoose` drops it (`graph-explorer.tsx:91-93`). Thread it through: `onChoose(neighborId, transitionId)` → `goToTrack` → `hopGraphSession(fromId, toId, transitionId)`, and store the trail as `{ trackId, inTransitionId }[]`. Without this, a saved trail is a bag of tracks with every join `available` — the opposite of the ticket's "arrives fully linked" promise. |
| D25 | sessionStorage migration                               | Bump the key from `selecta.graph-session.v1` to `.v2`. A v1 payload is track-ids-only; **drop it** rather than migrate — an in-flight exploration is cheap to redo, and silently resurrecting a trail with no transitions would produce exactly the unlinked block D24 exists to prevent. Delete the v1 key on first v2 write.                                                                                                                                                                                                                                                                                          |
| D26 | The save call                                          | One request: `POST /blocks { kind: "block", title, seed: { trail } }`, using the existing `parseTrail` path. Not N+1 step POSTs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| D27 | Guard and placement                                    | Enabled at ≥2 tracks (`trail.length >= 1`, since `trail` excludes `activeId`). Button in the explorer's top chrome next to Exit — it is a session-level action, not a per-neighbor one. Title dialog reusing the browse create dialog's shape; default empty, Create disabled while blank (SET-4 D5).                                                                                                                                                                                                                                                                                                                   |
| D28 | After saving                                           | Toast with the outcome and a link, and **do not** navigate away or clear the trail. The user was mid-exploration; the block is a side effect, not a destination.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

### Out of scope

- Alternates (`+ alt`, alt rows) — SET-6. Versions (header select, resolved path) — SET-7.
- Graph Set mode and Follow — SET-9 / SET-10. Do not build the expansion-driven flat list here even
  though `?expand=1` exists; Follow is where it belongs.
- `AddToSequenceMenu` / `/add` sequence context — SET-8.
- Nested-block editing **inside** the parent. Edit block navigates; it does not inline an editor.
- Freezing played sets, per-sequence connector overrides — architecture §12.

---

## 5. Surfaces

### 5.1 The block unit in the running order

```text
 ⠿ 03 [O] Opus            126 · 4A   9:06   ↑ ↓ ✎ ✕
 ┌──────────────────────────────────────────────────────────────┐
 │      ├─ ▸ Acid build · 4 tracks · Opus → Strobe   (+2 BPM)   │
 │      │     Expand   Edit block   Detach   Unlink   〜        │
 │      │                                                       │
 │      │  ┌ INSIDE THIS BLOCK · READ-ONLY ────────────────┐    │
 │      │  │ 1  Opus           Eric Prydz      126 · 4A    │    │
 │      │  │ 2  Silver Bullet  Chris Lake      126 · 10A   │    │
 │      │  │ 3  Acid Rain      Lorenzo Senni   130 · 11B   │    │
 │      │  │ 4  Strobe         deadmau5        128 · 9B    │    │
 │      │  └───────────────────────────────────────────────┘    │
 │ BLOCK · ACID BUILD · MOVES AS ONE                            │
 │ ⠿ 04 [S] Strobe         128 · 9B   10:34  ↑ ↓ ✎ ✕            │
 └──────────────────────────────────────────────────────────────┘
```

The outline wraps **both** steps of the unit, because that is what moves. The incoming join above
step 03 belongs to the parent, not to the block, so it sits outside the outline — the mockup's
`wrapBorder` / `innerBorder` split (lines 1009–1022) exists for exactly this and is worth copying
rather than re-deriving.

Degraded states:

```text
      ├─ ▸ Warmup block · 3 tracks · Glue → Cola      ← block-incomplete
      │     2 open joins inside · Edit block  Detach  Unlink  〜

      ├─ ⚠ Acid build no longer fits this pair        ← block-broken
      │     Unlink   Detach   〜
```

### 5.2 The Blocks palette tab

```text
LIBRARY                 [ Tracks ] [ Transitions ] [ Blocks ]
⌕ search blocks
── Fits the selected gap · Opus → Strobe ─────────────── clear ──
▸  Acid build       Opus → Strobe            4 tracks      [+]
▸  Rapture run      Innerbloom → Opus        3 tracks      [ ]  ← disabled
▸  Warmup block     Glue → Cola              3 tracks      [ ]  ← incomplete
─────────────────────────────────────────────────────────────────
+ uses the block as this gap's connector.
```

Footer hint follows SET-4's rule of always stating what `+` does now: "uses the block as this gap's
connector" with a gap selected, "inserts these tracks as one block" otherwise.

---

## 6. File map

| Path                                                       | Disposition                                                                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `packages/library/src/sequence-runtime.ts`                 | **new** — pure runtime formula, no db imports (D4)                                                                         |
| `packages/library/package.json`                            | edit — `"./sequence-runtime"` export                                                                                       |
| `packages/library/src/blocks.ts`                           | edit — `inBlock` embed (D2), `startTrack`/`endTrack` on records (D3), memoized recursive `runtimeSec` (D11)                |
| `packages/library/src/blocks.test.ts`                      | edit — embeds, nested runtime, endpoint-drift shape                                                                        |
| `apps/api/app/blocks/[id]/referrers/route.ts`              | **new** — `GET` (D12)                                                                                                      |
| `apps/web/lib/sequences/types.ts`                          | edit — `inBlock`, `startTrack`/`endTrack`, `block` drag payload, `DisplayGapState` additions                               |
| `apps/web/lib/sequences/gap-display.ts` + `.test.ts`       | edit — reorder the branches, three block states, chrome (D5)                                                               |
| `apps/web/lib/sequences/reorder.ts` + `.test.ts`           | edit — block-aware `unitRange` **only** (D10)                                                                              |
| `apps/web/lib/sequences/drag.ts` + `.test.ts`              | edit — block fit matrix, `paletteBlockReason`, drop labels (D14)                                                           |
| `apps/web/lib/sequences/metrics.ts` + `.test.ts`           | edit — block-aware track count + runtime via the shared formula (D9, D11)                                                  |
| `apps/web/lib/sequences/api.ts`                            | edit — `inBlockId` on `addSequenceStep`, `startTrack`/`endTrack` on `listSequences`, `detachSequenceStep`, `listReferrers` |
| `apps/web/components/sequences/connector-picker.tsx`       | **rename** from `transition-picker.tsx` — transitions then blocks (D22)                                                    |
| `apps/web/components/sequences/sequence-gap.tsx`           | edit — three block states and their actions                                                                                |
| `apps/web/components/sequences/block-connector-row.tsx`    | **new** — collapsed row + lazy read-only expansion (D6, D7)                                                                |
| `apps/web/components/sequences/sequence-running-order.tsx` | edit — unit outline, "moves as one" badge, block drop targets                                                              |
| `apps/web/components/sequences/sequence-workspace.tsx`     | edit — child-detail cache, insert-as-unit, detach, referrers banner, incomplete badge                                      |
| `apps/web/components/sequences/library-palette.tsx`        | edit — Blocks tab (D17–D21)                                                                                                |
| `apps/web/components/sequences/sequences-browse.tsx`       | edit — endpoints on Blocks rows                                                                                            |
| `apps/web/lib/graph/session-store.ts`                      | edit — trail records transitions, key `.v2` (D24, D25)                                                                     |
| `apps/web/components/graph/neighbor-card.tsx`              | edit — `onChoose` carries the selected edge                                                                                |
| `apps/web/components/graph/graph-explorer.tsx`             | edit — thread the edge; "Save as block" in the top chrome                                                                  |
| `apps/web/components/graph/use-graph-explorer.ts`          | edit — `goToTrack(nextId, transitionId, …)`                                                                                |
| `apps/web/components/graph/save-trail-dialog.tsx`          | **new** — title dialog + `POST /blocks` with `seed.trail`                                                                  |

No migration. No change to the connector write path, cycle detection, `detachSequenceStep`, or
`recomputeSequenceDerived`.

`alternate-list.tsx`, `version-switcher.tsx`, `graph-set-rail.tsx`, and `add-to-sequence-menu.tsx`
stay uncreated.

---

## 7. Phases

### Phase 1 — server embeds and the referrers route

- `sequence-runtime.ts` extracted; `sequenceRuntimeSec` in `apps/web/lib/sequences/metrics.ts`
  re-exports it so there is exactly one formula.
- `inBlock` embed, `startTrack`/`endTrack` on records, memoized recursive child runtime.
- `GET /blocks/:id/referrers`.

**Verify (unit):** a step with a block connector returns `inBlock.title` / `.stepCount` /
`.isComplete` / `.runtimeSec`; a nested block's `runtimeSec` accounts for its own interior; the
referrers route lists the parent by id and title.

### Phase 2 — render a block connector correctly

This phase alone fixes §2.1 and §2.2, and is worth landing even if the rest slips.

- Reorder `displayGapState`; add `block`, `block-incomplete`, `block-broken` and their chrome.
- `block-connector-row.tsx` with the collapsed label and lazy expansion.
- The "N block incomplete" header badge.

**Verify (manual):** link a block by hand (`PATCH` a step's `inBlockId` via the API), reload the
workspace, and the gap reads `▸ Acid build · 4 tracks · Opus → Strobe` — not an empty `⟶` row.
Change the child's first track and the gap flips to `block-broken` on reload.

### Phase 3 — the unit

- Block-aware `unitRange`; unit outline and "moves as one" badge.
- Remove-the-unit with confirm; `↑`/`↓` and drag both move two steps.

**Verify:** `↑` on the host step moves the anchor with it. `↑` on the step **above** the anchor
lands above the whole unit, never between the anchor and its host. The unit at the end of the line
has `↓` disabled on both of its steps.

### Phase 4 — palette, picker, insert, detach

- Blocks tab with disabled reasons and self-exclusion; `+ Insert block` CTA.
- `connector-picker.tsx` offers blocks after ranked transitions.
- Insert-as-a-unit (two POSTs), drop targets, drop hints.
- Detach behind `ConfirmDialog`; Edit block navigates with the referrers warning.

**Verify:** dragging an incomplete block arms nothing. Dragging a complete block onto a
non-matching gap arms nothing but the palette row still explains why. Onto the end zone it inserts
anchor + host, and the interior tracks are **not** loose steps. Detach inlines the interior and the
source block still exists in `/sets?view=blocks`. Choosing a block that would cycle shows the
server's message.

### Phase 5 — save trail as a block

- Trail records `{ trackId, inTransitionId }`; key bumped to `.v2`.
- Save button, dialog, one `POST /blocks` with `seed.trail`.

**Verify:** hop four tracks choosing a **non-default** edge on at least one hop, save, open the
block: every gap is `linked` and the non-default edge is the one that was pinned. Reload the graph
page mid-exploration and the trail still carries its transitions.

---

## 8. Testing

Only tests that catch a bug a human or typecheck would miss.

| Test                                                                                                                                       | Bug it catches                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `displayGapState`: `gapState: "linked"` + `inBlockId` → `"block"`                                                                          | §2.1 — a working block connector renders as an empty transition row                                                   |
| `displayGapState`: `linked` + `inBlock.isComplete: false` → `"block-incomplete"`; `inBlockId` + `gapState: "available"` → `"block-broken"` | §2.2 — an unfinished child reads as done, and drift reads as a normal gap                                             |
| `unitRange` over `[t1, block→t2, t3]`: index 1 → `[0,1]`, index 0 → `[0,1]`, index 2 → `[2,2]`                                             | The unit splits and the block points at the wrong pair — the exact stale state read-time validation exists to prevent |
| `unitRange` treats a `block-broken` step as a single step                                                                                  | A broken pin becomes unfixable because it drags its neighbor around                                                   |
| `moveUnit` up from the host of a unit at index 1 is a no-op                                                                                | `↑` reorders into the middle of the unit and silently breaks the connector                                            |
| `dropFit` block matrix: incomplete → false everywhere; gap → both endpoints; step/end → true                                               | A drop authors a connector whose endpoints do not match                                                               |
| Block-aware track count: spine of 4 with one `inBlock.stepCount: 4` → `6`                                                                  | The header under-reports a night built from blocks                                                                    |
| Block-aware runtime: block unit contributes `inBlock.runtimeSec`, not its two endpoint durations                                           | Double-counting the shared endpoint tracks, or ignoring the interior entirely                                         |
| `listSequences` sends `startTrack`/`endTrack` (not `…Id`)                                                                                  | D18 — the picker silently lists every block                                                                           |
| Library: `inBlock` embed round-trips after linking, and `runtimeSec` covers a nested child                                                 | Collapsed rows have ids and no titles; runtime ignores nesting                                                        |
| Library: referrers route lists the parent                                                                                                  | "Edit block" warns about nothing                                                                                      |
| Graph: trail serializes and rehydrates `{ trackId, inTransitionId }`; a v1 payload is dropped                                              | D24/D25 — saved trails arrive unlinked, which is the failure mode this feature exists to avoid                        |

Do **not** duplicate on the client what `blocks.test.ts` already proves: endpoint drift, ancestor
completeness propagation, cycle rejection, detach inlining, and the delete-guard 409.

No render/snapshot tests. No Playwright.

---

## 9. Acceptance

Restated from the ticket against the verified tree:

- A block used as a connector renders as one collapsed brand-tinted row (`▸`, name, track count,
  endpoints) and expands to show its tracks read-only.
- The block connector and its anchor step move together under drag **and** `↑`/`↓`, and are visibly
  grouped and labelled as one unit.
- Dragging a complete block onto a matching gap links it; onto the end of the line it inserts as one
  unit with its interior tracks still inside the block, never as loose steps.
- Detach inlines the interior as editable steps and leaves the source block untouched and still
  listed under `/sets?view=blocks`.
- Edit block opens the child's workspace and warns, from real referrer data, that edits apply
  everywhere it is used.
- Editing a child's first or last track surfaces the parent gap as `block-broken` — not as a normal
  `available` gap, and not as a silently wrong mix.
- A child with open joins inside it surfaces as `block-incomplete`, and the header no longer claims
  `N of N planned` next to an `incomplete` badge with no explanation.
- A connector choice that would cycle, or exceed the depth cap, is rejected with the server's
  message shown to the user.
- Incomplete blocks appear in the palette, disabled with the reason, and never appear in the picker.
- Saving a Freeform trail produces a **fully linked**, complete, importable block that appears under
  `/sets?view=blocks`, preserving the specific transitions the user chose.
- Side by side with the mockup, the block unit, the palette tab, and the collapsed row read as the
  same product.

---

## 10. Implementation notes

- Branch `dj-115` from an up-to-date `main`. `pnpm` only, oxfmt, semantic tokens only.
- `blocks.test.ts` integration tests need Docker + Postgres (`pnpm db:test`). `pnpm lint` and
  `pnpm typecheck` do not.
- Keep `moveUnit` / `reorderTo` / `spliceUnit` untouched. If a unit change seems to need them
  edited, the bug is in `unitRange`.
- The child-detail cache is per workspace mount and is **not** invalidated by parent mutations —
  nothing a parent edit can do changes a child. It _must_ be invalidated after Detach, since the
  host step's connector is gone.
- Clear `dragPayload` and `dropTarget` on `dragend` unconditionally, including a failed `dropFit`
  (SET-4 note that still applies).
- Every drag affordance needs a non-drag equivalent: the palette `+`, the connector picker, and
  `↑`/`↓` cover blocks the same way they cover tracks and transitions.
