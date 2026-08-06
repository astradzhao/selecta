# Local MVP — canonical ticket order

> Source of truth for **what to implement next** and how the remaining Linear
> issues depend on one another.
>
> Project: [MVP — Add → Library → Graph](https://linear.app/dj-project-astradzhao/project/mvp-add-library-graph-08d4f2152899)
>
> Architecture decisions:
> [`NEXT_PRODUCT_ARCHITECTURE.md`](./NEXT_PRODUCT_ARCHITECTURE.md)
>
> Last reconciled with all Linear issues DJ-1–DJ-76: 2026-08-05

## How to use this file

- Linear is authoritative for issue status, assignment, and blocking relations.
- This file is authoritative for recommended serial order and parallel lanes.
- One Linear issue means one `dj-XXXX` branch. Do not combine adjacent tickets.
- Parent issues DJ-7, DJ-11, and DJ-9 are milestone trackers, not implementation
  branches unless their descriptions gain standalone work.
- Deferred tickets are intentionally outside local MVP acceptance. Do not pull
  them forward without evidence from dogfood or measurements.

## Product and data invariants

- Primary product surfaces are **Add**, **Library**, and **Graph**.
- Library views are **Tracks**, **Transitions**, and immutable **Submissions**.
- Postgres owns submissions, proposals/reviews, workflow state, and audit.
- Neo4j owns tracks and committed transitions.
- LLM output never writes Neo4j directly.
- Clear proposals commit independently of ambiguous siblings.
- Multiple A → B transition edges are valid and addressed by stable edge ID.
- `Genre`, `Subgenre`, and `Folder` remain distinct concepts; see
  [DJ-51](https://linear.app/dj-project-astradzhao/issue/DJ-51).

## Milestone state

### Complete

- **M0 — Local foundations**:
  [DJ-6](https://linear.app/dj-project-astradzhao/issue/DJ-6)
- **M1 — Local data foundation**:
  [DJ-10](https://linear.app/dj-project-astradzhao/issue/DJ-10)
- **M2 — Track discovery & library foundation**:
  [DJ-8](https://linear.app/dj-project-astradzhao/issue/DJ-8)

### Active

- **M3 — Durable transition extraction**:
  [DJ-7](https://linear.app/dj-project-astradzhao/issue/DJ-7)
  - current implementation:
    [DJ-66](https://linear.app/dj-project-astradzhao/issue/DJ-66)

### Remaining local MVP

- **M4 — Graph traversal & transition management**:
  [DJ-11](https://linear.app/dj-project-astradzhao/issue/DJ-11)
- **M5 — Unified Add & Library**
- **M6 — End-to-end local dogfood**:
  [DJ-9](https://linear.app/dj-project-astradzhao/issue/DJ-9)

## Recommended serial implementation order

This is the order for one developer/agent working one branch at a time.

### 1. Durable extraction core — now

1. [DJ-66 — Durable multi-transition agent orchestration + partial writes](https://linear.app/dj-project-astradzhao/issue/DJ-66)
   - Current branch.
   - Replaces non-durable `after()` execution with a durable workflow.
   - Adds per-transition proposal persistence, child parsing, batched resolve,
     partial commits, idempotency, reconciliation, and audit.

Completion closes the remaining implementation scope of M3/DJ-7. Adaptive
range reading is explicitly not required.

### 2. Stable transition domain/API

2. [DJ-73 — Transition identity + CRUD API for parallel Neo4j edges](https://linear.app/dj-project-astradzhao/issue/DJ-73)
   - Can run in parallel with DJ-66 only on a separate branch.
   - Establishes stable edge identity and targeted create/read/update/delete.
   - Unblocks both Library transition queries and Graph edge management.

### 3. Cross-store Library query contracts

3. [DJ-72 — Queryable Library APIs for tracks, transitions, and submissions](https://linear.app/dj-project-astradzhao/issue/DJ-72)
   - Blocked by DJ-66 and DJ-73.
   - Joins Neo4j committed data with Postgres submission/proposal state without
     copying unresolved proposals into the graph.

### 4. Intake and Graph surfaces

4. [DJ-74 — Unified Add page for tracks and transition submissions](https://linear.app/dj-project-astradzhao/issue/DJ-74)
   - Blocked by DJ-66.
   - Reuses Add Track and moves transition submission intake to `/add`.

5. [DJ-75 — Graph explorer: display and manage parallel transitions](https://linear.app/dj-project-astradzhao/issue/DJ-75)
   - Blocked by DJ-73.
   - Closes M4/DJ-11 after verification.

DJ-74 and DJ-75 may run in parallel once their independent blockers are done.

### 5. Unified Library workspace

6. [DJ-71 — Unified Library workspace: Tracks, Transitions, and Submissions](https://linear.app/dj-project-astradzhao/issue/DJ-71)
   - Blocked by DJ-72.
   - Removes Notes from top-level navigation and establishes the three Library
     views plus legacy redirects.

7. [DJ-67 — Track edit + delete APIs and Library controls](https://linear.app/dj-project-astradzhao/issue/DJ-67)
   - Follows DJ-71.
   - Adds missing track management and destructive relationship cleanup.

8. [DJ-36 — Library transition review for ambiguous extraction proposals](https://linear.app/dj-project-astradzhao/issue/DJ-36)
   - Blocked by DJ-66, DJ-72, and DJ-71.
   - Adds per-proposal edit/approve/reject without mutating source submissions.

DJ-67 and DJ-36 may run in parallel after DJ-71.

### 6. Local MVP dogfood and acceptance

9. [DJ-47 — Populate representative tracks, transitions, and submissions](https://linear.app/dj-project-astradzhao/issue/DJ-47)
   - Starts only after DJ-36, DJ-67, DJ-71, DJ-74, and DJ-75.
   - Creates realistic fixtures exclusively through product UI.

10. [DJ-45 — Run end-to-end Add → Library → Graph dogfood](https://linear.app/dj-project-astradzhao/issue/DJ-45)
    - Blocked by DJ-47.
    - Exercises normal, partial, stale/retry, provider-failure, and limit paths.

11. [DJ-48 — Measure extraction, catalog, Library, and Graph performance/cost](https://linear.app/dj-project-astradzhao/issue/DJ-48)
    - Blocked by DJ-45.
    - Measures 1-, 10-, and 100-transition extraction plus core UI/API latency.

12. [DJ-46 — Accept local MVP and triage post-MVP follow-ups](https://linear.app/dj-project-astradzhao/issue/DJ-46)
    - Blocked by DJ-45 and DJ-48.
    - Closes M3–M6 only after evidence-backed acceptance.

## Parallel lanes

When separate branches/agents are available:

```text
DJ-66 ───────────────┬──→ DJ-74 ───────────────────────────────┐
                    └──→ DJ-72 ←── DJ-73 ──→ DJ-75 ──────────┤
                              └──→ DJ-71 ──→ DJ-67 ──────────┤
                                           └──→ DJ-36 ──────┤
                                                            ▼
DJ-47 → DJ-45 → DJ-48 → DJ-46
```

Do not merge these lanes into one branch. The dependency join is DJ-47.

## Deferred / not on the local MVP critical path

These remain valid tickets, but have explicit evidence gates:

- [DJ-76 — Adaptive range reading for very long submissions](https://linear.app/dj-project-astradzhao/issue/DJ-76)
  - Build only after DJ-48 shows bounded whole-input orchestration is
    insufficient.
- [DJ-42 — Optional graph discovery suggestions](https://linear.app/dj-project-astradzhao/issue/DJ-42)
  - Build only after DJ-46 if sparse neighborhoods are a demonstrated problem.
- [DJ-63 — Settings AI workflow usage/cost](https://linear.app/dj-project-astradzhao/issue/DJ-63)
  - DJ-66 records raw usage; this later ticket aggregates it in Settings.
- [DJ-15 — Vercel deployment](https://linear.app/dj-project-astradzhao/issue/DJ-15)
  - Starts after local MVP acceptance in DJ-46.
- [DJ-16 — Authentication and multi-user tenancy](https://linear.app/dj-project-astradzhao/issue/DJ-16)
  - Starts after DJ-15 and DJ-46, or when a second real user requires it.

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

DJ-69 and DJ-70 were reconciled to Done after their merged commits were found
on `main`.

## Canceled / superseded inventory

- DJ-1–DJ-4 — Linear onboarding placeholders, not product work.
- DJ-30 — default-library/login flow deferred with auth.
- DJ-35 and DJ-38 — absorbed into the shipped DJ-34 pipeline foundation.
- DJ-39 — persisted Live session intentionally removed from local MVP.
- DJ-44 — bar stepper intentionally removed from current traversal UX.
- DJ-55 — standalone visualization superseded by the shipped explorer design.
- DJ-68 — standalone Notes list superseded by DJ-71 Library → Submissions.

Canceled issues must not be reopened merely because old architecture docs mention
them. Create a focused new issue if the underlying product requirement returns.

## Maintenance rules

- Update this file whenever a ticket is created, canceled, materially rewritten,
  or moved across the critical path.
- Keep blocking relations in Linear synchronized with this order.
- Mark parent trackers complete when their required children finish; deferred
  post-MVP tickets are detached from M3/M4 parents so they do not hold milestones
  open.
- Before starting a ticket, verify its blockers are Done and create its own
  `dj-XXXX` branch from an up-to-date `main`.
- After implementation, commit, push, and open/update the ticket PR according to
  repository workflow rules.
