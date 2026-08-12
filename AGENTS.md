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
- **Body sections:** Why → What → Description → Linear link

Example Linear link: `[DJ-13](https://linear.app/dj-project-astradzhao/issue/DJ-13/init-nextjs-app-router-typescript)`

If a PR already exists for the branch, update it instead of opening a duplicate. Use `gh pr create` / `gh pr edit`.

## Package manager

Use **pnpm** only (`pnpm install`, `pnpm add`, `pnpm run …`). Do not introduce `package-lock.json` or npm/yarn lockfiles.

## Monorepo

This is a pnpm workspace monorepo:

- `apps/web` (`@selecta/web`) — Next.js UI deployable (port 3000)
- `apps/api` (`@selecta/api`) — Next.js API deployable (port 3001)
- `packages/catalog|db|mix-notes|agentics|ui` — shared libraries (`@selecta/*`)
- `packages/eslint-config` (`@selecta/eslint-config`) — shared ESLint flat configs

Put deployable apps under `apps/`. Put shared domain/UI libraries under `packages/`. Prefer importing `@selecta/*` from apps instead of duplicating logic.

Root scripts: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm format`, `pnpm format:check`, `pnpm --filter @selecta/web …`.

**Formatting:** use **oxfmt** only (`pnpm format` / `pnpm format:check`). Do not add Prettier or Biome.

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
