# DJ-137 — Put the submission pipeline in the right package (task plan)

> Ticket: [DJ-137 — Put the submission pipeline in the right package](https://linear.app/dj-project-astradzhao/issue/DJ-137)
> Follows: [DJ-134](https://linear.app/dj-project-astradzhao/issue/DJ-134) (folded `@selecta/mix-notes` into `@selecta/agentics`), [DJ-136](https://linear.app/dj-project-astradzhao/issue/DJ-136) (submission terminology), [DJ-132](https://linear.app/dj-project-astradzhao/issue/DJ-132) (split `packages/db`)
> Status: **not started.**

DJ-134 moved `@selecta/mix-notes` into `@selecta/agentics` as `src/core` + `src/submission-parser`. It was deliberately a pure file move: nothing was split, renamed, or deleted. So `submission-parser` now holds a pile of code that has nothing to do with talking to a model — it imports Spotify tracks, commits transitions to Postgres, and mints durable proposal keys.

This ticket finishes the job.

---

## 0. How to use this plan

**Read sections 1–4 before editing anything.** They contain the rule that decides every judgment call, plus the evidence behind every deletion.

Then work Steps 1–7 **in order**. Each step is:

- independently correct — the repo builds and tests green at the end of every step
- independently committable — make one commit per step
- followed by a **Verify** block — run it, and do not start the next step until it passes

Rules while working:

- **Do not batch steps.** If Step 5 breaks, you want a green Step 4 commit to fall back to.
- **Do not "improve" code you are moving.** Move it byte-for-byte, then fix imports. Behavior changes belong in a different ticket.
- **If a Verify block fails, fix it before continuing.** Do not proceed with a red tree.
- **If reality does not match section 4**, stop and re-verify rather than guessing. Someone may have landed work since this plan was written.

Environment notes that will bite you:

- **pnpm only.** Never `npm` or `yarn`. Never create `package-lock.json`.
- **oxfmt only** (`pnpm format`). Never add Prettier or Biome.
- **`git mv` fails in Cursor Cloud** with `Invalid cross-device link` when moving across directories. Use this instead, which also preserves rename detection:
  ```bash
  cp -a <src> <dest> && git add <dest> && git rm -r <src>
  ```
- After running the API dev server, `apps/api/AGENTS.md` and `apps/api/CLAUDE.md` are regenerated. They are untracked build artifacts — **do not commit them.**

---

## 1. The rule that decides every case

> **`@selecta/agentics` owns code that talks to a model.** Code that writes to Postgres, or defines a durable identity for a Postgres row, belongs to a domain package.

The extraction pipeline has four stages. Only the first is agentics:

| Stage       | What it does                                       | Belongs in                            |
| ----------- | -------------------------------------------------- | ------------------------------------- |
| **Parse**   | prompt → model call → schema-validated draft       | `@selecta/agentics/submission-parser` |
| **Resolve** | mention text → catalog/library candidate           | `@selecta/submissions`                |
| **Decide**  | pure policy gates over plan + candidates           | `@selecta/submissions`                |
| **Apply**   | imports a track, commits a transition, mints a key | `@selecta/submissions`                |

Why `@selecta/submissions` and not somewhere new: it already owns proposals and the extraction lifecycle, and it already depends on `@selecta/library` and `@selecta/db`. Adding `submissions → agentics` is a new edge but stays acyclic, because agentics imports no `@selecta/*` package at all.

**Do not move this code into `apps/api`**, even though the API is its only caller. `apps/api` has no `test` script (`apps/api/package.json`), so that would silently orphan four unit-test files.

---

## 2. Target layout

Before (current `main` + DJ-134):

```text
packages/agentics/src/
  core/            errors, harness, limits, logging, prompt, types
  submission-parser/
    content-types.ts
    index.ts
    agent/         20 files: parse, prompts, schemas, resolve, policy, apply, keys, ports
```

After this ticket:

```text
packages/agentics/src/
  core/
    errors.ts  harness.ts  limits.ts  logging.ts  prompt.ts  types.ts
    provider.ts                        # moved in, Step 6
    index.ts
  submission-parser/                   # flat — no agent/ subfolder
    content-types.ts
    confidence.ts
    schema.ts
    single-transition-schema.ts
    orchestrator-prompt.ts
    parse-single-transition.ts
    limits.ts                          # SUBMISSION_LIMITS, trimmed
    index.ts

packages/submissions/src/
  submissions.ts  proposals.ts  submission-track-links.ts  errors.ts
  constants.ts                         # new, client-safe — Step 2
  pipeline/                            # new — Step 5
    ports.ts                           # was agent/services.ts, split in Step 4
    candidate-registry.ts
    match.ts
    resolve-proposals-batch.ts
    policy.ts
    proposal-policy.ts
    apply-proposal-policy.ts
    reviewer-policy.ts
    proposal-key.ts
    index.ts
  index.ts
```

Import surface afterwards:

| Import path                           | Contains                                              |
| ------------------------------------- | ----------------------------------------------------- |
| `@selecta/agentics` / `.../core`      | bounded harness, logging, prompt composition          |
| `@selecta/agentics/submission-parser` | draft + plan schemas, prompts, the parse call, caps   |
| `@selecta/submissions`                | persistence **and** the resolve/decide/apply pipeline |
| `@selecta/submissions/constants`      | client-safe intake constants                          |

---

## 3. Decisions

| ID  | Question                                           | Decision                                                                                                                                                                                                               |
| --- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | New package for the pipeline?                      | **No.** Put it in `packages/submissions/src/pipeline/`. DJ-134 just removed a package; do not add one back. Section 1 explains why submissions is the right owner.                                                     |
| D2  | Delete the unused `runBoundedAgent` harness?       | **No — keep it.** `ARCHITECTURE.md:321` documents it as intentionally available for future multi-step agents. It is self-contained, tested, and costs nothing. Just stop pretending it is load-bearing.                |
| D3  | Delete `resolve-mentions.ts`?                      | **Yes.** It is a dead alternative to `resolve-proposals-batch.ts`, which is what production calls. See §4.1 for evidence.                                                                                              |
| D4  | Where does `SUBMISSION_LIMITS` live?               | **Stays in `submission-parser`.** It is one object and splitting it would churn nine call sites in the API workflow. The parser legitimately needs `maxTransitions` to build prompts; the pipeline imports the object. |
| D5  | Where does `confidence.ts` live?                   | **Stays in `submission-parser`**, same reasoning as D4 — the draft schemas use `CONFIDENCE_LEVELS`, and the pipeline imports the helpers.                                                                              |
| D6  | Collapse the write port into direct library calls? | **Out of scope.** Once apply lives in submissions, `MusicWritePort` is pure indirection — but removing it changes signatures, callers, and tests. Separate ticket, after this lands.                                   |
| D7  | Keep `SubmissionAgentServices` as one name?        | **No.** Split it (Step 4). One five-method interface spanning reads and writes is the reason resolve and apply feel inseparable.                                                                                       |

---

## 4. Facts verified in the current tree

Re-verify anything here that your edits depend on. Commands assume repo root.

### 4.1 Dead code — exported, but no caller outside its own test

Every symbol below has **zero** references outside `packages/agentics` and its own test files:

```bash
for sym in resolveSubmissionMentions withCandidateRegistry OrchestratorFinishSchema \
           meetsAutoCommitConfidence assertRawTextWithinLimit getSubmissionParserStatus \
           maxConcurrentParses; do
  echo "== $sym"; rg -l "$sym" --glob '!*.md' --glob '!packages/agentics/**' .
done
```

| Symbol / file                                                                 | Evidence                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolve-mentions.ts` + `.test.ts` (294 lines)                                | `resolveSubmissionMentions` referenced only by its own test. Production uses `resolveProposalsBatch`.                                                                                                          |
| `withCandidateRegistry`                                                       | Defined in `agent/candidate-registry.ts`, never called anywhere. `CandidateRegistry` itself **is** used — keep the class.                                                                                      |
| `OrchestratorFinishSchema` / `OrchestratorFinish`                             | Defined + re-exported from the barrel, never imported.                                                                                                                                                         |
| `meetsAutoCommitConfidence`                                                   | Only `confidence.test.ts`. `confidenceOrdinal` **is** used by `proposal-policy.ts` — keep it.                                                                                                                  |
| `assertRawTextWithinLimit`, `utf8ByteLength`, `SUBMISSION_LIMITS.maxRawBytes` | Only `proposal-key.test.ts`. Real enforcement is `requireRawText` in `packages/submissions/src/submissions.ts:103-116`.                                                                                        |
| `SUBMISSION_LIMITS.maxConcurrentParses`                                       | Never read.                                                                                                                                                                                                    |
| `getSubmissionParserStatus`                                                   | Never called. (Its `@selecta/mix-notes` ancestor was dead too.)                                                                                                                                                |
| `searchLibraryTracks` (port method)                                           | Implemented in `apps/api/lib/submission-agent-services.ts:33` and wrapped by `withCandidateRegistry`, but **no resolver calls it**. Both resolvers use `searchSpotifyTracks` + `findLibraryTrackByExternalId`. |

`runBoundedAgent`, `clampAgentLimits`, and `AgentError` are also uncalled outside agentics — but per **D2** they stay.

### 4.2 The 64 KB intake cap exists three times

| Location                                                    | Symbol                          |
| ----------------------------------------------------------- | ------------------------------- |
| `packages/submissions/src/submissions.ts:27`                | `MAX_SUBMISSION_RAW_BYTES`      |
| `packages/agentics/src/submission-parser/agent/limits.ts:7` | `SUBMISSION_LIMITS.maxRawBytes` |
| `apps/web/lib/submissions/limits.ts:2`                      | `MAX_SUBMISSION_RAW_BYTES`      |

They have already drifted: submissions says `Shorten the text and retry`, the agentics copy still says `Shorten the note and retry` (DJ-136 only updated one). `utf8ByteLength` is also duplicated inline at `apps/web/components/add/new-submission-form.tsx:16`.

### 4.3 Consumers of `@selecta/agentics/submission-parser`

Five files, all in `apps/api`:

| File                                    | Imports                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workflows/process-submission.steps.ts` | `applyProposalPolicy`, `buildOrchestratorPrompt`, `buildOrchestratorUserPrompt`, `confidenceToUnitInterval`, `DEFAULT_ORCHESTRATOR_MODEL`, `draftToSingleUnresolvedPlan`, `evaluateProposalPolicy`, `ORCHESTRATOR_AGENT_NAME`, `ORCHESTRATOR_PROMPT_VERSION`, `ParseSingleTransitionInputSchema`, `parseSingleTransitionDraft`, `resolveProposalsBatch`, `sourceFingerprint`, `spanProposalKey`, `SUBMISSION_LIMITS`, + 3 types |
| `lib/proposal-actions.ts`               | `applyProposalPolicy`, `draftToSingleUnresolvedPlan`, `evaluateProposalPolicy`, `resolveProposalsBatch`, + 4 types                                                                                                                                                                                                                                                                                                              |
| `lib/submission-agent-services.ts`      | `graphCandidateHandle`, `spotifyCandidateHandle`, + 3 types                                                                                                                                                                                                                                                                                                                                                                     |
| `lib/proposals.ts`                      | `parseCandidateHandle`                                                                                                                                                                                                                                                                                                                                                                                                          |
| `app/proposals/[id]/approve/route.ts`   | `assertReviewerEndpoint`, `buildReviewerPolicyResult`, `draftToSingleUnresolvedPlan`, + 3 types                                                                                                                                                                                                                                                                                                                                 |

`apps/web` imports nothing from agentics (DJ-134 removed the unused dependency).

### 4.4 Which module each `agent/` file belongs to

| File                          | Destination                | Why                                                            |
| ----------------------------- | -------------------------- | -------------------------------------------------------------- |
| `orchestrator-prompt.ts`      | parser                     | builds system/user prompts                                     |
| `parse-single-transition.ts`  | parser                     | the model call                                                 |
| `schema.ts`                   | parser                     | plan schemas + candidate-handle helpers                        |
| `single-transition-schema.ts` | parser                     | draft schema                                                   |
| `confidence.ts`               | parser (D5)                | parser output vocabulary                                       |
| `limits.ts`                   | parser (D4)                | `maxTransitions` is baked into the prompt                      |
| `provider.ts`                 | **core**                   | generic `openai/gpt-…` → `openai`; nothing submission-specific |
| `services.ts`                 | **pipeline** as `ports.ts` | no parser file imports it                                      |
| `candidate-registry.ts`       | **pipeline**               | collects search results                                        |
| `match.ts`                    | **pipeline**               | search-query shaping                                           |
| `resolve-proposals-batch.ts`  | **pipeline**               | calls the search port                                          |
| `policy.ts`                   | **pipeline**               | gate/action types                                              |
| `proposal-policy.ts`          | **pipeline**               | decides                                                        |
| `apply-proposal-policy.ts`    | **pipeline**               | **writes**                                                     |
| `reviewer-policy.ts`          | **pipeline**               | human approve/resolve → write path                             |
| `proposal-key.ts`             | **pipeline**               | durable Postgres row identity                                  |
| `resolve-mentions.ts`         | **deleted** (D3)           | dead                                                           |

---

## 5. Step 1 — delete dead code

Do this first. It removes roughly 400 lines and barely touches anything else.

1. Delete `packages/agentics/src/submission-parser/agent/resolve-mentions.ts` and `resolve-mentions.test.ts`.
2. In `agent/candidate-registry.ts`, delete `withCandidateRegistry`. Keep `class CandidateRegistry`.
3. In `agent/single-transition-schema.ts`, delete `OrchestratorFinishSchema` and `type OrchestratorFinish`.
4. In `agent/confidence.ts`, delete `meetsAutoCommitConfidence`. In `confidence.test.ts`, delete only the assertions that call it — keep the `confidenceOrdinal` and `confidenceToUnitInterval` cases.
5. In `agent/limits.ts`, delete `maxRawBytes`, `maxConcurrentParses`, `utf8ByteLength`, and `assertRawTextWithinLimit`. Keep `maxTransitions`, `maxChildRetries`, `maxOrchestrationSteps`, `resolveBatchSize`, `maxImportsPerProposal`, and `type SubmissionLimits`.
6. In `agent/proposal-key.test.ts`, delete the whole `describe("submission limits", …)` block and its now-unused import. Keep `describe("proposal keys", …)`.
7. In `agent/services.ts`, delete the `searchLibraryTracks` member. Then delete its implementation in `apps/api/lib/submission-agent-services.ts` (the block starting at `:33`) and remove it from the `Pick<…>` service type at `resolve-proposals-batch.ts:15`.
8. In `submission-parser/index.ts`, delete `getSubmissionParserStatus` and every barrel entry for a symbol deleted above.

**Verify**

```bash
pnpm --filter @selecta/agentics test
pnpm lint && pnpm typecheck && pnpm format:check
rg -n "resolveSubmissionMentions|withCandidateRegistry|OrchestratorFinish|meetsAutoCommitConfidence|assertRawTextWithinLimit|getSubmissionParserStatus|maxConcurrentParses|maxRawBytes|searchLibraryTracks" --glob '!*.md' .
```

The final `rg` must print nothing. Expect the agentics suite to drop from 33 tests to roughly 27.

---

## 6. Step 2 — one source of truth for the intake cap

1. Create `packages/submissions/src/constants.ts`. Mirror the header comment style of `packages/library/src/constants.ts`, which documents itself as client-safe:

   ```ts
   /**
    * Intake constants shared by the API and the browser.
    *
    * This module is client-safe: no runtime imports from `client` / `pg` / drizzle
    * schema tables. Import from `@selecta/submissions/constants` in browser code.
    */
   export const MAX_SUBMISSION_RAW_BYTES = 64 * 1024;

   export function utf8ByteLength(text: string): number {
     return new TextEncoder().encode(text).byteLength;
   }
   ```

2. Add the subpath to `packages/submissions/package.json`, exactly like `@selecta/library` does:

   ```json
   "exports": {
     ".": "./src/index.ts",
     "./constants": "./src/constants.ts"
   }
   ```

3. In `packages/submissions/src/submissions.ts`, delete the local `MAX_SUBMISSION_RAW_BYTES` declaration and import it from `./constants`. Re-export it from `src/index.ts` so existing consumers keep working. Use `utf8ByteLength` inside `requireRawText` instead of the inline `new TextEncoder()`.

4. In `apps/web`: delete `apps/web/lib/submissions/limits.ts`. In `components/add/new-submission-form.tsx`, delete the local `utf8ByteLength` and import both symbols from `@selecta/submissions/constants`. This works in a client component — `apps/web/components/tracks/tag-editor.tsx:6` already imports `@selecta/library/constants` the same way, and `@selecta/submissions` is already in `transpilePackages` (`apps/web/next.config.ts:13`).

**Verify**

```bash
pnpm --filter @selecta/web typecheck && pnpm --filter @selecta/submissions test
pnpm lint && pnpm typecheck && pnpm format:check
rg -n "64 \* 1024" packages apps        # exactly one hit: packages/submissions/src/constants.ts
```

Then `pnpm dev`, open `/add`, and paste text into the submission box: the byte counter and the over-limit warning must still work.

---

## 7. Step 3 — move `TRANSITION_QUALITIES` to the library

Transition vocabulary belongs with its siblings. `TRANSITION_INTENTS` and `TRANSITION_TECHNIQUES` already live in `packages/library/src/constants.ts`; `TRANSITION_QUALITIES` is stranded in the parser.

1. Move `TRANSITION_QUALITIES` and `type TransitionQuality` into `packages/library/src/constants.ts`, next to the existing allow-lists. Add an `isTransitionQuality` guard to match the file's existing pattern.
2. Leave `SUBMISSION_CONTENT_TYPES` / `SubmissionContentType` in `submission-parser/content-types.ts` — those classify parser output, not music.
3. `agent/schema.ts` imports `TRANSITION_QUALITIES` from `@selecta/library/constants`. This requires adding `"@selecta/library": "workspace:*"` to `packages/agentics/package.json`.
4. In `packages/library/src/neighborhood.ts`, make `transitionQualityRank` take `TransitionQuality | null | undefined` instead of `string | null | undefined` where the call sites allow it, so the ladder and the enum cannot drift.

> **STOP AND ASK** if step 3 feels wrong to you. It is the one place in this plan where agentics gains a dependency on a domain package. The alternative is to leave `TRANSITION_QUALITIES` in `content-types.ts` and accept the duplication. Either is defensible; do not silently invent a third option.

**Verify**

```bash
pnpm --filter @selecta/library test && pnpm --filter @selecta/agentics test
pnpm lint && pnpm typecheck && pnpm format:check
```

---

## 8. Step 4 — split the services port

This is a types-only change. No function body changes. Do it before Step 5 so the move is a clean cut.

In `agent/services.ts`, replace the single `SubmissionAgentServices` with two interfaces, keeping every method signature byte-identical:

```ts
/** Read-only candidate lookup used by mention resolution. */
export type CandidateSearchPort = {
  searchSpotifyTracks: (input: SearchQueriesInput) => Promise<SearchCandidatesOutput>;
  findLibraryTrackByExternalId: (input: {
    provider: string;
    providerId: string;
  }) => Promise<TrackCandidate | null>;
};

/** Deterministic writes — never exposed as LLM tools. */
export type MusicWritePort = {
  importSpotifyTrack: (input: {/* unchanged */}) => Promise<{ trackId: string; created: boolean }>;
  commitTransition: (input: {
    /* unchanged */
  }) => Promise<{ id: string | null; proposalKey: string; created: boolean }>;
};

/** Everything the pipeline needs. Kept so existing call sites compile unchanged. */
export type SubmissionAgentServices = CandidateSearchPort & MusicWritePort;
```

Keeping the intersection alias means `apps/api/lib/submission-agent-services.ts` and every consumer keep compiling with no edit. Then narrow the internals:

- `resolve-proposals-batch.ts` — replace its `Pick<SubmissionAgentServices, …>` with `CandidateSearchPort`.
- `candidate-registry.ts` — type its wrapper against `CandidateSearchPort`.
- `apply-proposal-policy.ts` — change `services: SubmissionAgentServices` to `services: MusicWritePort`.
- `apply-proposal-policy.test.ts` — its three service mocks currently stub all five methods; drop the search stubs the narrowed type no longer requires.

**Verify**

```bash
pnpm --filter @selecta/agentics test
pnpm lint && pnpm typecheck && pnpm format:check
```

---

## 9. Step 5 — move resolve, decide, and apply into `@selecta/submissions`

The big step. Nine files move; no logic changes.

1. Add the dependency to `packages/submissions/package.json`:

   ```json
   "@selecta/agentics": "workspace:*"
   ```

   Then run `pnpm install`. Confirm `pnpm-lock.yaml` changed and no `package-lock.json` appeared.

2. Move these files from `packages/agentics/src/submission-parser/agent/` to `packages/submissions/src/pipeline/`, using the `cp -a && git add && git rm` recipe from §0:

   | From                                    | To                                               |
   | --------------------------------------- | ------------------------------------------------ |
   | `services.ts`                           | `pipeline/ports.ts`                              |
   | `candidate-registry.ts`                 | `pipeline/candidate-registry.ts`                 |
   | `match.ts` + `.test.ts`                 | `pipeline/match.ts` + `.test.ts`                 |
   | `resolve-proposals-batch.ts`            | `pipeline/resolve-proposals-batch.ts`            |
   | `policy.ts`                             | `pipeline/policy.ts`                             |
   | `proposal-policy.ts` + `.test.ts`       | `pipeline/proposal-policy.ts` + `.test.ts`       |
   | `apply-proposal-policy.ts` + `.test.ts` | `pipeline/apply-proposal-policy.ts` + `.test.ts` |
   | `reviewer-policy.ts` + `.test.ts`       | `pipeline/reviewer-policy.ts` + `.test.ts`       |
   | `proposal-key.ts` + `.test.ts`          | `pipeline/proposal-key.ts` + `.test.ts`          |

3. Fix imports in the moved files. Anything they need from the parser now comes from the package:

   ```ts
   import {
     type SubmissionProcessingPlan,
     type SubmissionTransitionPlan,
     parseCandidateHandle,
     SUBMISSION_LIMITS,
     AUTO_COMMIT_CONFIDENCE_FLOOR,
     confidenceOrdinal,
     confidenceToUnitInterval,
     type ConfidenceLevel,
   } from "@selecta/agentics/submission-parser";
   ```

   Sibling imports inside `pipeline/` stay relative (`./ports`, `./policy`, `./match`).

4. Create `packages/submissions/src/pipeline/index.ts` re-exporting the same names the parser barrel exported for these files: `CandidateRegistry`, `mentionSearchQuery`, `stripCueSuffixesFromSearchQuery`, `topSearchHit`, `resolveProposalsBatch`, `evaluateProposalPolicy`, `applyProposalPolicy`, `buildReviewerPolicyResult`, `assertReviewerEndpoint`, `sourceFingerprint`, `spanProposalKey`, the port types, and every `Policy*` / `Proposal*` / `Resolve*` / `Reviewer*` type.

5. Re-export the pipeline barrel from `packages/submissions/src/index.ts` (`export * from "./pipeline";` or an explicit block matching the file's existing style), and delete the moved entries from `submission-parser/index.ts`.

6. Update the five API consumers from §4.3. Symbols that moved come from `@selecta/submissions`; parse symbols stay on `@selecta/agentics/submission-parser`. For example `lib/proposal-actions.ts` ends up with `applyProposalPolicy`, `evaluateProposalPolicy`, `resolveProposalsBatch`, `ProposalPolicyResult`, and `SubmissionAgentServices` from `@selecta/submissions`, and only `draftToSingleUnresolvedPlan`, `SubmissionProcessingPlan`, and `SingleTransitionDraft` from the parser.

7. Delete the now-empty `agent/` directory only after Step 6 flattens the remaining files.

**Verify**

```bash
pnpm install
pnpm --filter @selecta/agentics test
pnpm --filter @selecta/submissions test     # picks up src/**/*.test.ts — no Postgres needed
pnpm --filter @selecta/api typecheck && pnpm --filter @selecta/web typecheck
pnpm lint && pnpm typecheck && pnpm format:check
```

Then confirm the layering holds — both must print nothing:

```bash
rg -n "@selecta/(submissions|library|db)" packages/agentics/src   # except the Step 3 library/constants import
rg -n "importSpotifyTrack|commitTransition\(" packages/agentics/src
```

Finally run the stack (`pnpm dev`) and exercise **Add → extract → Library → review → approve → Graph provenance** end to end. Step 5 is the one most likely to produce a runtime-only failure that typecheck misses, because the workflow sandbox loads these modules dynamically.

---

## 10. Step 6 — tidy agentics

1. Move `agent/provider.ts` and `agent/provider.test.ts` to `core/provider.ts` and `core/provider.test.ts`. Export `providerFromModel` from `core/index.ts`. `parse-single-transition.ts` imports it from `../core/provider`; drop it from the parser barrel.
2. Flatten the rest: move the six remaining files out of `agent/` up into `submission-parser/`, then delete the empty `agent/` directory. Fix the now-shorter relative imports (`../content-types` becomes `./content-types`, `../../core/logging` becomes `../core/logging`).
3. Update the two stale doc comments the pre-Postgres world left behind:
   - `proposal-key.ts` (now in submissions) says _"Durable proposal identity for Neo4j MERGE + Postgres unique constraint"_ — Neo4j is gone (DJ-85).
   - `confidence.ts` says _"Map enum → 0..1 for Neo4j / notes.extractionConfidence storage"_ — same, and `notes` is now `submissions` (DJ-136).
4. Per **D2**, add one line to `core/index.ts` noting that `runBoundedAgent` is intentionally unused and reserved for future multi-step agents, so the next reader does not spend time deciding whether it is dead.

**Verify**

```bash
pnpm --filter @selecta/agentics test
pnpm lint && pnpm typecheck && pnpm format:check
test -d packages/agentics/src/submission-parser/agent && echo "FAIL: agent/ still exists" || echo "ok"
```

---

## 11. Step 7 — docs

Update every doc that names a path this ticket moved:

| File                                     | What to change                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| `README.md`                              | Monorepo layout block — note that submissions owns the pipeline                |
| `AGENTS.md`                              | Monorepo section — same                                                        |
| `.cursor/rules/monorepo-layout.mdc`      | Same, plus the one-line rule from §1 so future agents place new code correctly |
| `dev-files/ARCHITECTURE.md`              | §13 repository structure tree; §7.2 pipeline stages if it names modules        |
| `dev-files/DJ36_PROPOSAL_REVIEW_PLAN.md` | Four `packages/agentics/src/submission-parser/agent/…` references              |
| `dev-files/PG_MIGRATION_REFACTOR.md`     | `…/agent/services.ts` reference                                                |
| `dev-files/SETS_ARCHITECTURE.md`         | `packages/agentics/src/submission-parser` reference                            |
| This file                                | Set `Status:` to **implemented**                                               |

Leave historical narrative in `DJ136_SUBMISSION_TERMINOLOGY_PLAN.md` alone. Its decision D4 ("do not rename the `@selecta/mix-notes` package") was already superseded by DJ-134; do not rewrite the record.

---

## 12. Out of scope

- **Collapsing `MusicWritePort` into direct `@selecta/library` calls** (D6). Do it in a follow-up.
- **Splitting `SUBMISSION_LIMITS`** into parse-time and pipeline-time objects (D4).
- **Deleting the `runBoundedAgent` harness** (D2).
- Any change to SQL names, migrations, wire keys, or `.notes` fields. DJ-136 §2.1 lists the identifiers that must never be renamed — re-read it before touching anything with "note" in the name.

---

## 13. Final checklist

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm format:check
pnpm --filter @selecta/agentics test
pnpm --filter @selecta/submissions test
pnpm --filter @selecta/web test
pnpm db:test        # needs Docker + Postgres; see AGENTS.md for starting dockerd
pnpm build
```

Then confirm by hand:

- [ ] `packages/agentics/src` contains no `importSpotifyTrack`, `commitTransition(`, `createHash`-based proposal key, or `@selecta/db` import.
- [ ] `packages/agentics/src/submission-parser/agent/` does not exist.
- [ ] `64 * 1024` appears exactly once in the repo.
- [ ] No `package-lock.json`; `pnpm-lock.yaml` is the only lockfile.
- [ ] `apps/api/AGENTS.md` and `apps/api/CLAUDE.md` are not in the diff.
- [ ] Add → extract → review → approve → Graph provenance works against a live stack.
