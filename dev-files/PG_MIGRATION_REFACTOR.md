# Postgres-only music store migration (Neo4j removal)

> Architecture decision + full refactor plan for consolidating tracks,
> artists, vocabulary, and transitions from Neo4j into Postgres.
>
> Status: **implemented** — PG-1…PG-5 landed (DJ-81…DJ-85); docs/tickets
> reconciled in PG-7 (DJ-87). Optional PG-6 data export remains if needed.
> Baseline: `main` after DJ-66 / DJ-71 / DJ-72 / DJ-73 / DJ-74; cutover DJ-84;
> Neo4j package removed DJ-85.
>
> Companion docs: [`NEXT_PRODUCT_ARCHITECTURE.md`](./NEXT_PRODUCT_ARCHITECTURE.md)
> (product model — single-store invariants applied),
> [`TICKET_ORDER.md`](./TICKET_ORDER.md) (canonical implementation order).

## 1. Decision

**Move the entire music domain (Track, Artist, Genre, Subgenre, Folder,
TRANSITION) from Neo4j into Postgres. Remove Neo4j from the stack.**

### Why

Every query the app runs today is 1–2 hops and the graph is one DJ's library
(thousands of nodes/edges at most). Meanwhile the two-store split is the direct
cause of the most complex machinery in the codebase:

1. **No cross-store transaction.** Committing a proposal requires the
   idempotent saga: Postgres intent → Neo4j MERGE → Postgres status update →
   reconciliation for interrupted writes (`note_transition_commits` +
   `getTransitionCommitByKey` replay checks in
   `apps/api/workflows/process-submission.steps.ts`). In one Postgres this is
   a single transaction; the whole failure class disappears.
2. **Application-level joins.** `GET /transitions` fetches edges from Neo4j
   then batch-loads Postgres proposals by `sourceProposalId` and merges in JS.
   `loadSerializedTrackLinks` does per-row `getTrackById` round trips. These
   become single SQL joins.
3. **No referential integrity.** `note_track_links.track_id`,
   `note_transition_commits.from_track_id/to_track_id`, and every
   `sourceNoteId`/`sourceProposalId` edge property are opaque strings with no
   FK. Postgres gives real FKs and cascade semantics.
4. **Operational surface.** Second Docker service, second migration system
   (`graph:migrate` + constraints), second driver/client singleton, second
   health probe, `NEO4J_*` env, Aura hosting later.
5. **Future features point at Postgres too.** Similarity vectors are
   pgvector's home turf. Precomputed similarity is a scored join table.
   Bounded pathfinding over a personal library is a recursive CTE.

### When Neo4j would have been right

Deep variable-length traversal or GDS-style graph algorithms over a large
shared multi-tenant graph. Not on the roadmap; if that product pivot ever
happens, migrating a `transitions` table into a graph DB is mechanical.

## 2. Current state (inventoried 2026-08-07)

### 2.1 Neo4j data model (as implemented in `packages/graph`)

- **Nodes:** `Track` (id, title, bpm, musicalKey, durationSec, energy,
  artworkUrl, releaseDate, `externalIds` as `"provider:id"` string array,
  libraryId, timestamps), `Artist` / `Genre` / `Subgenre`
  (id, name, nameNormalized), `Folder` (+ optional `kind`: historically
  `folder` | `playlist` | `section` — **Postgres target drops `section`**),
  `Cue` (constraint only — **zero CRUD code**, drop from scope).
- **Relationships:** `(:Artist)-[:BY]->(:Track)`, `(:Track)-[:IN_GENRE]->(:Genre)`,
  `(:Track)-[:IN_SUBGENRE]->(:Subgenre)`, `(:Track)-[:IN_FOLDER]->(:Folder)`,
  `(:Track)-[:TRANSITION]->(:Track)`, `HAS_CUE` (declared, unused).
- **TRANSITION props:** `id` (unique), `proposalKey` (AI idempotency, indexed),
  `sourceNoteId`, `sourceNoteVersion`, `sourceProposalId`, `confidence`,
  `fromBar`, `toBar`, `barsOverlap`, `technique`, `intent`, `quality`,
  `notes`, `createdAt`, `updatedAt`.
- Vocab uniqueness via `nameNormalized` (`normalizeName`: trim → lower →
  collapse whitespace).

### 2.2 Consumers (complete list)

`@selecta/graph` is imported ONLY by:

- `apps/api/app/tracks/route.ts`, `tracks/[id]/route.ts`,
  `tracks/[id]/neighborhood/route.ts`, `tracks/stats/route.ts`
- `apps/api/app/transitions/route.ts`, `transitions/[id]/route.ts`
- `apps/api/app/notes/[id]/tracks/route.ts`, `app/health/route.ts`, `app/route.ts`
- `apps/api/lib/notes.ts`, `lib/transitions.ts`, `lib/note-agent-services.ts`
- `apps/web/components/tracks/folder-tag-editor.tsx` (**constants only**:
  `FOLDER_KINDS`, `FolderKind`)

`packages/agentics`, `packages/db` have **no** graph
dependency (services are injected; track ids are opaque strings).

Public graph functions actually used by consumers:
`isNeo4jConfigured`, `getGraphStatus`, `listTracks`, `getTrackById`,
`getTrackByExternalId`, `getLibraryStats`, `getTrackNeighborhood`,
`createTrack`, `createTransition`, `listTransitions`, `getTransitionById`,
`updateTransitionById`, `deleteTransitionById`, `commitTransitionProposal`,
`isGraphWriteError`, `FOLDER_KINDS`/`FolderKind`, plus I/O types.

### 2.3 Cross-store coupling to eliminate

- `GET /transitions` — Neo4j list + Postgres `getProposalsByIds` merge in JS.
- `loadSerializedTrackLinks` — Postgres links + per-link Neo4j `getTrackById`.
- `POST /notes/:id/tracks` — Neo4j existence check then Postgres write.
- Workflow commit — Neo4j MERGE then Postgres `upsertTransitionCommit` audit
  - idempotency replay reads.
- Opaque ids: `note_track_links.track_id`,
  `note_transition_commits.from_track_id/to_track_id`, edge provenance props.

### 2.4 Infra to remove

- `docker-compose.yml` `neo4j` service (image `neo4j:5-community`, ports
  7474/7687, volume `neo4j_data`).
- Root script `graph:migrate`; `scripts/dev-stack.mjs` invocation.
- `NEO4J_URI` / `NEO4J_USER` / `NEO4J_PASSWORD` in `.env.example` and README.
- `neo4j-driver` dependency; `transpilePackages: ["@selecta/graph"]` in both
  next configs.

## 3. Target Postgres schema (music domain)

New tables in `packages/db/src/schema.ts` (Drizzle) + one migration.
All ids are `text` UUIDs to match existing conventions and preserve current
Neo4j ids if data is imported.

```sql
tracks (
  id            text PK,
  title         text NOT NULL,
  bpm           real,
  musical_key   text,
  duration_sec  integer,
  energy        real,
  artwork_url   text,
  release_date  text,
  library_id    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
)
-- index: title (for sort), created_at, updated_at

track_external_ids (
  track_id     text NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  provider     text NOT NULL,           -- lowercased, no ':'
  provider_id  text NOT NULL,
  PRIMARY KEY (track_id, provider, provider_id),
  UNIQUE (provider, provider_id)        -- one library track per external id
)

artists    (id text PK, name text NOT NULL, name_normalized text NOT NULL UNIQUE, timestamps)
genres     (id text PK, name text NOT NULL, name_normalized text NOT NULL UNIQUE, timestamps)
subgenres  (id text PK, name text NOT NULL, name_normalized text NOT NULL UNIQUE, timestamps)
folders    (id text PK, name text NOT NULL, name_normalized text NOT NULL UNIQUE,
            kind folder_kind NULL,  -- pgEnum: 'folder' | 'playlist' only (`section` dropped)
            timestamps)

track_artists   (track_id FK CASCADE, artist_id FK CASCADE,  PRIMARY KEY (track_id, artist_id))
track_genres    (track_id FK CASCADE, genre_id FK CASCADE,   PRIMARY KEY (track_id, genre_id))
track_subgenres (track_id FK CASCADE, subgenre_id FK CASCADE, PRIMARY KEY (track_id, subgenre_id))
track_folders   (track_id FK CASCADE, folder_id FK CASCADE,  PRIMARY KEY (track_id, folder_id))

transitions (
  id                  text PK,
  from_track_id       text NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  to_track_id         text NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  proposal_key        text,             -- AI idempotency; NULL for manual edges
  source_note_id      text REFERENCES notes(id) ON DELETE SET NULL,
  source_note_version integer,
  source_proposal_id  text REFERENCES note_proposals(id) ON DELETE SET NULL,
  confidence          real,
  from_bar            integer,
  to_bar              integer,
  bars_overlap        integer,
  technique           text,
  intent              text,
  quality             text,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
)
-- UNIQUE INDEX transitions_proposal_key_uidx ON transitions(proposal_key) WHERE proposal_key IS NOT NULL
-- INDEX on from_track_id, INDEX on to_track_id
-- Parallel A→B edges are simply multiple rows. No uniqueness on (from,to).
```

Notes:

- `externalIds` moves from a `"provider:id"` string array to a proper join
  table; `getTrackByExternalId` and create-time dedupe become indexed lookups.
- The partial unique index on `proposal_key` + `INSERT … ON CONFLICT DO NOTHING`
  (then select) reproduces `commitTransitionProposal` MERGE semantics exactly,
  including the `${proposalKey}:rev` reverse-edge convention.
- Existing tables get FK upgrades in the cutover ticket (see §5, PG-4):
  `note_track_links.track_id` → FK to `tracks(id)` ON DELETE CASCADE;
  `note_transition_commits.from_track_id/to_track_id` → FK SET NULL.
- `Cue`/`HAS_CUE` are intentionally dropped (never implemented). If cues
  return, they are a `cues` table with a `track_id` FK.
- **Folder kinds are `folder` | `playlist` only.** Neo4j historically allowed
  `section`, but it never meant anything product-wise and is dropped from the
  Postgres `folder_kind` enum (and from `FOLDER_KINDS` when constants move in
  PG-2/PG-4). Existing Neo4j folders with `kind='section'` should be coerced
  to `folder` (or null) if PG-6 export runs.

## 4. Target module layout and API mapping

New module: `packages/db/src/music/` (exported from `@selecta/db` index).
Function contracts are kept as close as possible to the current graph package
so route handlers change imports, not logic.

| Current (`@selecta/graph`)                                        | Target (`@selecta/db` music module)                                            | Notes                                                                                                                                                      |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isNeo4jConfigured()`                                             | delete                                                                         | PG is always required; callers drop the guard                                                                                                              |
| `getGraphStatus()`                                                | delete                                                                         | health endpoint reports Postgres only                                                                                                                      |
| `createTrack(input)`                                              | `createTrack(input)`                                                           | same input/result; dedupe via `track_external_ids` lookup; one transaction                                                                                 |
| `listTracks(input)`                                               | `listTracks(input)`                                                            | same filters (q, subgenre/folder by id or normalized name, date bounds, sort title/createdAt/updatedAt, limit/offset, hasMore via limit+1)                 |
| `getTrackById(id)`                                                | `getTrackById(id)`                                                             | + `hasOutbound/InboundTransitions` via EXISTS                                                                                                              |
| `getTrackByExternalId(provider, id)`                              | same                                                                           | indexed lookup                                                                                                                                             |
| `getLibraryStats()`                                               | same                                                                           | `count(*)`, `max(updated_at)`                                                                                                                              |
| `getTrackNeighborhood(id)`                                        | same                                                                           | SQL join for outbound edges; **port ranking helpers as-is** (`transitionQualityRank`, `compareNeighborhoodNeighbors`, `rankNeighborhoodNeighbors` + tests) |
| `mergeArtist/Genre/Subgenre/Folder`                               | `ensureArtist/...` internal                                                    | `INSERT … ON CONFLICT (name_normalized) DO …` preserving current ON CREATE / folder-kind coalesce semantics                                                |
| `createTransition(input)`                                         | same                                                                           | plain INSERT, new UUID, no proposal_key                                                                                                                    |
| `getTransitionById(id)`                                           | same                                                                           | join endpoints + artists                                                                                                                                   |
| `listTransitions(input)`                                          | same                                                                           | same filters incl. `source` manual/ai (proposal_key + source_note_id nullness), q over titles/notes/artists                                                |
| `updateTransitionById(id, patch)`                                 | same                                                                           | partial UPDATE, bump updated_at, endpoints/provenance immutable                                                                                            |
| `deleteTransitionById(id)`                                        | same                                                                           | DELETE by id                                                                                                                                               |
| `commitTransitionProposal(input)`                                 | same                                                                           | `ON CONFLICT (proposal_key) DO NOTHING` + select-existing → `{ created }`                                                                                  |
| `GraphWriteError` / `isGraphWriteError`                           | `MusicWriteError` / `isMusicWriteError` (codes `invalid_input` \| `not_found`) | keep thrown-shape parity for route handlers                                                                                                                |
| `FOLDER_KINDS`, `FolderKind`, intents/techniques, `normalizeName` | move to db music module (or small shared constants file)                       | `FOLDER_KINDS = ["folder","playlist"]` — drop `section`; web imports update                                                                                |
| `AGENT_SAFE_GRAPH_SCHEMA`                                         | delete                                                                         | exported but unused today                                                                                                                                  |
| `readCypher`/`writeCypher`/driver                                 | delete                                                                         | —                                                                                                                                                          |

### The commit path becomes transactional

`applyProposalPolicy` currently: import tracks → `commitTransition` (Neo4j
MERGE) → `upsertTransitionCommit` (PG audit) → `updateProposal` (PG status),
with replay checks because any step can die between stores.

After migration, the service-level `commitTransition` runs **one Postgres
transaction**: insert transition (ON CONFLICT proposal_key) + upsert
`note_transition_commits` + set proposal `status='committed'`. Replay is a
no-op by construction. The `NoteAgentServices` interface shape in
`packages/agentics/src/submission-parser/agent/services.ts` does not change — only the
injected implementation in `apps/api/lib/note-agent-services.ts` does.
Reconciliation code for interrupted cross-store completion is deleted.

## 5. Ticket breakdown (implementation order)

Each ticket = one `dj-XXXX` branch. PG-1 → PG-4 are strictly serial.

1. **PG-1 — Schema: music domain tables in Postgres**
   Drizzle schema + migration for §3 (without touching existing tables or any
   consumer). Types exported. No behavior change anywhere.
2. **PG-2 — Track + vocabulary read/write helpers in `@selecta/db`**
   `createTrack`, `listTracks`, `getTrackById`, `getTrackByExternalId`,
   `getLibraryStats`, vocab ensure-helpers, `MusicWriteError`, constants,
   `normalizeName`. Valuable tests: external-id dedupe, filter/sort parity.
3. **PG-3 — Transition helpers: CRUD, idempotent commit, neighborhood**
   `createTransition`, `getTransitionById`, `listTransitions`,
   `updateTransitionById`, `deleteTransitionById`,
   `commitTransitionProposal`, `getTrackNeighborhood` + ported ranking.
   Valuable tests: parallel-edge identity, proposal-key idempotency, ranking.
4. **PG-4 — Cutover: API routes, agent services, workflow, FKs**
   Swap all 12 `apps/api` import sites + web constants import; transactional
   commit path; single SQL join for `GET /transitions` review enrichment and
   note track links; FK upgrades on `note_track_links` /
   `note_transition_commits`; health endpoint PG-only; delete reconciliation.
5. **PG-5 — Remove Neo4j from the stack**
   Delete `packages/graph`, `neo4j-driver`, Compose service, `graph:migrate`,
   env vars, README/docs references, `transpilePackages` entries.
6. **PG-6 (optional) — One-shot Neo4j → Postgres data export/import**
   Only if existing local graph data is worth preserving; otherwise reseed
   via the product UI during dogfood (DJ-47).
7. **PG-7 — Reconcile docs and open tickets**
   Update `ARCHITECTURE.md` §4/§6, `NEXT_PRODUCT_ARCHITECTURE.md` invariants,
   `TICKET_ORDER.md`; reword DJ-75, DJ-67, DJ-36, DJ-42 (Neo4j → Postgres
   terms, `DETACH DELETE` → FK cascade).

**Placement relative to existing roadmap:** land PG-1…PG-5 (PG-7) before
DJ-75, DJ-67, and DJ-36 so no further feature work builds on Neo4j.
PG-6 may run any time before DJ-47.

## 6. Invariant updates

Replacements for `NEXT_PRODUCT_ARCHITECTURE.md` §10 (applied in PG-7):

- ~~"Postgres owns submissions…; Neo4j owns tracks and committed transitions"~~
  → **One Postgres owns everything.** Music domain lives in dedicated tables;
  proposals/review/audit unchanged.
- ~~"LLM output never directly mutates Neo4j"~~ →
  **LLM output never directly mutates music tables.** Parsers write
  proposals; only deterministic policy/application code writes
  `tracks`/`transitions`.
- ~~Idempotent saga + reconciliation~~ →
  **Proposal commit is one ACID transaction.** Idempotency remains via the
  `proposal_key` unique index (replay safe by construction).
- Unchanged: immutable submissions, per-proposal partial commits, stable
  transition `id`, parallel A→B edges valid, edit/delete by edge id,
  auditable model/cost evidence, explicit limit failures.

## 7. Risks / notes

- **Behavior parity in list filters and ordering** — the ticket specs pin the
  current semantics (case-insensitive CONTAINS, normalized vocab matching,
  ISO-string date bounds, limit+1 `hasMore`). Tests assert parity where it
  can silently break (external-id dedupe, source manual/ai filter, ranking).
- **`release_date`/date bounds are stored as ISO strings today** — keep text
  comparison semantics in v1 to avoid subtle behavior changes; typed columns
  can follow later.
- **In-flight rows** — `note_transition_commits.payload.transitionId` values
  from old runs reference Neo4j edge ids; PG-6 maps them or they are accepted
  as historical audit (payload is jsonb, no FK).
- **Live Mode future pathfinding** — bounded recursive CTE over
  `transitions`; no schema change needed.
- **Similarity vectors later** — enable `pgvector`, add
  `track_embeddings(track_id FK, embedding vector)`; orthogonal to this plan.
