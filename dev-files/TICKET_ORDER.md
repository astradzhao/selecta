# Local MVP — ticket order

> Source of truth for **what to work on next**, local-first.  
> Project: [MVP — NL → Graph → Live Mode](https://linear.app/dj-project-astradzhao/project/mvp-nl-graph-live-mode-08d4f2152899)  
> Last updated: 2026-08-02  
> Strategy: get songs → NL transitions → Live Mode working on `pnpm dev` **before** auth or Vercel.

Statuses below reflect Linear at last update. Re-check Linear if unsure.

---

## Now (finish these)

| #   | Ticket                                                        | Title                                   | Status      | Notes                                           |
| --- | ------------------------------------------------------------- | --------------------------------------- | ----------- | ----------------------------------------------- |
| 1   | [DJ-14](https://linear.app/dj-project-astradzhao/issue/DJ-14) | `.env.example` (PG, Neo4j, AI, `DEV_*`) | In Progress | Include `DEV_USER_ID` / `DEV_LIBRARY_ID` stubs  |
| 2   | [DJ-17](https://linear.app/dj-project-astradzhao/issue/DJ-17) | Intent + technique vocabulary constants | In Progress | Prefer `@selecta/graph` or `@selecta/mix-notes` |
| 3   | [DJ-18](https://linear.app/dj-project-astradzhao/issue/DJ-18) | Provision Postgres (local / Neon)       | In Progress | Docker or Neon free tier fine                   |
| 4   | [DJ-19](https://linear.app/dj-project-astradzhao/issue/DJ-19) | Provision Neo4j (local / Aura)          | In Progress | Aura or local Neo4j/Docker fine                 |

Close **[DJ-6](https://linear.app/dj-project-astradzhao/issue/DJ-6)** (M0) once 1–4 are Done.

---

## Next — M1 Data layer

Wire clients + schemas against the local DBs. Order:

| #   | Ticket                                                        | Title                                                      | Priority                                             |
| --- | ------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| 5   | [DJ-20](https://linear.app/dj-project-astradzhao/issue/DJ-20) | Postgres schema: libraries, membership, notes, sessions    | High                                                 |
| 6   | [DJ-21](https://linear.app/dj-project-astradzhao/issue/DJ-21) | Neo4j constraints + indexes (Song/Artist/Genre/TRANSITION) | High                                                 |
| 7   | [DJ-22](https://linear.app/dj-project-astradzhao/issue/DJ-22) | Postgres client + membership helpers (`DEV_LIBRARY_ID`)    | High                                                 |
| 8   | [DJ-24](https://linear.app/dj-project-astradzhao/issue/DJ-24) | Neo4j driver singleton + Cypher helpers                    | High                                                 |
| 9   | [DJ-23](https://linear.app/dj-project-astradzhao/issue/DJ-23) | Health check for both DBs                                  | Low — do if not already covered by `apps/api` health |

Parent epic: [DJ-10](https://linear.app/dj-project-astradzhao/issue/DJ-10).

---

## Then — M2 Song library

| #   | Ticket                                                        | Title                                      | Priority                                  |
| --- | ------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------- |
| 10  | [DJ-30](https://linear.app/dj-project-astradzhao/issue/DJ-30) | Ensure default / `DEV` library exists      | High — treat as seed stub, not real login |
| 11  | [DJ-25](https://linear.app/dj-project-astradzhao/issue/DJ-25) | MERGE Artist/Genre + `BY` / `IN_GENRE`     | High                                      |
| 12  | [DJ-26](https://linear.app/dj-project-astradzhao/issue/DJ-26) | API: create song (Artist + Genre required) | High                                      |
| 13  | [DJ-27](https://linear.app/dj-project-astradzhao/issue/DJ-27) | API: search/list library songs             | High                                      |
| 14  | [DJ-28](https://linear.app/dj-project-astradzhao/issue/DJ-28) | API: song detail                           | Medium                                    |
| 15  | [DJ-29](https://linear.app/dj-project-astradzhao/issue/DJ-29) | UI: create song form                       | High                                      |
| 16  | [DJ-31](https://linear.app/dj-project-astradzhao/issue/DJ-31) | UI: library search/list + song detail      | High                                      |

Parent epic: [DJ-8](https://linear.app/dj-project-astradzhao/issue/DJ-8).

---

## Then — M3 NL → graph (transitions only)

| #   | Ticket                                                        | Title                                         | Priority                |
| --- | ------------------------------------------------------------- | --------------------------------------------- | ----------------------- |
| 17  | [DJ-33](https://linear.app/dj-project-astradzhao/issue/DJ-33) | Zod schema for NL transition extraction       | High                    |
| 18  | [DJ-32](https://linear.app/dj-project-astradzhao/issue/DJ-32) | Versioned NL extraction prompt + examples     | High                    |
| 19  | [DJ-34](https://linear.app/dj-project-astradzhao/issue/DJ-34) | API: `POST /api/notes/parse`                  | High                    |
| 20  | [DJ-35](https://linear.app/dj-project-astradzhao/issue/DJ-35) | Entity resolution + ambiguity picker          | High                    |
| 21  | [DJ-36](https://linear.app/dj-project-astradzhao/issue/DJ-36) | UI: note capture + preview diff               | High                    |
| 22  | [DJ-38](https://linear.app/dj-project-astradzhao/issue/DJ-38) | API: `POST /api/notes/commit` (transactional) | High                    |
| —   | [DJ-37](https://linear.app/dj-project-astradzhao/issue/DJ-37) | UI: notes history                             | **Skip / nice-to-have** |

Parent epic: [DJ-7](https://linear.app/dj-project-astradzhao/issue/DJ-7).

---

## Then — M4 Live Mode

| #   | Ticket                                                        | Title                                      | Priority                |
| --- | ------------------------------------------------------------- | ------------------------------------------ | ----------------------- |
| 23  | [DJ-39](https://linear.app/dj-project-astradzhao/issue/DJ-39) | API: `PUT /api/live/session`               | High                    |
| 24  | [DJ-40](https://linear.app/dj-project-astradzhao/issue/DJ-40) | API: `GET /api/live/next` (Cypher, no LLM) | High                    |
| 25  | [DJ-41](https://linear.app/dj-project-astradzhao/issue/DJ-41) | UI: Live Mode page                         | High                    |
| 26  | [DJ-43](https://linear.app/dj-project-astradzhao/issue/DJ-43) | UI: one-tap advance to next song           | High                    |
| 27  | [DJ-42](https://linear.app/dj-project-astradzhao/issue/DJ-42) | Same-artist fallback                       | Medium                  |
| —   | [DJ-44](https://linear.app/dj-project-astradzhao/issue/DJ-44) | Bar stepper                                | **Skip / nice-to-have** |

Parent epic: [DJ-11](https://linear.app/dj-project-astradzhao/issue/DJ-11).

---

## Then — M5 Dogfood (local acceptance)

| #   | Ticket                                                        | Title                                | Priority |
| --- | ------------------------------------------------------------- | ------------------------------------ | -------- |
| 28  | [DJ-47](https://linear.app/dj-project-astradzhao/issue/DJ-47) | Seed ~10 real songs + transitions    | High     |
| 29  | [DJ-45](https://linear.app/dj-project-astradzhao/issue/DJ-45) | Practice-set dogfood checklist       | High     |
| 30  | [DJ-48](https://linear.app/dj-project-astradzhao/issue/DJ-48) | Measure Live next-options latency    | Medium   |
| 31  | [DJ-46](https://linear.app/dj-project-astradzhao/issue/DJ-46) | File Phase 2 follow-ups + accept MVP | Medium   |

Parent epic: [DJ-9](https://linear.app/dj-project-astradzhao/issue/DJ-9).

---

## Deferred (do after local MVP works)

| Ticket                                                        | Title                  | Why deferred                           |
| ------------------------------------------------------------- | ---------------------- | -------------------------------------- |
| [DJ-16](https://linear.app/dj-project-astradzhao/issue/DJ-16) | Auth (Clerk / Auth.js) | Use `DEV_LIBRARY_ID` until slice works |
| [DJ-15](https://linear.app/dj-project-astradzhao/issue/DJ-15) | Link Vercel + deploy   | Local `pnpm dev` is enough             |

---

## Already done

| Ticket                                                        | Title                    |
| ------------------------------------------------------------- | ------------------------ |
| [DJ-5](https://linear.app/dj-project-astradzhao/issue/DJ-5)   | Architecture plan        |
| [DJ-13](https://linear.app/dj-project-astradzhao/issue/DJ-13) | Init Next.js             |
| [DJ-12](https://linear.app/dj-project-astradzhao/issue/DJ-12) | shadcn/ui primitives     |
| [DJ-49](https://linear.app/dj-project-astradzhao/issue/DJ-49) | ESLint + oxfmt           |
| [DJ-50](https://linear.app/dj-project-astradzhao/issue/DJ-50) | Monorepo naming / layout |

---

## One-line critical path

```
DJ-14 → DJ-17 → DJ-18/19 → DJ-20/21/22/24
  → DJ-30/25/26/27/29/31
  → DJ-33/32/34/35/36/38
  → DJ-39/40/41/43
  → DJ-47/45
  → (later) DJ-16, DJ-15
```

**MVP done when:** you can encode ~10 transitions via Notes UI and run a short practice set in Live Mode on localhost — without auth or Vercel.
