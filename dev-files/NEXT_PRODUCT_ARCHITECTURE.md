# Selecta next product architecture

> Decision record and implementation order for transition intake, durable extraction, review, Library, and Graph management.
>
> Last updated: 2026-08-20
>
> This document is the product architecture source of truth for Add → Library →
> Graph. Storage is **one Postgres** (see `PG_MIGRATION_REFACTOR.md`). Older
> Neo4j split-store language in `ARCHITECTURE.md` is historical except where
> marked superseded.

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

Notes are no longer a top-level editable product object. Storage, API, and TypeScript use **submission** for the pasted text (`submissions` table, `/submissions`, `submissionId`). **Note** is reserved for free-text annotations (`transitions.notes`, `reviewNote`, `block_steps.note`).

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
- **Transition** — one committed `transitions` row with stable identity.
- **Workflow run** — durable orchestration/audit for one submission version.

Storage ownership:

- **One Postgres owns everything.** Submissions, proposals, review state,
  workflow state, model usage, retries, audit, **and** the music domain
  (tracks, artists, genres/subgenres/folders, transitions) live in dedicated
  tables in `@selecta/db`.
- Unresolved or temporary proposals never become committed transition rows.

Proposal commit is **one ACID transaction** (transition insert(s) +
`submission_transition_commits` audit + proposal status). Idempotency is via the
`transitions.proposal_key` unique index (replay-safe by construction). The
former cross-store saga (Postgres intent → Neo4j MERGE → Postgres status →
reconciliation) is historical — see `PG_MIGRATION_REFACTOR.md`.

## 3. Durable extraction architecture

### 3.1 Selected design

Use one bounded orchestration agent per submission. Its job is transition-boundary discovery and dispatch, not detailed extraction or graph mutation.

For the first version, the agent receives the entire submission within a configured input limit. Its only tool is:

```text
parse_single_transition({
  submissionId,
  extractionVersion,
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

The parsing model and its tool do **not** write music tables.

Giving a parser direct mutation authority would couple uncertain model output to irreversible writes, make retries harder to reason about, and bypass shared resolution/policy gates. The parser writes a durable Postgres proposal. Parameterized deterministic application code is the only writer of `tracks` / `transitions`.

Likewise, a failed child should normally be retried by the durable runtime, not by asking the parent model to redispatch it. Model-driven retries waste tokens and can create duplicate source spans. After bounded runtime retries are exhausted, persist a failed/reviewable proposal outcome.

### 3.3 Durability

Use a durable workflow runtime with retryable, observable steps. The selected fit for the Vercel/Next.js stack is Vercel Workflow DevKit:

- workflow function: orchestration and durable sequencing;
- step functions: model calls, Postgres, and Spotify operations;
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

### 3.6 Migration from the pre-DJ-66 pipeline (historical)

The API previously launched `runNoteExtraction` through Next.js `after()`
inside a route with a 60-second maximum duration — background work within the
same invocation, not a durable queue. DJ-66 replaced that with a durable
workflow start that returns a run ID.

Reuse (still current):

- `submissions.extractionVersion` as the submission-version CAS boundary;
- `submission_agent_runs` for parent workflow/model audit;
- `submission_transition_commits` for transition-application audit;
- parameterized track resolve/import and transition commit helpers.

~~Cross-store reconciliation for interrupted Postgres/Neo4j completion~~ —
**superseded.** After PG-4/PG-5, proposal commit is one Postgres transaction;
replay short-circuits that guarded Neo4j-vs-Postgres partial failure are gone.
Idempotency remains via `proposal_key`.

The existing proposal key `{submissionId}:{extractionVersion}:{transitionIndex}` was
safe only while one stable plan owned transition ordering. Agent-discovered
spans may be reordered across retries, so proposal idempotency uses a stable
source-span/content fingerprint (`{submissionId}:{version}:span:{fingerprint}`).

## 4. Proposal and status model

Proposals are the durable per-transition units. Submissions are parent containers of immutable raw text. Do not confuse:

| Term       | Meaning                                    | Storage                |
| ---------- | ------------------------------------------ | ---------------------- |
| Submission | Immutable raw text the user pasted         | `submissions`          |
| Proposal   | One parsed transition from that submission | `submission_proposals` |
| Transition | Committed music-domain edge                | `transitions`          |

### Proposal record (minimal)

- `id`
- `submissionId` / submission id
- `extractionVersion`
- `agentRunId` (optional join to parent `submission_agent_runs`)
- `sourceStart`, `sourceEnd`, `sourceText`, `sourceFingerprint`
- `proposalKey` — keep this name end-to-end (`{submissionId}:{version}:span:{fingerprint}`)
- `status` — source of truth (`submission_proposal_status`)
- `draft`, `resolution`
- `policyResult` — includes nested `reviewReasons`
- `model`, `promptVersion`, `usage` (per-child audit when the workflow writes them)
- `attemptCount` — child parse retry source of truth
- `error`
- timestamps

Sort proposals by `sourceStart` then `createdAt`. Do not store display-only `ordinal`, a redundant `transitionId` copy of `proposalKey`, or proposal-level `workflowRunId` (keep workflow identity on `submission_agent_runs`).

### Proposal states

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

(`superseded` when a newer extraction version replaces older in-flight proposals.)

### Submission extraction status (derived cache only)

`submissions.extractionStatus` (`submission_extraction_status`) is **not** independent business logic. Always write it via `deriveSubmissionExtractionStatus` after proposal status changes. Used for list badges / filters / “still extracting?” CAS.

Derived outcomes include:

- `extracting` / `resolving`
- `committed`
- `partially_committed`
- `needs_review`
- `no_proposal`
- `failed` / `commit_failed`

There is no separate `note_status` (draft / preview / committed). Lifecycle UX reads `extractionStatus`.

Partial writes are required. One ambiguous proposal must never roll back or block a clear sibling.

## 5. Transition identity and parallel edges

Postgres permits multiple `transitions` rows between the same track endpoints
(no uniqueness on `(from_track_id, to_track_id)`). Make that behavior explicit
and manageable.

Every transition row needs a stable `id` independent of endpoint pair:

```text
transitions (
  id,
  from_track_id,
  to_track_id,
  proposal_key?,
  source_submission_id?,
  source_submission_version?,
  source_proposal_id?,
  from_bar?,
  to_bar?,
  bars_overlap?,
  technique?,
  intent?,
  quality?,
  notes?,
  created_at,
  updated_at
)
```

Rules:

- `(fromTrackId, toTrackId)` is not unique.
- technique/intent is not identity.
- AI-created rows retain an idempotency/proposal key and note provenance (`sourceSubmissionId`, `sourceProposalId`).
- manual rows use the same stable ID and domain fields without requiring note provenance.
- update/delete APIs address one row by ID.
- deleting one parallel transition must not affect siblings.

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

Pending proposals can be surfaced beside committed transitions, but they must be visually and semantically marked as temporary Postgres review items rather than committed transition rows.

## 7. Route migration

Target routes:

- `/add`
- `/library?view=tracks`
- `/library?view=transitions`
- `/library?view=submissions`
- `/graph`

Preserve safe redirects during migration:

- `/tracks/new` and `/songs/new` -> `/add` Track mode

`/notes`, `/notes/new`, and `/notes/:id` are retired (DJ-99). They 404; do not redirect them.

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
7. ~~Add reconciliation for interrupted Postgres/Neo4j completion~~ — superseded by single-tx commit (PG-4).
8. Persist aggregate submission counts/status and complete audit.
9. Test multi-transition partial success, replay idempotency, child retry exhaustion, and hard-limit behavior.
10. Measure 1-, 10-, and 100-transition fixtures for cost, latency, and extraction completeness.

## 10. Non-negotiable invariants

- Raw submissions are persisted before AI processing and immutable afterward.
- LLM output never directly mutates music tables (`tracks` / `transitions`).
  Parsers write proposals; only deterministic policy/application code writes
  the music domain.
- Proposal commit is one ACID transaction; idempotency is via `proposal_key`.
- Every proposal and transition has stable identity.
- Workflow replay is safe and idempotent.
- Clear proposals commit independently of ambiguous siblings.
- Review items remain proposals until approved; they are not fake committed transitions.
- Multiple A → B transition rows are valid.
- Edit/delete targets one transition ID.
- Model, prompt, token/cost, retry, resolution, policy, and commit evidence are auditable.
- Every limit failure is explicit; no silent truncation.
