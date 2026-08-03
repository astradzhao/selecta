# Selecta — Architecture Plan

<!-- Product + GitHub repo: selecta. Package scope: @selecta/*. -->

> Status: planning only — no implementation yet  
> Last updated: 2026-08-02  
> Linear: DJ Project team document (see “Linear tracking” below)

---

## 1. Product vision

A **DJ-helping note-taking app** where DJs capture knowledge about songs and transitions in **natural language**. Those notes are automatically parsed into a **Neo4j graph** so that, during a live set, the DJ can update “I am on song X (around bar N)” and instantly see:

- Which songs are good next
- Why each transition works (technique, timing, energy intent)
- Intra-song opportunities (loops, hype builds, cool-downs) that are not song→song edges

**Near-term focus:** NL → structured graph notes + a live “what’s next” UX.  
**Far-term (explicitly out of scope for v1):** music embeddings, auto-suggested paths, DJ software sync (Serato / Rekordbox / Traktor / VirtualDJ).

### Core user promise

> Write how you think about mixing. Play with a graph that thinks the same way.

---

## 2. Problem framing

DJs accumulate tribal knowledge that is hard to reuse under pressure:

| Knowledge type   | Example                                             | Graph shape                                |
| ---------------- | --------------------------------------------------- | ------------------------------------------ |
| Transition       | “A → B at bar 16 with HPF, great for building hype” | `Song -[:TRANSITION]-> Song` + edge props  |
| Intra-song cue   | “At bar 32 on track A, 4-bar loop builds hype”      | `Song -[:HAS_CUE]-> Cue`                   |
| Artist / catalog | “Other tracks by this artist”                       | `Artist -[:BY]-> Song`                     |
| Genre            | “UKG / techno — multi-tag”                          | `Song -[:IN_GENRE]-> Genre` (many edges)   |
| Song metadata    | BPM, key, energy                                    | `Song` **properties** (scalars)            |
| Set context      | Current song + energy goal                          | Postgres session → Cypher over music graph |

The product is **not** a DAW or mixer. It is a **knowledge + decision surface** for live performance.

---

## 3. Design principles

1. **Notes first, schema second** — DJs write plain language; the system proposes structure; humans confirm when ambiguous.
2. **Graph is the source of truth for relationships** — transitions and cues live in Neo4j; raw note text is retained for audit/replay.
3. **Live mode is glanceable** — large type, few taps, phone/tablet friendly; no dense dashboards during a set.
4. **Intentional vocabulary, not rigid ontology** — seed controlled terms (`build_hype`, `cool_down`, `hpf`, `loop`) but allow free-form labels that can be normalized later.
5. **Confirm before mutate (early)** — NL extraction returns a preview diff; user accepts into the graph. Auto-commit can come later once trust is high.
6. **Music-only Neo4j** — users, notes, and sessions stay in Postgres; the graph is traversable musical knowledge.
7. **Multi-tenant via membership** — Postgres library↔song IDs scope all Cypher (even if v1 UX is single-user).

---

## 4. Storage split: Postgres vs Neo4j

**Decision (locked): split stores. Neo4j holds only musical knowledge.**

| Store        | Owns                                                                                                                        | Does not own                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Postgres** | Users/auth, libraries, sessions, raw notes + extraction previews/commits, song↔user membership (`library_songs`), app audit | Music topology / mix relationships |
| **Neo4j**    | Songs, artists, genres, transitions, cues, (later) intent/technique hubs & artist similarity                                | Users, notes, sessions, auth       |

### Why not `(:User)-[:OWNS]->(:Song)` / `(:Note)`?

Those edges were tenancy scaffolding for an all-in-Neo4j design. They are **removed** because:

1. Users, notes, and sessions are not musical concepts — they pollute traversal and mental model.
2. Ownership/membership is a classic relational concern (library membership table in Postgres).
3. Live/graph queries should read as “song → transition → song → artist → genre”, not “user → owns → …”.

### How tenancy works with a music-only graph

- Postgres `library_songs(library_id, song_id)` (and similar for cues if needed) defines which Neo4j song IDs a user can see/edit.
- API always: auth → resolve allowed `song_id`s → Cypher with parameterized IDs.
- Optional denormalized `libraryId` property on `Song`/`Cue` for defense-in-depth filtering — **not** a `User` node.
- Artists/Genres are **shared vocabulary nodes** (MERGE by canonical name). Songs remain library-scoped; artists/genres are reusable hubs across a user’s library (and later across users if we ever share graphs).

```
Postgres                         Neo4j (music only)
────────                         ─────────────────
User ── Library                  Artist ──BY── Song ──IN_GENRE── Genre
           │                              │
           │ library_songs                ├──TRANSITION──► Song
           │                              └──HAS_CUE──► Cue
         Note / Session
```

---

## 5. Domain model

### 5.1 Primary entities

```
Postgres:
  User → Library → membership → songIds
  Note (raw NL + extraction)
  Session (live runtime)

Neo4j:
  Artist ──[:BY]── Song ──[:IN_GENRE]── Genre
  Song ──[:TRANSITION]──► Song
  Song ──[:HAS_CUE]──► Cue
```

### 5.2 Node vs property decision rule

Promote to a **node** when most of these are true:

1. **Shared identity** — reused across many songs (Artist, Genre)
2. **Traversal hub** — you want queries like “song → artist → other songs” or “genre → songs”
3. **Own relationships later** — e.g. `(:Artist)-[:SIMILAR_TO]->(:Artist)`, `(:Genre)-[:RELATED_TO]->(:Genre)`
4. **Many-to-many** — a song has multiple genres; encoding as a CSV property fights the graph
5. **First-class UI object** — browsable/filterable entity, not just a field on a form

Keep as a **property** when most of these are true:

1. **Scalar attribute of one entity** — BPM, key, duration, energy score
2. **Not a useful hub** — you rarely start a query _from_ that value as an entity
3. **High-cardinality / free text** — titles, rationale notes, external ID strings
4. **Edge-local fact** — `fromBar`, `toBar`, `barsOverlap`, `quality` on a specific transition
5. **Enum that only filters one relationship type** — can start as an edge property; promote later if it becomes a hub

| Concept                                     | v1 shape                                                          | Why                                                     |
| ------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------- |
| Song                                        | **Node**                                                          | Central entity                                          |
| Artist                                      | **Node** (required ≥1 via `BY`)                                   | Traverse song→artist→songs; future similarity           |
| Genre                                       | **Node** + `IN_GENRE` edges (required ≥1)                         | Multi-genre; traverse genre→songs                       |
| Cue                                         | **Node**                                                          | Time-anchored object with its own fields; many per song |
| Transition                                  | **Relationship**                                                  | Directed mix fact between two songs                     |
| BPM / key / energy / duration               | **Song properties**                                               | Scalars; filtering ok via indexes, not hubs             |
| Title                                       | **Song property**                                                 | Identity string, not a hub                              |
| Transition bars / overlap / quality / notes | **Edge properties**                                               | Local to that mix instance                              |
| Intent (`build_hype`, …)                    | **Edge/Cue property in v1** → optional **Intent node** in Phase 2 | Start simple; promote when faceting/analytics need hubs |
| Technique (`hpf`, `bass_swap`, …)           | **Edge/Cue property in v1** → optional **Technique node** later   | Same as intent                                          |
| User / Note / Session                       | **Postgres only**                                                 | Not musical graph                                       |

**Rule of thumb:** if you would ever write “find all X connected through Y”, Y is probably a node. If you would write “filter songs where field = value”, it can stay a property.

### 5.3 Song (Neo4j node)

| Field         | Required    | Notes                                               |
| ------------- | ----------- | --------------------------------------------------- |
| `id`          | yes         | UUID (also referenced from Postgres membership)     |
| `title`       | yes         | Display / search                                    |
| `bpm`         | no          | Float                                               |
| `musicalKey`  | no          | Camelot / open key string                           |
| `durationSec` | no          |                                                     |
| `energy`      | no          | Ordinal or 0–1                                      |
| `externalIds` | no          | Map/JSON-ish for Spotify, Beatport, Rekordbox later |
| `libraryId`   | recommended | Defense-in-depth scope (mirrors Postgres)           |

**Not song properties:** artist name, genre list — those are relationships.

Creating a song requires:

- ≥1 `(:Artist)-[:BY]->(:Song)` (primary artist first; features allowed as additional `BY` or later `FEATURES`)
- ≥1 `(:Song)-[:IN_GENRE]->(:Genre)`

### 5.4 Artist (Neo4j node)

| Field            | Required | Notes                                      |
| ---------------- | -------- | ------------------------------------------ |
| `id`             | yes      | UUID                                       |
| `name`           | yes      | Canonical display name                     |
| `nameNormalized` | yes      | Lowercased / stripped for MERGE uniqueness |

Relationships:

```cypher
(:Artist)-[:BY]->(:Song)                 // required for every song
// Phase 3+:
(:Artist)-[:SIMILAR_TO {score?, notes?}]->(:Artist)
```

Traversal example: current song → artist → other songs by same artist (excluding current), useful as Live Mode fallback when few transitions exist.

### 5.5 Genre (Neo4j node)

| Field            | Required | Notes                         |
| ---------------- | -------- | ----------------------------- |
| `id`             | yes      | UUID                          |
| `name`           | yes      | e.g. `techno`, `ukg`, `disco` |
| `nameNormalized` | yes      | For MERGE                     |

Relationships:

```cypher
(:Song)-[:IN_GENRE]->(:Genre)            // multi-genre via multiple edges
// Optional later:
(:Genre)-[:RELATED_TO]->(:Genre)
```

Direction note: either `Song-[:IN_GENRE]->Genre` or `Genre-[:HAS_SONG]->Song` works. Prefer **`Song-[:IN_GENRE]->Genre`** so song-centric queries stay outgoing from the current track; genre browse is just a reverse traverse.

### 5.6 Transition (edge)

Directed relationship `(:Song)-[:TRANSITION]->(:Song)` with properties:

| Property                  | Example                  | Purpose                                 |
| ------------------------- | ------------------------ | --------------------------------------- |
| `fromBar`                 | `16`                     | When to leave outgoing track            |
| `toBar`                   | `1` or `32`              | Where to enter incoming track           |
| `technique`               | `high_pass_filter`       | How (property v1; node later if needed) |
| `intent`                  | `build_hype`             | Why / energy role (property v1)         |
| `quality`                 | `great` / `ok` / `risky` | Preference                              |
| `notes`                   | free text                | Human rationale                         |
| `barsOverlap`             | `8`                      | Blend length                            |
| `sourceNoteId`            | UUID                     | FK-ish to Postgres `notes.id`           |
| `createdAt` / `updatedAt` | ISO timestamps           | Lifecycle                               |

Multiple transitions between the same pair are allowed (different techniques/intents).

### 5.7 Intra-song cues (nodes)

```cypher
(:Song)-[:HAS_CUE]->(:Cue {
  id, bar, barEnd?, kind, intent, technique, notes, quality, sourceNoteId
})
```

Example `kind` values: `loop_opportunity`, `hype_build`, `vocal_drop`, `breakdown`, `mix_out_window`, `acapella_moment`.

### 5.8 Session (Postgres, not Neo4j)

| Field           | Description                              |
| --------------- | ---------------------------------------- |
| `currentSongId` | Now playing (Neo4j song id)              |
| `currentBar`    | Approximate position (manual for v1)     |
| `energyGoal`    | Optional filter: build / cool / maintain |
| `recentSongIds` | Avoid immediate repeats                  |
| `setId`         | Optional grouping of a night             |

---

## 6. Neo4j graph schema (v1 proposal)

### 6.1 Node labels (music only)

- `Song`
- `Artist`
- `Genre`
- `Cue`
- Phase 2+ (optional): `Intent`, `Technique`

**Explicitly not in Neo4j:** `User`, `Note`, `Session`, `Library`.

### 6.2 Relationships

```cypher
(:Artist)-[:BY]->(:Song)
(:Song)-[:IN_GENRE]->(:Genre)
(:Song)-[:TRANSITION {
  fromBar, toBar, technique, intent, quality, notes,
  barsOverlap, sourceNoteId, createdAt, updatedAt
}]->(:Song)
(:Song)-[:HAS_CUE]->(:Cue)
```

### 6.3 Constraints & indexes

- Unique `Song.id`, `Artist.id`, `Genre.id`, `Cue.id`
- Unique `Artist.nameNormalized`, `Genre.nameNormalized` (global vocabulary)
- Indexes on `Song.title`, `Song.bpm`, `Song.libraryId`
- Index on `TRANSITION.intent`, `TRANSITION.technique`
- Index on `Cue.bar`, `Cue.kind`

### 6.4 Example Cypher — live “what’s next”

```cypher
MATCH (current:Song {id: $currentSongId})
MATCH (current)-[t:TRANSITION]->(next:Song)
WHERE ($intent IS NULL OR t.intent = $intent)
  AND NOT next.id IN $recentSongIds
  AND next.id IN $allowedSongIds   // from Postgres membership
RETURN next, t
ORDER BY
  CASE t.quality WHEN 'great' THEN 0 WHEN 'ok' THEN 1 ELSE 2 END,
  coalesce(t.fromBar, 0)
LIMIT 20
```

### 6.5 Example — same-artist fallback

```cypher
MATCH (current:Song {id: $currentSongId})<-[:BY]-(a:Artist)-[:BY]->(other:Song)
WHERE other.id <> current.id
  AND other.id IN $allowedSongIds
RETURN DISTINCT other, a
LIMIT 10
```

### 6.6 Example — cues near current bar

```cypher
MATCH (s:Song {id: $currentSongId})-[:HAS_CUE]->(c:Cue)
WHERE c.bar >= $currentBar - 8 AND c.bar <= $currentBar + 32
RETURN c
ORDER BY c.bar ASC
```

### 6.7 Example — genre neighborhood

```cypher
MATCH (current:Song {id: $currentSongId})-[:IN_GENRE]->(g:Genre)<-[:IN_GENRE]-(other:Song)
WHERE other.id <> current.id
  AND other.id IN $allowedSongIds
RETURN other, collect(DISTINCT g.name) AS sharedGenres
LIMIT 20
```

---

## 7. Natural language → graph pipeline

### 7.1 Intake UX

Two complementary input surfaces:

1. **Quick capture** — single text box: “Transition A into B at 16 with HPF, builds hype”
2. **Structured assist** — optional form fields after parse (song pickers, bar numbers, intent chips)

Keep raw text forever; show a **proposed graph diff** before commit.

### 7.2 Pipeline stages

```
[Raw note text]
      │
      ▼
1. Preprocess (trim, song alias resolution hints)
      │
      ▼
2. LLM structured extraction → JSON schema
      │
      ▼
3. Entity resolution (match/create Song nodes)
      │
      ▼
4. Validation + conflict checks
      │
      ▼
5. Preview diff (human confirm)
      │
      ▼
6. Cypher write transaction + Note provenance
```

### 7.3 Extraction schema (conceptual)

```json
{
  "noteType": "transition | cue | song_note | mixed",
  "songs": [
    {
      "mention": "song A",
      "resolvedId": null,
      "titleHint": "...",
      "artists": [{ "mention": "Artist Name", "resolvedId": null }],
      "genres": [{ "mention": "techno", "resolvedId": null }]
    }
  ],
  "transitions": [
    {
      "fromMention": "song A",
      "toMention": "song B",
      "fromBar": 16,
      "toBar": null,
      "technique": "high_pass_filter",
      "intent": "build_hype",
      "quality": "great",
      "notes": "original rationale"
    }
  ],
  "cues": [
    {
      "songMention": "song A",
      "bar": 32,
      "barEnd": 36,
      "kind": "loop_opportunity",
      "intent": "build_hype",
      "technique": "4_bar_loop",
      "notes": "..."
    }
  ],
  "songUpdates": [{ "songMention": "song A", "bpm": 128, "energy": 0.8 }],
  "confidence": 0.0,
  "ambiguities": ["Which 'Midnight' track?", "Genre 'house' vs 'tech house'?"]
}
```

### 7.4 Ambiguity handling

- Fuzzy song match → picker UI
- Missing bars/technique → allow partial save
- Low confidence → force confirm
- Mixed notes (transition + cue) → multi-op commit in one transaction

### 7.5 LLM / AI placement

- Use structured output (JSON schema) via AI SDK / gateway
- Keep prompts versioned; store `model`, `promptVersion`, `rawResponse` on `Note`
- Do **not** require AI for Live Mode queries — those are pure Cypher
- Future: embeddings on songs/transitions for “similar vibe” suggestions

---

## 8. Application architecture

### 8.1 Clean topology (locked)

**Four things only:**

1. **Frontend + Backend** — one Next.js app on Vercel
2. **Postgres** — app/tenancy/notes/sessions
3. **Neo4j Aura** — music graph
4. **AI Gateway** (managed call from the app) — NL extraction only; not a service we operate

No separate Go/Python API. No message bus. No extra BFF. Split a worker later only if profiling demands it (embeddings batch, DJ-software sync daemons).

```
┌──────────────────────────────────────┐
│  Browser (Live Mode / Library)       │
└──────────────────┬───────────────────┘
                   │ HTTPS (same origin)
                   ▼
┌──────────────────────────────────────┐
│  Next.js on Vercel (Fluid Compute)   │
│  UI (shadcn) + Route Handlers /      │
│  Server Actions + server modules     │
└──────────────┬───────────┬───────────┘
               │           │
               ▼           ▼
        ┌──────────┐ ┌──────────┐
        │ Postgres │ │ Neo4j    │
        │ (app)    │ │ (music)  │
        └──────────┘ └──────────┘
               │
               └──► AI Gateway (parse notes only)
```

### 8.2 Backend: Next.js vs Go/Python

| Option                         | Pros                                                                    | Cons                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Next.js fullstack (chosen)** | One deploy, one auth boundary, zero extra hops, shared types, least ops | CPU-heavy long jobs less ideal later                                                          |
| Separate Go/Python API         | Fine for heavy compute / strict isolation                               | Extra service, extra latency hop, duplicated auth, more infra — fights “clean + few services” |

**Locked for v1–3:** Next.js is the backend. Live Mode and Neo4j reads are simple Cypher + membership checks — Node on Fluid Compute is fast enough. Revisit a worker/service only for Phase 4+ batch intelligence or Phase 5 sync adapters.

### 8.3 Suggested tech stack (locked)

| Layer    | Choice                                        | Rationale                                                              |
| -------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| App      | **Next.js App Router + TypeScript** on Vercel | Single deployable = cleanest architecture                              |
| UI       | **shadcn/ui + Tailwind**                      | Accessible primitives; Live Mode can still be custom/composition-light |
| Auth     | Clerk (or Auth.js)                            | Stays in the Next app                                                  |
| API      | Route Handlers + Server Actions               | Same-origin, typed, no separate API host                               |
| Graph DB | Neo4j Aura                                    | Music-only knowledge graph                                             |
| App DB   | Postgres (Neon / Marketplace)                 | Tenancy, sessions, notes                                               |
| AI       | Vercel AI Gateway + AI SDK structured output  | NL → JSON; not on Live Mode hot path                                   |
| Hosting  | Vercel Fluid Compute (Node)                   | Connection reuse, no edge runtime required                             |

**Not in v1:** separate Go/Python service, Redis (unless session cache proves necessary), Kafka/queues, microservice mesh.

### 8.4 Performance principles (Live Mode hot path)

Live Mode must feel instant. Design rules:

1. **No LLM on Live queries** — pure Postgres membership + Neo4j Cypher.
2. **Minimize hops** — browser → Next server → DBs. Never browser → API#2 → Neo4j.
3. **Reuse connections** — Neo4j driver + PG pool as module singletons; Fluid Compute instance reuse keeps pools warm.
4. **Tight Cypher** — parameterized queries, indexes on `Song.id`, `TRANSITION.intent`, `Cue.bar`; return only fields Live UI needs.
5. **Parallelize independent reads** — e.g. `Promise.all` for outbound transitions + nearby cues (+ optional same-artist fallback).
6. **Cache membership allow-list briefly** in the request/server scope (not a separate Redis unless needed).
7. **Prefer Server Actions / RSC where they cut round-trips**; use Route Handlers for clear JSON endpoints (Live refresh).
8. **Region locality** — put Vercel, Neo4j Aura, and Postgres in the same region.

Target UX budget (guideline): Live “what’s next” **p95 &lt; 200–300ms** server time under normal library size.

### 8.5 Internal module layout (still one app)

Keep code clean with folders/modules — not separate deployables:

1. **`library`** — song/artist/genre CRUD orchestration
2. **`notes`** — raw note storage (PG), parse, preview, commit
3. **`graph`** — Neo4j driver, Cypher builders, schema constants
4. **`live`** — session (PG) + next-options aggregation
5. **`resolution`** — entity matching / aliases

UI uses **shadcn** primitives (`Button`, `Command`, `Dialog`, `Input`, etc.). Live Mode composition stays glanceable — shadcn is the kit, not a dashboard aesthetic mandate.

### 8.6 API surface (conceptual)

| Method | Path                      | Purpose                                       |
| ------ | ------------------------- | --------------------------------------------- |
| `POST` | `/api/notes/parse`        | NL → structured preview (no write)            |
| `POST` | `/api/notes/commit`       | Apply accepted preview to Neo4j + PG note row |
| `GET`  | `/api/songs`              | Search/list (membership-scoped)               |
| `POST` | `/api/songs`              | Manual create (Artist + Genre required)       |
| `GET`  | `/api/songs/:id`          | Song + cues + outbound transitions            |
| `GET`  | `/api/live/next`          | Session → ranked next songs + nearby cues     |
| `PUT`  | `/api/live/session`       | Update current song/bar/intent filter         |
| `GET`  | `/api/graph/neighborhood` | Optional explorer (prep mode)                 |

---

## 9. UX architecture

### 9.1 Modes

1. **Library / Notes mode** (prep)
   - Capture NL notes
   - Review extraction diffs
   - Browse songs, edit transitions, inspect graph neighborhood

2. **Live mode** (performance)
   - Big current-song selector
   - Optional bar stepper (`-8 / +8` or number pad)
   - Intent chips: Build hype · Cool down · Maintain · Drop
   - Primary panel: **Next songs** (title, why, technique, fromBar)
   - Secondary panel: **Do this now** (cues near current bar)
   - One-tap: “Play next” → advances session current song

### 9.2 Live Mode interaction loop

```
Set current song → (optional) set bar / intent
        │
        ▼
Query graph for outbound TRANSITION + nearby CUE
        │
        ▼
DJ picks a next song OR executes a cue
        │
        ▼
Update session (current = chosen next) → repeat
```

### 9.3 UX constraints for Live Mode

- Thumb-friendly; high contrast; minimal chrome
- Prefer 1 current context + 1 decision list (not a dashboard of widgets)
- Offline/degraded: cache last neighborhood for current song (phase 2)
- Mistaps are costly mid-set — confirm destructive edits only in Library mode

### 9.4 Library note review

Show a side-by-side:

- Left: original text
- Right: proposed ops (`CREATE Song`, `MERGE TRANSITION`, `CREATE Cue`)
- Actions: Accept all · Edit fields · Reject

---

## 10. Data flows

### 10.1 Capture flow

```mermaid
sequenceDiagram
  participant DJ
  participant UI
  participant API
  participant LLM
  participant Neo4j

  DJ->>UI: Paste/type note
  UI->>API: POST /notes/parse
  API->>LLM: Extract structured JSON
  LLM-->>API: transitions/cues/songs + ambiguities
  API->>Neo4j: Read-only entity resolution
  API-->>UI: Preview diff
  DJ->>UI: Confirm / edit
  UI->>API: POST /notes/commit
  API->>Neo4j: Write tx (Note + graph mutations)
  API-->>UI: Success + updated entities
```

### 10.2 Live query flow

```mermaid
sequenceDiagram
  participant DJ
  participant LiveUI
  participant API
  participant Neo4j

  DJ->>LiveUI: Select current song (+ bar, intent)
  LiveUI->>API: PUT /live/session
  LiveUI->>API: GET /live/next
  API->>Neo4j: TRANSITION + CUE queries
  Neo4j-->>API: Candidates
  API-->>LiveUI: Ranked next + nearby cues
  DJ->>LiveUI: Choose next song
  LiveUI->>API: PUT /live/session (advance)
```

---

## 11. Ranking & filtering (live intelligence v1)

v1 ranking should be **transparent and rule-based**, not ML:

1. Filter by optional `intent`
2. Prefer `quality = great`
3. Prefer transitions whose `fromBar` is near `currentBar` (if bar known)
4. Deprioritize recently played
5. Optional soft filters: BPM delta, key compatibility (only if metadata present)

Surface the **reason string** in UI (“HPF @ bar 16 · build hype · marked great”) so the DJ trusts the suggestion.

---

## 12. Security, tenancy, and trust

- Tenancy lives in **Postgres** (library membership). Cypher receives an allow-list of song IDs (and optional `libraryId` property filter) — never a `User` node walk.
- Never interpolate user strings into Cypher — parameterized queries only.
- LLM outputs are untrusted: validate against schema; whitelist enums where possible; require resolved Artist + ≥1 Genre before song commit.
- Soft-delete or archive transitions rather than hard-delete mid-set.
- Export/import (JSON / Cypher dump) as a later reliability feature.

---

## 13. Repository / project structure (locked monorepo)

```
selecta/                     # monorepo root (github.com/astradzhao/selecta)
  apps/
    web/                     # Next.js UI (Vercel) — @selecta/web
    api/                     # Next.js API deployable (Vercel) — @selecta/api
  packages/
    db/                      # Postgres client, membership — @selecta/db
    graph/                   # Neo4j driver, Cypher, types — @selecta/graph
    mix-notes/               # parse/commit orchestration + Zod — @selecta/mix-notes
    ui/                      # shadcn + shared UI — @selecta/ui
    eslint-config/           # shared ESLint — @selecta/eslint-config
  dev-files/                 # architecture, ADRs, prompts
```

pnpm workspace at repo root. Deployables live in `apps/`; shared domain/UI code lives in `packages/`. Do **not** invent additional deployables (workers, Go/Python services) in v1 unless a later phase explicitly unlocks them.

Suggested early `dev-files/` companions (later, not now):

- `GRAPH_SCHEMA.md` — concrete property dictionary
- `NL_EXTRACTION_PROMPT.md` — versioned prompt + examples
- `LIVE_UX.md` — wireframe notes
- `ROADMAP.md` — milestone checklist
- `ADR-001-nextjs-fullstack.md` — why no separate Go/Python API

---

## 14. Phased roadmap

### Phase 0 — Foundations (this doc)

- [x] Architecture plan
- [x] Lock stack: Next.js fullstack + shadcn + Vercel + PG + Neo4j
- [ ] Seed vocabulary for intents/techniques
- [ ] Provision Neo4j Aura + Postgres in same region

### Phase 1 — MVP vertical slice

**Goal:** Write a transition note → see it as a next-song option in Live Mode.

1. Auth + Postgres library membership
2. Manual song create with **required Artist + ≥1 Genre** (Neo4j nodes/edges)
3. NL parse → preview → commit for **transitions only**
4. Neo4j write/read of `Song` / `Artist` / `Genre` / `TRANSITION`
5. Live Mode: set current song → list outbound transitions → advance
6. Bonus fallback: same-artist suggestions when transitions are sparse

**Success metric:** A DJ can encode 10 transitions and run a short practice set using only Live Mode.

### Phase 2 — Cues & richer notes

1. Intra-song `Cue` extraction + Live “do this now”
2. Intent/technique chips + filters
3. Song property updates via NL (“this track is 124 BPM, peak energy”)
4. Duplicate song merge / aliases

### Phase 3 — Graph UX & quality

1. Neighborhood explorer (optional, prep mode only)
2. Transition quality feedback from Live Mode (“worked / failed”)
3. Better ranking (BPM/key soft scoring)
4. Mobile/PWA polish for booth use

### Phase 4 — Intelligence (future)

1. Embeddings over songs + transition notes
2. Path suggestions for a target energy arc
3. Semi-automatic extraction without confirm for high-confidence notes

### Phase 5 — DJ software integrations (future)

1. Read now-playing from Rekordbox/Serato/etc.
2. Auto-update session current song
3. Optional bidirectional cues (non-blocking; treat as adapter layer)

---

## 15. Risks & open decisions

| Topic                          | Options                             | Recommendation                                                   |
| ------------------------------ | ----------------------------------- | ---------------------------------------------------------------- |
| Neo4j only vs Neo4j + Postgres | Single store vs split               | **Locked: split** — Postgres app/tenancy/notes; Neo4j music only |
| User/Note in graph             | OWNS edges vs external membership   | **Locked: no User/Note in Neo4j**                                |
| Artist / Genre modeling        | Properties vs nodes                 | **Locked: required nodes + edges**                               |
| Backend shape                  | Next fullstack vs Go/Python service | **Locked: Next.js on Vercel** (fewest services, fewest hops)     |
| UI kit                         | Custom vs shadcn                    | **Locked: shadcn/ui + Tailwind**                                 |
| Auto-commit NL vs confirm      | Speed vs trust                      | Confirm in Phases 1–2                                            |
| Cue as node vs properties      | Flexibility vs simplicity           | Cue nodes                                                        |
| Intent/Technique               | Edge props vs nodes                 | Props in v1; promote to nodes if faceting needs hubs             |
| Artist uniqueness              | Per-library vs global MERGE         | Global `nameNormalized` MERGE; songs stay library-scoped         |
| Bar tracking                   | Manual vs synced                    | Manual stepper in v1                                             |
| Multi-device live              | Phone + laptop                      | PWA-friendly Live Mode early                                     |
| Ontology strictness            | Enums vs free text                  | Hybrid: seeded enums + `notes` free text                         |
| Extra infra (Redis/queue)      | Add early vs defer                  | **Defer** until measured need                                    |

### Open product questions

1. Single-DJ personal tool first, or shared/collaborative libraries later?
2. Do we need set planning (ordered playlists) in MVP, or only reactive next-song?
3. How important is key/BPM compatibility in v1 vs pure human-encoded transitions?
4. Preferred booth device: phone, tablet, or laptop?
5. Should failed transitions be first-class (`quality: risky/fail`) from day one?
6. Features / remix credits: extra `BY` edges, or a separate `FEATURES` relationship?
7. Genre taxonomy: flat list first, or parent/child genres from day one?

---

## 16. Non-goals (v1)

- Real-time audio analysis
- Automatic beatmatching / stem separation
- Marketplace of shared transition graphs
- Full graph visualization as the primary Live UI
- Training custom music embedding models

---

## 17. Success criteria for the overall architecture

The architecture is “right” if:

1. A plain-English transition becomes a queryable edge within one confirm action.
2. Live Mode answers “what’s next?” in one screen with reasons.
3. Intra-song cues don’t pollute song→song topology.
4. Future embedding/DJ-software features can attach without rewriting the graph core.
5. Raw notes remain recoverable for re-extraction when the schema evolves.

---

## 18. Immediate next steps (when implementation starts)

1. Provision Neo4j Aura + Postgres in the **same region** as the Vercel project
2. Scaffold Next.js app + shadcn + auth
3. Lock v1 property dictionary + Zod extraction schema
4. Implement Phase 1 vertical slice only (no extra services)
5. Seed 5–10 real transitions and measure Live `/api/live/next` latency

---

## Linear tracking

- Team: **DJ Project**
- Architecture doc: [Selecta — Architecture Plan](https://linear.app/dj-project-astradzhao/document/dj-graph-notes-architecture-plan-01bfac2a798b)
- Architecture issue (done): [DJ-5](https://linear.app/dj-project-astradzhao/issue/DJ-5/architecture-plan-nl-neo4j-dj-notes-app)
- **MVP project:** [MVP — NL → Graph → Live Mode](https://linear.app/dj-project-astradzhao/project/mvp-nl-graph-live-mode-08d4f2152899)
  - M0 [DJ-6](https://linear.app/dj-project-astradzhao/issue/DJ-6/m0-scaffold-nextjs-shadcn-vercel) → M1 [DJ-10](https://linear.app/dj-project-astradzhao/issue/DJ-10/m1-postgres-neo4j-data-layer) → M2 [DJ-8](https://linear.app/dj-project-astradzhao/issue/DJ-8/m2-song-library-with-artist-genre) → M3 [DJ-7](https://linear.app/dj-project-astradzhao/issue/DJ-7/m3-nl-parse-preview-commit-transitions) → M4 [DJ-11](https://linear.app/dj-project-astradzhao/issue/DJ-11/m4-live-mode-whats-next) → M5 [DJ-9](https://linear.app/dj-project-astradzhao/issue/DJ-9/m5-dogfood-seed-data-mvp-acceptance)

---

## Appendix A — Example notes the system should handle

1. “Song A into Song B at bar 16 with a high-pass filter — great for building hype.”
2. “On Song A at bar 32, 4-bar loop is a good hype build.”
3. “Don’t go from Song C to Song D — key clash, messy.” → `quality: risky` or negative edge later
4. “Song E is peak-time, ~128 BPM, major energy.” → song property update
5. “Echo out of Song F into Song G over 8 bars to cool down.”

## Appendix B — Glossary

| Term       | Meaning                                                                |
| ---------- | ---------------------------------------------------------------------- |
| Transition | Directed mix relationship from song A to song B                        |
| Cue        | Time-anchored opportunity on a single song                             |
| Artist     | Graph node; songs connect via `BY`                                     |
| Genre      | Graph node; songs connect via `IN_GENRE` (many-to-many)                |
| Intent     | Energy/role label (build hype, cool down, …) — edge/cue property in v1 |
| Technique  | Mixing method (HPF, bass swap, loop, …) — edge/cue property in v1      |
| Live Mode  | Performance UI driven by session state + graph queries                 |
| Extraction | NL → structured graph operations                                       |
| Membership | Postgres link from library/user → Neo4j song ids                       |
