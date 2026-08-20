# Local MVP — canonical ticket order

> Source of truth for **what to implement next** and how the remaining Linear
> issues depend on one another.
>
> Project: [MVP — Add → Library → Graph](https://linear.app/dj-project-astradzhao/project/mvp-add-library-graph-08d4f2152899)
>
> Architecture decisions:
> [`NEXT_PRODUCT_ARCHITECTURE.md`](./NEXT_PRODUCT_ARCHITECTURE.md) (product
> model) and [`PG_MIGRATION_REFACTOR.md`](./PG_MIGRATION_REFACTOR.md)
> (Postgres-only music store — **implemented**).
>
> Last reconciled with Linear issues DJ-1–DJ-131: 2026-08-20

## How to use this file

- Linear is authoritative for issue status, assignment, and blocking relations.
- This file is authoritative for recommended serial order and parallel lanes.
- One Linear issue means one `dj-XXXX` branch in general. DJ-85 + DJ-87 were
  intentionally combined in one PR (pure removal + docs). DJ-108 + DJ-131 were
  combined (graph explorer split + graph/track UI separation).
- Parent issues DJ-7, DJ-11, DJ-9, and DJ-80 are trackers, not implementation
  branches unless their descriptions gain standalone work.
- Deferred tickets are intentionally outside local MVP acceptance. Do not pull
  them forward without evidence from dogfood or measurements.

## Product and data invariants

- Primary product surfaces are **Add**, **Library**, and **Graph**.
- Library views are **Tracks**, **Transitions**, and immutable **Submissions**.
- **One Postgres owns everything** — submissions, proposals/reviews, workflow
  state, audit, and the music domain (tracks, artists, vocab, transitions).
- LLM output never writes music tables directly. Parsers write proposals;
  deterministic policy/application code is the only music-store writer.
- Proposal commit is one ACID transaction (`proposal_key` idempotency).
- Clear proposals commit independently of ambiguous siblings.
- Multiple A → B transition rows are valid and addressed by stable ID.
- `Genre`, `Subgenre`, and `Folder` remain distinct concepts; see
  [DJ-51](https://linear.app/dj-project-astradzhao/issue/DJ-51).
- Folder kinds are **`folder` | `playlist` only** (`section` dropped).

## UI cleanup epic (DJ-92) — implemented

Parent: [DJ-92 — UI Cleanup](https://linear.app/dj-project-astradzhao/issue/DJ-92).
Execution plan: [`UI_CLEANUP_PLAN.md`](./UI_CLEANUP_PLAN.md). Durable output:
[`UI_STYLE_GUIDE.md`](./UI_STYLE_GUIDE.md).

1. ~~[DJ-93 — UI-1 Semantic color](https://linear.app/dj-project-astradzhao/issue/DJ-93)~~
2. ~~[DJ-96 — UI-2 Type / space / radius](https://linear.app/dj-project-astradzhao/issue/DJ-96)~~
3. ~~[DJ-95 — UI-3 Theme switching](https://linear.app/dj-project-astradzhao/issue/DJ-95)~~
4. ~~[DJ-99 — UI-4 Retire `/notes`](https://linear.app/dj-project-astradzhao/issue/DJ-99)~~
5. ~~[DJ-100 — UI-5 Primitives](https://linear.app/dj-project-astradzhao/issue/DJ-100)~~
6. ~~[DJ-101 — UI-6 Layout composites](https://linear.app/dj-project-astradzhao/issue/DJ-101)~~
7. ~~[DJ-102 — UI-7 Formatters / hooks](https://linear.app/dj-project-astradzhao/issue/DJ-102)~~
8. ~~[DJ-103 — UI-8 FilteredListShell](https://linear.app/dj-project-astradzhao/issue/DJ-103)~~
9. ~~[DJ-104 — UI-9 TrackRow + TrackPicker](https://linear.app/dj-project-astradzhao/issue/DJ-104)~~
10. ~~[DJ-105 — UI-10 Status vocabulary](https://linear.app/dj-project-astradzhao/issue/DJ-105)~~
11. ~~[DJ-106 — UI-11 Forms](https://linear.app/dj-project-astradzhao/issue/DJ-106)~~
12. [DJ-107 — UI-12 A11y / interaction](https://linear.app/dj-project-astradzhao/issue/DJ-107) — **canceled**
13. ~~[DJ-108 — UI-13 Decompose graph explorer](https://linear.app/dj-project-astradzhao/issue/DJ-108)~~
    - ~~[DJ-131](https://linear.app/dj-project-astradzhao/issue/DJ-131)~~ (graph vs track folders)
14. [DJ-109 — UI-14 Lint guardrails + style guide](https://linear.app/dj-project-astradzhao/issue/DJ-109)
    — this PR; last ticket in the epic.

## Milestone state

### Complete

- **M0 — Local foundations**:
  [DJ-6](https://linear.app/dj-project-astradzhao/issue/DJ-6)
- **M1 — Local data foundation**:
  [DJ-10](https://linear.app/dj-project-astradzhao/issue/DJ-10)
- **M2 — Track discovery & library foundation**:
  [DJ-8](https://linear.app/dj-project-astradzhao/issue/DJ-8)
- **M4.5 — Postgres-only music store** (code + docs):
  [DJ-81](https://linear.app/dj-project-astradzhao/issue/DJ-81) …
  [DJ-85](https://linear.app/dj-project-astradzhao/issue/DJ-85) +
  [DJ-87](https://linear.app/dj-project-astradzhao/issue/DJ-87)
  (optional [DJ-86](https://linear.app/dj-project-astradzhao/issue/DJ-86)
  export only if needed before dogfood)

### Merged on `main`, pending Linear closure

DJ-66, DJ-71, DJ-72, DJ-73, DJ-74 are merged to `main` (durable extraction,
Library workspace/APIs, transition identity/CRUD, unified Add). Close them in
Linear after verification; remaining M3 loose ends are DJ-78/DJ-79.

### Active / next

- **M4 — Graph traversal & transition management**:
  [DJ-75](https://linear.app/dj-project-astradzhao/issue/DJ-75)
- **M5 leftovers**: [DJ-67](https://linear.app/dj-project-astradzhao/issue/DJ-67),
  [DJ-36](https://linear.app/dj-project-astradzhao/issue/DJ-36)
- **M6 — End-to-end local dogfood**:
  [DJ-9](https://linear.app/dj-project-astradzhao/issue/DJ-9)

## Recommended serial implementation order

### 1. Postgres migration — done

1. ~~[DJ-81 — PG-1](https://linear.app/dj-project-astradzhao/issue/DJ-81)~~ merged
2. ~~[DJ-82 — PG-2](https://linear.app/dj-project-astradzhao/issue/DJ-82)~~ merged
3. ~~[DJ-83 — PG-3](https://linear.app/dj-project-astradzhao/issue/DJ-83)~~ merged
4. ~~[DJ-84 — PG-4](https://linear.app/dj-project-astradzhao/issue/DJ-84)~~ merged
5. ~~[DJ-85 — PG-5](https://linear.app/dj-project-astradzhao/issue/DJ-85)~~ +
   ~~[DJ-87 — PG-7](https://linear.app/dj-project-astradzhao/issue/DJ-87)~~
   (this PR)

Optional:
[DJ-86 — PG-6: one-shot Neo4j → Postgres data export](https://linear.app/dj-project-astradzhao/issue/DJ-86)
— only if leftover local Neo4j data is worth preserving; otherwise close as
not-needed (DJ-47 repopulates via UI).

### 2. Remaining feature work

6. [DJ-75 — Graph explorer: display and manage parallel transitions](https://linear.app/dj-project-astradzhao/issue/DJ-75)
   — closes M4/DJ-11 after verification.
7. [DJ-67 — Track edit + delete APIs and Library controls](https://linear.app/dj-project-astradzhao/issue/DJ-67)
   — deletion uses FK cascades.
8. [DJ-36 — Library transition review for ambiguous extraction proposals](https://linear.app/dj-project-astradzhao/issue/DJ-36)
   — approval uses the transactional commit path.

DJ-75, DJ-67, and DJ-36 may run in parallel on separate branches.

Loose M3 items [DJ-78](https://linear.app/dj-project-astradzhao/issue/DJ-78)
(editable notes + differential re-extraction) and
[DJ-79](https://linear.app/dj-project-astradzhao/issue/DJ-79) (strip bar cues
from search queries) are independent; DJ-79 is small and may slot in anywhere.

### 3. Local MVP dogfood and acceptance

9. [DJ-47 — Populate representative tracks, transitions, and submissions](https://linear.app/dj-project-astradzhao/issue/DJ-47)
   — starts only after DJ-36, DJ-67, DJ-75.
10. [DJ-45 — Run end-to-end Add → Library → Graph dogfood](https://linear.app/dj-project-astradzhao/issue/DJ-45)
11. [DJ-48 — Measure extraction, catalog, Library, and Graph performance/cost](https://linear.app/dj-project-astradzhao/issue/DJ-48)
12. [DJ-46 — Accept local MVP and triage post-MVP follow-ups](https://linear.app/dj-project-astradzhao/issue/DJ-46)

## Parallel lanes

```text
DJ-81 → … → DJ-84 → DJ-85+DJ-87 (done)
                  └──→ DJ-75 ──┐
                  └──→ DJ-67 ──┤
                  └──→ DJ-36 ──┤
                               ▼
                    DJ-47 → DJ-45 → DJ-48 → DJ-46

DJ-79 (small, independent) — any time
DJ-78 — anytime after cutover
DJ-86 optional (legacy Neo4j data only)
```

Do not merge remaining feature tickets into one branch. The dependency join is DJ-47.

## Deferred / not on the local MVP critical path

- [DJ-76 — Adaptive range reading for very long submissions](https://linear.app/dj-project-astradzhao/issue/DJ-76)
  — build only after DJ-48 shows bounded whole-input orchestration is
  insufficient.
- [DJ-42 — Optional graph discovery suggestions](https://linear.app/dj-project-astradzhao/issue/DJ-42)
  — build only after DJ-46; SQL joins over artist/subgenre/folder.
- [DJ-63 — Settings AI workflow usage/cost](https://linear.app/dj-project-astradzhao/issue/DJ-63)
- [DJ-77 — Rekordbox live-song integration](https://linear.app/dj-project-astradzhao/issue/DJ-77)
  — post-MVP exploration.
- [DJ-15 — Vercel deployment](https://linear.app/dj-project-astradzhao/issue/DJ-15)
  — after DJ-46; Postgres-only (no Aura).
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
- DJ-81–DJ-84 (Postgres migration PG-1…PG-4)
- DJ-93–DJ-96, DJ-99–DJ-106, DJ-108, DJ-131 (UI cleanup UI-1…UI-13 except UI-12)

Merged on `main`, pending Linear closure: DJ-66, DJ-71, DJ-72, DJ-73, DJ-74.

## Canceled / superseded inventory

- DJ-1–DJ-4 — Linear onboarding placeholders, not product work.
- DJ-30 — default-library/login flow deferred with auth.
- DJ-35 and DJ-38 — absorbed into the shipped DJ-34 pipeline foundation.
- DJ-39 — persisted Live session intentionally removed from local MVP.
- DJ-44 — bar stepper intentionally removed from current traversal UX.
- DJ-55 — standalone visualization superseded by the shipped explorer design.
- DJ-68 — standalone Notes list superseded by DJ-71 Library → Submissions.
- DJ-107 — UI-12 a11y/interaction pass canceled; ConfirmDialog + lint bans in DJ-109 cover the leftover `window.confirm` sites.

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
