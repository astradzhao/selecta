# Local MVP — canonical ticket order

> Source of truth for **what to implement next** and how the remaining Linear
> issues depend on one another.
>
> Project: [MVP — Add → Library → Graph](https://linear.app/dj-project-astradzhao/project/mvp-add-library-graph-08d4f2152899)
>
> Architecture decisions:
> [`NEXT_PRODUCT_ARCHITECTURE.md`](./NEXT_PRODUCT_ARCHITECTURE.md) (product
> model) and [`PG_MIGRATION_REFACTOR.md`](./PG_MIGRATION_REFACTOR.md)
> (Postgres-only music store migration).
>
> Last reconciled with all Linear issues DJ-1–DJ-87: 2026-08-07

## How to use this file

- Linear is authoritative for issue status, assignment, and blocking relations.
- This file is authoritative for recommended serial order and parallel lanes.
- One Linear issue means one `dj-XXXX` branch. Do not combine adjacent tickets.
- Parent issues DJ-7, DJ-11, DJ-9, and DJ-80 are trackers, not implementation
  branches unless their descriptions gain standalone work.
- Deferred tickets are intentionally outside local MVP acceptance. Do not pull
  them forward without evidence from dogfood or measurements.

## Product and data invariants

- Primary product surfaces are **Add**, **Library**, and **Graph**.
- Library views are **Tracks**, **Transitions**, and immutable **Submissions**.
- **Target state (DJ-80): one Postgres owns everything** — submissions,
  proposals/reviews, workflow state, audit, AND the music domain (tracks,
  artists, vocab, transitions). Neo4j is being removed.
- Until DJ-84 (cutover) lands, Neo4j still serves tracks and committed
  transitions; do not build new features on it.
- LLM output never writes the music store directly (Neo4j today, Postgres
  music tables after migration). Parsers write proposals; deterministic
  policy/application code is the only music-store writer.
- Clear proposals commit independently of ambiguous siblings.
- Multiple A → B transition edges are valid and addressed by stable edge ID.
- `Genre`, `Subgenre`, and `Folder` remain distinct concepts; see
  [DJ-51](https://linear.app/dj-project-astradzhao/issue/DJ-51).
- Folder kinds are **`folder` | `playlist` only** (`section` dropped — DJ-81).
  Neo4j/`FOLDER_KINDS` may still list `section` until constants move in PG-2/PG-4.

## Milestone state

### Complete

- **M0 — Local foundations**:
  [DJ-6](https://linear.app/dj-project-astradzhao/issue/DJ-6)
- **M1 — Local data foundation**:
  [DJ-10](https://linear.app/dj-project-astradzhao/issue/DJ-10)
- **M2 — Track discovery & library foundation**:
  [DJ-8](https://linear.app/dj-project-astradzhao/issue/DJ-8)

### Merged on `main`, pending Linear closure

DJ-66, DJ-71, DJ-72, DJ-73, DJ-74 are merged to `main` (durable extraction,
Library workspace/APIs, transition identity/CRUD, unified Add). Close them in
Linear after verification; remaining M3 loose ends are DJ-78/DJ-79.

### Active / next

- **M4.5 — Postgres-only music store**:
  [DJ-80](https://linear.app/dj-project-astradzhao/issue/DJ-80) — **the
  current critical path**. Lands before all remaining feature work.

### Remaining local MVP after migration

- **M4 — Graph traversal & transition management**:
  [DJ-11](https://linear.app/dj-project-astradzhao/issue/DJ-11) (DJ-75 left)
- **M5 — Unified Add & Library** (DJ-67, DJ-36 left)
- **M6 — End-to-end local dogfood**:
  [DJ-9](https://linear.app/dj-project-astradzhao/issue/DJ-9)

## Recommended serial implementation order

### 1. Postgres migration — now (strictly serial)

1. [DJ-81 — PG-1: Postgres schema for music domain](https://linear.app/dj-project-astradzhao/issue/DJ-81)
   — tables + migration only; zero runtime change.
2. [DJ-82 — PG-2: Track + vocabulary helpers in `@selecta/db`](https://linear.app/dj-project-astradzhao/issue/DJ-82)
   — contract-parity `createTrack` / `listTracks` / lookups; no consumers.
3. [DJ-83 — PG-3: Transition helpers (CRUD, idempotent commit, neighborhood)](https://linear.app/dj-project-astradzhao/issue/DJ-83)
   — parallel-edge + `proposal_key` idempotency + ported ranking; no consumers.
4. [DJ-84 — PG-4: Cutover of API routes, agent services, workflow, FKs](https://linear.app/dj-project-astradzhao/issue/DJ-84)
   — import swaps, transactional proposal commit, SQL joins, FK upgrades.
   After this, Neo4j receives zero traffic.
5. [DJ-85 — PG-5: Remove Neo4j from the stack](https://linear.app/dj-project-astradzhao/issue/DJ-85)
   — delete package/driver/Compose/env/scripts/README references.
6. [DJ-87 — PG-7: Reconcile docs and open tickets](https://linear.app/dj-project-astradzhao/issue/DJ-87)
   — ARCHITECTURE/NEXT_PRODUCT_ARCHITECTURE updates + reword DJ-75/67/36/42/45/47/48.

Optional, decoupled:
[DJ-86 — PG-6: one-shot Neo4j → Postgres data export](https://linear.app/dj-project-astradzhao/issue/DJ-86)
— only if current local graph data is worth preserving; must run after DJ-81
and before DJ-85. Otherwise close as not-needed (DJ-47 repopulates via UI).

### 2. Remaining feature work (blocked by DJ-80)

7. [DJ-75 — Graph explorer: display and manage parallel transitions](https://linear.app/dj-project-astradzhao/issue/DJ-75)
   — closes M4/DJ-11 after verification.
8. [DJ-67 — Track edit + delete APIs and Library controls](https://linear.app/dj-project-astradzhao/issue/DJ-67)
   — deletion semantics become FK cascades post-migration.
9. [DJ-36 — Library transition review for ambiguous extraction proposals](https://linear.app/dj-project-astradzhao/issue/DJ-36)
   — approval uses the transactional commit path.

DJ-75, DJ-67, and DJ-36 may run in parallel on separate branches once DJ-84
has landed (DJ-85/DJ-87 do not block them functionally, but keep the serial
order when one agent works alone).

Loose M3 items [DJ-78](https://linear.app/dj-project-astradzhao/issue/DJ-78)
(editable notes + differential re-extraction) and
[DJ-79](https://linear.app/dj-project-astradzhao/issue/DJ-79) (strip bar cues
from search queries) are independent of the migration lane; DJ-79 is small and
may slot in anywhere, DJ-78 should wait until after DJ-84 to avoid building on
the saga.

### 3. Local MVP dogfood and acceptance

10. [DJ-47 — Populate representative tracks, transitions, and submissions](https://linear.app/dj-project-astradzhao/issue/DJ-47)
    — starts only after DJ-36, DJ-67, DJ-75 (and the migration lane).
11. [DJ-45 — Run end-to-end Add → Library → Graph dogfood](https://linear.app/dj-project-astradzhao/issue/DJ-45)
12. [DJ-48 — Measure extraction, catalog, Library, and Graph performance/cost](https://linear.app/dj-project-astradzhao/issue/DJ-48)
13. [DJ-46 — Accept local MVP and triage post-MVP follow-ups](https://linear.app/dj-project-astradzhao/issue/DJ-46)

## Parallel lanes

```text
DJ-81 → DJ-82 → DJ-83 → DJ-84 → DJ-85 → DJ-87
                  │        └──→ DJ-75 ──┐
                  │        └──→ DJ-67 ──┤
                  │        └──→ DJ-36 ──┤
                  └(DJ-86 optional,     │
                    before DJ-85)       ▼
                         DJ-47 → DJ-45 → DJ-48 → DJ-46

DJ-79 (small, independent) — any time
DJ-78 — after DJ-84
```

Do not merge these lanes into one branch. The dependency join is DJ-47.

## Deferred / not on the local MVP critical path

- [DJ-76 — Adaptive range reading for very long submissions](https://linear.app/dj-project-astradzhao/issue/DJ-76)
  — build only after DJ-48 shows bounded whole-input orchestration is
  insufficient.
- [DJ-42 — Optional graph discovery suggestions](https://linear.app/dj-project-astradzhao/issue/DJ-42)
  — build only after DJ-46; becomes SQL joins post-migration.
- [DJ-63 — Settings AI workflow usage/cost](https://linear.app/dj-project-astradzhao/issue/DJ-63)
- [DJ-77 — Rekordbox live-song integration](https://linear.app/dj-project-astradzhao/issue/DJ-77)
  — post-MVP exploration.
- [DJ-15 — Vercel deployment](https://linear.app/dj-project-astradzhao/issue/DJ-15)
  — after DJ-46; simplified by the migration (no Aura).
- [DJ-16 — Authentication and multi-user tenancy](https://linear.app/dj-project-astradzhao/issue/DJ-16)
  — after DJ-15 and DJ-46, or when a second real user requires it.

## Complete issue inventory

All completed issues are historical foundation and are not reordered:

- DJ-5, DJ-6, DJ-8, DJ-10
- DJ-12–DJ-14
- DJ-17–DJ-29
- DJ-31–DJ-34
- DJ-37
- DJ-40, DJ-41, DJ-43
- DJ-49–DJ-54
- DJ-56–DJ-62
- DJ-64, DJ-65
- DJ-69, DJ-70

Merged on `main`, pending Linear closure: DJ-66, DJ-71, DJ-72, DJ-73, DJ-74.

## Canceled / superseded inventory

- DJ-1–DJ-4 — Linear onboarding placeholders, not product work.
- DJ-30 — default-library/login flow deferred with auth.
- DJ-35 and DJ-38 — absorbed into the shipped DJ-34 pipeline foundation.
- DJ-39 — persisted Live session intentionally removed from local MVP.
- DJ-44 — bar stepper intentionally removed from current traversal UX.
- DJ-55 — standalone visualization superseded by the shipped explorer design.
- DJ-68 — standalone Notes list superseded by DJ-71 Library → Submissions.

Canceled issues must not be reopened merely because old architecture docs
mention them. Create a focused new issue if the underlying product requirement
returns.

## Maintenance rules

- Update this file whenever a ticket is created, canceled, materially
  rewritten, or moved across the critical path.
- Keep blocking relations in Linear synchronized with this order.
- Mark parent trackers complete when their required children finish; deferred
  post-MVP tickets are detached from M3/M4 parents so they do not hold
  milestones open.
- Before starting a ticket, verify its blockers are Done and create its own
  `dj-XXXX` branch from an up-to-date `main`.
- After implementation, commit, push, and open/update the ticket PR according
  to repository workflow rules.
