# DJ-119 — SET-9: Graph Set mode (task plan)

> Ticket: [DJ-119](https://linear.app/dj-project-astradzhao/issue/DJ-119)
> Architecture: [`../SETS_ARCHITECTURE.md`](../SETS_ARCHITECTURE.md) §4.4, §5.6, §8, §11–§12
> Predecessor: [`DJ117_VERSIONS_PLAN.md`](./DJ117_VERSIONS_PLAN.md) — SET-7 on `main` (`#104`)
> Design source: workspace **Open in graph** is in the mockup header; the explorer overlay is specified in Linear / §4.4, not in the HTML prototype
> Status: **implemented** on `dj-119`.

Traverse the graph while following a sequence. Every deviation is an edit, not an error.

Do not start this until SET-4 has been used on a real gig (architecture §11). SET-5, SET-6, and
SET-7 are already on `main`; this slice assumes that tree. Linear still lists DJ-115 / DJ-116 as
blockers in Backlog — that is stale; git is the authority.

---

## 1. Goal

`/graph?set=:id` is the same explorer as Freeform — ranked neighbors, hop, back, prefetch, artwork
flight — with a **rail** that knows the plan:

- On-script next pinned at the top of next-options.
- Alternates for the upcoming span directly under it, labelled with their conditions.
- The full ranked neighborhood still underneath. The set is a plan, not a cage.
- At a seam: no on-script nag; full neighborhood; a marker for where the next planned track picks
  up.
- Off-script hop: four actions (save as alternate / insert / replace / keep exploring).

Follow (`?follow=1`, booth chrome, jump-to-step) is **SET-10**. Omit it. Do not render a disabled
Follow button.

---

## 2. What I verified (current tree)

Read this before you start. Linear and architecture §8 were written against an older explorer.

### Paths and sizes are stale in the ticket

| Ticket / architecture §8 says                       | Actual tree                                                                                          |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `lib/tracks/graph-session-store.ts`                 | `apps/web/lib/graph/session-store.ts`                                                                |
| Bump storage key to `selecta.graph-session.v2`      | **Already v2** (SET-5 hop payloads). Freeform trails would be dropped by a v3 bump for no reason.    |
| `components/tracks/graph-explorer.tsx` (1151 lines) | `apps/web/components/graph/graph-explorer.tsx` (**122 lines**). Logic lives in `use-graph-explorer`. |
| Mount `graph-set-rail.tsx` because the file is huge | Still mount a separate overlay. Size is no longer the reason; ownership is.                          |

`/graph` only reads `?track=` today (`apps/web/app/graph/page.tsx`). After seed, `GraphSession`
strips the query so refresh restores from sessionStorage. Set mode uses the same pattern.

### Already shipped (do not rebuild)

| Capability                        | Where                                                                                           | State    |
| --------------------------------- | ----------------------------------------------------------------------------------------------- | -------- |
| Freeform explorer                 | `graph-explorer` + `use-graph-explorer` + `next-transitions` + `neighbor-card`                  | **done** |
| Session trail of hops             | `{ activeId, trail: { trackId, inTransitionId }[] }`, key `selecta.graph-session.v2`            | **done** |
| Save trail as a block             | `save-trail-dialog.tsx` → `POST /blocks { seed: { trail } }`                                    | **done** |
| Sequence workspace                | `/sets/:id`, `/blocks/:id` — header has version switcher (blocks) + delete; **no** graph button | **done** |
| Alternates, block-only            | SET-6 D20: `canAuthorAlternates` is `kind === "block"`                                          | **done** |
| Versions + nested pins            | SET-7. `GET /blocks/:id?expand=1&version=` already expands the **resolved** path                | **done** |
| `updateSequenceStep({ trackId })` | Domain + `parseUpdateStepBody`. Web client does **not** send `trackId` yet                      | **done** |
| Insert with pin                   | `addSequenceStep({ trackId, position, inTransitionId })`                                        | **done** |
| Stale downstream pins             | `clearStaleStepConnectors` inside `recomputeSequenceDerived`                                    | **done** |
| Duplicate-track expansion         | `packages/library` test `"addresses a duplicate track by step id"`                              | **done** |
| Alternate label dialog            | `alternate-label-dialog.tsx` — reuse for Save as alternate                                      | **done** |

`GET /blocks/:id?expand=1` returns both the base `steps` spine **and** `expansion.entries`:

```ts
type ExpandedSequenceEntry = {
  stepId: string;
  trackId: string;
  sequenceId: string; // owning sequence (parent or nested block)
  depth: number;
  inTransitionId: string | null;
  inBlockId: string | null;
};
```

Web `SequenceDetail` and `getSequence()` **drop this on the floor**: the client type has no
`expansion`, and the fetch never passes `expand` / `version`. SET-9's first server-shaped work is
plumbing that through, plus two missing fields on the entry (D8).

Expansion already skips a nested block's duplicated first track, honors `inBlockVersionId`, and
pushes seam steps through as ordinary entries (`if (step.isSeam || !step.inBlockId) pushStep`).
It does **not** currently include `isSeam` or a track title, which the rail needs without N+1
fetches.

### What the mockup gives you

The HTML prototype's **Open in graph** / **Follow** buttons toast
`"Graph Set mode and Follow land in SET-9 / SET-10"`. There is no explorer mock. Chrome for the
rail is invented here from §4.4 + the style guide, not copied from `oklch()` in the HTML.

Placement for the workspace button **is** in the mockup: header right cluster, left of Follow,
outline 32px. This slice ships **Open in graph** only.

---

## 3. Product model

Set mode is an overlay on the Freeform hop. The explorer does not grow a second traversal engine.

### 3.1 Play path

The cursor walks a **play path**: version applied, nested blocks expanded, seams kept.

```
GET /blocks/:id?expand=1[&version=:versionId]
→ expansion.entries[i] is position i of N
```

`session.stepId` is `entries[i].stepId`, not `activeId`. Same track twice is two entries with
different step ids (already true in the domain test). When the current entry came from a taken
alternate's interior, `session.alternateId` is set so we do not confuse that step with a primary
row that happens to share a track.

Progress copy is `i+1 / N` plus the titles of the next two or three entries.

### 3.2 On-script vs alternate vs seam vs off-script

Classification is by **destination track**, against the play path, at the moment of the hop.

| Hop destination                                         | Classification | UI                                                                                                                                   |
| ------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Next play-path entry's `trackId`                        | On-script      | Advance cursor to that entry. No prompt. Prefer the pinned `inTransitionId` if it exists.                                            |
| First hop of a **valid** alternate for the upcoming gap | On-script      | Advance onto that alternate (`alternateId` set). No prompt. Next suggestion follows the alt until it rejoins `toStep`.               |
| Anything else, while the outbound gap is a **seam**     | Seam improvise | No prompt (improvising **is** the plan). Cursor leaves the script until `activeId` matches a later play-path track, then snaps back. |
| Anything else, not a seam                               | Off-script     | Hop first, then the four-action dialog.                                                                                              |

A different mix into the **same** next track is on-script. Do not prompt just because the
transition id differs from the pin.

Taking an alternate is on-script even when the first track is not the primary next track (the
track-swap / detour case).

### 3.3 Upcoming gap and alternate pins

The upcoming gap is the inbound gap of `entries[i+1]`.

Alternate pins are valid alternates on the **owning sequence** of that next entry
(`entries[i+1].sequenceId`) whose `fromStepId === entries[i+1].stepId` (same helper as SET-6
`alternatesForGap`). Sets do not author alternates; pins appear when the next entry belongs to a
nested **block** (or when the sequence itself is a block).

If a version already consumed that span, the play path has already spliced it — those alts are the
path, not pins. Unchosen, non-overlapping alts still show.

### 3.4 Seam handoff

When `entries[i+1].isSeam` is true:

- Do **not** pin an on-script neighbor.
- Show a marker: `Improvise — next planned track is {title}`.
- Ranked neighborhood unchanged.
- Pathfinding ("your next block is 2 hops away") is architecture §12 / DJ-42. Out of scope.

Landing on that planned track later (via any route) resumes the script at the matching play-path
entry. If the track appears twice, pick the **first** not-yet-passed occurrence after the seam
(D12).

### 3.5 Off-script dialog

After hopping to a track that is neither next nor an alternate, while not on a seam:

```text
You went to "{title}" — not in this set at step {n}.

  [ Save as alternate ]  [ Insert here ]  [ Replace "{planned}" ]  [ Keep exploring ]
```

`n` is the 1-based index of the step you **left** (the planned slot you skipped). `{planned}` is
that next play-path title. On the last step there is no Replace.

The hop has already happened (trail + `activeId` updated). Back dismisses the dialog and pops the
trail, restoring the previous cursor.

---

## 4. Decisions

| ID  | Question                         | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Overlay vs rewrite               | Overlay. Freeform hop/back/prefetch/flight stay in `use-graph-explorer`. Set mode adds cursor fields, a rail, and a classify-on-hop hook. Do not fork the explorer.                                                                                                                                                                                                                                                                                                                                                                                         |
| D2  | Storage key                      | **Keep `selecta.graph-session.v2`.** Add optional `sequenceId`, `versionId`, `stepId`, `alternateId`. Missing keys parse as Freeform. Ticket's "bump to v2" is already done. A v3 bump would wipe in-progress Freeform trails.                                                                                                                                                                                                                                                                                                                              |
| D3  | Cursor                           | `stepId` + `alternateId \| null` on the play path. `activeId` remains the graph node (artwork, neighborhood). Never key Set-mode progress on `activeId`.                                                                                                                                                                                                                                                                                                                                                                                                    |
| D4  | Play path source                 | Server expansion. `GET /blocks/:id?expand=1` and `&version=` when the workspace had a version selected. Do not reimplement splice + nested expand on the client. Client `resolveVersionPath` stays the workspace preview helper.                                                                                                                                                                                                                                                                                                                            |
| D5  | Nested blocks                    | **Expand them** so a night of blocks is followable end to end. Opaque parent hops (start → end, skipping interior) would make Set mode worse than a printed list. Follow (SET-10) also expands; doing it here is not stealing that ticket — SET-10 is booth chrome on the same path.                                                                                                                                                                                                                                                                        |
| D6  | Sets vs blocks                   | Both open in Set mode. Alternate **pins** and **Save as alternate** only when `canAuthorAlternates(owningKind)` — i.e. the upcoming gap's owning sequence is a block. On a set spine gap: Insert / Replace / Keep exploring only; Save as alternate is omitted (not disabled). That is SET-6 D20, not a new rule.                                                                                                                                                                                                                                           |
| D7  | Versions                         | Honor SET-7 even though Linear's SET-9 blockers stop at SET-6. Workspace **Open in graph** passes the active version. Sets pass no version (nested pins live on steps and expansion already honors `inBlockVersionId`). Off-script writes always hit the **base** spine; toast `Saved to the base path` when `versionId` is set.                                                                                                                                                                                                                            |
| D8  | Expansion embed                  | Add `isSeam: boolean` and `track: { id, title, artists, artworkUrl }` on `ExpandedSequenceEntry` (hydrate via existing `getTrackSummariesByIds`). Rail and dialog copy must not N+1. `inTransitionId` is already there for preferring the planned edge.                                                                                                                                                                                                                                                                                                     |
| D9  | URL                              | `/graph?set=:id[&version=:id][&step=:id]`. After seed, `replaceState` to `/graph` (same as `?track=`). Refresh restores cursor from storage. `?track=` and `?set=` together: **set wins**, track ignored. `seedGraphSession` (track picker / track-detail Open in graph) **clears** set fields. `?follow=1` ignored.                                                                                                                                                                                                                                        |
| D10 | Open in graph                    | Workspace header, outline `size="sm"`, left of delete (and left of Follow's future slot). Disabled with `title="Add a track first"` when `displaySteps.length === 0`. Starts at play-path index 0 unless `?step=` is passed. No per-row "Open from here" in this ticket.                                                                                                                                                                                                                                                                                    |
| D11 | On-script row missing from graph | Still pin it. Synthesize a neighbor-shaped row: `Badge variant="brand"` `on script`, title, and if there is no outbound edge, a caption `No transition yet` plus a link to `addTransitionHref(from, to)`. Choosing a synthesized row with no edge does not hop. Do not hide the plan because the graph is incomplete — that is the whole point of authoring while traversing.                                                                                                                                                                               |
| D12 | Snap-back after a seam           | When `activeId` equals a later play-path `trackId`, resume at the earliest entry after the seam with that track. Duplicate tracks after the seam use step identity once resumed; the snap itself is first-match.                                                                                                                                                                                                                                                                                                                                            |
| D13 | Alternate first hop              | 1-step transition alt → destination is `toStep.trackId` (often the same as primary next — show as a labelled pin on that card, not a duplicate card). Block alt → first hop is the first expansion track after the duplicated start (same skip as `expandResolvedSteps`). Taking it sets `alternateId` and walks that connector's expansion until `toStep`.                                                                                                                                                                                                 |
| D14 | Save as alternate                | Attach the **traversed transition** as the connector. Span: (a) if destination equals a **later** play-path track on the same owning sequence, span `fromStepId = upcoming.stepId` … `toStepId = that later step` (skip/cut); (b) if destination equals upcoming track — should have been on-script, do not reach the dialog. (c) destination not on the path: dialog stays open, inline error `"{title}" is not on this {block\|set}, so it can't be an alternate yet. Insert it, or rejoin a planned track first.` Do **not** auto-create a detour block. |
| D15 | Insert here                      | `POST /steps` on the owning sequence of the **current** (pre-hop) entry, `position = currentIndex + 1` in **that** sequence's spine (not the flattened play-path index), `trackId = hopped track`, `inTransitionId = traversed`. Stale downstream pin on the old next step clears via recompute. Then set `stepId` to the new step and stay in Set mode.                                                                                                                                                                                                    |
| D16 | Replace "{planned}"              | `PATCH` the **upcoming** play-path step (the one you skipped): `{ trackId: hopped, inTransitionId: traversed }`. Downstream connector clears via recompute. Web `updateSequenceStep` must send `trackId`. Disabled when there is no upcoming step. Copy uses the planned title.                                                                                                                                                                                                                                                                             |
| D17 | Keep exploring                   | Clear `sequenceId` / `versionId` / `stepId` / `alternateId`. Keep `activeId` + trail. Explorer is Freeform. Sequence rows untouched. Rail unmounts.                                                                                                                                                                                                                                                                                                                                                                                                         |
| D18 | Edits inside a referenced block  | Insert / Replace / Save as alternate use `entries[i].sequenceId`. If that is not the sequence you opened (`session.sequenceId`), confirm first: `This edits "{childTitle}" everywhere it's used.` Reuse `ConfirmDialog`. That is the SET-5 footgun; do not silently patch a nested block from a set rehearsal.                                                                                                                                                                                                                                              |
| D19 | Back                             | `popGraphTrail` restores `stepId` / `alternateId` from the popped hop (new optional fields on `GraphTrailHop`). Freeform hops leave those null. If the off-script dialog is open, Back closes it as part of the pop.                                                                                                                                                                                                                                                                                                                                        |
| D20 | Next-options list                | `NextTransitions` gains an optional `pins` prefix. Pins render first (on-script, then alternates), then the remaining neighborhood **minus** those destination ids so the same card does not appear twice. Do not restyle the whole list. Pin chrome: `Badge variant="brand"` `on script` / `Badge variant="tertiary"` `{label}` for alts.                                                                                                                                                                                                                  |
| D21 | Trail vs cursor                  | Set-mode hops still push Freeform trail hops so **Save as block** keeps working. Each hop stores the pre-hop cursor so Back can restore it.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| D22 | Same-track hop guard             | `hopGraphSession` no-ops when `fromId === toId`. A sequence that lists the same track consecutively cannot advance. Do not change that guard in this ticket; consecutive duplicates are not a real prep pattern. Non-consecutive duplicates are the acceptance case.                                                                                                                                                                                                                                                                                        |
| D23 | Empty / 404 set                  | `?set=` that 404s: stay on Graph landing, `Alert` `Set not found.` Empty sequence: do not seed; toast `Add a track before opening in graph.`                                                                                                                                                                                                                                                                                                                                                                                                                |
| D24 | Save as block in Set mode        | Leave the button. Promoting the rehearsal trail is still useful. Out of scope to hide or retarget it.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

### Explicitly out of scope

- Follow mode, keyboard stepping, jump-to-step, booth typography (SET-10 / DJ-120).
- `?follow=1` handling beyond ignoring it.
- Pathfinding across a seam (DJ-42, architecture §12).
- SET-8 `AddToSequenceMenu` / `/library/add` sequence context.
- Auto-creating a detour block for Save as alternate.
- Client-side expansion that bypasses `GET ?expand=1`.
- Disabled Follow chrome in the workspace header.
- Changing ranking (`compareNeighborhoodNeighbors`).
- Persist Set-mode progress server-side (DJ-39 posture: client-only).

---

## 5. File map

| Path                                                   | Disposition                                                                                         |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `apps/web/lib/graph/session-store.ts`                  | Add set-cursor fields; trail hop cursor; `seedGraphSetSession`; `clearGraphSetCursor`; parse extras |
| `apps/web/lib/graph/session-store.test.ts`             | v2 payload with/without set fields; trail restore of `stepId`                                       |
| `apps/web/lib/graph/set-mode.ts`                       | **new** — play-path helpers, hop classification, pin list, off-script span proposal (pure)          |
| `apps/web/lib/graph/set-mode.test.ts`                  | **new** — the valuable tests (§8)                                                                   |
| `apps/web/lib/sequences/types.ts`                      | `expansion` on `SequenceDetail`; richer `ExpandedSequenceEntry`                                     |
| `apps/web/lib/sequences/api.ts`                        | `getSequence(id, { expand, versionId })`                                                            |
| `apps/web/lib/sequences/view.ts`                       | `graphSetHref(id, { versionId?, stepId? })`                                                         |
| `apps/web/app/graph/page.tsx`                          | Parse `set` / `version` / `step` alongside `track`                                                  |
| `apps/web/components/graph/graph-session.tsx`          | Seed set vs track; strip query; pass set payload into explorer                                      |
| `apps/web/components/graph/graph-explorer.tsx`         | Mount rail; pass pins into `NextTransitions`                                                        |
| `apps/web/components/graph/use-graph-explorer.ts`      | After hop, classify; expose `goToTrack` result (destination + transition) to the rail               |
| `apps/web/components/graph/next-transitions.tsx`       | Optional `pins` prefix; de-dupe remaining list                                                      |
| `apps/web/components/sequences/graph-set-rail.tsx`     | **new** — progress strip, seam marker, off-script dialog                                            |
| `apps/web/components/sequences/off-script-dialog.tsx`  | **new** — four actions; not `ConfirmDialog` (that primitive is 2-button)                            |
| `apps/web/components/sequences/sequence-workspace.tsx` | **Open in graph** in the header cluster                                                             |
| `packages/library/src/blocks.ts`                       | D8: `isSeam` + `track` on expansion entries                                                         |
| `packages/library/src/blocks.test.ts`                  | Expansion entries include `isSeam` and titles; seam still present in the path                       |

No new tables, no new routes, no Follow surface.

---

## 6. Session shape

```ts
type GraphTrailHop = {
  trackId: string;
  inTransitionId: string | null;
  fromStepId?: string | null;
  fromAlternateId?: string | null;
};

type GraphSessionState = {
  activeId: string | null;
  trail: GraphTrailHop[];
  sequenceId: string | null;
  versionId: string | null;
  stepId: string | null;
  alternateId: string | null;
};
```

`parseGraphSessionState` keeps today's v2 trail rules (drop v1 id arrays). Extra keys default to
`null`. `seedGraphSession(trackId)` resets set fields to null. `seedGraphSetSession({ sequenceId,
versionId, stepId, trackId })` sets those and clears the trail.

`useGraphSession()` already returns the whole snapshot; the rail reads set fields from it.

---

## 7. Implementation phases

Work on `dj-119`. Commit per phase if the diff is naturally split; one PR.

### Phase 1 — plumbing (nothing user-visible in the explorer)

1. D8 on `ExpandedSequenceEntry` + a focused domain test.
2. Web types + `getSequence(id, { expand: true, versionId })`.
3. Extend session parse/seed/clear. Tests for v2-with-set-fields and v2-without.
4. `graphSetHref` + graph page params + `GraphSession` seed/strip.
5. Workspace **Open in graph**. Clicking it lands on the first track in the **existing** Freeform
   explorer with set fields stored but no rail yet. That is an acceptable intermediate: you can
   verify seed/refresh/exit before overlay work.

### Phase 2 — pure set-mode helpers

`lib/graph/set-mode.ts` (client-safe, no React):

- `playPathFromDetail(sequence): PlayPosition[]` from `expansion.entries`.
- `classifyHop({ path, index, alternateId, destinationTrackId, upcomingAlts })`.
- `pinsForIndex(...)` → on-script pin + alternate pins.
- `skipSpanForOffscript(...)` → D14(a) span or `null`.
- `insertPositionOnOwner(ownerSteps, currentStepId)` → spine index + 1.

Tests in §8 land here. No UI yet.

### Phase 3 — rail: on-script, alts, seams, progress

1. `graph-set-rail.tsx`: strip `4 / 11` (`text-numeric`) + next two/three titles (`text-caption`).
   Link the sequence title to `sequenceWorkspaceHref`. Exit still clears the whole session
   (existing button).
2. Seam marker when upcoming `isSeam`.
3. `NextTransitions` pin prefix (D20, D11).
4. Hook `goToTrack` completion: advance `stepId` / `alternateId` on on-script; snap-back after
   seam (D12); do not prompt.

Manual check: follow a linked block end to end; follow a set of two blocks with a seam between
them; duplicate track in the middle does not jump to the first occurrence.

### Phase 4 — off-script dialog

1. `off-script-dialog.tsx` — four buttons, style-guide tokens, `text-body` copy from §3.5.
2. Save as alternate → existing `AlternateLabelDialog`, then `createSequenceAlternate`. D14(c)
   error stays in the off-script dialog.
3. Insert / Replace via existing step APIs (D15–D16). Nested-block confirm (D18).
4. Keep exploring (D17).
5. Back-to-dismiss (D19).

Reload expansion after Insert / Replace / Save as alternate so the play path matches the new
spine, then set the cursor onto the hopped track's new entry.

### Phase 5 — polish

- Empty / 404 (D23).
- Version toast on write (D7).
- `pnpm --filter @selecta/web test` and `pnpm format`.
- Browser pass (§9).

---

## 8. Tests

Only behavior that can silently break. No render tests for the rail.

| Test                                                                 | Bug it catches                                                         |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Parse v2 without set fields → Freeform                               | Shipping Set mode wipes existing explorer sessions.                    |
| Parse v2 with `stepId` round-trips                                   | Cursor lost on refresh; duplicate-track acceptance fails.              |
| Two play-path entries, same `trackId`, different `stepId`            | Architecture §10: cursor keyed on track jumps to the wrong occurrence. |
| Hop to next `trackId` is `on-script` even if transition id differs   | False off-script prompt on a perfectly planned slot.                   |
| Hop to an upcoming alt's first track is `on-script`                  | Taking plan B nags you.                                                |
| Hop to anything else when upcoming `isSeam` is `seam` not off-script | Seam handoff regresses to a nag.                                       |
| Hop to anything else otherwise is `off-script`                       | Wander is silent.                                                      |
| `skipSpanForOffscript` when dest equals a later step                 | Save as alternate spans the wrong pair (index vs id).                  |
| `skipSpanForOffscript` when dest is unknown → `null`                 | Would POST an alternate that 422s on endpoint mismatch.                |
| `pinsForIndex` omits on-script when upcoming is a seam               | Pinned nag at a seam.                                                  |
| `insertPositionOnOwner` uses spine index, not flattened index        | Insert inside a nested expansion writes the wrong parent position.     |

Domain: one test that expansion entries carry `isSeam: true` for a seamed step and still include
that step in `entries`.

Do not add `db:test` cases that restate SET-1 expansion. Do not snapshot the rail.

---

## 9. Browser verification (required before the PR)

No Playwright. Exercise as a user.

1. **Block, on-script.** Open a complete 4-track block → Open in graph. Follow the pinned row each
   hop. Strip reads `1 / 4` … `4 / 4`. Back restores the previous step, not merely the previous
   track.
2. **Duplicate track.** A block `A → B → A`. At first A, on-script is B. After B, on-script is the
   **second** A. Choosing A does not jump to step 1.
3. **Alternate (block).** Mapped 1-step alt with a condition label. It sits under on-script. Taking
   it does not open the off-script dialog. Next pin is the step after the span.
4. **Seam (set).** Set of two linked blocks with a seam between. Arriving at the last track of
   block 1: no on-script pin; marker names block 2's start. Neighborhood still listed. Hopping
   somewhere random does **not** prompt. Hopping onto the marked track resumes the script.
5. **Off-script four ways** (on a **block**, so Save as alternate exists):
   - Save as alternate onto a later track in the block (skip) → label → primary line unchanged,
     alt row appears in the workspace.
   - Save as alternate onto a track not in the block → error copy, no row.
   - Insert here → workspace has the new step, inbound pin is the hop, old next gap unlinked.
   - Replace → planned step's track is the hopped track; following gap unlinked.
   - Keep exploring → rail gone, sequence untouched.
6. **Set, no Save as alternate** on a set-owned gap (D6).
7. **Nested block footgun** (D18): from a set, wander while the cursor is inside an expanded child;
   Insert asks before editing the child.
8. **Refresh / Exit.** Mid-set refresh keeps the cursor. Exit then `/graph` is landing. Track
   detail **Open in graph** clears Set mode.
9. **Freeform unchanged.** `/graph` from nav, hop, Save as block, Exit — no rail, no prompt.

If browser tools are up, do this against `pnpm dev` at `http://localhost:3000`. If not, say so in
the PR and run the helper tests plus a curl of `GET /blocks/:id?expand=1`.

---

## 10. Acceptance (from Linear, restated against this plan)

- Follow a sequence end to end without leaving the explorer.
- Off-script hop offers all four actions **when the owning sequence can author alternates**; on a
  set spine, three actions plus Keep exploring. Save as alternate pins the traversed transition
  when the destination is already a later step.
- Arriving at a seam shows the full neighborhood and the next-block marker, with no on-script nag.
- A sequence containing the same track twice does not confuse the cursor.

---

## 11. Copy and tokens

- Progress: `text-numeric` for `4 / 11`, `text-caption` for upcoming titles.
- On-script badge: `Badge variant="brand"` `on script`.
- Alternate badge: `Badge variant="tertiary"` plus the condition label as `text-caption`. Do not
  use `variant="secondary"` (teal is button-only).
- Seam marker: `bg-surface-1` strip, `〜` is already the workspace seam glyph — reuse it.
- Off-script: `Dialog` (not `ConfirmDialog`, not `window.confirm`). Four `Button`s: default /
  outline / outline / ghost. Destructive is the wrong tone; this is an opportunity.
- Workspace **Open in graph**: `Button variant="outline" size="sm"`. No hex, no `oklch()`, no
  `tracking-[…]`.

---

## 12. Risks worth not rediscovering mid-PR

1. **`hopGraphSession` is fire-and-forget.** Classification must run off the hop arguments
   (`toId`, `transitionId`) plus the **pre-hop** cursor, not off `useGraphSession()` after render,
   or you will classify against the already-advanced index.
2. **Flattened index ≠ spine position.** Insert/Replace go through `entries[i].sequenceId` and
   that sequence's `steps` array. Using `i` as `position` on a set that contains a 5-track block
   writes off the end or into the wrong gap.
3. **1-step transition alts share a destination with on-script.** Dedupe by track id in the pin
   list; put the condition on the same card rather than rendering two Strobe rows.
4. **Linear blockers are stale.** Do not wait on DJ-115 / DJ-116 status. Do not rebuild expansion
   or alternate writes.

---

## 13. PR notes (when implementation finishes)

Title: `[DJ-119] Graph Set mode — on-script traversal, seam handoff, and off-script edits`

Linear: [DJ-119](https://linear.app/dj-project-astradzhao/issue/DJ-119/set-9-graph-set-mode-on-script-traversal-seam-handoff-and-off-script)
