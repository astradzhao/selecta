# Agent instructions

## Git / Linear workflow (required)

For every Linear issue implementation:

1. Start from an up-to-date `main`:
   ```bash
   git checkout main
   git pull origin main
   ```
2. Create a new branch named after the Linear issue number:
   ```bash
   git checkout -b "dj-XXXX"
   ```
   Example: issue [DJ-13](https://linear.app/dj-project-astradzhao/issue/DJ-13) → branch `dj-13`.
3. Implement the ticket on that branch only.
4. When implementation is finished, **immediately** commit on that branch and push to origin (do not wait to be asked):
   ```bash
   git push -u origin HEAD
   ```
5. After every push, open or update a PR to `main` in the same turn (see **Pull requests** below). Return the PR URL.

Do not commit directly to `main`. Do not reuse an unrelated branch for a different Linear issue.

## Pull requests

After pushing a `dj-XXXX` branch, create or update a GitHub PR using [`.github/pull_request_template.md`](./.github/pull_request_template.md).

- **Title:** `[DJ-XXXX] Brief title` (aligned with the Linear issue)
- **Body sections:** Why → What → Description → How to Test → Linear link

Example Linear link: `[DJ-13](https://linear.app/dj-project-astradzhao/issue/DJ-13/init-nextjs-app-router-typescript)`

If a PR already exists for the branch, update it instead of opening a duplicate. Use `gh pr create` / `gh pr edit`.

## Package manager

Use **pnpm** only (`pnpm install`, `pnpm add`, `pnpm run …`). Do not introduce `package-lock.json` or npm/yarn lockfiles.

## Monorepo

This is a pnpm workspace monorepo:

- `apps/web` (`@selecta/web`) — Next.js UI deployable (port 3000)
- `apps/api` (`@selecta/api`) — Next.js API deployable (port 3001)
- `packages/db` (`@selecta/db`) — Postgres client, Drizzle schema, and migrations only (no domain logic)
- `packages/library` (`@selecta/library`) — music domain: tracks, transitions, vocab, neighborhood, sequences/blocks
- `packages/submissions` (`@selecta/submissions`) — notes, proposals, and extraction bookkeeping
- `packages/catalog|agentics|ui` — shared libraries (`@selecta/*`). Note extraction lives at `@selecta/agentics/submission-parser`.
- `packages/eslint-config` (`@selecta/eslint-config`) — shared ESLint flat configs

Domain packages depend on `@selecta/db` for the client/executor (`getDb`, `getExecutor`, `runInDbTransaction`) and table definitions (`@selecta/db/schema`); `@selecta/db` never imports domain logic.

Put deployable apps under `apps/`. Put shared domain/UI libraries under `packages/`. Prefer importing `@selecta/*` from apps instead of duplicating logic.

Root scripts: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm format`, `pnpm format:check`, `pnpm --filter @selecta/web …`.

**Formatting:** use **oxfmt** only (`pnpm format` / `pnpm format:check`). Do not add Prettier or Biome.

## Design system

UI work follows [`dev-files/UI_STYLE_GUIDE.md`](./dev-files/UI_STYLE_GUIDE.md) and `.cursor/rules/ui-design-system.mdc`. Use semantic tokens and `@selecta/ui` primitives; do not invent palette classes, hex/oklch literals, `tracking-[…]`, raw `<select>` / checkbox inputs, or `window.confirm`. If a value does not exist, add a token in `packages/ui/src/styles/globals.css`.

## Testing

Only write tests that provide real value.

- Prefer tests that lock in behavior we care about: parsing/validation, graph commit rules, membership/auth boundaries, Live Mode next-options logic, and other non-obvious regressions.
- Do **not** add filler coverage: snapshot spam, trivial render-only checks, asserting implementation details, or tests that only restate the code.
- If a change is trivial UI chrome with no meaningful failure mode, skip a test unless the ticket asks for one.
- When adding a test, be able to answer: “What bug would this catch that a human or typecheck would miss?”

## Next.js

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

The update script (`pnpm install`) only refreshes dependencies. Docker, Postgres, and the dev servers are **not** started automatically — start them yourself.

- **Docker daemon:** there is no systemd, so start the daemon manually before any DB work: run `sudo dockerd` in a background/tmux session. If `docker` commands hit a permission error, run `sudo chmod 666 /var/run/docker.sock` (the `ubuntu` user is in the `docker` group, but that only applies to a fresh login shell). Docker is configured with the `fuse-overlayfs` storage driver and `iptables-legacy` — do not switch these.
- **`.env.local` is required** or `pnpm dev` fails fast. If missing, `cp .env.example .env.local`. The committed defaults (Postgres on host port `5433`, `API_ORIGIN=http://localhost:3001`) work as-is. `AI_GATEWAY_API_KEY` (NL note extraction) and `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` (catalog search) are optional — both degrade gracefully, and manual track entry works without them.
- **Run the stack:** `pnpm dev` (Docker Postgres → migrate → web `:3000` + api `:3001`); open `http://localhost:3000/library`. Once Postgres is up you can use `pnpm dev:apps`. See the README for all escape-hatch scripts.
- **Tests:** `pnpm db:test` needs the Docker daemon + Postgres running (it runs `docker compose up`). `pnpm lint` / `pnpm typecheck` do not.
- **Gotcha:** the API dev server regenerates `apps/api/AGENTS.md` and `apps/api/CLAUDE.md` on startup (Next.js `agentRules`). These are untracked build artifacts — do not commit them.
