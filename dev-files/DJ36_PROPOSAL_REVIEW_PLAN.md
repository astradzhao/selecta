# DJ-36 — Library proposal review (design + task plan)

> Ticket: [DJ-36 — Library transition review for ambiguous extraction proposals](https://linear.app/dj-project-astradzhao/issue/DJ-36)
> Status: **plan only, nothing implemented**
> Blocked-by (all merged on `main`): DJ-66, DJ-71, DJ-72, DJ-80
> Related invariants: [`TICKET_ORDER.md`](./TICKET_ORDER.md) "Product and data invariants"

## 1. Goal

Give the DJ a way to resolve every extraction outcome that the durable workflow
could not safely auto-commit, **one proposal at a time**, without touching
immutable submission text or already-committed siblings.

Entry point per product direction: **Library → Submissions**. Any submission
with unresolved work exposes a default review UI; from there the reviewer can
pick the right track, edit transition fields, approve (commit), reject, or
re-run extraction/resolution. Library → Transitions also surfaces pending
`needs_review` items so the review queue is reachable from both tabs
(DJ-36 acceptance).

## 2. What already exists (no need to rebuild)

Per-proposal state is already first class — this is a **read/write API + UI**
ticket much more than a data-modelling ticket.

| Capability                                                                                                | Where                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `note_proposals` rows with span offsets, `draft`, `resolution`, `policy_result`, `attempt_count`, `error` | `packages/db/src/schema.ts` L178–220                                                                                                      |
| Stable idempotency keys (`proposal_key`, `(note_id, extraction_version, source_fingerprint)`)             | same file; `packages/submissions/src/pipeline/proposal-key.ts`                                                                            |
| Statuses incl. unused `rejected`                                                                          | `noteProposalStatusEnum`, `packages/db/src/schema.ts` L50–60                                                                              |
| Ranked candidates (≤5 per mention) persisted                                                              | `note_proposals.resolution.candidates`, written in `resolveAndApplyProposals` (`apps/api/workflows/process-submission.steps.ts` L365–379) |
| Gate reasons persisted                                                                                    | `policy_result.reviewReasons` (same step)                                                                                                 |
| Deterministic policy + single music writer                                                                | `evaluateProposalPolicy`, `applyProposalPolicy` (`packages/submissions/src/pipeline/`)                                                    |
| ACID commit + idempotent edge insert                                                                      | `runInDbTransaction` (`packages/db/src/executor.ts`), `commitTransitionProposal` (`packages/db/src/music/transitions.ts` L601–667)        |
| Commit audit incl. unused `rejected` status                                                               | `note_transition_commits`                                                                                                                 |
| Partial-success rollup                                                                                    | `deriveSubmissionExtractionStatus` (`packages/db/src/proposals.ts` L241–281)                                                              |
| Submission list counts + `needsReview` filter                                                             | `GET /notes`, `apps/web/components/library/submissions-list.tsx`                                                                          |
| Committed-transition "Needs review" badge                                                                 | `apps/web/components/library/transitions-list.tsx`                                                                                        |
| Submission-level retry                                                                                    | `POST /notes/:id/extract`                                                                                                                 |
| Library + catalog search                                                                                  | `GET /tracks?q=`, `GET /catalog/search`                                                                                                   |

### Real gaps

1. **No API exposes proposal detail.** The web UI reads a _summary_ blob
   (`notes.extraction.proposals`, built by `summarizeProposal`,
   `process-submission.steps.ts` L579–677). Ranked candidates, full policy
   result, and hydrated track titles are not reachable from the browser.
2. **No write path for a human decision.** Nothing can move a proposal out of
   `needs_review`; `rejected` is never written. `deriveSubmissionExtractionStatus`
   only runs inside the workflow's finalize step, and `completeExtraction` uses
   CAS requiring `extraction_status = 'extracting'`, so a manual action cannot
   refresh the submission rollup today.
3. **Proposal UI is debug output** (`ProposalCard` in
   `apps/web/components/notes/note-detail.tsx`) — raw UUIDs, no links, no actions.
4. **No cross-submission proposal query** — no `listProposals`, no index for a
   review queue.
5. **`ambiguous_match` is never emitted.** The resolver always takes Spotify hit
   #1 (`topSearchHit`, `match.ts` L34–36), so genuine ambiguity can auto-commit
   as long as parser confidence ≥ `strong`.

## 3. Review taxonomy — everything the UI must handle

The reviewer's queue is not only "ambiguous match". Cases, current persisted
state, and the affordance each one needs:

| #   | Case                                                                  | How it lands today                                                     | Review affordance                                                                                                      |
| --- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| R1  | `low_confidence` — parser unsure, endpoints resolved                  | `needs_review`, full `resolution`                                      | Confirm endpoints as-is → **Approve**                                                                                  |
| R2  | `unresolved_endpoint` — catalog search returned nothing for a mention | `needs_review`, `resolutionStatus: "unresolved"`, empty candidate list | Search library, search catalog, or create track manually; then Approve                                                 |
| R3  | `ambiguous_match` (once emitted, §8-D) / weak top hit                 | `needs_review`                                                         | Choose from ranked candidates or search                                                                                |
| R4  | `invented_candidate` — LLM picked a handle not in the registry        | `needs_review`                                                         | Pick a real candidate                                                                                                  |
| R5  | `too_many_imports` — >2 new tracks for one proposal                   | `needs_review`                                                         | Re-point endpoints at existing tracks, or accept the imports                                                           |
| R6  | `incomplete_transition` — draft references missing mention ids        | `needs_review`, draft malformed                                        | Manually assign both endpoints + fields, or Reject                                                                     |
| R7  | Child parse failed after retries                                      | `failed`, `draft` null, `error` set                                    | **Re-parse span** (new LLM call), manual entry, or Reject                                                              |
| R8  | `no_proposal` — parser found no transition in the span                | `failed`                                                               | Reject/dismiss (expected for prose spans)                                                                              |
| R9  | Commit failed (FK/db error, track deleted mid-flight)                 | proposal `failed` + `note_transition_commits.status = commit_failed`   | **Retry commit** (idempotent), re-pick endpoints, or Reject                                                            |
| R10 | Submission-level failure, zero proposals                              | `notes.extraction_status = failed`, `extraction_error`                 | Retry extraction (exists)                                                                                              |
| R11 | Dispatch limit hit (>128 spans)                                       | `partially_committed` + `extraction_error`                             | Informational banner + retry extraction                                                                                |
| R12 | Stuck run — workflow died without finalizing                          | `extracting`/`resolving` with old `extraction_started_at`              | Surface "stalled for N min" + retry extraction (bumps version, supersedes)                                             |
| R13 | Duplicate edge — chosen endpoints already have an A→B transition      | allowed by design (parallel edges)                                     | Warn with existing edge links; reviewer continues or rejects                                                           |
| R14 | Already committed / superseded while the reviewer was reading         | `committed` or `superseded`                                            | Approve is a no-op returning the existing transition; superseded → conflict + "re-extracted, open the current version" |
| R15 | Same span rejected in an earlier version reappears after re-extract   | new `needs_review` row, old row stays `rejected`                       | Show "you rejected this span before" via fingerprint match (§8-E)                                                      |

Non-goals for review actions: editing `notes.raw_text` (immutable), bulk
approve, deleting committed siblings (that is Transition detail's delete).

## 4. Information architecture

```text
Library → Submissions (list)
  row: preview · status · "3 committed · 2 need review · 1 failed" · [Review 2] ─┐
                                                                                │
Library → Submissions → /library/submissions/:id  (submission detail)           │
  · immutable raw text with span highlights                                     │
  · Proposals, grouped: Needs review → Failed → Committed → Rejected  ──────────┤
  · per-row [Review] / [Open transition]                                        │
                                                                                ▼
/library/submissions/:id/proposals/:proposalId  (REVIEW UI — new page) ◄────────┘
                                                                                ▲
Library → Transitions (list)                                                    │
  · "Needs review (n)" section of pending proposal rows (dashed, not edges) ────┘
  · committed rows keep today's badge/links
```

Decisions:

- **Full page, not a modal.** The review UI needs source text, two candidate
  lists, transition fields, sibling context, and audit — plus deep links by
  stable proposal id (an acceptance criterion). Prev/next buttons walk the
  submission's review queue.
- **No fourth Library tab.** Review lives inside Submissions/Transitions;
  `LibraryWorkspace` gains a header link "N need review" that jumps to
  `/library?view=submissions&needsReview=1`.
- Pending proposals in the Transitions tab are visually **not** committed rows
  (dashed border, "Needs review" destructive badge, no transition id shown) and
  link to the review page.

## 5. Review UI specification

Anatomy of `/library/submissions/:id/proposals/:proposalId`, top to bottom:

1. **Header** — `← Submission` back link, eyebrow "Proposal", status badge,
   `Needs review 2 of 5` with prev/next, actions inline with the title
   (Approve · Reject · overflow: Re-parse span, Re-resolve).
2. **Why this needs review** — human copy per gate code, not raw JSON:

   | code                                        | copy                                                                              |
   | ------------------------------------------- | --------------------------------------------------------------------------------- |
   | `low_confidence`                            | "The parser wasn't confident about this transition (`moderate`, needs `strong`)." |
   | `unresolved_endpoint`                       | "No catalog match for “{mention}”. Pick a track below."                           |
   | `ambiguous_match`                           | "Several tracks matched “{mention}” closely."                                     |
   | `invented_candidate`                        | "The parser referenced a track that wasn't in the search results."                |
   | `too_many_imports`                          | "This would add {n} new tracks to your library (max {max})."                      |
   | `incomplete_transition`                     | "The draft didn't say which two tracks the transition is between."                |
   | `missing_required_fields` / `stale_version` | verbatim message fallback                                                         |

   Plus `error` text for `failed` proposals and the `commit_failed` audit error.

3. **Source** — the submission's raw text with this span highlighted, siblings'
   spans dimmed. Offset robustness: verify `rawText.slice(start, end)` matches
   `sourceText` after whitespace/case normalization; else `indexOf(sourceText)`;
   else render `sourceText` standalone with a "couldn't locate span" note. Pure
   helper `locateSpan()` (unit-tested).
4. **Endpoints** — two `EndpointPicker` blocks (From / To). Each shows the
   mention text + hints, the current selection, and a ranked candidate list
   (artwork, title, artists, duration, provider) with badges
   `In library` / `Would import` / `Selected by parser`. Tabs inside the picker:
   _Suggested_ (stored candidates) · _My library_ (`GET /tracks?q=`) ·
   _Catalog_ (`GET /catalog/search`) · _Create manually_ (existing add-track
   dialog, then auto-select). Free text can never become an endpoint.
5. **Transition fields** — reuse `apps/web/components/tracks/transition-fields.tsx`
   (bars/overlap/technique/intent/quality/notes) + `bidirectional` toggle,
   prefilled from the draft, editable.
6. **Duplicate check** — when both endpoints are chosen and existing A→B edges
   exist: "This pair already has 2 transitions" + links; approving still allowed.
7. **Siblings** — every proposal of the same submission+version: span preview,
   status badge, link (committed → `/library/transitions/:id`).
8. **Audit** (collapsed) — proposal id, `proposal_key`, fingerprint, attempt
   count, model, prompt version, agent run + workflow run id, timestamps, commit
   audit row, and the raw `draft` / `resolution` / `policy_result` JSON behind a
   disclosure (keeps today's debug value without leading with it).

States: loading skeleton; `db_not_configured`; 404; already-committed (read-only
summary + "Open transition"); rejected (read-only + Reopen if §8-C accepted);
superseded (banner pointing at the current version); optimistic-conflict toast
after a 409 with a Reload action.

Approve button is disabled until both endpoints resolve to a track or a concrete
catalog candidate. Destructive Reject keeps the `window.confirm` convention used
elsewhere in Library.

## 6. Backend design

### 6.1 Read APIs

| Route                                                          | Purpose                                                                                                                                            |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /notes/:id/proposals?version=`                            | All non-superseded proposals for a submission (defaults to current version), fully serialized                                                      |
| `GET /proposals/:id`                                           | One proposal: draft, resolution, policy result, hydrated candidates and endpoints, sibling summaries, existing-edge count, note raw text + version |
| `GET /proposals?status=needs_review&noteId=&q=&limit=&offset=` | Review queue for Transitions-tab merge and header counts                                                                                           |

Serialization (`apps/api/lib/proposals.ts`, mirroring `apps/api/lib/notes.ts`):
hydrate `graph:` candidates and committed endpoints into
`{ id, title, artists, artworkUrl }` track summaries so the UI never renders raw
UUIDs; keep the raw JSONB blobs under `raw` for the audit disclosure.

### 6.2 Write APIs

All are keyed by the **proposal id**, idempotent, and carry
`expectedUpdatedAt` for optimistic concurrency.

**`POST /proposals/:id/approve`**

```jsonc
{
  "expectedUpdatedAt": "2026-08-12T04:00:00.000Z",
  "from": { "kind": "track", "trackId": "…" },
  "to": {
    "kind": "spotify",
    "providerId": "…",
    "title": "…",
    "artists": ["…"],
    "artworkUrl": null,
    "durationMs": 214000,
  },
  "bidirectional": false,
  "transition": {
    "fromBar": 64,
    "toBar": 1,
    "barsOverlap": 16,
    "technique": "…",
    "intent": "…",
    "quality": "ok",
    "notes": "…",
  },
  "reviewNote": "picked the 2014 remaster",
}
```

Endpoint kinds are exactly `track` (existing id) and `spotify` (concrete catalog
candidate) — this is what preserves "never invent tracks from free text".

Server sequence, entirely inside one `runInDbTransaction`:

1. CAS-load the proposal: `status ∈ {needs_review, failed}` and
   `updated_at = expectedUpdatedAt`; `committed` → 200 `{ alreadyCommitted: true }`
   with the existing transition; `superseded`/`rejected` → 409.
2. `buildReviewerPolicyResult()` (new, `packages/submissions/src/pipeline`) turns reviewer input
   into a normal `ProposalPolicyResult` with `decision: "auto_commit"`, imports
   for `spotify` endpoints, `resolvedTrackIdsByMention` for `track` endpoints,
   and a plan carrying the edited transition fields.
3. `applyProposalPolicy(...)` **unchanged** → `importSpotifyTrack` (dedupes on
   `track_external_ids`) → `commitTransitionProposal` with the _same_
   `proposal_key` (`:rev` for the reverse edge). Single music writer preserved.
4. `upsertTransitionCommit({ status: "committed", payload: { …, reviewed: true } })`.
5. `updateProposal(id, { status: "committed", reviewedAt, reviewNote, policyResult: { …, applied, reviewer: true } })`.
6. `refreshSubmissionExtractionStatus(noteId, version)` (new) — recompute counts,
   write `notes.extraction_status` and patch `notes.extraction.counts` /
   `applySummary` so list badges and the legacy blob stay truthful. No CAS on
   `'extracting'`.

Response: `{ ok, proposal, transition, reverseTransition, alreadyCommitted }`.
Errors: `400 invalid_body`, `404 not_found`, `409 proposal_conflict`,
`503 db_not_configured`.

**`POST /proposals/:id/reject`** — `{ expectedUpdatedAt, reason? }` → status
`rejected`, `review_note`, `reviewed_at`; audit row upserted with status
`rejected`; rollup refreshed. Never touches `notes.raw_text`, committed
siblings, or existing transitions. `committed` → 409 ("delete the transition
instead").

**`PATCH /proposals/:id`** — `{ expectedUpdatedAt, reviewState }` saves
in-progress endpoint/field selections into the new `review_state` column without
committing and without mutating agent-authored columns. Lets the reviewer park a
hard item.

**`POST /proposals/:id/resolve`** — re-runs _deterministic_ resolution for this
one proposal (`resolveProposalsBatch` + `evaluateProposalPolicy`, no LLM). If it
now passes, commit through the same path; otherwise refresh
`resolution`/`policy_result` and stay in `needs_review`. This is the cheap
"retry extract" for R2/R9 after the reviewer imported a matching track.

**`POST /proposals/:id/reparse`** (phase 4) — one bounded `parseSingleTransitionDraft`
call for the span, bumps `attempt_count`, then runs `resolve`. Direct route call
with `maxDuration`, no new workflow needed. Guard with a max attempt ceiling.

Submission-level retry stays `POST /notes/:id/extract` (bumps version, supersedes
non-terminal proposals) — the escape hatch for R10/R11/R12.

### 6.3 New `@selecta/db` functions

- `listProposals({ noteId?, extractionVersion?, statuses?, query?, limit, offset })`
  → `{ proposals, limit, offset, hasMore }`, mirroring `listNotes`.
- `getProposalDetail(id)` → proposal + note (`rawText`, `extractionVersion`,
  `extractionStatus`) + siblings + commit audit row.
- `updateProposalGuarded(id, { expectedUpdatedAt, fromStatuses, set })` →
  `UPDATE … WHERE id = $1 AND updated_at = $2 AND status = ANY($3) RETURNING *`;
  0 rows ⇒ conflict. Used by approve/reject/patch.
- `refreshSubmissionExtractionStatus(noteId, extractionVersion)` — counts →
  `deriveSubmissionExtractionStatus` → update `notes.extraction_status` +
  `extraction.counts`; transaction-aware via `getExecutor()`.
- `countTransitionsBetween(fromTrackId, toTrackId)` for R13.
- Extend `UpdateProposalInput` with `reviewState`, `reviewedAt`, `reviewedBy`,
  `reviewNote`.

## 7. Migrations

Drizzle: edit `packages/db/src/schema.ts`, then
`pnpm --filter @selecta/db exec drizzle-kit generate` → `0009_proposal_review.sql`.

1. `note_proposals` review columns:
   - `review_state jsonb` — reviewer's parked selections/edits.
   - `reviewed_at timestamptz`
   - `reviewed_by text` — nullable until auth (DJ-16).
   - `review_note text` — approval note / rejection reason.
2. Review-queue indexes:
   - `note_proposals_status_updated_idx` on `(status, updated_at DESC)`.
   - `note_proposals_fingerprint_idx` on `(source_fingerprint)` for R15
     ("rejected before") lookups across versions.
     _(`(note_id, extraction_version)` is already covered by the leftmost prefix of
     `note_proposals_note_version_fingerprint_uidx`.)_
3. `proposal_review_events` (recommended, small):
   `id`, `proposal_id → note_proposals.id ON DELETE CASCADE`,
   `action` enum `proposal_review_action` (`approve|reject|edit|resolve|reparse|reopen`),
   `actor text NULL`, `payload jsonb`, `created_at`.
   `note_transition_commits` only audits commits; this gives the ticket's
   "trace every proposal … and audit evidence" for rejects, edits, and retries.
4. Enum add (decided, §8-B): `ALTER TYPE note_extraction_status ADD VALUE 'dismissed'`.

Reversibility: all additive. No backfill needed — existing `needs_review` rows
already carry everything the review UI reads.

## 8. Decisions

**A. Confidence on a human-approved transition — decided: `1.0`.** Reviewer
approval writes `transitions.confidence = 1.0`; provenance stays in
`note_proposals.reviewed_at` + `policy_result.reviewer`. The parser's own
confidence remains readable on the proposal row.

**B. Submission status when every proposal is rejected — decided: new
`dismissed` value.** `deriveSubmissionExtractionStatus` returns `no_proposal`
today, whose UI copy reads "nothing extracted". Add `dismissed` to
`note_extraction_status` (additive enum, §7.4), return it when the only decided
proposals are rejected, and extend `NoteExtractionStatus` in
`apps/web/lib/notes/types.ts` plus the status filter and badge maps.

**C. Reopening a rejection — decided: allowed.** `rejected → needs_review`,
logged as `reopen`, since rejection is cheap to trigger by mistake.

**D. Emitting `ambiguous_match` (R3) — decided: follow-up, not this ticket.**
The resolver's rank-1 auto-pick means truly ambiguous items can auto-commit
today. A near-tie detector (top-2 titles similar and/or mention has no
`artistHint`) that sets `resolutionStatus: "ambiguous"` ships **after** the
review UI, behind a constant in the policy config, so review volume never grows
before there is a place to resolve it. Tracked in phase 6.

**E. Re-extract vs prior rejections (R15) — decided: no silent suppression.**
Previously rejected fingerprints reappear as normal review items; the review
page shows "you rejected this span in v{n}".

**F. Actor identity — decided: deferred.** No auth yet; `reviewed_by` stays null
and the UI says "Reviewed manually". Wire to a user when DJ-16 lands.

## 9. Task plan (phased, file by file)

Single branch `dj-36`; each phase is a reviewable commit. Sequence matters:
read APIs first so the UI can be built against real payloads, writes next, UI
last.

**Phase 1 — read model (no schema change)**

- `packages/db/src/proposals.ts`: `listProposals`, `getProposalDetail`.
- `packages/db/src/index.ts`: exports.
- `apps/api/lib/proposals.ts`: `serializeProposal` + candidate/track hydration.
- `apps/api/app/proposals/route.ts` (GET), `apps/api/app/proposals/[id]/route.ts` (GET),
  `apps/api/app/notes/[id]/proposals/route.ts` (GET).
- `apps/web/lib/proposals/{types,api}.ts`.

**Phase 2 — migration + write APIs**

- `packages/db/src/schema.ts` + generated `drizzle/0009_proposal_review.sql` (§7).
- `packages/db/src/proposals.ts`: `updateProposalGuarded`,
  `refreshSubmissionExtractionStatus`, review fields on `UpdateProposalInput`,
  review-event insert helper.
- `packages/db/src/music/transitions.ts`: `countTransitionsBetween`.
- `packages/submissions/src/pipeline/reviewer-policy.ts`: `buildReviewerPolicyResult`
  (+ validation that endpoints are `track`/`spotify` only).
- `apps/api/app/proposals/[id]/approve/route.ts`, `…/reject/route.ts`,
  `…/resolve/route.ts`, `PATCH` in `…/[id]/route.ts`.
- Extend `apps/web/lib/proposals/api.ts` with the mutations.

**Phase 3 — review UI**

- `apps/web/app/library/submissions/[id]/proposals/[proposalId]/page.tsx`.
- `apps/web/components/library/proposal-review.tsx` (page body + actions),
  `proposal-endpoint-picker.tsx`, `proposal-source-span.tsx` (+ `locateSpan`
  helper in `apps/web/lib/proposals/span.ts`), `proposal-status-badge.tsx`,
  `proposal-siblings.tsx`.
- Reuse `transition-fields.tsx`, the add-track dialog, `Dialog`, `Badge`.
- `invalidateLibraryCache()` after any approve (new tracks/edges).

**Phase 4 — submission detail rework**

- Replace the `ProposalCard` debug block in
  `apps/web/components/notes/note-detail.tsx` with
  `apps/web/components/library/submission-proposals.tsx` reading
  `GET /notes/:id/proposals`, grouped by state, with span highlighting over the
  raw text and per-row Review / Open transition links.
- Surface R11/R12 banners (dispatch limit, stalled run) next to the existing
  retry button.

**Phase 5 — Transitions tab + header**

- `apps/web/components/library/transitions-list.tsx`: pending `needs_review`
  section (merged from `GET /proposals?status=needs_review`) plus a
  "Needs review only" filter for committed rows.
- `apps/web/components/library/library-workspace.tsx`: "N need review" link.
- `apps/web/components/library/submissions-list.tsx`: prominent review pill.

**Phase 6 — optional follow-ups (separate tickets if they grow)**

- `POST /proposals/:id/reparse` + attempt ceiling.
- `ambiguous_match` near-tie detector (§8-D).
- "Rejected before" hint via fingerprint index (§8-E).

Estimated size: phases 1–2 ≈ 700 lines of backend, phases 3–5 ≈ 900 lines of UI.

## 10. Tests worth writing

Per `.cursor/rules/valuable-tests-only.mdc` — only silent-failure paths, all PG
suites on isolated `selecta_test` (same Compose Postgres; see DJ-91):

- **Approve is idempotent and reuses `proposal_key`** — approving twice yields
  one transition, second call reports `alreadyCommitted` (integration).
- **Approve rejects stale state** — `expectedUpdatedAt` mismatch, `superseded`,
  and `rejected` all 409 and write nothing (integration).
- **Approve rolls back atomically** — forced failure after import leaves no
  transition, no commit-audit row, and proposal still `needs_review`.
- **Reject preserves siblings + raw text**, and the rollup becomes
  `committed`/`partially_committed`/`dismissed` as designed (integration).
- **Rollup derivation** for manual-review count shapes, including all-rejected
  (unit on `deriveSubmissionExtractionStatus`).
- **`buildReviewerPolicyResult` refuses free-text endpoints** and maps
  track/spotify endpoints to imports vs resolved ids (unit).
- **`locateSpan` fallbacks** — exact offsets, drifted offsets, unfindable span
  (unit).

No snapshot or render-only tests for the review page.

## 11. Out of scope

Bulk approve/reject; editing submission raw text; a standalone Notes workflow
(canceled, DJ-68); LLM-in-the-loop re-writes of music tables; multi-user actor
identity (DJ-16); Live Mode interactions; differential re-extraction (DJ-78).

## 12. Acceptance mapping (DJ-36)

| Ticket criterion                                                        | Covered by                                                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| One ambiguous proposal reviewed while clear siblings stay committed     | Per-proposal writes + `refreshSubmissionExtractionStatus` keeping `partially_committed` (§6.2)   |
| Reviewer can trace every proposal to source text and audit evidence     | Source highlight (§5.3), audit disclosure (§5.8), `proposal_review_events` (§7.3)                |
| Approve/reject/edit address stable ids and are idempotent               | Proposal-id routes, CAS + `proposal_key` reuse (§6.2)                                            |
| Review reachable from Transitions and Submissions                       | Phases 4–5 (§4)                                                                                  |
| Explains the exact failed gate                                          | Gate-code copy table (§5.2)                                                                      |
| Approval runs deterministic policy + transactional commit, never an LLM | `buildReviewerPolicyResult` → unchanged `applyProposalPolicy` inside `runInDbTransaction` (§6.2) |
| Reject never mutates submission or committed siblings                   | §6.2 + rejection test (§10)                                                                      |

## 13. Risks

- **Rollup drift.** Two writers now touch `notes.extraction_status` (workflow
  finalize and manual review). Mitigation: one shared
  `refreshSubmissionExtractionStatus`, always inside the caller's transaction,
  and never resurrecting a version that has been superseded.
- **Stale blob.** `notes.extraction.proposals` is a snapshot; after manual
  review it can disagree with `note_proposals`. Mitigation: review UI reads the
  proposals API only; the blob is refreshed for counts and otherwise treated as
  workflow-time audit.
- **Review volume.** Tightening ambiguity detection (§8-D) before the UI exists
  would create an unresolvable backlog — hence the ordering.
- **Long submissions.** Span highlighting over a 64 KiB text needs to stay
  virtualization-free and cheap; render the span's paragraph context rather than
  the whole document when the text is large.
