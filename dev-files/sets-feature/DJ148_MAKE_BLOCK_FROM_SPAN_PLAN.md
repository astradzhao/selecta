# DJ-148 — Make a selected span of a set into a block (task plan)

> Ticket: [DJ-148 — Be able to select a group of songs in a set and make it a block](https://linear.app/dj-project-astradzhao/issue/DJ-148/be-able-to-select-a-group-of-songs-in-a-set-and-make-it-a-block)
> Architecture: [`../SETS_ARCHITECTURE.md`](../SETS_ARCHITECTURE.md) §2.1–§2.2, §4.2, §5.5–§5.8
> Design source: same workspace as SET-4/5. The mockup has no "make block from span" chrome — this slice invents it, matching existing tokens and the Save-trail / Detach patterns.
> Predecessor: SET-5 ([`DJ115_BLOCK_CONNECTORS_PLAN.md`](./DJ115_BLOCK_CONNECTORS_PLAN.md)) shipped detach and save-trail-as-block. SET-6 ([`DJ116_ALTERNATES_PLAN.md`](./DJ116_ALTERNATES_PLAN.md)) D20 enabled shift-click spans **on blocks only**, and explicitly deferred this:
>
> > Auto-creating a block from a selected span. If you need `A → B′ → C`, build that block in `/sets?view=blocks` (or save a trail) and drop it on the span.
>
> Status: **implemented** on `dj-148`.

You already build a night as a flat running order, then notice a rehearsed run that should be a
reusable block. Graph can promote a trail. Detach can explode a nested block back into loose steps.
There is no inverse: you cannot carve a contiguous run out of a set and collapse it into a nested
block without rebuilding that block by hand.

---

## 1. Goal

On `/sets/:id`, shift-click a contiguous group of tracks and **Make block**. That:

1. Creates a new `kind: "block"` sequence whose steps are a **copy** of the selected run (tracks,
   inbound connectors, seams, notes, nested block pins).
2. Replaces that run on the set with a SET-5 block unit: first track stays, last track becomes the
   host whose inbound connector is the new block, interior spine steps are deleted.

The night still plays the same tracks, in the same order, with the same mixes — they are just
composed now. The new block shows up under `/sets?view=blocks` and can be dropped into any other
gap.

This is the inverse of Detach. Do not invent a second composition model.

---

## 2. What I verified (current tree)

SET-1 through SET-7 and SET-9 are on `main`. Do not rebuild any of it.

| Capability                       | Where                                                                                                              | State    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------- |
| Nested block as a connector      | `inBlockId` on `block_steps`; `assertConnectorMatchesGap` + `assertAcyclicReference`                               | **done** |
| Block unit (moves as one)        | `unitRange` / `isLiveBlockHost` in `apps/web/lib/sequences/reorder.ts`                                             | **done** |
| Detach (explode nested → copies) | `detachSequenceStep` + `POST /blocks/:id/detach/:stepId`                                                           | **done** |
| Save trail as a **new** block    | `createSequence({ seed: { trail } })` + Graph `SaveTrailDialog`. Set is unchanged.                                 | **done** |
| Seed from track ids              | `createSequence({ seed: { trackIds } })` — copies tracks only, **not** connectors/notes/seams                      | **done** |
| Span selection type              | `WorkspaceSelection` `{ kind: "span"; fromStepId; toStepId }`                                                      | **done** |
| Shift-click spans                | `handleSelectStep` in `sequence-workspace.tsx` — **gated on `canAuthorAlternates` (blocks)**                       | **done** |
| First-track clamp                | `orderSpan` / `spanRange` in `apps/web/lib/sequences/alternates.ts` — alt spans cannot start at index 0            | **done** |
| Trail seed copies nested blocks? | **No.** `SequenceTrailSeed` is `{ trackId, inTransitionId }`. Notes, seams, `inBlockId`, version pins are dropped. | missing  |

`createSequence` + a client-side loop of `deleteSequenceStep` / `updateSequenceStep` is **not** an
acceptable implementation:

- Two (or N) HTTP calls can leave an orphan block if the parent rewrite fails.
- Trail seed cannot copy nested block connectors, seams, notes, or `inBlockVersionId`.
- Deleting interior steps one-by-one races with `updatedAt` and can cascade-delete leftover
  alternates in surprising order.

**One transaction, one route.** Mirror Detach.

Also load-bearing: `spanRange` / `orderSpan` / `coveredStepIds` are **alternate** helpers. They
reject or clamp `fromIdx === 0` because an alternate needs a predecessor. A make-block span **must**
be allowed to start at the opener. Do not widen those helpers. Add a sibling.

---

## 3. The operation, in pictures

Set before, span `B..D` selected:

```text
 01  A
     ⟶ mix
 02  B          ← span start (stays on the parent as the unit anchor)
     ⟶ mix
 03  C          ← interior (deleted from parent, copied into the block)
     〜 seam
 04  D          ← span end / future host
     ⟶ mix
 05  E
```

After Make block `"Peak run"`:

```text
Parent set                         New block "Peak run"
 01  A                               01  B
     ⟶ mix                                ⟶ mix
 02  B  ┐                            02  C
        │ BLOCK · Peak run · MOVES AS ONE  〜 seam
 03  D  ┘ inBlockId = Peak run       03  D
     ⟶ mix
 04  E
```

- Child step 0 has **no** inbound (first step of a sequence never does). A's mix into B stays on
  the parent, on B.
- Child copies every subsequent inbound (`inTransitionId` XOR `inBlockId`), `isSeam`, `note`, and
  `inBlockVersionId`.
- Parent host (D) is rewritten to `inBlockId = child`, `inTransitionId = null`,
  `inBlockVersionId = null`, `isSeam = false`. Its `note` stays on the parent; the child last step
  also gets a copy of that note.
- Completeness, endpoints, and stale-pin clearing are `recomputeSequenceDerived` on **both** ids.

Two-step span (no interior) is the smallest legal case: parent keeps both cards, host just gains
the block connector. That is exactly how you would pin a 2-track block by hand today.

Detach of that host must restore the same tracks, connectors, seams, and notes (new step ids are
fine). Add that round-trip as a library test.

---

## 4. Decisions

### Server

| ID  | Question                      | Decision                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Name                          | Domain `wrapSequenceSpan(sequenceId, { fromStepId, toStepId, title, description? })`. HTTP `POST /blocks/:id/wrap` with that body. UI copy is **Make block**. Avoid `extract` (submissions) and `collapse` (the Expand/collapse row).                                                                                                                                           |
| D2  | Atomicity                     | One `runInDbTransaction`: insert child `kind: "block"` (copy parent's `libraryId`), copy span steps onto it, delete parent interior steps, pin `inBlockId` on the host, `assertAcyclicReference(parent, child)`, `recomputeSequenceDerived` on child then parent. Return `{ sequence, block }` so the toast can name the new block.                                             |
| D3  | Parent kind                   | **No restriction.** Wrapping a span of a block into a nested sub-block is valid composition. The **UI** only offers it on sets (D12) so it does not steal SET-6's shift-click.                                                                                                                                                                                                  |
| D4  | Child kind                    | Always `"block"`. Sets are not importable as connectors (architecture §2.1). Palette already filters `kind: "block"`; keep that invariant even though `validateConnector` currently does not check `kind`.                                                                                                                                                                      |
| D5  | Minimum span                  | `toIdx - fromIdx + 1 >= 2`. One track has no endpoints as a run. 422 `"Select at least two tracks."`                                                                                                                                                                                                                                                                            |
| D6  | Bounds                        | `fromStepId` / `toStepId` must be ids of **this** sequence, `fromIdx <= toIdx`. Server does not snap units (D8 is client-only); if the span splits a live block unit, 422 `"A nested block has to be included in full."` Detect a split with the same rule as `unitRange`: a live host is `(inBlockId && gapState === "linked")`, and the unit is `[hostIndex - 1, hostIndex]`. |
| D7  | Already a block               | If the snapped span is **exactly one** live unit and nothing else, 422 `"That's already a block."` Wrapping a wrapper around a single nested block is not the product.                                                                                                                                                                                                          |
| D8  | Alternates                    | If any `block_alternates` row on the parent has `fromStepId` or `toStepId` inside the span (inclusive), 422 and name the count. Deleting interior steps would CASCADE those rows. On sets this should not fire in the UI (D20 of SET-6 omits alt chrome). Still reject so a leftover API alt cannot silently vanish.                                                            |
| D9  | Nested connectors             | Copy `inBlockId` by **reference**, not deep-clone. Nested interiors stay in the child block's own rows; they are not spine steps of the parent (SET-5). Copy `inBlockVersionId` too — extend `insertStepRow` to accept it and `assertBlockVersionPin`. Depth / cycle checks run via `assertAcyclicReference` after the child exists.                                            |
| D10 | Incomplete / unmapped / seams | **Allowed.** Drafting stays possible (architecture: completeness is computed, never an edit gate). An incomplete child used as a connector already renders SET-5's `block-incomplete` treatment.                                                                                                                                                                                |
| D11 | CAS                           | Do **not** require `expectedUpdatedAt`. Detach does not. Keep the pair symmetric.                                                                                                                                                                                                                                                                                               |
| D12 | Trail seed                    | **Do not extend** `createSequence({ seed: { trail } })` to carry `inBlockId` / notes / seams. Graph trails are still transitions-only. Wrap is a different writer.                                                                                                                                                                                                              |

### Selection and chrome

| ID  | Question               | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D13 | Who can select         | `canWrapSpan(kind) === (kind === "set")`. `/sets/:id` only. `/blocks/:id` keeps shift-click as **add alternate** (SET-6 D6/D20). Same workspace component, two gates.                                                                                                                                                                                                                                                                                                           |
| D14 | Gesture                | Reuse `{ kind: "span" }`. Shift-click a second step while a step/gap/span is selected. **No first-track clamp.** New helper `orderStepSpan` (ordered min/max, no `fromIdx === 0` rewrite). Clicking the span again, `clear`, or Escape clears it (Escape already exists).                                                                                                                                                                                                       |
| D15 | Unit snap              | Client expands the ordered range through `unitRange` on both ends before setting selection, so you cannot highlight half a nested block. If the snapped range is exactly one live unit, toast D7's copy and leave the previous selection. If the range is one loose track, toast `"Select at least two tracks."`                                                                                                                                                                |
| D16 | Highlight              | Existing `highlighted={spanCovered.has(step.id)}` on step cards. `coveredStepIds` today uses alt `spanRange` and therefore **drops a span that starts at the opener**. Add `coveredStepIdsInRange` (or teach a new `stepSpan` helper) that includes index 0. Do not change alt `spanRange`.                                                                                                                                                                                     |
| D17 | Action bar             | When `canWrapSpan && selection.kind === "span"`, a `bg-brand-subtle` bar above the running order: `{n} tracks selected · {startTitle} → {endTitle}` + **Make block** + ghost **clear**. `{n}` is spine steps, not expanded nested interiors — the parent never listed those interiors.                                                                                                                                                                                          |
| D18 | Dialog                 | Same browse-create shape as `SaveTrailDialog` / `AlternateLabelDialog`: heading "Make block", description "A reusable run. This night will use it as one connector — Detach if you want the tracks loose again.", title field, placeholder `"Peak run"`, Create disabled while blank. No second checkbox for copy-only (D21).                                                                                                                                                   |
| D19 | Palette while wrapping | Span on a set is **not** alternate-authoring. Banner: `{n} tracks selected · A → C` with `clear`. Tracks `+` stay disabled. Transitions and Blocks `+` / drops disabled with `"Make a block from the selected tracks, or clear the selection"`. Footer: drop the `+ uses this as the alternate for …` line (`spanSelected && canAuthorAlternates`). `handleAddTransition` / `handleAddBlock` already no-op alts on sets via `beginAlternateDraft`; do not leave a silent click. |
| D20 | Hint                   | When `kind === "set"`, `steps.length >= 2`, and selection is not a span, a single `text-caption` under the running-order heading: `Shift-click a range to make a block.` Hide the line while the action bar is up.                                                                                                                                                                                                                                                              |
| D21 | Copy-only              | **Out of scope.** Graph already has Save trail as a block (set unchanged). This ticket is "make it a block" — the selected run _becomes_ the nested unit. Copy-without-replacing would immediately diverge and skip the composition the architecture is built on.                                                                                                                                                                                                               |
| D22 | Toast                  | `"Made “Peak run” — it stays in your library"` plus the usual mutate refresh. Clear the span. Do not auto-navigate to `/blocks/:newId`; Edit block on the new unit is SET-5's entrance.                                                                                                                                                                                                                                                                                         |
| D23 | Path lock              | Same as other spine edits: `requireBasePath()`. Sets have no sequence-level version switcher (SET-7), so this is a no-op there; keep the guard anyway.                                                                                                                                                                                                                                                                                                                          |

### Out of scope

- Copy-only "save these tracks as a block and leave the set flat" (D21). Graph Save trail covers the analogous case.
- Make-block chrome on `/blocks/:id`. Server allows it (D3); do not steal alt shift-click. A later ticket can add an explicit button on a block span if nested carving is missed.
- Deep-cloning nested blocks inside the span. Reference, then Detach on the child if you want a private copy.
- Auto-linking unmapped gaps inside the new block. Wrap copies what is there.
- Checkboxes, lasso, or non-contiguous multi-select. Contiguous spine only.
- Schema / migration. No new tables or columns.
- Graph Set mode, Follow, Add-to-sequence, versions UI.
- Changing Detach to round-trip `inBlockVersionId` on exploded interior steps (pre-existing SET-7 gap). Wrap still **writes** the pin onto the child so the night keeps the chosen nested version.

---

## 5. File map

| Path                                                       | Disposition                                                                                                                                                                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/library/src/blocks.ts`                           | edit — `wrapSequenceSpan`; extend `insertStepRow` with optional `inBlockVersionId`                                                                                                                                                   |
| `packages/library/src/index.ts`                            | edit — export the new function + input type                                                                                                                                                                                          |
| `packages/library/src/blocks.test.ts`                      | edit — tests in §8                                                                                                                                                                                                                   |
| `apps/api/lib/blocks.ts`                                   | edit — `parseWrapSpanBody`                                                                                                                                                                                                           |
| `apps/api/app/blocks/[id]/wrap/route.ts`                   | **new** — `POST`                                                                                                                                                                                                                     |
| `apps/web/lib/sequences/api.ts`                            | edit — `wrapSequenceSpan` client                                                                                                                                                                                                     |
| `apps/web/lib/sequences/span.ts`                           | **new** — `stepSpan`, `orderStepSpan`, `snapSpanToUnits`, `isExactLiveUnit`, `coveredStepIdsInRange`, `canWrapSpan`                                                                                                                  |
| `apps/web/lib/sequences/span.test.ts`                      | **new** — the web tests in §8                                                                                                                                                                                                        |
| `apps/web/lib/sequences/alternates.ts`                     | **do not change** `spanRange` / `orderSpan`                                                                                                                                                                                          |
| `apps/web/lib/sequences/drag.ts`                           | edit — when `selection.kind === "span"` and the sequence cannot author alts, disable connector fit (`"Make a block…"` reason). Thread `sequenceKind` or a `spanMode: "alternate" \| "wrap"` flag; do not guess from `fromIdx === 0`. |
| `apps/web/components/sequences/sequence-workspace.tsx`     | edit — shift-click on sets, dialog, mutate                                                                                                                                                                                           |
| `apps/web/components/sequences/sequence-running-order.tsx` | edit — action bar, hint, highlight via new coverage helper                                                                                                                                                                           |
| `apps/web/components/sequences/library-palette.tsx`        | edit — D19 banner/footer/disabled reasons (needs `sequenceKind`, already passed)                                                                                                                                                     |
| `apps/web/components/sequences/make-block-dialog.tsx`      | **new** — clone the `SaveTrailDialog` shape                                                                                                                                                                                          |
| `dev-files/SETS_ARCHITECTURE.md`                           | edit — §4.2 bullet + §11 row (phase 5)                                                                                                                                                                                               |
| `dev-files/sets-feature/README.md`                         | edit — table row                                                                                                                                                                                                                     |
| `dev-files/sets-feature/DJ116_ALTERNATES_PLAN.md`          | edit — strike the "out of scope / auto-creating a block" line, point here                                                                                                                                                            |

`insertStepRow` today does not persist `inBlockVersionId` (column defaults null). Detach has the
same limitation. Wrap is the first writer that must copy a pin, so extend the helper rather than
issuing a follow-up `UPDATE`.

---

## 6. Phase 1 — domain writer

Work in `packages/library/src/blocks.ts` only until the tests in §8 pass via `pnpm --filter @selecta/library test` (or the repo's equivalent `blocks.test.ts` run).

Suggested body of `wrapSequenceSpan`:

1. `requireSequenceRow`, load ordered steps, resolve `fromIdx` / `toIdx`.
2. Validate D5–D8. For D6, a split is: some index `i` in `[fromIdx, toIdx]` whose `unitRange` is not
   fully inside `[fromIdx, toIdx]`. You will need gap state for `isLiveBlockHost` — either call the
   same `deriveGapState` used on read, or treat `inBlockId != null && !isSeam` as "would-be unit" and
   additionally `validateConnector` so a **broken** pin is not treated as a unit (broken pins are
   not units in `reorder.ts`).
3. Insert `blocks` row `kind: "block"`, `title`, `description`, `libraryId` from parent.
4. For `i = fromIdx .. toIdx`, `insertStepRow` on the child:
   - `i === fromIdx`: no inbound, `isSeam: false`, note copied.
   - else: copy inbound XOR, seam, note, version pin.
5. Delete parent steps `fromIdx+1 .. toIdx-1` (no-op when length is 2).
6. Patch host (`toIdx` step, still present) to `{ inBlockId: childId, inTransitionId: null, inBlockVersionId: null, isSeam: false }`.
7. `assertConnectorMatchesGap(parentId, start.trackId, host.trackId, { inBlockId: childId })` —
   this is the cycle/depth/endpoint gate. Then `rewritePositions` if deletes happened.
8. `recomputeSequenceDerived(childId)` then `recomputeSequenceDerived(parentId)`.
9. Return `{ sequence: parentDetail, block: childDetail }`.

Do not go through `createSequence({ seed })`. That path cannot copy `inBlockId`.

Broken nested pin inside the span: copy it anyway (D10). The child will show the same broken gap;
the parent unit is valid as long as child endpoints match `(start, host)` tracks, which they will
by construction.

---

## 7. Phase 2 — HTTP

`POST /blocks/:id/wrap`

```json
{ "fromStepId": "…", "toStepId": "…", "title": "Peak run", "description": null }
```

201:

```json
{ "ok": true, "sequence": {/* parent SequenceDetail */}, "block": {/* child SequenceDetail */} }
```

Parse like the other block bodies (`invalidBody` on bad JSON / missing title / missing step ids).
`sequenceErrorResponse` already maps `MusicWriteError` → 400/404/409/422.

Wire `apps/web/lib/sequences/api.ts` `wrapSequenceSpan` the same way as `detachSequenceStep`.

---

## 8. Phase 3 — workspace

### 8.1 Pure helpers (`lib/sequences/span.ts`)

Keep these out of `alternates.ts`. Tests are cheap and this is the layer that will silently clamp
the opener if someone reuses `orderSpan`.

| Helper                                       | Contract                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| `canWrapSpan(kind)`                          | `kind === "set"`                                                                     |
| `stepSpan(steps, fromId, toId)`              | `{ fromIdx, toIdx }` or `null`. Allows `fromIdx === 0`. Requires `fromIdx <= toIdx`. |
| `orderStepSpan(steps, aId, bId)`             | Ordered ids, **no clamp**. `null` if either id is missing.                           |
| `snapSpanToUnits(steps, fromIdx, toIdx)`     | Expand through `unitRange` on both ends.                                             |
| `isExactLiveUnit(steps, fromIdx, toIdx)`     | True iff the range is one live block unit.                                           |
| `coveredStepIdsInRange(steps, fromId, toId)` | Inclusive ids, including opener.                                                     |

### 8.2 `handleSelectStep`

```text
if (shiftKey && canWrapSpan(detail.kind) && requireBasePath()) → wrap span path
else if (shiftKey && canAuthorAlternates(detail.kind) && …) → existing alt span path
else → toggle step
```

Do not share `orderSpan` between the two paths.

### 8.3 Dialog + mutate

`MakeBlockDialog` owns title state, like `SaveTrailDialog`. On confirm:

```ts
await mutate(
  () => wrapSequenceSpan(detail.id, { fromStepId, toStepId, title }),
  `Made “${title}” — it stays in your library`,
);
setSelection({ kind: "none" });
```

`mutate` already reapplies detail from the response; make sure it reads `result.sequence` (not
`result.block`). If today's helper assumes `{ sequence }`, keep that shape in the JSON (D2).

### 8.4 Palette / drag

`LibraryPalette` already receives `sequenceKind`. When `selection.kind === "span" && !canAuthorAlternates(sequenceKind)`:

- Context banner uses wrap copy (D19), not `Fits the selected span · pred → dest` (that string is
  the **alternate pair**, which is predecessor→destination, not start→end of the block).
- Connector rows disabled.
- Hide the alternate footer.

Thread the same mode into `paletteTransitionReason` / `paletteBlockReason` / `dropFit` so a drag
does not arm a gap as "use as alternate" on a set.

---

## 9. Tests (only these)

Library (`blocks.test.ts`) — these catch bugs typecheck will not:

1. **Happy path.** Set `A B C D` with mixes on every join. Wrap `B..D`. Parent spine is `A, B, D`
   with `D.inBlockId = child`. Child spine is `B, C, D` with the original mixes/seams/notes.
   Parent `A→B` mix unchanged. Child completeness matches what those joins were.
2. **Round-trip.** Wrap then `detachSequenceStep` on the host. Parent track order and inbound
   connectors/seams/notes match the pre-wrap set (step ids may change).
3. **Opener included.** Wrap `A..C` on `A B C D`. Parent becomes `A, C(inBlockId), D`. Proves
   `fromIdx === 0` is legal here even though it is 422 for alternates.
4. **Nested unit copied by reference.** Parent has a live block unit in the middle of the span.
   Child host-step of that unit keeps the same `inBlockId` (and pin if set). Parent no longer has
   that interior spine. Reject wrapping **only** that unit (D7).
5. **Rejects.** One-step span; ids not in this sequence; reversed ids (`fromIdx > toIdx` after
   lookup — client orders, server still checks); overlapping alternate (seed a block-kind parent);
   depth cap if you can construct it cheaply (optional — `assertAcyclicReference` is already
   tested).

Web (`span.test.ts`):

6. `orderStepSpan` includes the first track; `orderSpan` still clamps (do not regress SET-6).
7. `snapSpanToUnits` expands a selection that starts on a unit host to include the anchor.
8. `isExactLiveUnit` is true only for a 2-step live unit.
9. `coveredStepIdsInRange` from the opener includes that first step; `coveredStepIds` (alt) still
   does not.

No render tests, no snapshot of the dialog.

---

## 10. How to verify (browser)

Start `pnpm dev`, open a set with ≥4 loose tracks and at least one nested block already in it.

1. **Main path.** Shift-click track 2 then track 4. Action bar shows the titles. Make block →
   title → Create. Running order shows a SET-5 unit; `/sets?view=blocks` lists the new row; toast
   copy matches D22. Expand the unit: interiors match. Edit block warns (SET-5) if you open it.
2. **Opener.** Shift-click the first track through the third. Same collapse. Completeness header
   still honest.
3. **Reject exact unit.** Shift-click only an existing nested block's two spine cards → toast, no
   dialog.
4. **Detach inverse.** Detach the new unit. Loose tracks return; mixes/seams/notes intact.
5. **Escape / clear.** Span highlight and palette banner go away. Palette `+` works again.
6. **Block workspace unchanged.** `/blocks/:id` shift-click still authors an alternate, not a wrap.
   No Make-block bar.
7. **Palette.** With a wrap span selected, Transitions/Blocks rows are disabled with D19 copy; no
   alternate footer; New track disabled.

If browser tools are unavailable: the library tests in §9 plus a `curl` of `POST /blocks/:id/wrap`
against a seeded set.

---

## 11. Docs (same PR)

- `SETS_ARCHITECTURE.md` §4.2 running-order bullets: add **Make block** from a selected span on a
  set (inverse of Detach). §11: a follow-up row for [DJ-148](https://linear.app/dj-project-astradzhao/issue/DJ-148),
  depends on SET-5. Do not renumber SET-1…SET-10.
- This folder's `README.md` table: add this plan, status "plan / not started".
- SET-6 plan out-of-scope bullet about auto-creating a block: point here.

---

## 12. Implementation notes (do not relitigate)

- Branch `dj-148` from updated `main`. One Linear issue, one branch, one PR titled
  `[DJ-148] Make a selected span of a set into a block`.
- Tokens: `bg-brand-subtle` / `text-brand` for the action bar, `text-caption` for the hint,
  `ConfirmDialog` is **not** needed (this is not destructive of library data). Title dialog is a
  `Dialog`, not a confirm.
- `{n} tracks` counts spine steps. Nested interiors are already inside child blocks and must not
  be double-counted in the bar.
- `applyDetail` currently tries to preserve a span by id. After wrap, interior ids are gone —
  falling back to `{ kind: "none" }` is correct (also do it explicitly in the mutate callback).
