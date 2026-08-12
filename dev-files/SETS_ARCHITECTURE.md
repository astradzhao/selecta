# Sets and Blocks architecture

> Design record for **Blocks** — ordered, persisted, composable paths through the transition
> graph — and the **manual transition entry** path they require.
>
> Status: proposal. Not yet ticketed.
>
> Last updated: 2026-08-12
>
> Builds on [`NEXT_PRODUCT_ARCHITECTURE.md`](./NEXT_PRODUCT_ARCHITECTURE.md) (Add → Library →
> Graph product model) and [`TICKET_ORDER.md`](./TICKET_ORDER.md). Storage is one Postgres.

## 1. Why

Today the product answers _"what could come next?"_ — you walk the graph one hop at a time and
the trail lives in `sessionStorage` until you close the tab. There is no way to answer _"what am I
actually playing on Saturday, in order?"_

A DJ prepping a real gig does five things the app cannot express:

1. commits to a specific ordering of tracks;
2. commits to a specific transition for each pair in that ordering, out of several possible ones;
3. keeps short rehearsed runs that get reused across gigs, improvising the joins between them;
4. keeps a plan B for the slots where the room could go either way;
5. rehearses and follows the result later.

This document adds one primitive that covers all five without introducing a second source of
truth for the music domain.

## 2. Product model

### 2.1 There is one graph, and one sequence type

Two decisions frame everything else.

> **There is one graph.** It is `tracks` (nodes) + `transitions` (edges), globally shared. A
> sequence is a saved, ordered path through that graph. Sequences never own transitions.

> **A block and a set are the same thing.** Both are ordered runs of tracks with connectors
> between them. They live in one table, differentiated by a `kind` label that carries no
> behavioral rules of its own.

The user-facing framing "the graph is in Set mode or Freeform mode" is a property of the
**session**, not of the graph. Modeling it the other way — sequences that own private transitions
— would fork the domain, duplicate edges, and destroy the thing that makes this product work.

The payoff is a flywheel:

```text
Build a sequence  →  you must pick or author a connector for every gap
                  →  every transition you author is a real graph edge
                  →  the graph gets denser
                  →  future sequences are easier and Freeform gets better suggestions
```

Sequence-building becomes the highest-yield way to feed the graph, which is currently fed only by
pasting notes.

### 2.2 A connector is a transition or a block

The central abstraction:

```text
Connector = Transition | Block

both typed by (from_track, to_track)
```

A block exposes a derived `start_track_id` and `end_track_id`, which makes it type-compatible
with a transition. Anywhere you need to get from A to B, either will do. Three consequences:

- **Composition is free.** A block used as a connector is one opaque step in its parent.
- **Multi-track alternates are free.** A detour is just a block used as an alternate connector; no
  separate span-container concept is needed.
- **One picker.** "What can fill this gap?" is a single query over transitions and blocks with
  matching endpoints.

At the parent's level a block connector stores only the reference. The child's internals stay in
the child's rows and are reached by following the foreign key. The in-between tracks are still
played, so they appear in two places: collapsed-but-expandable in the editor, and inlined by
read-time expansion in Follow mode (§5.6).

### 2.3 The spine is tracks, not connectors

Sequence rows are **tracks**. Each row optionally carries the connector that gets you _into_ it.
Connectors are annotations on the joins; they are not the backbone.

This is not a stylistic choice. A connector-only chain breaks in three ways:

- **Consecutive gaps are unrepresentable.** `[c1, null, c3]` is fine because the missing join's
  endpoints can be read off its neighbors. `[c1, null, null, c4]` has two unknown tracks in the
  middle, and a fresh draft `[null, null, null]` carries no track information at all. Writing the
  running order first and working out the mixing later is the normal way a night starts.
- **Reorder stops typechecking.** Connectors are defined by their endpoints, so dragging step 5
  above step 3 does not move anything — it invalidates the chain. Drag-reorder is the core
  interaction of a running-order editor.
- **Deleting an edge would delete a track.** With tracks as the spine, deleting a transition in
  Library degrades a join; with connectors as the spine, it removes a track from the running order.

### 2.4 Alternates are substitutable spans; versions are choices

An **alternate** replaces a span of the primary line with one connector. Because a connector can
be a block, one mechanism covers every case:

| Want                                        | Alternate is                | Span     |
| ------------------------------------------- | --------------------------- | -------- |
| A different mix between the same two tracks | a transition                | 1 step   |
| A different route to the same track         | a block `A → … → B`         | 1 step   |
| A different track that rejoins              | a block `A → B′ → C`        | 2 steps  |
| A multi-track detour                        | a block `A → X → Y → Z → C` | 2+ steps |

A **version** is a named selection of alternates — not a copy of the sequence. The base path is
the version with no choices, so no special row is needed for it.

### 2.5 What this is not

| Not                                      | Why                                                                                                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| A playlist (`folders.kind = 'playlist'`) | Playlists are unordered tags. Sequences are ordered and carry connectors. Both stay; they answer different questions.                        |
| A container of transitions               | Transitions belong to the graph. A sequence points at them.                                                                                  |
| A live session                           | Follow mode is a presentation, not persisted performance state. Persisted live sessions were intentionally dropped (DJ-39) and stay dropped. |
| A submission                             | Submissions are immutable raw text. A sequence is a mutable working document.                                                                |

## 3. Vocabulary

- **Block** — a named ordered run of tracks. Row in `blocks`. Importable as a connector.
- **Set** — the same row with `kind = 'set'`. A night. Not offered in the connector picker.
- **Sequence** — either of the above, when the distinction does not matter.
- **Step** — one track in a sequence. Row in `block_steps`.
- **Connector** — what gets you into a step: a transition, or a block. Nullable.
- **Gap** — the join into a step. Derived, not a row.
- **Gap state** — `linked | available | unmapped | seam` (§4.3).
- **Seam** — a join deliberately left open, to be improvised. Excluded from completeness.
- **Alternate** — a connector that substitutes a span of the primary line. Row in
  `block_alternates`.
- **Version** — a named set of chosen alternates.
- **Tight / complete** — every gap in a sequence is linked, transitively. Required to import.
- **Freeform mode** — Graph traversal with no active sequence.
- **Set mode** — Graph traversal following a sequence.
- **Follow mode** — the card-first, one-track-at-a-time booth presentation.

Note for implementers: `Set` and `Block` both collide with globals or common React names. Use
`SequenceRecord`, `SequenceDetail`, `SequenceStep` in TypeScript, never `set` or `block` as a
variable.

## 4. UX design

### 4.1 Where sequences live

| Surface       | Route                      | Purpose                                                                          |
| ------------- | -------------------------- | -------------------------------------------------------------------------------- |
| Browse sets   | `/library?view=sets`       | Nights.                                                                          |
| Browse blocks | `/library?view=blocks`     | Reusable runs, with a completeness filter.                                       |
| Edit          | `/sets/:id`, `/blocks/:id` | Same editor component; `kind` changes the header and the default picker filters. |
| Traverse      | `/graph?set=:id`           | Graph in Set mode.                                                               |
| Follow        | `/graph?set=:id&follow=1`  | Booth presentation.                                                              |

Primary nav stays **Add · Library · Graph**.

### 4.2 The editor

A single vertical column: tracks as cards, gaps as connectors between them. This is the shape a
DJ already thinks in, and it makes the incomplete parts impossible to miss.

```text
┌────────────────────────────────────────────────────────┐
│ Sunset rooftop                        47 min · 11 tracks
│ 8 of 8 planned · 2 seams              v1 base ▾
│                                       [Follow] [Open in graph]
└────────────────────────────────────────────────────────┘

 ⠿ 1  ▮ Midnight City          M83         124 BPM  8A
      │
      ├─ blend · 16 bars · great                  ✎  ⇄       ← linked
      │
 ⠿ 2  ▮ Innerbloom              RÜFÜS      122 BPM  9A
      │  ⤷ alt · if the room is hot
      │       ▸ Rapture → Opus                    (block, 2 steps)
      │
      ├─ ⚠ 3 connectors available — pick one                 ← available
      │
 ⠿ 3  ▮ Opus                    Eric Prydz 126 BPM  4A
      │
      ├─ ▸ Acid build            4 tracks · Opus → Strobe    ← block connector
      │
 ⠿ 4  ▮ Strobe                  deadmau5   128 BPM  9B
      │
      ├─ 〜 open seam · improvise                            ← seam
      │
 ⠿ 5  ▮ Sun Rising              Blue Six   120 BPM  7A

      [ + Add track ]  [ + Insert block ]
```

Behaviors:

- **Drag to reorder** the primary line. Reordering is the operation most likely to invalidate
  connectors, so affected gaps visibly flip state immediately (§5.7).
- **Append / insert** inline: library track search, or the connector picker for a whole block.
  Neither should require leaving the page.
- **Block connectors render collapsed** — one row showing the name, track count, and endpoints.
  Expand to view read-only. **Detach to a copy** inlines its steps and makes them editable, for
  when you want this night's version to differ.
- **Mark a join as a seam** from the gap menu. Seams are the point of the feature for nights built
  from blocks (§4.3).
- **Add alternate** from a gap or a selected span: pick a connector, write the condition label.
- **Version switcher** in the header. Switching re-renders the resolved path; editing while a
  non-base version is active edits the underlying sequence, not the version.
- **BPM delta** on every gap from `tracks.bpm`. Key compatibility is deferred (§12).
- **Step note** — a per-step reminder ("kill the bass early"). Distinct from `transitions.notes`,
  which is global truth shared by every sequence. Performance reminders must not pollute the graph.
- **Runtime** from `tracks.duration_sec`, minus overlap where known. Approximate; label it so.

### 4.3 Gap states

| State         | Condition                                       | Counts toward completeness | Primary action                                                |
| ------------- | ----------------------------------------------- | -------------------------- | ------------------------------------------------------------- |
| **linked**    | Connector set and valid                         | yes (satisfied)            | Edit, or swap to a sibling                                    |
| **available** | No valid connector, but ≥1 exists for this pair | yes (unsatisfied)          | One click to pick, ranked with `compareNeighborhoodNeighbors` |
| **unmapped**  | No connector exists for this pair               | yes (unsatisfied)          | **Add transition** → manual form (§9)                         |
| **seam**      | Deliberately left open                          | **no**                     | Unmark, or plan it after all                                  |

The first three are derived. **Seam is intent, so it is the only one that needs storage.**

Seams matter because they are how a night made of blocks is honestly represented. Without them,
`8 of 10 mapped` nags you to fill in exactly the two joins you meant to improvise. With them the
header reads `8 of 8 planned · 2 seams`, and **a block is simply a run of linked gaps between two
seams**. That is the whole block-and-seams reality of real prep, expressed in a linear model.

A deliberate hard cut is not a state — it is a transition with `technique = "cut"`.

### 4.4 Graph: Freeform vs Set mode

The explorer already does the hard part: ranked next-options, hop, back, prefetch, artwork
flight. Set mode is an overlay, not a rewrite.

**Freeform** — unchanged, plus **"Save trail as a block."** This is the highest-value bridge in
the feature. The trail already exists ephemerally; promoting it is one POST, and because you
hopped real transitions the result arrives fully linked and immediately importable. It turns
exploration into a reusable asset.

**Set mode** (`/graph?set=:id`) — the explorer gains a rail:

- The **next on-script track is pinned to the top** of the next-options list.
- **Alternates for the current span sit immediately below**, tagged with their condition labels.
  This is what makes Set mode better than Freeform rather than merely narrower: at the moment of
  decision, the app surfaces the plan and the plan B you already thought through, above the
  generic ranked neighbors.
- **Arriving at a seam hands control back.** No on-script suggestion; the full ranked
  neighborhood, plus a marker for where the next block picks up. Improvising is the plan there.
- A slim strip shows position (`4 / 11`) and the next two or three steps.

**Going off-script** is an edit opportunity, not an error:

```text
You went to "Opus" — not in this set at step 5.

  [ Save as alternate ]  [ Insert here ]  [ Replace "Strobe" ]  [ Keep exploring ]
```

_Save as alternate_ attaches it to the current span with the traversed transition as its
connector and prompts for a label; the primary line is untouched. Taking an alternate is
on-script and produces no prompt.

### 4.5 Follow mode

`/graph?set=:id&follow=1`. Same session, denser presentation for a dark booth:

- Large **now playing** and **up next** cards; the connector's instructions (`fromBar`,
  `barsOverlap`, `technique`, plus the step note) rendered big and monospaced.
- Alternates for the upcoming span appear as chips: `or — if the room is hot · Rapture`.
- Block connectors are **expanded inline** (§5.6). The booth never sees nesting.
- `→` / `Space` advance, `←` back.
- **Jump to any step.** "Ten minutes left, go to the closer" is the most common real deviation,
  and it is a skip rather than a branch. Jumping shows the skipped span as unplayed and needs no
  schema support.
- Progress is client-side only, consistent with DJ-39.

### 4.6 Add integration

**Transition mode gets a method switch.** Today `/add?mode=transition` always goes through the
LLM:

```text
Add        [ Track ] [ Transition ]
Method     [ Describe it ] [ Fill it in ]
```

_Describe it_ (`method=notes`, default) is the existing submission → proposal → review pipeline,
unchanged. _Fill it in_ (`method=manual`) is a direct form (§9) that writes one `transitions` row.
Worth building on its own merits: today the only manual entry points are the Graph explorer's
inline panel and raw API calls.

**Both modes accept a sequence context** via `sequenceId`, `stepId`, `from`, `to`, `returnTo`:

| Deep link                                                              | Behavior                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/add?mode=track&sequenceId=X&returnTo=/sets/X`                        | Creates the track **and** appends it, then returns.                                                                                                                                                                                           |
| `/add?mode=transition&method=manual&from=A&to=B&sequenceId=X&stepId=Y` | Endpoints prefilled and locked; on save, creates the transition and links that gap.                                                                                                                                                           |
| `/add?mode=transition&method=notes&sequenceId=X`                       | Notes path with a banner. Best-effort: committed transitions are offered as gap candidates on return, never auto-linked, because proposals are async and may need review (see [DJ-98](https://linear.app/dj-project-astradzhao/issue/DJ-98)). |

Inline-first is the rule. The `/add` deep links exist for the heavyweight cases only: importing a
track that is not in the library yet, and authoring a brand-new transition with full fields.

### 4.7 "Add to…" everywhere

One reusable popover (`AddToSequenceMenu`) on track detail, library rows, graph cards, and
transition detail. Lists recent sets and blocks plus **New…**, appends on click with an undo
toast.

## 5. Data model

Four new tables. Migration `0010_blocks.sql`, generated with `pnpm db:generate` after editing
`packages/db/src/schema.ts`.

```ts
export const blocks = pgTable(
  "blocks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    kind: blockKind("kind").notNull().default("block"), // 'block' | 'set'
    title: text("title").notNull(),
    description: text("description"),

    // Derived caches (§5.5) — never written by hand.
    startTrackId: text("start_track_id").references(() => tracks.id, { onDelete: "set null" }),
    endTrackId: text("end_track_id").references(() => tracks.id, { onDelete: "set null" }),
    isComplete: boolean("is_complete").notNull().default(false),

    libraryId: text("library_id"), // mirrors tracks.library_id; multi-tenant hook
    createdAt,
    updatedAt,
  },
  (t) => [
    // The hottest query in the feature: "what can fill this A → B gap?"
    index("blocks_endpoints_idx").on(t.startTrackId, t.endTrackId),
  ],
);

export const blockSteps = pgTable(
  "block_steps",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    blockId: text("block_id")
      .notNull()
      .references(() => blocks.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),

    // The connector INTO this step. At most one; neither set means a gap.
    inTransitionId: text("in_transition_id").references(() => transitions.id, {
      onDelete: "set null",
    }),
    inBlockId: text("in_block_id").references((): AnyPgColumn => blocks.id, {
      onDelete: "set null",
    }),

    isSeam: boolean("is_seam").notNull().default(false),
    note: text("note"), // step-local; NOT graph truth
    createdAt,
    updatedAt,
  },
  (t) => [
    check(
      "block_steps_single_connector",
      sql`NOT (${t.inTransitionId} IS NOT NULL AND ${t.inBlockId} IS NOT NULL)`,
    ),
    index("block_steps_block_position_idx").on(t.blockId, t.position),
    index("block_steps_track_idx").on(t.trackId),
    index("block_steps_in_transition_idx").on(t.inTransitionId),
    index("block_steps_in_block_idx").on(t.inBlockId),
  ],
);

export const blockAlternates = pgTable(
  "block_alternates",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    blockId: text("block_id")
      .notNull()
      .references(() => blocks.id, { onDelete: "cascade" }),
    label: text("label"), // "if the room is hot"

    // Span replaced, anchored to step IDs — never positions (§5.3).
    fromStepId: text("from_step_id")
      .notNull()
      .references(() => blockSteps.id, { onDelete: "cascade" }),
    toStepId: text("to_step_id")
      .notNull()
      .references(() => blockSteps.id, { onDelete: "cascade" }),

    altTransitionId: text("alt_transition_id").references(() => transitions.id, {
      onDelete: "cascade",
    }),
    altBlockId: text("alt_block_id").references(() => blocks.id, { onDelete: "cascade" }),
    createdAt,
    updatedAt,
  },
  (t) => [
    check(
      "block_alternates_single_connector",
      sql`(${t.altTransitionId} IS NULL) <> (${t.altBlockId} IS NULL)`,
    ),
    index("block_alternates_block_idx").on(t.blockId),
  ],
);

export const blockVersions = pgTable("block_versions", { id, blockId, name, createdAt, updatedAt });

export const blockVersionChoices = pgTable(
  "block_version_choices",
  {
    versionId: text("version_id")
      .notNull()
      .references(() => blockVersions.id, { onDelete: "cascade" }),
    alternateId: text("alternate_id")
      .notNull()
      .references(() => blockAlternates.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.versionId, t.alternateId] })],
);
```

### 5.1 Why the structure is rows, not a JSON path

A `path` column holding a list of lists is the obvious first design and it costs three things.
Ids inside JSON have **no foreign keys**, so deleting a transition leaves a dangling reference the
database cannot tell you about, and the `ON DELETE SET NULL` degradation story disappears in
favor of scanning every sequence on every delete. **"Which sets use this block?"** stops being an
indexed join, and that query drives the edit-propagation warnings. And every edit becomes a
read-modify-write of the whole blob, so concurrent changes clobber.

Rows lose nothing: `path[i][j]` is exactly a step at `position = i` plus alternates anchored to it.

### 5.2 Why versions are two tables

A version activates N alternates, which does not fit in one row without an array or JSON column —
the same trade rejected in §5.1, for the same reasons. The join table also answers "which versions
use this alternate?", which is what lets the UI warn _"deleting this alternate changes 2 saved
versions"_ before the fact.

Resolution: read steps ordered by position, read the version's chosen alternates, and for each,
splice out `fromStepId..toStepId` and splice in its connector. **Two chosen alternates must not
overlap the same step.** That cannot be a database constraint, so it is enforced at save time and
tested (§10).

### 5.3 Why spans and choices are anchored to IDs, not indexes

An index-based path such as `[0, 1, 0, 2, 2]` silently means something different the moment anyone
inserts a step, adds an alternate, or reorders. A saved version would point at the wrong tracks
with no error and no way to detect it. Step and alternate IDs are stable across insert and
reorder, and a deleted target surfaces through the foreign key instead of aliasing to a neighbor.

### 5.4 Why positions are not unique

`position` is an ordering hint, not identity. Reads sort by `(position, id)` and tolerate gaps in
the integer sequence. This avoids the class of bugs around non-deferrable unique constraints during
reorder, where an intermediate state legitimately has two rows at the same position. Reorder
rewrites all positions to `0..n-1` in one transaction; sequences are tens of rows, so full
renumbering beats any fractional-index scheme and keeps the API a plain array of step ids.

### 5.5 Derived caches

`startTrackId`, `endTrackId`, and `isComplete` are **derived**, stored only because the endpoint
index powers the connector picker. Treat them exactly as the repo already treats
`notes.extractionStatus`: written by one function after any structural change, never as
independent state.

Completeness is **transitive** — a sequence is tight only if every gap is linked and every block
connector it uses is itself tight. A change deep in a nested block must invalidate its ancestors,
so recomputation walks upward through `block_steps.in_block_id` and `block_alternates.alt_block_id`.

Only tight blocks are offered in the connector picker. Incomplete ones are still saveable and
editable; they are just not importable, which is what keeps drafting possible (§2.3).

### 5.6 Read-time expansion

`getSequenceDetail(id, { expand })` returns either the authored structure (editor) or a fully
flattened track list (Follow mode and traversal). Expansion is what keeps the Follow cursor a
simple index rather than a path through a tree, which is the one place complexity would hurt most.

Expansion is bounded by a depth cap and short-circuits on any incomplete or broken connector,
surfacing it rather than silently dropping steps.

### 5.7 Nothing is trusted on read

Three kinds of staleness, all handled the same way — validate on read, report as broken, never
follow:

- **Stale pin.** A transition connector is stale when
  `transition.from_track_id ≠ previousStep.track_id ∨ transition.to_track_id ≠ step.track_id`.
  Reordering, inserting, replacing, and promoting all produce these.
- **Endpoint drift.** A block connector is stale when the child's derived endpoints no longer
  match the join. Editing a block's first or last track breaks every parent that references it,
  and `isComplete` does not protect against this.
- **Broken span.** An alternate whose `fromStepId`/`toStepId` no longer bound a contiguous span,
  or whose steps were deleted.

Stale references are cleared opportunistically on the next write. The invariant that matters is
that a stale reference is never displayed or followed as if it were valid.

### 5.8 Cycles

Block connectors make the reference graph a DAG that must be kept acyclic. Check on insert by
walking `in_block_id` / `alt_block_id` from the candidate and rejecting if it reaches the parent.
Combine with the depth cap from §5.6.

## 6. Invariants

- One graph. Sequences reference `transitions`; they never store transition properties.
- Blocks and sets are one table. `kind` is a filter label with no behavioral rules attached.
- The spine is tracks. Connectors annotate joins and are always nullable.
- A step has at most one connector.
- Only tight sequences are importable as connectors. Incomplete ones remain fully editable.
- Completeness is transitive and derived, never authored.
- Spans and version choices are anchored to IDs, never to positions or array indexes.
- Two chosen alternates in one version may not overlap the same step.
- Seams are excluded from completeness. They are the only gap state that is stored.
- The block reference graph is acyclic and depth-bounded.
- Stale pins, endpoint drift, and broken spans read as unlinked; they are never followed.
- Deleting a transition degrades a join. Deleting a sequence never deletes tracks or transitions.
- `block_steps.note` is sequence-local; `transitions.notes` is global. Never write one from the other.
- Authoring a transition from inside a sequence is a normal graph write with no `proposal_key`,
  indistinguishable from any other manual transition.
- Follow-mode progress is client-side only.

## 7. API surface

`apps/api`, following existing conventions (`{ ok: true, ... }`, `expectedUpdatedAt` for optimistic
concurrency as in the proposal review routes).

| Method           | Path                              | Notes                                                                                                                                                                       |
| ---------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`            | `/blocks`                         | `kind`, `q`, `complete`, `startTrack`, `endTrack`, `limit`, `offset`. The endpoint filters back the connector picker.                                                       |
| `POST`           | `/blocks`                         | `{ kind, title, seed? }`. `seed` is `{ trackIds }` or `{ trail }` — powers "Save trail as a block".                                                                         |
| `GET`            | `/blocks/:id`                     | Steps + connectors + **derived gap states** + alternates + versions + per-gap candidate counts. `?expand=1` for the flattened list, `?version=` to resolve one.             |
| `PATCH`          | `/blocks/:id`                     | `{ kind?, title?, description?, expectedUpdatedAt }`                                                                                                                        |
| `DELETE`         | `/blocks/:id`                     | Rejects with 409 if referenced as a connector, listing the referrers.                                                                                                       |
| `POST`           | `/blocks/:id/steps`               | `{ trackId, position? \| "append", inTransitionId?, inBlockId? }`. Cycle-checked.                                                                                           |
| `PATCH`          | `/blocks/:id/steps/:stepId`       | `{ trackId?, inTransitionId?, inBlockId?, isSeam?, note? }`. Validates endpoints; 422 on mismatch.                                                                          |
| `DELETE`         | `/blocks/:id/steps/:stepId`       | Clears alternates whose span it bounded.                                                                                                                                    |
| `POST`           | `/blocks/:id/reorder`             | `{ stepIds, expectedUpdatedAt }` — **full ordering**, one transaction. Idempotent and immune to the index-drift bugs of `{ stepId, toIndex }`. Rejects a mismatched id set. |
| `POST`           | `/blocks/:id/detach/:stepId`      | Inline a block connector's steps as editable rows.                                                                                                                          |
| `POST`           | `/blocks/:id/alternates`          | `{ fromStepId, toStepId, label?, altTransitionId? \| altBlockId? }`                                                                                                         |
| `PATCH`/`DELETE` | `/blocks/:id/alternates/:altId`   |                                                                                                                                                                             |
| `POST`           | `/blocks/:id/versions`            | `{ name, alternateIds }`. Rejects overlapping spans with 422.                                                                                                               |
| `PATCH`/`DELETE` | `/blocks/:id/versions/:versionId` |                                                                                                                                                                             |

No new transition-writing endpoint. Authoring an edge inside a sequence is:

```text
POST  /transitions                    → { transition }
PATCH /blocks/:id/steps/:stepId       → { inTransitionId }
```

Two calls, deliberately not atomic. If the second fails, the graph has gained a valid edge and the
gap simply shows as `available` with the new edge ranked first — recoverable, never corrupting.
**The transition is the durable artifact; the connector is a soft pointer.** A bespoke
transactional endpoint would buy nothing and add a second writer to the music domain.

### 7.1 DB layer

New module `packages/db/src/music/blocks.ts` alongside `tracks.ts` / `transitions.ts` /
`neighborhood.ts`. Gap-state derivation, completeness recomputation, expansion, cycle checks, and
staleness validation all live here — not in routes, not in the client — so Graph and Library agree
by construction. Reuse `MusicWriteError` and the helpers in `shared.ts`.

## 8. Web architecture

Thin async server pages, client components doing `apiFetch` against `/backend/*`. No server
actions, no react-query — consistent with the rest of `apps/web`.

| Path                                                 | Role                                                                    |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `app/sets/[id]/page.tsx`, `app/blocks/[id]/page.tsx` | Server shells → the same editor.                                        |
| `components/sequences/sequence-editor.tsx`           | Ordered line, drag reorder, inline append.                              |
| `components/sequences/sequence-gap.tsx`              | The four gap states and their actions.                                  |
| `components/sequences/connector-picker.tsx`          | Transitions **and** blocks for a given `(from, to)`.                    |
| `components/sequences/block-connector-row.tsx`       | Collapsed block step; expand, detach.                                   |
| `components/sequences/alternate-list.tsx`            | Spans, labels, add/remove.                                              |
| `components/sequences/version-switcher.tsx`          | Header control.                                                         |
| `components/sequences/graph-set-rail.tsx`            | Explorer overlay: on-script next, alternates, seams, off-script prompt. |
| `components/sequences/add-to-sequence-menu.tsx`      | Reusable popover (§4.7).                                                |
| `components/library/sequences-list.tsx`              | `/library?view=sets` and `?view=blocks`.                                |
| `components/tracks/manual-transition-form.tsx`       | §9.                                                                     |
| `lib/sequences/api.ts`, `lib/sequences/types.ts`     | Client API module.                                                      |

Extended:

| Path                                       | Change                                                                                                                                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/tracks/graph-session-store.ts`        | Add `sequenceId`, `versionId`, and `stepId`. The cursor is `stepId` — not `activeId` — because a sequence may contain the same track twice. Bump the storage key to `selecta.graph-session.v2`. |
| `components/tracks/graph-explorer.tsx`     | Mount `graph-set-rail`. Already 1151 lines; the overlay goes in its own component.                                                                                                              |
| `components/add/add-workspace.tsx`         | Method switch, sequence-context banner, `returnTo`.                                                                                                                                             |
| `components/library/library-workspace.tsx` | Sets and Blocks tabs.                                                                                                                                                                           |
| `lib/add/mode.ts`                          | Parse `method`, `sequenceId`, `stepId`, `from`, `to`, `returnTo`.                                                                                                                               |

Drag-and-drop: the repo has no DnD dependency. Ship reorder with `↑`/`↓` buttons — also the
accessible path — and add pointer dragging only if it proves necessary.

## 9. Manual transition entry

Independently useful, and a hard requirement for filling `unmapped` gaps.

**Route:** `/add?mode=transition&method=manual`

| Field                        | Control            | Required |
| ---------------------------- | ------------------ | -------- |
| From track / To track        | Track picker       | yes      |
| From bar / To bar / Overlap  | `TransitionFields` | no       |
| Technique / Intent / Quality | `TransitionFields` | no       |
| Notes                        | `TransitionFields` | no       |

Reuse is high. `components/tracks/transition-fields.tsx` already provides the field group, its
`TransitionFieldValues` type, and `parseTransitionFieldPatch`. The track picker should reuse the
candidate model proven in `proposal-endpoint-picker.tsx` — library search plus catalog search,
where a catalog hit imports on submit:

```ts
type EndpointSelection =
  | { kind: "track"; trackId: string }
  | { kind: "spotify"; providerId: string; title: string; artists: string[] };
```

Two improvements worth taking while building this:

- **Technique, intent, and quality should be comboboxes**, not free text. The allow-lists exist in
  `packages/db/src/music/constants.ts` and `packages/mix-notes`. Free text silently fragments the
  vocabulary that ranking depends on — `compareNeighborhoodNeighbors` sorts on `quality`, and a
  typo'd `"grate"` ranks as unknown. Keep free entry allowed; suggest the known values. Applies to
  the existing Library and Graph editors too.
- **No auto-reverse checkbox.** The AI path creates a `:rev` edge because the note said the mix
  works both ways. A manual mirror is a footgun: `fromBar`/`toBar` are not symmetric, and a mix
  that works A→B usually does not work B→A. If reverse authoring is wanted, make it an explicit
  step that opens a fresh prefilled form.

**On submit:** `POST /transitions`, then the connector `PATCH` and return to `returnTo` if a
sequence context is present; otherwise land on `/library/transitions/:id`.

## 10. Testing

Per repo policy, only tests for behavior that can silently break. Everything valuable here is a
structural invariant that a typecheck cannot catch:

| Test                                         | Bug it catches                                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Reorder invalidates connectors               | `A→B→C` reordered to `A→C→B` leaves a pin whose endpoints no longer match, and the editor shows a transition that does not exist between those tracks. |
| Endpoint drift on a referenced block         | Editing a block's first track silently breaks every parent using it as a connector; `isComplete` does not catch this.                                  |
| Transitive completeness                      | A change deep in a nested block must mark ancestors incomplete, or an untight block becomes importable.                                                |
| Cycle rejection                              | Block A importing B importing A hangs expansion.                                                                                                       |
| Version choices survive insert and reorder   | The index-vs-ID bug: a saved version silently pointing at different tracks after an unrelated edit.                                                    |
| Overlapping alternates rejected              | Two chosen alternates covering the same step make resolution ambiguous and order-dependent.                                                            |
| Reorder rejects a mismatched id set          | A stale client silently drops a concurrently-added step.                                                                                               |
| Seams excluded from completeness             | A night built from blocks reads as permanently unfinished, and the headline metric becomes noise.                                                      |
| Deleting a transition degrades, not cascades | A `cascade` typo would delete steps when a user cleans up an edge in Library.                                                                          |
| Duplicate track in a sequence                | A cursor keyed on `trackId` instead of `stepId` jumps to the wrong occurrence.                                                                         |
| Connector endpoint validation on `PATCH`     | Linking an arbitrary transition or block to the wrong gap.                                                                                             |

No render tests for editor chrome.

## 11. Implementation slices

Tracked under the epic [DJ-110](https://linear.app/dj-project-astradzhao/issue/DJ-110). One Linear
issue per slice, one `dj-XXXX` branch each. SET-1 lands the **complete** schema so no migration is
revisited; the richer surfaces arrive later.

| #          | Issue                                                           | Slice                                                                                                                                                                                                               | Depends on   |
| ---------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **SET-1**  | [DJ-111](https://linear.app/dj-project-astradzhao/issue/DJ-111) | Schema + `0010_blocks.sql` + `packages/db/src/music/blocks.ts`: gap states, derived caches with transitive completeness, expansion, cycle checks, staleness validation, reorder in one transaction. Tests from §10. | —            |
| **SET-2**  | [DJ-112](https://linear.app/dj-project-astradzhao/issue/DJ-112) | `apps/api` routes for blocks, steps, and reorder (§7).                                                                                                                                                              | SET-1        |
| **SET-3**  | [DJ-113](https://linear.app/dj-project-astradzhao/issue/DJ-113) | Manual transition mode on `/add` (§9) with the vocabulary comboboxes. Ships standalone value.                                                                                                                       | —            |
| **SET-4**  | [DJ-114](https://linear.app/dj-project-astradzhao/issue/DJ-114) | `/library` Sets and Blocks tabs + the editor for the primary line: append, remove, reorder, gap linking, seams. Transitions only as connectors.                                                                     | SET-2        |
| **SET-5**  | [DJ-115](https://linear.app/dj-project-astradzhao/issue/DJ-115) | Block connectors: connector picker over blocks, collapsed rows, expand, detach-to-copy, "Save trail as a block".                                                                                                    | SET-4        |
| **SET-6**  | [DJ-116](https://linear.app/dj-project-astradzhao/issue/DJ-116) | Alternates: spans, labels, and the alternate list.                                                                                                                                                                  | SET-4        |
| **SET-7**  | [DJ-117](https://linear.app/dj-project-astradzhao/issue/DJ-117) | Versions: API, switcher, overlap validation.                                                                                                                                                                        | SET-6        |
| **SET-8**  | [DJ-118](https://linear.app/dj-project-astradzhao/issue/DJ-118) | `/add` sequence context and `AddToSequenceMenu` across track and transition surfaces.                                                                                                                               | SET-3, SET-4 |
| **SET-9**  | [DJ-119](https://linear.app/dj-project-astradzhao/issue/DJ-119) | Graph Set mode: session-store cursor, rail, on-script next, alternates, seam handoff, off-script prompt.                                                                                                            | SET-5, SET-6 |
| **SET-10** | [DJ-120](https://linear.app/dj-project-astradzhao/issue/DJ-120) | Follow mode: expansion, alternate chips, keyboard stepping, jump-to-step.                                                                                                                                           | SET-9        |

If only part ships, make it SET-3 plus SET-1/2/4. That alone lets a user hand-author a full
running order with seams; blocks, alternates, and versions layer on without migration.

**Sequencing caveat:** this is a large jump for a product that has not been dogfooded (DJ-45 and
DJ-47 are still open). Landing the full schema early is deliberate, but do not build SET-5 through
SET-10 before using SET-4 on a real gig. The prep habits described in §1 are a hypothesis about
your own workflow, not a validated finding.

## 12. Deferred

| Item                                                             | Why                                                                                                                                                | Extension point                                                          |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Freezing played sets**                                         | Reference composition means editing a block rewrites nights you already played. Real, but not a v1 problem.                                        | An `archived_at` that snapshots to an expanded copy.                     |
| **Submission → sequence draft** (paste a tracklist)              | The orchestrator discovers spans in parallel with no ordering semantics. Tracked as [DJ-98](https://linear.app/dj-project-astradzhao/issue/DJ-98). | Proposals already store `sourceStart`, so document order is recoverable. |
| **Pathfinding across a seam** ("your next block is 2 hops away") | Needs DJ-42 discovery work. This is the feature seams unlock, and probably the strongest reason Set mode beats a printed list.                     | Shortest path over a small graph, surfaced in the seam handoff.          |
| **Key compatibility on gaps**                                    | `tracks.musical_key` is free-form; Camelot math needs normalization.                                                                               | BPM delta ships now; key slots into the same chip.                       |
| **Per-sequence connector overrides**                             | Decided against: editing a transition edits the shared edge everywhere, and `block_steps.note` is the pressure valve.                              | Nullable shadow columns on `block_steps`.                                |
| **Time anchors** ("closer must start by 1:50")                   | More likely to matter than branching, but needs runtime estimates to be trustworthy first.                                                         | A target timestamp per step, diffed against cumulative runtime.          |
| **Export** (Rekordbox / M3U / text)                              | Depends on DJ-77.                                                                                                                                  | Read-only projection of the expanded sequence.                           |
| **Sharing**                                                      | Blocked on auth (DJ-16).                                                                                                                           | `blocks.library_id` is present.                                          |

## 13. Decisions on record

| Question                                 | Decision                                                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Are blocks and sets different things?    | **No.** One table, one rule set. `kind` is a filter label. The "sets cannot be imported" restriction is a rule, not a shape, and can be relaxed without migration. |
| What is a connector?                     | **A transition or a block**, both typed by `(from, to)`. This gives composition and multi-track alternates from one mechanism.                                     |
| Is the spine tracks or connectors?       | **Tracks.** Connector chains cannot express consecutive gaps or a fresh draft, and make reorder structurally impossible.                                           |
| Is the structure JSON or rows?           | **Rows.** JSON loses foreign keys, the "which sets use this block?" query, and safe concurrent edits.                                                              |
| How are versions stored?                 | **Two tables**, choices anchored to alternate IDs. Array indexes silently realias on any insert or reorder.                                                        |
| Is completeness enforced?                | **No — computed.** It gates importability, never editing, so drafting stays possible.                                                                              |
| Composition by copy or reference?        | **Reference**, because a block connector is opaque at the point of use. Expansion happens at read time; "detach to a copy" is the escape hatch.                    |
| Does the notes/LLM path build sequences? | **Deferred**, [DJ-98](https://linear.app/dj-project-astradzhao/issue/DJ-98).                                                                                       |
