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

Requires [Docker Desktop](https://docs.docker.com/get-docker/) (Compose healthchecks for Postgres + Neo4j).

```bash
pnpm install
cp .env.example .env.local   # Postgres, Neo4j, API_ORIGIN, optional Spotify/AI
pnpm dev                     # DBs → migrate → web :3000 + api :3001
```

`pnpm dev` is the primary local entrypoint (`scripts/dev-stack.mjs`). It:

1. Starts Postgres + Neo4j via Docker Compose and waits until healthy
2. Applies pending Postgres + Neo4j migrations (idempotent)
3. Starts `@selecta/web` and `@selecta/api`

Then open [http://localhost:3000/library](http://localhost:3000/library).

### Escape hatches

```bash
pnpm db:up         # Compose only
pnpm db:migrate    # Postgres migrations only
pnpm graph:migrate # Neo4j constraints only
pnpm dev:apps      # web + api only (DBs already up)
pnpm dev:web       # web only
pnpm dev:api       # api only
pnpm db:down       # stop Compose services
pnpm db:logs       # follow Compose logs
pnpm lint
pnpm format        # write with oxfmt
pnpm format:check  # CI-friendly format check
pnpm build
```

`.env.example` credentials match the Compose Postgres and Neo4j services. Postgres listens on host port `5433` (mapped to container `5432`, so it does not collide with a local Postgres on `5432`); Neo4j Bolt on `7687` and Browser on `http://localhost:7474`. `API_ORIGIN` (default `http://localhost:3001`) is used by the web app’s `/backend` rewrite. Fill an AI gateway key when you need that service. Optional `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` enable catalog search (server-only; UI falls back to manual entry when unset). Local MVP is single-user: Neo4j holds the song library; Postgres holds free-form notes. `DEV_LIBRARY_ID` / `DEV_USER_ID` remain as optional stubs until auth. Auth provider secrets in `.env.example` are optional placeholders only.

## Linting & formatting

- **Formatter:** [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) (repo-wide). Config: `.oxfmtrc.json`. Use `pnpm format` locally; run `pnpm format:check` in CI.
- **Linter:** ESLint via shared `@selecta/eslint-config` (`./next` for apps, `./base` for packages). Formatting is left to oxfmt — do not add Prettier or Biome.

## Agent workflow

See [AGENTS.md](./AGENTS.md) for Linear branching (`dj-XXXX`), pnpm, monorepo, and testing conventions.
