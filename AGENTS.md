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
4. When implementation is finished, commit on that branch and push to origin:
   ```bash
   git push -u origin HEAD
   ```

Do not commit directly to `main`. Do not reuse an unrelated branch for a different Linear issue.

## Next.js

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
