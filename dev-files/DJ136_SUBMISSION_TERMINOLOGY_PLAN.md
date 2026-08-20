# DJ-136 — Consolidate submission / note / proposal terminology (task plan)

> Ticket: [DJ-136 — Consolidate submission/note/proposal terminology across the stack](https://linear.app/dj-project-astradzhao/issue/DJ-136)
> Related: [DJ-71](https://linear.app/dj-project-astradzhao/issue/DJ-71) (renamed the product surface), [DJ-99](https://linear.app/dj-project-astradzhao/issue/DJ-99) (deleted the legacy `/notes` UI)
> Architecture source: [`NEXT_PRODUCT_ARCHITECTURE.md`](./NEXT_PRODUCT_ARCHITECTURE.md) §"Submission" and lines 38, 190–201
> Status: **not started.**

One feature has two names. The UI, URLs, and product docs say **submission**; storage, the HTTP API, and most TypeScript types say **note**. This was a deliberate deferral, recorded in `NEXT_PRODUCT_ARCHITECTURE.md:38`:

> Existing `notes` database naming may remain temporarily to avoid a risky mechanical migration, but product/API language should move toward **submission**.

DJ-71 converted the presentation layer and stopped. The two vocabularies were then bridged with aliases instead of being reconciled — `GET /notes` literally returns the same array twice, once as `notes` and once as `submissions`. This plan finishes the rename through all four layers.

---

## 1. Goal

After this ticket, exactly one word names each concept, at every layer from the URL bar to the Postgres column. No endpoint returns the same data under two keys. No function exists solely to alias another.

---

## 2. Vocabulary decision (read this before touching anything)

| Concept                                            | Canonical term | Never call it       |
| -------------------------------------------------- | -------------- | ------------------- |
| The immutable raw text the user pasted             | **submission** | note, note record   |
| One parsed transition extracted from a submission  | **proposal**   | note proposal       |
| Free-text annotation a human wrote about something | **note**       | (this one is fine)  |

### 2.1 DO NOT RENAME — "note" has a second, legitimate meaning

These are annotations, not submissions. Renaming them **will** break the product and corrupt the vocabulary you are trying to fix. Re-read this list before every commit.

| Identifier                                  | What it actually is                                   |
| ------------------------------------------- | ------------------------------------------------------ |
| `transitions.notes` (SQL column)            | Free-text the DJ wrote about a transition edge         |
| `ApiTransition.notes`, `CreateTransitionBody.notes`, `UpdateTransitionBody.notes` | Same field over the wire |
| `"Notes"` label at `apps/web/components/tracks/transition-fields.tsx:163` | Form label for the above |
| `note_proposals.review_note` / `reviewNote` | Reviewer's comment when approving/rejecting a proposal |
| `block_steps.note` (SQL column)             | Annotation on a sequence step                          |
| `NoteTransitionPlan.notes` (mix-notes)      | Extracted annotation text, feeds `transitions.notes`   |
| `@selecta/mix-notes` package name           | "Mix notes" = DJ shorthand for the craft, not the entity |

### 2.2 Mechanical guard

Before committing any tier, run this and confirm every remaining hit is on the §2.1 list:

```bash
rg -n --pcre2 '\bnote(?!s?\b(?=[^a-zA-Z]))|[Nn]ote[A-Z]|note_' apps/web apps/api packages/db packages/mix-notes
```

Simpler and good enough in practice:

```bash
rg -ni 'note' apps/web apps/api | rg -v 'transition-fields|reviewNote|review_note|\.notes\b|notes:'
```

---

## 3. What I verified (current tree)

- `apps/api/app/notes/route.ts:120-138` serializes `result.notes` twice, into a `notes` key and a `submissions` key, with the comment `// Alias for Library "Submissions" wording.`
- `apps/web/lib/notes/api.ts:44-53` — `listSubmissions()` exists only to call `listNotes()`.
- `apps/web/components/library/submissions-list.tsx:43` — `response.submissions ?? response.notes`.
- There is **no** `submissions` table, **no** `/submissions` route, and **no** `submissionId` column anywhere. Submission exists only as UI copy, URL segments, and a scattering of backend function names.
- There is **no** `submissionId` identifier in `apps/web` at all — the frontend mismatch is `submission` in URLs/copy vs `noteId` in every prop and API call.
- `proposal` is already consistent across URL, UI copy, web lib, API route, and DB column. Its only blemishes are the table name `note_proposals` and the `Note`-prefixed types.
- The backend is already partway converted on its own: `apps/api/workflows/process-submission.ts` / `.steps.ts`, `startSubmissionWorkflow`, `deriveSubmissionExtractionStatus`, `refreshSubmissionExtractionStatus`, `MAX_SUBMISSION_RAW_BYTES`, `SUBMISSION_LIMITS`, and mix-notes' `submissionId` tool-schema field all use the target word already. **Tiers 2–3 reduce the number of translation points; they do not add any.**
- `apps/web/components/graph/neighbor-detail.tsx` is self-inconsistent inside one file: `:146` renders a `note` badge and `:160` says "From note", while `:168` says "Source submission".
- Migrations are plain SQL in `packages/db/drizzle/`, tracked by `drizzle/meta/_journal.json` (11 entries, `0000`–`0010`) plus a per-migration snapshot. Generated by `pnpm --filter @selecta/db db:generate`, applied by `pnpm --filter @selecta/db db:migrate`.

---

## 4. Decisions

| ID  | Question                                    | Decision                                                                                                                                                                                   |
| --- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | One PR or four?                             | **Four commits on one `dj-136` branch, one PR**, tiers in order. Tier 4 is the only risky one; if review wants it isolated, split Tier 4 into its own follow-up issue rather than reordering. |
| D2  | Which word wins?                            | **`submission`.** It is already the user-facing word, and it frees "note" for the annotation meaning that genuinely cannot be renamed (§2.1).                                              |
| D3  | Keep a `/notes` compat alias after Tier 2?  | **No.** Single-user, pre-production, both apps deploy together, no external consumer. Aliasing is what caused this ticket.                                                                  |
| D4  | Rename the `@selecta/mix-notes` package?    | **No.** Churns every import for no clarity gain. Its `NOTE_TYPES` / `NoteType` (`transition \| song_note \| unknown \| mixed`) classify *content*, not the entity — rename to `SubmissionContentType` in Tier 3 but leave the package alone. |
| D5  | User-visible copy that says "note"          | The **noun for the stored object** is always "submission". Prose describing the *act of writing* may keep "notes". Exact list in §5.4 — do not improvise beyond it.                        |
| D6  | `?mode=note` / `?mode=notes` URL alias      | **Drop** it (`apps/web/lib/add/mode.ts:4`). `/notes*` already 404s per DJ-99, so nothing links it.                                                                                          |
| D7  | Tier 4 in-place migration or fresh DB?      | **In-place `ALTER ... RENAME`.** Never DROP+CREATE. §8.3 explains how to force drizzle-kit to emit renames.                                                                                 |

---

## 5. Tier 1 — frontend only, no API change

**Nothing outside `apps/web/` changes in this tier.** After it, the entire frontend speaks one language and the note↔submission translation is confined to one file (`lib/submissions/api.ts`).

### 5.1 THE WIRE BOUNDARY RULE (most important rule in this tier)

A JSON key that crosses the HTTP boundary is part of the API contract and **cannot** change until Tier 2 renames both sides together.

In Tier 1 you **may** rename: files, directories, type *names*, component names, props, local variables, function names.
In Tier 1 you **may not** rename: property *keys* inside types that model a request body, query param, or response payload.

Frozen until Tier 2 — leave these keys spelled exactly as they are:

- Response keys `note`, `notes`, `submissions`
- `ApiProposal.noteId`, `ApiProposalDetail.note`, `ApiTransitionCommit.noteId`
- `ApiTransition.sourceNoteId`, `ApiTransition.sourceNoteVersion`
- Query params `noteId`, `sourceNoteId`

This means Tier 1 legitimately produces code like `getSubmission(): Promise<{ ok: true; note: ApiSubmission }>`. That reads wrong and **is expected** — Tier 2 fixes it. Do not "helpfully" rename the key.

### 5.2 Directory and file moves

| From                                          | To                                                  |
| --------------------------------------------- | ---------------------------------------------------- |
| `apps/web/lib/notes/api.ts`                   | `apps/web/lib/submissions/api.ts`                   |
| `apps/web/lib/notes/types.ts`                 | `apps/web/lib/submissions/types.ts`                 |
| `apps/web/lib/notes/extraction-status.ts`     | `apps/web/lib/submissions/extraction-status.ts`     |
| `apps/web/lib/notes/extraction-status.test.ts`| `apps/web/lib/submissions/extraction-status.test.ts`|
| `apps/web/lib/notes/limits.ts`                | `apps/web/lib/submissions/limits.ts`                |
| `apps/web/components/add/new-note-form.tsx`   | `apps/web/components/add/new-submission-form.tsx`   |

`apps/web/lib/notes/` must not exist afterwards. Update the `@/lib/notes/...` import specifier at every call site (`apps/web/lib/library/list-params.ts` imports `NoteExtractionStatus` from `@/lib/notes/api` — easy to miss).

### 5.3 Symbol renames

`apps/web/lib/submissions/types.ts`:

| Old                      | New                             |
| ------------------------- | --------------------------------- |
| `ApiNote`                | `ApiSubmission`                 |
| `ApiNoteTrackLink`       | `ApiSubmissionTrackLink`        |
| `ApiNoteProposalLink`    | `ApiSubmissionProposalLink`     |
| `ApiNoteProposalCounts`  | `ApiSubmissionProposalCounts`   |

`NoteExtractionStatus` comes from `@selecta/db` and is renamed in Tier 3. Bridge it here with an alias so the rest of `apps/web` never sees the old name:

```ts
import type { NoteExtractionStatus as SubmissionExtractionStatus } from "@selecta/db";
export type { SubmissionExtractionStatus };
```

Tier 3 deletes the `as` clause. Same treatment for `NoteProposalStatus` in `apps/web/components/common/status-badge.tsx`.

`apps/web/lib/submissions/api.ts`:

| Old                        | New                              |
| --------------------------- | ---------------------------------- |
| `listNotes`                | `listSubmissions`                |
| `listSubmissions` (alias)  | **delete** — was a wrapper only   |
| `getNote`                  | `getSubmission`                  |
| `createNote`               | `createSubmission`               |
| `extractNote`              | `extractSubmission`              |
| `addNoteTrackLink`         | `addSubmissionTrackLink`         |
| `removeNoteTrackLink`      | `removeSubmissionTrackLink`      |
| param `noteId`             | `submissionId`                   |

Callers of the old `listSubmissions` now hit the real function; `submissions-list.tsx:43` keeps reading `response.submissions ?? response.notes` until Tier 2.

`apps/web/lib/proposals/api.ts`: `listNoteProposals` → `listSubmissionProposals`, param `noteId` → `submissionId`. The URL it builds (`/notes/:id/proposals`) stays until Tier 2.

`apps/web/lib/graph/helpers.ts`: `provenanceLabel` returns `{ kind, noteId }` → `{ kind, submissionId }`. It is derived from `edge.sourceNoteId`, which stays (wire boundary).

### 5.4 Component prop renames

Rename the prop `noteId` → `submissionId` in each of these, and update the JSX that passes it:

- `apps/web/components/library/submission-detail.tsx`
- `apps/web/components/library/submission-proposals.tsx`
- `apps/web/components/library/submission-track-links.tsx`
- `apps/web/components/library/proposal-review.tsx`
- `apps/web/components/library/proposal-siblings.tsx`

Both route pages pass it: `apps/web/app/library/submissions/[id]/page.tsx:12` and `apps/web/app/library/submissions/[id]/proposals/[proposalId]/page.tsx:12` currently do `noteId={id}` → `submissionId={id}`.

Component rename: `NewNoteForm` → `NewSubmissionForm` (imported by `apps/web/components/add/add-workspace.tsx`).

### 5.5 User-visible copy (per D5)

**Change** — these name the stored object:

| Location                                              | From                              | To                                  |
| ------------------------------------------------------ | ----------------------------------- | ------------------------------------- |
| `components/graph/neighbor-detail.tsx:146`            | badge `note`                      | `submission`                        |
| `components/graph/neighbor-detail.tsx:160`            | "From note"                       | "From submission"                   |
| `components/library/submissions-list.tsx:169`         | "Submit a transition note…"       | "Submit a transition…"              |
| `components/library/transitions-list.tsx:237`         | "Add a transition note to start…" | "Add a transition to start…"        |

**Keep** — these describe the act of writing prose, not the object:

- `app/page.tsx:15` "…just by writing notes for yourself…"
- `app/layout.tsx:20` "DJ mix notes → graph → live what's next"
- `components/add/add-workspace.tsx:24` "Paste free-form mix notes describing one or many transitions…"
- `components/add/new-submission-form.tsx:73` field label "Transition notes"
- `components/graph/next-transitions.tsx:76` "…capture a mix note…"

Also per D6, delete the `note` / `notes` aliases from `parseAddMode` in `apps/web/lib/add/mode.ts:4`.

### 5.6 Verify Tier 1

```bash
pnpm --filter @selecta/web typecheck
pnpm --filter @selecta/web test
pnpm lint
pnpm format
rg -n 'noteId|ApiNote|listNotes|lib/notes' apps/web
```

That last grep should return **only** the frozen wire-boundary keys from §5.1. Then manually: submit a transition on `/add`, open it from Library → Submissions, open a proposal, approve it.

---

## 6. Tier 2 — HTTP surface

Both apps change in the **same commit**. There is no deprecation window (D3).

### 6.1 Route moves (`apps/api/app/`)

| From                                    | To                                            |
| ---------------------------------------- | ----------------------------------------------- |
| `notes/route.ts`                        | `submissions/route.ts`                        |
| `notes/[id]/route.ts`                   | `submissions/[id]/route.ts`                   |
| `notes/[id]/extract/route.ts`           | `submissions/[id]/extract/route.ts`           |
| `notes/[id]/proposals/route.ts`         | `submissions/[id]/proposals/route.ts`         |
| `notes/[id]/tracks/route.ts`            | `submissions/[id]/tracks/route.ts`            |
| `notes/[id]/tracks/[trackId]/route.ts`  | `submissions/[id]/tracks/[trackId]/route.ts`  |

`apps/api/app/notes/` must not exist afterwards.

### 6.2 Payload key renames

| Location                            | Old key                              | New key                                          |
| ------------------------------------ | ------------------------------------- | -------------------------------------------------- |
| `GET /submissions` response         | `notes` **and** `submissions`        | `submissions` only — **delete the duplicate**    |
| `GET/POST/PATCH` single response    | `note`                               | `submission`                                     |
| `GET /proposals` query              | `noteId`                             | `submissionId`                                   |
| Serialized proposal                 | `noteId`                             | `submissionId`                                   |
| `GET /proposals/:id` detail         | `note`                               | `submission`                                     |
| `GET /transitions` query            | `sourceNoteId`                       | `sourceSubmissionId`                             |
| Serialized transition               | `sourceNoteId`, `sourceNoteVersion`  | `sourceSubmissionId`, `sourceSubmissionVersion`  |

Deleting the duplicate `submissions` key at `apps/api/app/notes/route.ts:120-138` is the headline change of this tier — the response should build the array once.

### 6.3 `apps/api/lib/` renames

| From                              | To                                       |
| ---------------------------------- | ------------------------------------------ |
| `notes.ts`                        | `submissions.ts`                         |
| `note-agent-services.ts`          | `submission-agent-services.ts`           |
| `serializeNote`                   | `serializeSubmission`                    |
| `SerializedNote`                  | `SerializedSubmission`                   |
| `SerializedNoteTrackLink`         | `SerializedSubmissionTrackLink`          |
| `createNoteAgentServices`         | `createSubmissionAgentServices`          |
| `NoteAgentServices`               | `SubmissionAgentServices`                |

`apps/api/lib/start-submission-workflow.ts` keeps its name; change its `noteId` param to `submissionId`.

### 6.4 Environment variables

| Old                        | New                              |
| --------------------------- | ---------------------------------- |
| `NOTE_AGENT_MODEL`         | `SUBMISSION_AGENT_MODEL`         |
| `NOTE_AGENT_FALLBACK_MODEL`| `SUBMISSION_AGENT_FALLBACK_MODEL`|
| `NOTE_ORCHESTRATOR_MODEL`  | `SUBMISSION_ORCHESTRATOR_MODEL`  |

Read at `apps/api/workflows/process-submission.steps.ts:143-144` and `packages/mix-notes/src/agent/parse-single-transition.ts:73`. Update `.env.example:22-24` **and** tell the human to update their local `.env.local` — these are optional with defaults, so a missed rename fails silently by falling back to the default model rather than erroring.

### 6.5 Frontend follow-through

Update every `apiFetch` path in `apps/web/lib/submissions/api.ts`, `lib/proposals/api.ts`, and `lib/transitions/api.ts` from `/notes` to `/submissions`, then unfreeze the §5.1 keys: `ApiProposal.noteId` → `submissionId`, `ApiProposalDetail.note` → `submission`, `ApiTransition.sourceNoteId` → `sourceSubmissionId`, and `submissions-list.tsx:43` becomes plain `response.submissions`.

### 6.6 Verify Tier 2

```bash
pnpm typecheck && pnpm lint && pnpm format
rg -n "'/notes|\"/notes|\`/notes" apps/web apps/api   # must be empty
```

Then run the stack (`pnpm dev`) and exercise Add → extract → Library → review → approve → Graph provenance link end to end. Tier 2 is the tier most likely to produce a runtime-only break that typecheck misses, because route paths are strings.

---

## 7. Tier 3 — `packages/db` + `packages/mix-notes` TypeScript surface, no SQL change

Drizzle separates the JS binding from the SQL name, so the entire TypeScript layer can be renamed with **zero** migration risk:

```ts
// SQL string stays "notes" — only the exported symbol changes.
export const submissions = pgTable("notes", { /* … */ });
```

Tier 4 changes those strings. Keeping the tiers apart means that if Tier 4 is deferred or reverted, everything above it still reads correctly.

### 7.1 `packages/db/src/schema.ts`

Table bindings (**keep the string argument unchanged**):

| Symbol                        | New symbol                          | SQL string (unchanged)    |
| ------------------------------ | ------------------------------------- | --------------------------- |
| `notes`                       | `submissions`                       | `"notes"`                 |
| `noteTrackLinks`              | `submissionTrackLinks`              | `"note_track_links"`      |
| `noteAgentRuns`               | `submissionAgentRuns`               | `"note_agent_runs"`       |
| `noteProposals`               | `submissionProposals`               | `"note_proposals"`        |
| `noteTransitionCommits`       | `submissionTransitionCommits`       | `"note_transition_commits"` |

Enum bindings (same rule):

| Symbol                            | New symbol                              | SQL string (unchanged)          |
| ---------------------------------- | ----------------------------------------- | --------------------------------- |
| `noteExtractionStatusEnum`        | `submissionExtractionStatusEnum`        | `"note_extraction_status"`      |
| `noteAgentRunStatusEnum`          | `submissionAgentRunStatusEnum`          | `"note_agent_run_status"`       |
| `noteTransitionCommitStatusEnum`  | `submissionTransitionCommitStatusEnum`  | `"note_transition_commit_status"` |
| `noteProposalStatusEnum`          | `submissionProposalStatusEnum`          | `"note_proposal_status"`        |

Column properties — rename the TS property, keep the SQL name: `noteId: text("note_id")` → `submissionId: text("note_id")`. Applies to `note_track_links`, `note_agent_runs`, `note_proposals`, `note_transition_commits`. On `transitions`: `sourceNoteId: text("source_note_id")` → `sourceSubmissionId: text("source_note_id")`, and likewise `sourceNoteVersion`.

**`transitions.notes` stays completely untouched** (§2.1).

Inferred types: `Note`/`NewNote` → `Submission`/`NewSubmission`, `NoteExtractionStatus` → `SubmissionExtractionStatus`, `NoteTrackLink`, `NoteAgentRun`, `NoteProposal`, `NoteTransitionCommit` → `Submission*` equivalents. Relation names `sourceNote` → `sourceSubmission`.

### 7.2 `packages/db/src/` file and function renames

| From                                       | To                                            |
| ------------------------------------------- | ----------------------------------------------- |
| `notes.ts`                                 | `submissions.ts`                              |
| `note-track-links.ts`                      | `submission-track-links.ts`                   |
| `createNote` / `getNoteById` / `listNotes` / `updateNote` | `createSubmission` / `getSubmissionById` / `listSubmissions` / `updateSubmission` |
| `listAgentRunsForNote`                     | `listAgentRunsForSubmission`                  |
| `supersedeProposalsForNote`                | `supersedeProposalsForSubmission`             |
| `addNoteTrackLink` / `listNoteTrackLinks` / `listNoteTrackLinksWithTracks` / `removeNoteTrackLink` | `*SubmissionTrackLink(s)` |
| `NotesError` / `isNotesError`              | `SubmissionsError` / `isSubmissionsError`     |
| `CreateNoteInput` / `ListNotesInput` / `ListNotesResult` / `NoteListItem` / `NoteProposalLink` / `UpdateNoteInput` / `UpdateNoteResult` | `*Submission*` equivalents |
| `AddNoteTrackLinkInput` / `NoteTrackLinkWithTrack` | `AddSubmissionTrackLinkInput` / `SubmissionTrackLinkWithTrack` |
| `ProposalDetailNote`                       | `ProposalDetailSubmission`                    |
| `noteId` params throughout                 | `submissionId`                                |

Update the barrel at `packages/db/src/index.ts` (lines 5–66) and its header comment on line 1. `deriveSubmissionExtractionStatus`, `refreshSubmissionExtractionStatus`, and `MAX_SUBMISSION_RAW_BYTES` are already correct — leave them.

### 7.3 `packages/mix-notes`

Package name stays (D4). Rename internals only:

- `noteId` params → `submissionId` in `agent/apply-proposal-policy.ts` and anywhere else. Its LLM tool schema already says `submissionId`, so this closes the last translation point.
- Per D4: `NOTE_TYPES` → `SUBMISSION_CONTENT_TYPES`, `NoteType` → `SubmissionContentType` in `src/note-types.ts` (rename the file to `content-types.ts`). Values (`transition`, `song_note`, `unknown`, `mixed`) are unchanged — they are persisted in drafts.
- `NoteMentionPlanSchema` / `NoteTransitionPlanSchema` / `NoteProcessingPlanSchema` and their types → `Submission*` prefix. **Their `.notes` fields stay** (§2.1).
- `resolveNoteMentions` → `resolveSubmissionMentions`.

### 7.4 Verify Tier 3

```bash
pnpm typecheck && pnpm lint && pnpm format
pnpm --filter @selecta/db test
pnpm db:test          # needs Docker + Postgres running (see AGENTS.md)
```

Zero SQL changed in this tier, so `pnpm --filter @selecta/db db:generate` must produce **no new migration**. If it wants to generate one, you changed a SQL string by mistake — revert that and retry.

---

## 8. Tier 4 — SQL migration

The risky one. Read all of §8 before running anything.

### 8.1 Non-negotiable rules

1. **Renames only.** Every statement is `ALTER … RENAME`. If the generated migration contains `DROP TABLE`, `DROP COLUMN`, or `CREATE TABLE` for an existing table, **throw it away** — that destroys data.
2. `transitions.notes`, `note_proposals.review_note`, and `block_steps.note` are never touched (§2.1).
3. Back up first: `pg_dump` the local DB before applying.

### 8.2 Rename map

Tables:

| From                       | To                              |
| --------------------------- | --------------------------------- |
| `notes`                    | `submissions`                   |
| `note_track_links`         | `submission_track_links`        |
| `note_agent_runs`          | `submission_agent_runs`         |
| `note_proposals`           | `submission_proposals`          |
| `note_transition_commits`  | `submission_transition_commits` |
| `proposal_review_events`   | unchanged                       |

Columns:

| Table                            | From                   | To                          |
| --------------------------------- | ------------------------ | ----------------------------- |
| `submission_track_links`         | `note_id`              | `submission_id`             |
| `submission_agent_runs`          | `note_id`              | `submission_id`             |
| `submission_proposals`           | `note_id`              | `submission_id`             |
| `submission_transition_commits`  | `note_id`              | `submission_id`             |
| `transitions`                    | `source_note_id`       | `source_submission_id`      |
| `transitions`                    | `source_note_version`  | `source_submission_version` |

Enum types:

| From                             | To                                     |
| --------------------------------- | ---------------------------------------- |
| `note_extraction_status`         | `submission_extraction_status`         |
| `note_agent_run_status`          | `submission_agent_run_status`          |
| `note_transition_commit_status`  | `submission_transition_commit_status`  |
| `note_proposal_status`           | `submission_proposal_status`           |
| `proposal_review_action`         | unchanged                              |

Indexes and constraints: **do not hand-copy a guessed list.** Query the live DB for the real names and generate the `ALTER` statements from the output:

```sql
SELECT indexname FROM pg_indexes
 WHERE schemaname = 'public' AND indexname LIKE '%note%';

SELECT conname, conrelid::regclass AS on_table FROM pg_constraint
 WHERE conname LIKE '%note%';
```

Rename each to its `submission_*` equivalent with `ALTER INDEX <old> RENAME TO <new>;` and `ALTER TABLE <t> RENAME CONSTRAINT <old> TO <new>;`. Expect roughly: the seven `note_*` indexes on the five renamed tables, their `*_pkey` constraints, and the FKs whose drizzle-generated names embed `note` (including `transitions_source_note_id_notes_id_fk` and `proposal_review_events_proposal_id_note_proposals_id_fk`). Getting these wrong is cosmetic *until* the next `db:generate`, which will then try to "fix" the drift — §8.4 catches that.

### 8.3 Generating the migration

Update `packages/db/src/schema.ts` so every `pgTable(...)` / `pgEnum(...)` / `text(...)` **string** matches the new names (Tier 3 already fixed the symbols; this tier fixes the strings). Then:

```bash
pnpm --filter @selecta/db db:generate --name=submission_rename
```

drizzle-kit **prompts interactively** for every rename, offering "create/drop" vs "rename". You must answer *rename* each time. Two consequences:

- Run this in a real interactive terminal. If you have no TTY, **stop and ask the human** — do not pipe input or force a non-interactive run. Guessing here silently produces a DROP+CREATE migration.
- Afterwards, open `packages/db/drizzle/0011_submission_rename.sql` and read every line. It must contain only `ALTER … RENAME`. Diff it against §8.2.

drizzle-kit writes `drizzle/meta/0011_snapshot.json` and appends to `_journal.json` for you. Do not hand-edit those unless the generate step failed, in which case hand-write the SQL, add the journal entry (`idx: 11`, `version: "7"`, `tag: "0011_submission_rename"`, `breakpoints: true`, `when` = epoch ms), and copy `0010_snapshot.json` to `0011_snapshot.json` with the names updated. Separate every SQL statement with `--> statement-breakpoint`.

### 8.4 Non-schema files that also change

- `packages/db/src/test-database.ts:20-43` — `TRUNCATE_TABLES` lists `note_track_links`, `note_agent_runs`, `note_proposals`, `note_transition_commits`, `notes` as raw strings. Integration tests fail loudly if you miss this.
- `scripts/seed-dj36-review.mts` — references the proposal/note tables.
- Any raw `sql.raw(...)` fragments mentioning the old names.

### 8.5 Verify Tier 4

```bash
pg_dump "$DATABASE_URL" > /tmp/pre-dj136.sql        # back up first
pnpm --filter @selecta/db db:migrate
pnpm --filter @selecta/db db:generate               # must report NO changes
pnpm db:test
pnpm typecheck && pnpm lint && pnpm format
```

The second `db:generate` reporting no drift is the real proof that `schema.ts`, the migration chain, and the live database all agree. If it wants to emit another migration, the index or constraint renames in §8.2 are incomplete.

Then verify existing rows survived — this is a rename, so counts must be identical to the backup:

```sql
SELECT count(*) FROM submissions;
SELECT count(*) FROM submission_proposals;
SELECT count(*) FROM transitions WHERE source_submission_id IS NOT NULL;
```

Finally, a from-scratch check: drop the local DB, re-run `db:migrate` from `0000`, and confirm the full chain applies cleanly.

---

## 9. Documentation to update (do this in the Tier 4 commit)

| File                                     | What to change                                                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `dev-files/NEXT_PRODUCT_ARCHITECTURE.md` | Line 38 — replace the "may remain temporarily" deferral with a statement that the rename is complete. Also lines 173, 190–201 (the Submission/Proposal table maps still say `notes` / `note_proposals`) and 233–235. |
| `dev-files/PG_MIGRATION_REFACTOR.md`     | Table names in §3 and §4.                                                                                                |
| `dev-files/ARCHITECTURE.md`              | Historical doc — add a one-line note rather than rewriting history.                                                      |
| `dev-files/SETS_ARCHITECTURE.md`         | References to submissions/notes.                                                                                         |
| `README.md`                              | Any `/notes` endpoint or env-var references.                                                                             |
| `.env.example`                           | Lines 22–28 (`NOTE_AGENT_MODEL`, and the comments saying "note-pipeline" / "note detail page").                          |
| This file                                | Set Status to implemented.                                                                                               |

---

## 10. Acceptance

- `rg -ni 'note' apps/web apps/api packages/db packages/mix-notes` returns only §2.1 hits (transition annotations, `reviewNote`, `block_steps.note`, the `@selecta/mix-notes` package name).
- No `/notes` route exists in either app; no `lib/notes/` directory exists.
- No endpoint returns the same data under two keys; `listSubmissions` is a real function, not an alias.
- No table, column, enum, or index name contains `note` except `transitions.notes`, `submission_proposals.review_note`, and `block_steps.note`.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `pnpm db:test` all pass.
- `pnpm --filter @selecta/db db:generate` reports no pending changes.
- Manual end-to-end: submit a transition → watch extraction → open it in Library → Submissions → review a proposal → approve → follow the provenance link from Graph back to the submission.
- Row counts for submissions, proposals, and transitions are unchanged from the pre-migration backup.
