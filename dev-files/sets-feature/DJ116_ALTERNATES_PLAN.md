# DJ-116 — SET-6: Alternates as substitutable spans (task plan)

> Ticket: [DJ-116 — SET-6: Alternates as substitutable spans](https://linear.app/dj-project-astradzhao/issue/DJ-116)
> Architecture: [`../SETS_ARCHITECTURE.md`](../SETS_ARCHITECTURE.md) §2.4, §4.2, §5.2–§5.3, §5.7
> **Design source: [`Sets feature mockup/Selecta Sets.dc.html`](./Sets%20feature%20mockup/Selecta%20Sets.dc.html)**
> Predecessor: [`DJ115_BLOCK_CONNECTORS_PLAN.md`](./DJ115_BLOCK_CONNECTORS_PLAN.md) — SET-5 shipped in #102
> Status: implemented on `dj-116`. Authoring chrome is **block-only** (D20).

SET-4 made a night orderable. SET-5 made a rehearsed run reusable. SET-6 is plan B: _if the room
is hot, go here instead_ — without copying the sequence.

Do not start this until SET-4 has been used on a real gig (architecture §11). SET-5 is already on
`main`; this slice assumes that tree.

---

## 1. The headline: this is a web slice, with one server embed

**The alternates write path already exists and is tested.** SET-1 landed the span model; SET-2
exposed it. I verified all of the following on `main` (`eabd83f`):

| Capability                          | Where                                                                                                                                         | State    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Create / patch / delete an alt      | `createSequenceAlternate` / `updateSequenceAlternate` / `deleteSequenceAlternate`; `POST`/`PATCH`/`DELETE /blocks/:id/alternates[/:altId]`    | **done** |
| Span is two step IDs                | `fromStepId` / `toStepId` on `block_alternates`; `spanRange` requires `fromIdx <= toIdx`; `fromIdx === 0` is 422                              | **done** |
| Connector XOR                       | DB check `block_alternates_single_connector`; `xorConnector` on write                                                                         | **done** |
| Endpoint validation                 | `assertAlternateSpan` uses **predecessor of `fromStep`** and **`toStep`'s track**, then `assertConnectorMatchesGap` (cycles + depth included) | **done** |
| Read-time validity                  | `hydrateAlternates` → `SequenceAlternate.valid` via `isAlternateValid` (broken span or stale connector → `false`, never followed)             | **done** |
| Bounding-step delete clears the alt | `from_step_id` / `to_step_id` FKs are `ON DELETE CASCADE`. `deleteSequenceStep` does not mention alternates; Postgres does.                   | **done** |
| Connector delete clears the alt     | `alt_transition_id` / `alt_block_id` are `ON DELETE CASCADE` (unlike step pins, which `SET NULL`)                                             | **done** |
| Version overlap rejection           | `assertNoOverlappingChoices` on version save. **Not this ticket** — SET-7. Multiple alts may cover the same span here; that is the point.     | SET-7    |
| Detail already returns `alternates` | `GET /blocks/:id` includes them. SET-4/SET-5 ignore the array.                                                                                | **done** |

Existing tests in `packages/library/src/blocks.test.ts`: `"keeps version choices anchored to step
ids across insert and reorder"`, `"rejects overlapping alternates in a single version"`. There is
**no** test that deleting a bounding step clears the row, and **no** test that a two-step span
validates `A → C` rather than `A → B`. Add those (D2). Do not rebuild the write path.

SET-6's server work is the embed the chrome cannot render without (D1), plus those two tests.
Everything else is `apps/web`.

---

## 2. What the ticket is actually asking for

An alternate replaces a **span** of the primary line with **one connector**. Because a connector is
`Transition | Block`, one mechanism covers the architecture §2.4 table:

| Want                                        | Alternate is                | Span     |
| ------------------------------------------- | --------------------------- | -------- |
| A different mix between the same two tracks | a transition                | 1 step   |
| A different route to the same track         | a block `A → … → B`         | 1 step   |
| A different track that rejoins              | a block `A → B′ → C`        | 2 steps  |
| A multi-track detour                        | a block `A → X → Y → Z → C` | 2+ steps |
| Skip the middle track                       | a transition `A → C`        | 2 steps  |

The last row is legal today (the overlap test already creates it) and is how you author a hard cut
across a span without a block.

Resolution (SET-7 / Follow) splices the span out and pins the connector on `toStep`. SET-6 does
**not** resolve. It authors and displays alternates against the **base** running order. The primary
line never changes because you added a plan B.

The Linear comment is load-bearing:

> The mockup keys an alternate to a **single gap** (`intoStepId`). The SET-1 schema already models
> an alternate as a **span**. The mockup is the degenerate one-gap case. Build the span model, and
> treat the mockup's per-gap row as how a one-step span _renders_; do not build a per-gap UI and
> try to widen it later.
>
> The label is the product here: an alternate without a condition ("if the room is hot") is just a
> second option, and the DJ has no way to decide between them in the booth.

---

## 3. The mockup, and where SET-6 diverges from it

Open `Sets feature mockup/Selecta Sets.dc.html` and drive `+ alt` on a gap, then `remove` on the
`⤷ alt · …` row. `onAddAlternate` and the `alts` list under each gap are the chrome spec for the
**one-step** case.

| Mockup                                                                                     | SET-6                                                                                       | Why                                                                                                                           |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Alternate keyed by `intoStepId` (one gap)                                                  | `fromStepId` / `toStepId`                                                                   | Schema and ticket. One-step is `from === to ===` that gap's destination step.                                                 |
| `+ alt` auto-picks `cands[1] \|\| cands[0]` and hardcodes the label `"if the room is hot"` | Opens the connector picker (or the unmapped rejoin CTA); label dialog is required           | Auto-pick silently authors the wrong mix. A blank/canned label is the failure mode the comment exists to prevent.             |
| Alts listed only when `version === "base"`                                                 | Always list every alt                                                                       | Versions are SET-7. Until a version is active, the base path is the only path.                                                |
| `alternate · <label>` chip on a resolved gap                                               | Omitted                                                                                     | That chip is the resolved-path treatment. SET-7.                                                                              |
| Version `<select>`                                                                         | Omitted                                                                                     | SET-7.                                                                                                                        |
| No span selection                                                                          | First-class `{ kind: "span" }` selection that retargets the palette                         | Ticket: "Selecting a span retargets the palette exactly as selecting a gap does."                                             |
| Header ignores alts                                                                        | `{n} alternates · {m} mapped` when `n > 0`                                                  | Ticket: coverage is reported separately so it never drags headline completeness.                                              |
| One visual (`⤷ alt · label · desc`)                                                        | Three: mapped / incomplete / broken, plus a **ghost** unmapped row on a selected empty span | Real data has endpoint drift (SET-5's lesson). The ticket's "rejoin of `none`" is the ghost, not a stored connector-less row. |

---

## 4. Decisions

### Server (additive only)

| ID  | Question                         | Decision                                                                                                                                                                                                                                                                                                                                                   |
| --- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Collapsed-row data               | Embed `altTransition` / `altBlock` on `SequenceAlternate`, same shapes as `SequenceStep.inTransition` / `inBlock`, populated in `hydrateAlternates` via the existing batch loaders. Ids-only is why SET-4 could ignore the array and the mockup's `desc` (`"Rapture run · 3 tracks"`, `"loop roll · 4 bars"`) cannot be rendered today. **No new column.** |
| D2  | Tests the write path is missing  | Two library tests, nothing else: (1) deleting `fromStep` or `toStep` drops the alternate from `getSequenceDetail`; (2) a two-step span `B..C` with a block `A → … → C` is accepted, and a block `A → … → B` is 422. That is the "validate the span pair, not the first gap" bug.                                                                           |
| D3  | Touch `createSequenceAlternate`? | **No behavior change.** Label stays nullable on the wire (existing tests omit it). The **UI** requires a trimmed label (D12). Do not migrate the XOR check; an alternate without a connector cannot be stored, so "unmapped" is never a row.                                                                                                               |
| D4  | `valid` vs incomplete child      | Keep `valid` as endpoint-and-span truth (same as `validateConnector`). Surface an incomplete child block via `altBlock.isComplete === false`, the SET-5 `block-incomplete` pattern. Do not overload `valid`.                                                                                                                                               |

### Selection and palette

| ID  | Question                         | Decision                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D5  | Selection grows a variant        | `WorkspaceSelection` gains `{ kind: "span"; fromStepId: string; toStepId: string }` with `fromStepId`/`toStepId` already ordered by current index (`fromIdx <= toIdx`, `fromIdx >= 1`). This **breaks** `insertIndex` / `paletteTransitionQuery` / `paletteBlockReason` / `library-palette.tsx`, which all assume a `stepId` when `kind !== "none"`. Fix them in the same PR; a span is not an insert position.                |
| D6  | How you select a span            | **Two entrances, one writer.** (1) `+ alt` on a gap (including a block-connector gap) with no span selected → one-step span for that destination step, then the picker. (2) Shift-click a second step card while a step or gap is selected → contiguous span from `min` to `max` index, clamped so it cannot start at step 0. Palette switches to Transitions. Clicking the selected span again, `clear`, or Escape clears it. |
| D7  | First-track clamp                | An alternate cannot start at the first step (no predecessor). If the shift-click range includes index 0, start at index 1 when `max >= 1`; if the range is only the first step, ignore and toast "An alternate needs a join to substitute — pick from the second track on." Server already 422s this; the client should not offer it.                                                                                          |
| D8  | Span is alternate-authoring mode | While a span is selected, Tracks `+` / track drops are disabled ("select a step or gap to insert a track"). Transitions and Blocks `+` / fitting drops **create an alternate** for that span, they do not link the primary gap. A gap selection still links the primary line; `+ alt` is the only way a gap authors a plan B. Do not silently turn palette `+` into add-alternate just because a gap is selected.              |
| D9  | Palette query on a span          | `fromTrackId = steps[fromIdx - 1].trackId`, `toTrackId = steps[toIdx].trackId`. Banner: `Fits the selected span · A → C` with `clear`. Footer: `uses this as the alternate for A → C`. Disabled reasons stay SET-5's copy, plus `"Does not fit the selected span"`. Same `listSequences({ startTrack, endTrack })` trap as SET-5 D18 — send the short names.                                                                   |
| D10 | Drop target                      | When a span is selected, the only armed connector target is the **fromStep's gap** (where the alt row lives). Fitting payload: endpoints equal the span pair. Drop hint: `"Use {name} as the alternate for A → C"`. Step / end zones do not arm.                                                                                                                                                                               |

### Chrome

| ID  | Question                            | Decision                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D11 | Where a stored alt renders          | Always under the **fromStep's inbound gap**, as an indented `⤷` row matching the mockup. One-step spans look exactly like the mockup. Multi-step spans add `covers N steps · {fromTitle} → {toTitle}` on the same line, and the covered step cards get a `brand-subtle` outline while that alt is expanded or the span is selected. Never duplicate the row under every gap in the span.                                            |
| D12 | Label                               | Required in the UI. After a connector is picked (picker, palette `+`, or drop), open a dialog in the browse-create shape: heading "Add alternate", placeholder `"if the room is hot"`, Create disabled while blank. `PATCH` of label later is inline on the row (click the label). Empty string → reject; do not store a nameless plan B.                                                                                           |
| D13 | Do not auto-pick                    | `+ alt` never writes a connector by itself. Zero candidates → the ghost rejoin row (D15), not the mockup toast `"No second connector to offer as an alternate"` and not a no-op. One or more → picker, including the primary-line's current mix — a different _block_ for the same pair is a valid plan B even when there is only one transition.                                                                                   |
| D14 | Three stored visuals                | **mapped** — `valid` and (transition, or complete block) → quiet `⤷ alt · {label} · {desc}`. **incomplete** — `valid` and `altBlock.isComplete === false` → warning tint, `"open joins inside"`. **broken** — `valid === false` → destructive tint, `"this alternate no longer fits"` / `"taking this would strand you"`. Actions: mapped/incomplete → Expand (block or multi-step only), edit label, remove. Broken → remove only. |
| D15 | Rejoin of `none` (ghost, not a row) | Selecting a span (or `+ alt` on a gap) whose pair has **zero** transition and complete-block candidates renders a ghost row in `unmapped` chrome: `○ no connector for this rejoin yet` + **Add transition** to `libraryAddHref("transitions")` with both endpoints. This is the ticket's "taking this alternate strands you, and you probably want to author that edge now." It is not POSTed. Clear the span and it disappears.    |
| D16 | Expand                              | Collapsed is the default, one line. Expand is a no-op for a one-step transition alt. For a **block** alt, lazily `GET /blocks/:childId` and reuse SET-5's read-only interior (the child-detail cache already exists on the workspace). For a **multi-step** alt, also list the primary steps the span covers, read-only, under `"Covers · read-only"`, so you can see which tracks you would skip.                                  |
| D17 | Header                              | Leave `plannedMetrics` alone. When `alternates.length > 0`, append a tertiary fact `{n} alternates · {m} mapped` (`m` = `valid === true`). Hidden at zero. An unmapped ghost is not counted. An incomplete-but-valid block still counts as mapped — the unfinished part is the child's interior, same posture as SET-5 D9.                                                                                                          |
| D18 | Remove                              | Immediate `DELETE`, toast `"Alternate removed"`. No `ConfirmDialog` unless some `versions[].alternateIds` still points at it (possible via API before SET-7), in which case confirm `"This alternate is used in N saved versions"` and then delete — version choices already cascade.                                                                                                                                               |
| D19 | `+ alt` on block-connector gaps     | Same control as transition gaps. A 1-step alt on a block unit is "a different connector for this pair"; a multi-step span that starts on a unit host is allowed. Do not invent a second picker.                                                                                                                                                                                                                                     |
| D20 | Authoring lives on blocks           | `canAuthorAlternates(kind)` is true only for `block`. `/sets/:id` omits `+ alt`, shift-click spans, alt rows, and the coverage line even if leftover API alts exist. `/blocks/:id` is the surface that grows the tree. Picking a nested block's version from a set is SET-7 — do not ship a stub switcher here.                                                                                                                     |

### Out of scope

- Versions, header switcher, resolved-path rendering, `alternate ·` chips, and picking a nested block's version from a set — SET-7.
- Overlap rejection across chosen alts — SET-7 (authoring many overlapping plan Bs is legal).
- Graph Set mode / off-script "Save as alternate" — SET-9.
- Follow-mode expansion of the chosen alt — SET-10.
- `AddToSequenceMenu` / `/add` sequence context — SET-8.
- Persisting an alternate with no connector. Schema XOR forbids it; do not migrate.
- Nested-block editing inside an expanded alt. Edit block is SET-5's navigation; this slice does not add it on alt rows.
- Auto-creating a block from a selected span — shipped later as [DJ-148](https://linear.app/dj-project-astradzhao/issue/DJ-148); plan: [`DJ148_MAKE_BLOCK_FROM_SPAN_PLAN.md`](./DJ148_MAKE_BLOCK_FROM_SPAN_PLAN.md).

---

## 5. Surfaces

### 5.1 One-step (the mockup)

```text
 ⠿ 02 [I] Innerbloom     122 · 9A   9:54   ↑ ↓ ✎ ✕
        │
        ├─ ⟶ blend · 16 bars · great   (+2 BPM)   Swap  Unlink  〜  + alt
        │  ⤷ alt · if the room is hot   echo out · 8 bars   remove
        │  ⤷ alt · if it stays mellow   Rapture run · 3 tracks   remove
```

`+ alt` opens the connector picker for `previous → this`. Pick, then the label dialog.

### 5.2 Multi-step span

Shift-click step 03 then step 05. Covered cards outline. Palette banner `Fits the selected span ·
Innerbloom → Opus`.

```text
 ⠿ 03 [I] Innerbloom     …          ← span start (fromStep)
        │
        ├─ ⚠ 3 transitions — pick one            Pick  〜  + alt
        │  ⤷ alt · if the room is hot   Rapture run · 3 tracks
        │       covers 2 steps · Innerbloom → Opus          Expand  remove
        │
 ⠿ 04 [O] Opus           …          ← covered, outlined
        │
        ├─ ○ no transition for this pair yet
        │
 ⠿ 05 [S] Strobe         …          ← toStep, outlined
```

The alt row lives under **03's** gap, not under 05. The connector is typed by
`(Innerbloom, Strobe)`, not by either primary-line join.

### 5.3 Ghost rejoin (unmapped span)

Same selection, zero matching connectors:

```text
        ├─ ⚠ 3 transitions — pick one            Pick  〜  + alt
        │  ○ no connector for this rejoin yet    Add transition
```

Add transition deep-links with `fromTrackId=Innerbloom&toTrackId=Strobe`. After the edge exists,
reload, pick it, label it. The ghost never hits `POST /alternates`.

### 5.4 Broken after reorder

Reorder so `fromStep` now sits after `toStep`. `spanRange` returns null, `valid` is false, the row
flips to destructive and is not followed. The primary line is untouched.

---

## 6. Interaction model: one writer, three entrances

All alternate writes go through `lib/sequences/api.ts`. The gap `+ alt`, a span-mode palette `+`,
and a span-mode drop are three **entrances** to `createSequenceAlternate`, never three
implementations.

```ts
type WorkspaceSelection =
  | { kind: "none" }
  | { kind: "step"; stepId: string }
  | { kind: "gap"; stepId: string }
  | { kind: "span"; fromStepId: string; toStepId: string };

type AlternateDraft = {
  fromStepId: string;
  toStepId: string;
  altTransitionId?: string;
  altBlockId?: string;
};
```

`spanRange(steps, fromStepId, toStepId)` is a pure client helper (do not import `blocks.ts`). It
returns `{ fromIdx, toIdx, predecessor, destination } | null`. `null` when either id is missing,
`fromIdx > toIdx`, or `fromIdx === 0`.

`alternatesForGap(alternates, stepId)` returns alts whose `fromStepId === stepId` (render site).

`alternateDesc(alt)` is `mixLabel(alt.altTransition)` or SET-5's `blockConnectorLabel(alt.altBlock, …)`.

`alternateCoverage(alternates)` → `{ total, mapped }` for the header.

After every mutation, replace local `SequenceDetail` with the response body (already the full
detail, including recomputed `valid` flags). A reorder that flips a span must show **broken**, not
the old mix as if it still applied.

---

## 7. File map

| Path                                                       | Disposition                                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `packages/library/src/blocks.ts`                           | edit — `altTransition` / `altBlock` on `SequenceAlternate` (D1)                                        |
| `packages/library/src/blocks.test.ts`                      | edit — bounding-step cascade; two-step span endpoint pair (D2)                                         |
| `apps/web/lib/sequences/types.ts`                          | edit — embeds on `SequenceAlternate`; `WorkspaceSelection` span variant                                |
| `apps/web/lib/sequences/api.ts`                            | edit — `createSequenceAlternate`, `updateSequenceAlternate`, `deleteSequenceAlternate`                 |
| `apps/web/lib/sequences/alternates.ts` + `.test.ts`        | **new** — `spanRange`, `orderSpan`, `alternatesForGap`, `alternateDesc`, `alternateCoverage`, ghost    |
| `apps/web/lib/sequences/drag.ts` + `.test.ts`              | edit — span-aware `insertIndex`, `paletteTransitionQuery`, reasons, dropFit/dropLabel                  |
| `apps/web/lib/sequences/metrics.ts` + `.test.ts`           | edit — header coverage helper (does not change `plannedMetrics`)                                       |
| `apps/web/components/sequences/alternate-list.tsx`         | **new** — stored rows + ghost unmapped row, expand, label, remove                                      |
| `apps/web/components/sequences/alternate-label-dialog.tsx` | **new** — required-label dialog, browse-create shape                                                   |
| `apps/web/components/sequences/sequence-gap.tsx`           | edit — `+ alt`; mount `AlternateList`                                                                  |
| `apps/web/components/sequences/block-connector-row.tsx`    | edit — `+ alt` on the block gap (D19)                                                                  |
| `apps/web/components/sequences/sequence-running-order.tsx` | edit — span/alt outline on covered step cards; Shift-click                                             |
| `apps/web/components/sequences/sequence-workspace.tsx`     | edit — span selection, draft → dialog → POST, header coverage, picker intent                           |
| `apps/web/components/sequences/library-palette.tsx`        | edit — span banner, footer, disable Tracks `+` in span mode                                            |
| `apps/web/components/sequences/connector-picker.tsx`       | unchanged API — workspace passes span endpoints; picker already lists transitions then complete blocks |

No migration. No change to `assertAlternateSpan`, `applyVersionToSteps`, cycle checks, or version
routes. `version-switcher.tsx` and `graph-set-rail.tsx` stay uncreated.

---

## 8. Phases

### Phase 1 — embeds + the two missing domain tests

- `altTransition` / `altBlock` on `hydrateAlternates`.
- D2 tests.

**Verify (unit):** after creating a 1-step alt, `getSequenceDetail` returns
`alternates[0].altTransition.technique`. After creating a 2-step block alt, `altBlock.title` is
set and `valid` is true. After `deleteSequenceStep(fromStep)`, `alternates` is empty and both
bounding tracks' remaining steps are still there.

### Phase 2 — one-step chrome (the mockup)

This phase alone is dogfoodable, and is worth landing even if span selection slips.

- `+ alt` on transition and block gaps.
- Connector picker → required-label dialog → `POST`.
- `alternate-list.tsx` under the gap; remove; inline label patch.
- Header `{n} alternates · {m} mapped`.
- Broken visual from a hand-made reorder (reload).

**Verify (manual):** on a linked gap with two transitions, `+ alt`, pick the other mix, label "if
the room is hot". The primary mix does not change. Remove the alt; the mix still does not change.
Unlink the primary; the alt row stays.

### Phase 3 — spans, palette retarget, ghost rejoin

- `WorkspaceSelection` span variant; Shift-click; clamp; `insertIndex` etc. compile and behave.
- Palette banner/footer; Tracks `+` disabled; Transitions/Blocks `+` authors the alt.
- Covered-step outline; multi-step row copy; expand covers-list + block interior.
- Ghost unmapped row + Add transition for the span pair.

**Verify:** Shift-click Innerbloom then Opus. Palette lists `A → C` connectors, not `A → B`. A
non-matching transition is disabled with "Does not fit the selected span". With zero `A → C`
edges, the ghost row appears and Add transition prefills both endpoints. Dropping a matching
block on the fromStep gap opens the label dialog and stores `from=Innerbloom's step`,
`to=Opus's step`, `altBlockId`. The interior tracks of that block are **not** loose steps on the
set.

### Phase 4 — staleness you can see

- Reorder a bounding step past its partner → broken row, toast on next write still from SET-1's
  opportunistic clear (display is enough; do not add a new clearer).
- Edit a child block's last track → parent alt `valid: false` on reload (endpoint drift).
- Delete a bounding step → alt gone, no dangling row.

**Verify:** none of those mutations change `plannedMetrics`. The header still says `N of N planned`
with `1 alternate · 0 mapped` when the only alt is broken.

---

## 9. Testing

Only tests that catch a bug a human or typecheck would miss.

| Test                                                                                            | Bug it catches                                                                                     |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `spanRange` / `orderSpan`: missing id, `fromIdx > toIdx`, `fromIdx === 0` → `null`              | A first-track alt 422s after the UI offered it, or a reversed shift-click writes swapped endpoints |
| `orderSpan` of `(step3, step1)` returns `(step1, step3)`                                        | Shift-click order leaks into the wire                                                              |
| `alternatesForGap` only returns alts whose `fromStepId` matches                                 | A 2-step alt duplicates under every covered gap                                                    |
| `alternateCoverage`: 2 valid + 1 `valid: false` → `{ total: 3, mapped: 2 }`                     | Header counts broken alts as mapped, or counts ghosts                                              |
| `insertIndex` / `paletteTransitionQuery` on `{ kind: "span" }`                                  | Palette `+` inserts a track into the line while you are authoring a plan B                         |
| `paletteTransitionQuery` span of `B..C` → `{ from: A, to: C }`                                  | Picker offers `A → B` mixes for a detour that has to land on C                                     |
| `dropFit` span-mode: matching `A → C` on fromStep gap → true; `A → B` → false; step/end → false | A drop authors an alternate whose endpoints do not match the span                                  |
| Library: 2-step block alt validates `A → C`, rejects `A → B`                                    | D2 — the whole reason spans exist                                                                  |
| Library: delete bounding step → alt gone                                                        | D2 — a `SET NULL` typo would leave a dangling span the editor cannot render honestly               |
| Library: embed round-trip on `altTransition` / `altBlock`                                       | Collapsed rows have ids and no titles                                                              |

Do **not** duplicate version-overlap, cycle rejection, or "IDs survive insert" — those already
exist. No render/snapshot tests. No Playwright.

`plannedMetrics` must keep returning the same numbers for a fixture that gains alternates — if a
test needs to lock that, add it next to the coverage helper, not by rewriting the planned-line
test.

---

## 10. Acceptance

Restated from the ticket against the verified tree:

- Single-step and multi-step alternates both work, including `A → B′ → C` (block over a 2-step
  span) and `A → C` (transition that skips the middle track).
- `+ alt` on a gap authors a one-step span; Shift-click authors a multi-step span; both use the
  same picker, palette, and POST.
- The label is required and is the condition ("if the room is hot"), not a leftover prototype
  string.
- Inserting or reordering steps **elsewhere** does not silently retarget an alternate: it stays
  anchored to the same step IDs. Reordering a bounding step so the span is no longer forward
  surfaces **broken**, not a wrong mix.
- Deleting a step that bounded a span clears the alternate rather than leaving it dangling.
- A selected span with no matching connector is a visible unmapped rejoin (`○` + Add transition),
  not a stored row and not a silent no-op.
- Alternate coverage is `{n} alternates · {m} mapped` in the header and does not change
  `N of N planned`. On a set, that line is absent.
- On `/sets/:id` there is no `+ alt`, no `⤷ alt` rows, and no span-selection mode.
- Side by side with the mockup, a one-step alt row on a **block** (`⤷ alt · label · desc`, `+ alt`
  on the gap) reads as the same product. Multi-step is the schema the mockup did not draw.

---

## 11. Implementation notes

- Branch `dj-116` from an up-to-date `main`. `pnpm` only, oxfmt, semantic tokens only.
- Type names: `SequenceAlternate`, never `alt` as a variable that could mean `altBlockId`.
- `insertIndex` currently does `selection.stepId` for every non-`none` kind. A span variant that
  compiles without updating that helper is a bug, not a skip.
- The child-detail cache from SET-5 can be reused for expanded block alts. Invalidate it on
  remove of that alt (optional — the next expand just refetches).
- Keep `moveUnit` / `reorderTo` / `spliceUnit` untouched. Alternates are not units; they do not
  participate in reorder.
- Every drag affordance needs a non-drag equivalent: `+ alt`, palette `+`, and the picker cover
  span authoring the same way SET-4 covered primary-line linking.
- Do not prefetch Graph, Follow, or the version switcher. Dead chrome teaches the wrong model
  (architecture §13).
