# DJ-99 — Retire the legacy `/notes` surface (task plan)

> Ticket: [DJ-99 — UI-4: Retire the legacy `/notes` surface before migrating components](https://linear.app/dj-project-astradzhao/issue/DJ-99)
> Parent epic: [DJ-92 — UI Cleanup](https://linear.app/dj-project-astradzhao/issue/DJ-92)
> Epic plan: [`UI_CLEANUP_PLAN.md`](./UI_CLEANUP_PLAN.md)
> Blocked-by: none (DJ-93 / DJ-96 / DJ-95 already on `main`)
> Status: **implemented on `dj-99`.** Decisions D1–D4 landed as recommended.

`/notes` duplicates Library → Submissions. [DJ-68](https://linear.app/dj-project-astradzhao/issue/DJ-68) was already canceled as superseded by [DJ-71](https://linear.app/dj-project-astradzhao/issue/DJ-71). This ticket deletes that leftover UI **before** UI-6–UI-11 migrate composites, so those tickets do not touch doomed copies.

## 1. Goal

Stop rendering a Notes list or editable note detail. Keep the Add → Transition submit path and the Library submission detail + proposal review path. Redirect old `/notes*` URLs so bookmarks do not 404.

## 2. What I verified (current tree)

### 2.1 Redirects already exist

`apps/web/next.config.ts` already sends:

| Source                   | Destination                 |
| ------------------------ | --------------------------- |
| `/notes`                 | `/library?view=submissions` |
| `/notes/:id` (not `new`) | `/library/submissions/:id`  |
| `/notes/new`             | `/add?mode=transition`      |

Those page modules (`app/notes/page.tsx`, `app/notes/[id]/page.tsx`, `app/notes/new/page.tsx`) are therefore unreachable. Delete them; **keep the redirects**.

### 2.2 Nav and home are already off `/notes`

`AppShell` is Add / Library / Graph. Home CTAs go to `/add` and `/library`. The only remaining UI `href="/notes…"` was inside `notes-list.tsx`.

### 2.3 Shared `note-detail.tsx` cannot be deleted blindly

`app/library/submissions/[id]/page.tsx` renders `NoteDetail` with `readOnly`. `app/notes/[id]/page.tsx` rendered it editable. After the notes pages go, only the read-only Library path remains.

### 2.4 DJ-78 is not live

[DJ-78](https://linear.app/dj-project-astradzhao/issue/DJ-78) (editable notes + differential re-extraction) is **Backlog**. Ticket instruction: drop the editable branch unless DJ-78 still wants it. Do not block DJ-99 on DJ-78. Re-extraction retry (`POST /notes/:id/extract`) stays on the submission detail — that is product, not the edit form.

## 3. Decisions

| ID  | Question                                                 | Decision                                                                                                                      |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| D1  | Editable note form                                       | **Drop.** DJ-78 can restore PATCH + a form later. Remove unused `updateNote` from the web client; keep the API `PATCH` route. |
| D2  | Extraction-debug accordion / ProposalCard / raw metadata | **Delete.** Proposal review already lives in `submission-proposals.tsx`. Do not hide debug behind a flag.                     |
| D3  | Track links                                              | **Keep** on submission detail; move to `library/submission-track-links.tsx`.                                                  |
| D4  | Add → Transition form (`new-note-form.tsx`)              | **Keep**, move under `components/add/`. Drop the unused `embedded` / standalone-header branch (`/notes/new` is a redirect).   |

Out of scope: API `apps/api/app/notes/**`, `apps/web/lib/notes/*` (except dead `updateNote`), unifying status vocabulary (UI-10), FilteredListShell (UI-8).

## 4. File map

| Path                                    | Disposition                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| `app/notes/page.tsx`                    | delete                                                                       |
| `app/notes/new/page.tsx`                | delete (redirect already in next.config)                                     |
| `app/notes/[id]/page.tsx`               | delete (redirect already in next.config)                                     |
| `components/notes/notes-list.tsx`       | delete                                                                       |
| `components/notes/note-detail.tsx`      | replace with `library/submission-detail.tsx` (read-only, no debug accordion) |
| `components/notes/note-track-links.tsx` | move → `library/submission-track-links.tsx`                                  |
| `components/notes/new-note-form.tsx`    | move → `add/new-note-form.tsx`                                               |
| `next.config.ts` redirects              | keep                                                                         |
| `lib/notes/api.ts` `updateNote`         | delete (unused after D1)                                                     |

After this, `apps/web/components/notes/` is empty and should not exist.

## 5. Acceptance

- `/notes` and `/notes/:id` redirect; no Notes list UI.
- Submission detail + proposal review still work: Add transition → extract → Library submission → review/commit.
- Retry processing still works on the submission detail.
- No notes component duplicates a library counterpart.
- `pnpm typecheck` and `@selecta/web` build pass with no dead imports.
