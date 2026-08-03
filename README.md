# Selecta

DJ-helping note-taking app: natural-language mix notes → Neo4j graph → live “what’s next” UX.

Repo: [github.com/astradzhao/selecta](https://github.com/astradzhao/selecta)

## Monorepo layout

```text
apps/
  web/          # Next.js UI (Vercel) — port 3000
  api/          # Next.js API deployable (Vercel) — port 3001
packages/
  catalog/      # External music catalog search (@selecta/catalog)
  db/           # Postgres client + notes (@selecta/db)
  graph/        # Neo4j / Cypher (@selecta/graph)
  mix-notes/    # NL parse / preview / commit (@selecta/mix-notes)
  ui/           # Shared UI / shadcn (@selecta/ui)
  eslint-config # Shared ESLint flat configs (@selecta/eslint-config)
dev-files/      # Architecture + planning docs
```

## Getting started

Requires [Docker](https://docs.docker.com/get-docker/) for local Postgres and Neo4j (`pnpm db:up`).

```bash
pnpm install
cp .env.example .env.local   # Postgres, Neo4j, AI, local stub IDs
pnpm db:up        # Postgres + Neo4j via Docker Compose (defaults match .env.example)
pnpm db:migrate   # apply Postgres schema migrations (@selecta/db)
pnpm graph:migrate # apply Neo4j constraints/indexes (@selecta/graph)
pnpm dev          # web :3000 + api :3001
pnpm dev:web      # web only
pnpm dev:api      # api only
pnpm db:down      # stop Compose services
pnpm db:logs      # follow Compose logs
pnpm lint
pnpm format       # write with oxfmt
pnpm format:check # CI-friendly format check
pnpm build
```

`.env.example` credentials match the Compose Postgres and Neo4j services. Postgres listens on host port `5433` (mapped to container `5432`, so it does not collide with a local Postgres on `5432`); Neo4j Bolt on `7687` and Browser on `http://localhost:7474`. Fill an AI gateway key when you need that service. Optional `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` enable `GET /catalog/search` on the API (server-only; UI falls back to manual entry when unset). Local MVP is single-user: Neo4j holds the song library; Postgres holds free-form notes. `DEV_LIBRARY_ID` / `DEV_USER_ID` remain as optional stubs until auth. Auth provider secrets in `.env.example` are optional placeholders only.

## Linting & formatting

- **Formatter:** [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) (repo-wide). Config: `.oxfmtrc.json`. Use `pnpm format` locally; run `pnpm format:check` in CI.
- **Linter:** ESLint via shared `@selecta/eslint-config` (`./next` for apps, `./base` for packages). Formatting is left to oxfmt — do not add Prettier or Biome.

## Agent workflow

See [AGENTS.md](./AGENTS.md) for Linear branching (`dj-XXXX`), pnpm, monorepo, and testing conventions.
