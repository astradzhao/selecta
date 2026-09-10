# DJ-153 — See transition information on the Sets / Blocks workspace (task plan)

> Ticket: [DJ-153 — Add ability to see transition information on sets/blocks page when clicking on it](https://linear.app/dj-project-astradzhao/issue/DJ-153/add-ability-to-see-transition-information-on-setsblocks-page)
> Architecture: [`../SETS_ARCHITECTURE.md`](../SETS_ARCHITECTURE.md) §2.1–§2.2, §4.2–§4.3, §13
> Design source: SET-4 mockup has **no inspector**. Gap click already means “select this join for the palette.” This slice adds a compact facts panel under that join, matching Library mix facts and Graph’s neighbor expand — without leaving the night, and without Graph’s in-place edit.
> Predecessor: SET-4 gap rows ([`DJ114_SETS_WORKSPACE_PLAN.md`](./DJ114_SETS_WORKSPACE_PLAN.md)). SET-5 interiors ([`DJ115_BLOCK_CONNECTORS_PLAN.md`](./DJ115_BLOCK_CONNECTORS_PLAN.md)). SET-6 alt rows ([`DJ116_ALTERNATES_PLAN.md`](./DJ116_ALTERNATES_PLAN.md)).
> Status: **implemented** on `dj-153`.

You already pin a real graph edge onto every linked join. The running-order row only prints a
one-line mix label (`Cut · 40 bars · Great`) plus a BPM chip. Cut-out bar, come-in bar, intent, and
the global mix notes are sitting on `step.inTransition` and never appear. Clicking the gap selects
it for Swap / palette filter — it does not show the mix. To read the notes you wrote for that edge
you have to leave the night and open `/library/transitions/:id`.

That is the hole. Do not invent a second transition record, a sequence-local override, or a
workspace editor for the shared graph.

---

## 1. Goal

On `/sets/:id` and `/blocks/:id`, **click a linked mix** and read the mix: bars, technique, intent,
quality, notes. Stay in the two-pane workspace. Edit still happens on the Library record.

Same workspace, both kinds. A block is the same primitive opened in the same chrome.

---

## 2. What I verified (current tree)

`main` at `56c7d7f` (DJ-148). Do not rebuild any of it.

| Capability                        | Where                                                                                                                             | State                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Gap click selects for the palette | `onSelectGap` in `sequence-workspace.tsx` — toggle `{ kind: "gap" }`, switch palette to Transitions                               | **done**                                                       |
| One-line mix label                | `gapRowLabel` → `mixLabel(technique, barsOverlap, quality)` + BPM chip                                                            | **done** — this is all you see                                 |
| Mix payload on the step           | `SequenceStepTransition`: `fromBar`, `toBar`, `barsOverlap`, `technique`, `intent`, `quality`, `notes` via `loadTransitionEmbeds` | **done** — unused in the UI except the one-liner               |
| Full mix page                     | `TransitionView` on `/library/transitions/:id` (sleeves, 3-col bars, facts, notes, provenance)                                    | **done** — wrong place                                         |
| Graph expand-to-read (and edit)   | `NeighborDetail`: bars, notes, `TransitionFields` PATCH, delete                                                                   | **done** — Graph only. Do **not** port in-place edit into Sets |
| Interior mixes in a nested block  | `InteriorGap` in `block-connector-row.tsx` — same one-liner, **not clickable**                                                    | missing inspector, missing click                               |
| Alternate mix rows                | `AlternateList` — label + `alternateDesc`; Expand is for **block** alts only                                                      | missing inspector on transition alts                           |
| Sequence-local step note          | Track-card `✎` → `block_steps.note`                                                                                               | **done** — different field from `transitions.notes`            |
| Palette / picker mix rows         | `library-palette` / `ConnectorPicker` — technique · bars · quality for **candidates**                                             | **done** — not the pinned mix                                  |

No new API. `GET /blocks/:id` already embeds the fields. `GET /transitions/:id` is only needed if
we want provenance (source submission, confidence, timestamps). We do not, in this slice.

Architecture already forbids the tempting extra:

> Per-sequence connector overrides — Decided against: editing a transition edits the shared edge
> everywhere, and `block_steps.note` is the pressure valve. (§12)

---

## 3. The interaction, in pictures

Linked gap, unselected (today, unchanged):

```text
        ├─ ⟶ Cut · 40 bars · Great   −2 BPM   Swap  Unlink  〜
```

Click the gap (already selects it; palette still filters to this pair). **New:** facts open under
the row:

```text
        ├─ ⟶ Cut · 40 bars · Great   −2 BPM   Swap  Unlink  〜
        │    Cut out 40          Overlap 40          Come in —
        │    Technique Cut       Intent —            Quality Great
        │    Notes
        │    wait for the vocal to finish
        │    Open in library
```

Click the same gap again (existing toggle) — selection clears, panel closes, palette leaves
gap-filter. Swap / Unlink / 〜 / picker stay on the row; they do not replace the panel.

Available / unmapped / seam / block-connector header: no panel. There is no mix to inspect.
Expand a nested block and click an **inner** mix instead.

---

## 4. Locked decisions

| #   | Decision                      | Call                                                                                                                                                                                                                                                                                                                                |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Where the facts live          | **Under the mix row in the running order.** Not a dialog, not a route change, not a palette takeover. The palette stays the swap/link surface (§4.2).                                                                                                                                                                               |
| D2  | What click means              | First click on a linked transition gap **already** selects it. Show the panel iff `selection.kind === "gap"` and that step has `inTransition` and `displayGapState === "linked"`. Second click already deselects — that hides the panel. No extra gesture.                                                                          |
| D3  | Fields                        | The embed: Cut out (`fromBar`), Overlap (`barsOverlap`), Come in (`toBar`), Technique, Intent, Quality, Notes. Empty slots render `—`, same as `TransitionView`, so the grid does not jump. BPM chip stays on the row; do not repeat it. Key shift is still deferred (architecture §12 — free-form `musical_key`).                  |
| D4  | Read-only                     | **No PATCH /transitions from this workspace.** One link: **Open in library** → `/library/transitions/:id`. Graph keeps in-place edit; Sets does not. A night is the wrong place to mutate a shared edge.                                                                                                                            |
| D5  | Notes which                   | Panel shows `transitions.notes` (global). Sequence-local `block_steps.note` stays on the track card `✎`. Never write one from the other (§5.8 / §6).                                                                                                                                                                                |
| D6  | Sets and blocks               | Same component, both `/sets/:id` and `/blocks/:id`.                                                                                                                                                                                                                                                                                 |
| D7  | Nested interiors              | `InteriorGap` becomes clickable. Click toggles a **local** open state (not workspace `{ kind: "gap" }`), so expanding a child mix does not steal the parent palette / wrap-span selection. Same panel component.                                                                                                                    |
| D8  | Alternates                    | Transition-kind alt rows (`altTransition`) get the same panel, local toggle. Block-kind alts keep Expand for inner tracks; their header is not a mix. Broken alts: no panel.                                                                                                                                                        |
| D9  | Block connector header        | Purple unit row is a block, not a mix. No inspector there. Expand → click inner mixes (D7).                                                                                                                                                                                                                                         |
| D10 | Palette / picker rows         | Out of scope. Those rows are candidates, not the pin. Clicking `+` still links.                                                                                                                                                                                                                                                     |
| D11 | Compact, not `TransitionView` | No 192px sleeves, no provenance/confidence, no `BarChart` (viz tokens are Graph-only). Three-column bars + three-column facts + notes + link. Type: `text-eyebrow` labels, `text-numeric` / `text-body` values, `text-caption` link. Surfaces: `bg-surface-1 border-border`. Quality uses `Badge` + `qualityRankTone` like Library. |
| D12 | Picker + panel together       | Legal. Swap still opens `ConnectorPicker` under the same gap. The panel is the current pin; the picker is the replacement list.                                                                                                                                                                                                     |
| D13 | No new API / no extra fetch   | Render from `step.inTransition` / `item.altTransition`. If notes are long, `whitespace-pre-wrap` like `TransitionView`; no clamp that hides the reason you clicked.                                                                                                                                                                 |
| D14 | Wrap span / alt span          | A wrap span on a set is not a gap selection — no mix panel. An alt span on a block is also not a linked pin — no mix panel until you click a real mix row.                                                                                                                                                                          |

---

## 5. What this is not

- **Not SET-10 Follow.** Booth-sized now/next copy is DJ-120. This is the prep workspace.
- **Not Graph NeighborDetail.** Do not copy edit/delete/bar-chart into the running order.
- **Not SET-8.** Do not invent `returnTo` on the library link. A normal `<Link>` is enough. SET-8 owns add-context deep links.
- **Not DJ-152.** Play-at BPM on a step or edge is a different ticket.
- **Not in-row expansion of every mix at once.** Only the mix you clicked. A set with 20 joins must not become a wall of notes.

---

## 6. Implementation

### 6.1 Presentational panel

New `apps/web/components/sequences/mix-inspector.tsx`.

Props: `transition: SequenceStepTransition` (the embed is enough). Optional `fromTitle` / `toTitle`
only if the link caption needs them — it does not; Library’s page title is the pair.

Reuse `displayVocab` / `qualityRankTone` from `@/lib/transitions/vocab-labels`. Do not import
`TransitionView` or Graph `BarChart`.

Copy:

| Slot          | Label (eyebrow) | Empty                         |
| ------------- | --------------- | ----------------------------- |
| `fromBar`     | Cut out         | —                             |
| `barsOverlap` | Overlap         | —                             |
| `toBar`       | Come in         | —                             |
| `technique`   | Technique       | —                             |
| `intent`      | Intent          | —                             |
| `quality`     | Quality         | Unrated (muted), else badge   |
| `notes`       | Notes           | omit the Notes block if blank |
| link          | Open in library | always                        |

`stopPropagation` on the link so it does not toggle selection.

### 6.2 Primary gaps — `sequence-gap.tsx`

In `TransitionGapRow`, when `selected && state === "linked" && step.inTransition`, render
`<MixInspector transition={step.inTransition} />` under the row, still inside the rail column.

Do not change `onSelect` / picker / unlink / seam.

### 6.3 Nested interiors — `InteriorGap`

Promote to a small client component with `useState(open)`. Click the inner mix row to toggle.
`role="button"` + Enter/Space, same as `TransitionGapRow`. No Swap/Unlink on interiors (still
read-only copies of the child). **Open in library** is the escape hatch to edit.

### 6.4 Alternate mix rows — `alternate-list.tsx`

If `item.altTransition` and `item.valid`, clicking the mix description (not the label field, not
remove) toggles the same panel. Do not overload the existing Expand control — that means “show
inner tracks of a block alt.”

### 6.5 Docs when implementing

- Architecture §4.2: one sentence — selecting a linked mix also reveals the embed (bars, intent,
  notes) under the row; Open in library for the shared record.
- Architecture §11: DJ-153 row.
- This plan’s status line → implemented.

---

## 7. Tests

Skip a render test of the panel. Typecheck will catch missing fields.

Worth it only if we extract a pure helper that can silently drop notes or treat `linked` without
`inTransition` as inspectable:

- `canInspectMix(state, transition)` → true iff `state === "linked"` and `transition != null`.
  Catches wiring the panel to `available` / block headers / broken pins.

Otherwise no new test file.

---

## 8. How to verify in the browser

1. Open a set with a linked mix that has notes (Library → pick an edge you know). Click the gap.
   Panel shows bars / technique / intent / quality / notes. Palette still says it fits that pair.
   **Open in library** lands on `/library/transitions/:id` with the same numbers.
2. Click the gap again — panel gone, palette unfiltered. Swap still opens the picker; panel can
   sit above the picker while the gap stays selected.
3. Available / unmapped / seam / block header: click does **not** open a mix panel.
4. Expand a nested block, click an inner mix — panel opens, parent wrap-span / palette context
   unchanged.
5. On a block with a transition alternate, click the alt mix line — panel for `altTransition`,
   not the primary pin. Expand on a **block** alt still means inner tracks.
6. `/blocks/:id` matches `/sets/:id`.

---

## 9. Out of scope (do not sneak in)

| Item                                          | Why                                          |
| --------------------------------------------- | -------------------------------------------- |
| In-workspace edit of technique/bars/notes     | Shared edge; Library / Graph already edit it |
| Provenance, confidence, created/updated       | Library page facts                           |
| Sequence-local mix overrides                  | Architecture §12, rejected                   |
| Key-compat chip                               | Architecture §12                             |
| Follow-mode large type                        | DJ-120                                       |
| Palette-row inspector                         | Candidates, not the pin                      |
| `returnTo` on the library link                | SET-8                                        |
| Fetching `GET /transitions/:id` for the panel | Embed is sufficient                          |
