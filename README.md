# DJ Graph Notes

DJ-helping note-taking app: natural-language mix notes → Neo4j graph → live “what’s next” UX.

## Monorepo layout

```text
apps/
  web/          # Next.js UI (Vercel) — port 3000
  api/          # Next.js API deployable (Vercel) — port 3001
packages/
  db/           # Postgres client + membership (@dj/db)
  graph/        # Neo4j / Cypher (@dj/graph)
  notes/        # NL parse / preview / commit (@dj/notes)
  ui/           # Shared UI / shadcn (@dj/ui)
dev-files/      # Architecture + planning docs
```

## Getting started

```bash
pnpm install
pnpm dev          # web :3000 + api :3001
pnpm dev:web      # web only
pnpm dev:api      # api only
pnpm lint
pnpm build
```

## Agent workflow

See [AGENTS.md](./AGENTS.md) for Linear branching (`dj-XXXX`), pnpm, monorepo, and testing conventions.
