# Selecta next product architecture

> Decision record and implementation order for transition intake, durable extraction, review, Library, and Graph management.
>
> Last updated: 2026-08-05
>
> This document supersedes conflicting Notes UX and single-plan extraction guidance in `ARCHITECTURE.md` and `TICKET_ORDER.md`. The existing files remain useful historical context until they are fully reconciled.

## 1. Product model

The primary navigation becomes:

1. **Add**
2. **Library**
3. **Graph**
4. **Settings** later

### Add

`/add` is the only intake surface:

- **Add Track** reuses catalog search/import and manual track creation.
- **Add Transition** accepts free-form text describing one or many transitions.

Submitting transition text creates an immutable source record before processing begins. The request returns quickly with a durable workflow/submission ID; it does not wait for every transition to parse, resolve, and commit.

### Library

Library is the browse and management workspace:

- **Tracks** — search, filter, inspect, edit, and delete tracks.
- **Transitions** — search/filter committed edges and pending review proposals; manually add/edit/delete transitions.
- **Submissions** — read-only raw text previously surfaced as Notes, with processing counts, audit history, and links to resulting transitions/reviews.

Notes are no longer a top-level editable product object. Existing `notes` database naming may remain temporarily to avoid a risky mechanical migration, but product/API language should move toward **submission**.

### Graph

Graph remains the traversal surface. It also provides contextual transition management:

- display every transition edge between the current track and a target;
- add another transition for a pair;
- edit or delete one selected edge;
- retain traversal state after a mutation.

## 2. Domain boundaries

Use these terms consistently:

- **Submission** — immutable raw user text stored in Postgres.
- **Proposal** — one parsed candidate transition stored in Postgres, whether clear, ambiguous, rejected, or failed.
- **Review item** — a proposal whose deterministic gates require user input.
- **Transition** — one committed Neo4j `TRANSITION` relationship with stable identity.
- **Workflow run** — durable orchestration/audit for one submission version.

Storage ownership:

- Postgres owns submissions, proposals, review state, workflow state, model usage, retries, and audit.
- Neo4j owns tracks and committed transitions.
- Unresolved or temporary proposals never become Neo4j edges.

There is no cross-database transaction. Use an idempotent saga:

1. persist proposal/application intent in Postgres;
2. create/update the Neo4j edge by stable identity/idempotency key;
3. mark the proposal committed in Postgres;
4. reconcile any interrupted write where Neo4j succeeded but the final Postgres update did not.

## 3. Durable extraction architecture

### 3.1 Selected design

Use one bounded orchestration agent per submission. Its job is transition-boundary discovery and dispatch, not detailed extraction or graph mutation.

For the first version, the agent receives the entire submission within a configured input limit. Its only tool is:

```text
parse_single_transition({
  submissionId,
  extractionVersion,
  ordinal,
  sourceStart,
  sourceEnd,
  sourceText,
  sourceFingerprint
}) -> {
  ok,
  proposalId,
  retryable
}
```

The parent may issue several `parse_single_transition` calls in one model step and those child calls may execute concurrently. The complete child JSON is persisted by the tool and is not returned to parent context; only the minimal receipt returns.

Each tool execution:

1. claims an idempotency key;
2. performs one cheap structured-output model call for exactly one transition;
3. validates the draft;
4. persists the proposal and model audit;
5. returns a minimal receipt.

After all discovered spans have durable proposal records, deterministic application code:

1. deduplicates track search queries across proposals;
2. batches local-library and Spotify resolution;
3. reuses existing tracks by external ID;
4. evaluates policy independently per proposal;
5. imports required tracks and commits eligible transitions;
6. leaves only unsafe proposals in review.

### 3.2 Safety boundary

The parsing model and its tool do **not** write Neo4j.

Giving a parser direct graph mutation authority would couple uncertain model output to irreversible writes, make retries harder to reason about, and bypass shared resolution/policy gates. The parser writes a durable Postgres proposal. Parameterized deterministic application code is the only graph writer.

Likewise, a failed child should normally be retried by the durable runtime, not by asking the parent model to redispatch it. Model-driven retries waste tokens and can create duplicate source spans. After bounded runtime retries are exhausted, persist a failed/reviewable proposal outcome.

### 3.3 Durability

Use a durable workflow runtime with retryable, observable steps. The selected fit for the Vercel/Next.js stack is Vercel Workflow DevKit:

- workflow function: orchestration and durable sequencing;
- step functions: model calls, Postgres, Spotify, and Neo4j operations;
- persisted step results: crash/replay safety;
- bounded retries for transient failures.

Before implementation, install the current package with `pnpm` and follow its bundled `node_modules/workflow/docs/` documentation. Do not implement from stale API memory.

### 3.4 Cost profile

This design is not the absolute cheapest call count. A submission with `N` transitions uses approximately one orchestration call plus `N` cheap child calls. It is selected because it isolates failures, scales output size, enables per-transition retries, and creates clean review units.

Keep cost controlled by:

- a small orchestration prompt and minimal tool receipts;
- a cheap structured-output model for child parsing;
- parallel child dispatch with bounded concurrency;
- prompt caching where supported;
- no catalog or graph tools inside either model;
- one deduplicated deterministic resolve batch after parsing;
- recorded model/token/cost metadata per run and proposal.

Do not claim unlimited input. Initial limits should be centralized configuration and validated at intake. Recommended starting measurement targets:

- raw submission: up to 64 KiB;
- discovered transitions: up to 128;
- concurrent child parses: 8;
- transient child retries: 2;
- bounded orchestration steps.

These are starting guardrails, not permanent product guarantees. Measure realistic 1-, 10-, and 100-transition notes before increasing them.

### 3.5 Very long submissions

Range-based reading is a later optimization, tracked by DJ-76.

That version adds a read-only `read_submission_range` tool, overlapping deterministic windows, persisted scan progress, and source-span deduplication. It reuses the same one-transition child parser. It should not be built until bounded whole-submission orchestration is measured.

### 3.6 Migration from the current pipeline

The current API launches `runNoteExtraction` through Next.js `after()` inside a route with a 60-second maximum duration. That is background work within the same invocation, not a durable queue. DJ-66 must replace this launch path with a durable workflow start and return its run ID.

Reuse the safeguards that already exist:

- `notes.extractionVersion` as the submission-version CAS boundary;
- `note_agent_runs` for parent workflow/model audit, extended with durable run identity and superseded state;
- `note_transition_commits` for graph-application audit;
- parameterized track resolve/import and transition commit helpers.

Add or change:

- a first-class per-transition proposal table rather than storing every child result only in `notes.extraction` JSON;
- per-proposal CAS and terminal states;
- explicit `pending` and `rejected` application states;
- aggregate progress updates while children are still running;
- stale-child cancellation/supersession when a submission version changes;
- reconciliation for interrupted cross-store completion.

The existing proposal key `{noteId}:{extractionVersion}:{transitionIndex}` is safe only while one stable plan owns transition ordering. Agent-discovered spans may be reordered across retries, so new proposal idempotency must use a stable source-span/content fingerprint. Keep the old key only for compatibility with already committed edges.

## 4. Proposal and status model

Add a first-class Postgres proposal record. Suggested fields:

- `id`
- `submissionId`
- `extractionVersion`
- `workflowRunId`
- `ordinal`
- `sourceStart`
- `sourceEnd`
- `sourceText`
- `sourceFingerprint`
- `status`
- `draft`
- `resolution`
- `policyResult`
- `reviewReasons`
- `model`
- `promptVersion`
- `usage`
- `attemptCount`
- `transitionId`
- `error`
- timestamps

Require a unique idempotency key derived from submission/version and stable source fingerprint. Ordinal alone is useful for display but is not stable enough after changed segmentation.

Proposal states:

```text
queued
  -> parsing
  -> resolving
  -> ready
  -> committed

parsing/resolving/ready
  -> needs_review
  -> failed
  -> rejected
```

Submission status is derived from child counts rather than used as the only policy result:

- `processing`
- `committed`
- `partially_committed`
- `needs_review`
- `no_proposal`
- `failed`

Partial writes are required. One ambiguous proposal must never roll back or block a clear sibling.

## 5. Transition identity and parallel edges

Neo4j already permits multiple relationships of the same type between the same nodes. Make that behavior explicit and manageable.

Every transition edge needs a stable `id` independent of endpoint pair:

```text
(:Track)-[:TRANSITION {
  id,
  proposalKey?,
  sourceSubmissionId?,
  sourceProposalId?,
  fromBar?,
  toBar?,
  barsOverlap?,
  technique?,
  intent?,
  quality?,
  notes?,
  createdAt,
  updatedAt
}]->(:Track)
```

Rules:

- `(fromTrackId, toTrackId)` is not unique.
- technique/intent is not identity.
- AI-created edges retain an idempotency/proposal key.
- manual edges use the same stable edge ID and domain fields without requiring submission provenance.
- update/delete APIs address one edge by ID.
- deleting one parallel edge must not affect siblings.

The Graph UI may group destination tracks for readability, but it must never collapse the underlying transition list.

## 6. Review UX

Review is an exception queue inside Library → Transitions, not a separate Notes workflow.

For each review item show:

- immutable source span;
- child draft;
- exact policy failures;
- ranked track candidates and match evidence;
- committed/failed sibling counts;
- editable transition fields.

Actions:

- select existing tracks;
- import/create missing tracks;
- edit proposal fields;
- approve through deterministic policy/application;
- reject without mutating the submission or committed siblings.

Pending proposals can be surfaced beside committed transitions, but they must be visually and semantically marked as temporary Postgres review items rather than Neo4j edges.

## 7. Route migration

Target routes:

- `/add`
- `/library?view=tracks`
- `/library?view=transitions`
- `/library?view=submissions`
- `/graph`

Preserve safe redirects during migration:

- `/tracks/new` and `/songs/new` -> `/add` Track mode
- `/notes/new` -> `/add` Transition mode
- `/notes` -> `/library?view=submissions`
- `/notes/:id` -> the corresponding read-only submission detail

Raw submission update APIs should be removed or rejected after the immutable intake cutover. Review and transition mutation APIs replace note editing.

## 8. Linear implementation order

The canonical serial order, parallel lanes, blocker graph, milestone state, and
complete DJ-1–DJ-76 status inventory live in
[`TICKET_ORDER.md`](./TICKET_ORDER.md).

Keep this document focused on architectural decisions. Update `TICKET_ORDER.md`
and Linear together whenever implementation priority or dependencies change.

## 9. DJ-66 implementation slices

Keep one branch/issue, but implement and verify in this order:

1. Add proposal/workflow schema and idempotency constraints.
2. Introduce durable workflow entrypoint and persist submission before start.
3. Implement `parse_single_transition` child step with structured output and minimal receipt.
4. Implement bounded orchestrator with only that tool.
5. Batch/deduplicate resolve across persisted proposals.
6. Refactor policy/application to per-proposal outcomes and partial commits.
7. Add reconciliation for interrupted Postgres/Neo4j completion.
8. Persist aggregate submission counts/status and complete audit.
9. Test multi-transition partial success, replay idempotency, child retry exhaustion, and hard-limit behavior.
10. Measure 1-, 10-, and 100-transition fixtures for cost, latency, and extraction completeness.

## 10. Non-negotiable invariants

- Raw submissions are persisted before AI processing and immutable afterward.
- LLM output never directly mutates Neo4j.
- Every proposal and transition has stable identity.
- Workflow replay is safe and idempotent.
- Clear proposals commit independently of ambiguous siblings.
- Review items remain in Postgres until approved; they are not fake graph edges.
- Multiple A → B transition edges are valid.
- Edit/delete targets one edge ID.
- Model, prompt, token/cost, retry, resolution, policy, and commit evidence are auditable.
- Every limit failure is explicit; no silent truncation.
