# Selecta

DJ-helping note-taking app: natural-language mix notes → Neo4j graph → live “what’s next” UX.

Repo: [github.com/astradzhao/selecta](https://github.com/astradzhao/selecta)

## Monorepo layout

```text
apps/
  web/          # Next.js UI (Vercel) — port 3000
  api/          # Next.js API deployable (Vercel) — port 3001
packages/
  db/           # Postgres client + membership (@selecta/db)
  graph/        # Neo4j / Cypher (@selecta/graph)
  mix-notes/    # NL parse / preview / commit (@selecta/mix-notes)
  ui/           # Shared UI / shadcn (@selecta/ui)
  eslint-config # Shared ESLint flat configs (@selecta/eslint-config)
dev-files/      # Architecture + planning docs
```

## Getting started

```bash
pnpm install
pnpm dev          # web :3000 + api :3001
pnpm dev:web      # web only
pnpm dev:api      # api only
pnpm lint
pnpm format       # write with oxfmt
pnpm format:check # CI-friendly format check
pnpm build
```

## Linting & formatting

- **Formatter:** [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) (repo-wide). Config: `.oxfmtrc.json`. Use `pnpm format` locally; run `pnpm format:check` in CI.
- **Linter:** ESLint via shared `@selecta/eslint-config` (`./next` for apps, `./base` for packages). Formatting is left to oxfmt — do not add Prettier or Biome.

## Agent workflow

See [AGENTS.md](./AGENTS.md) for Linear branching (`dj-XXXX`), pnpm, monorepo, and testing conventions.
