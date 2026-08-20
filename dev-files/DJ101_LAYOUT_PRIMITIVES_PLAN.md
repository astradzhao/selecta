# DJ-101 — Shared layout + feedback primitives (task plan)

> Ticket: [DJ-101 — UI-6](https://linear.app/dj-project-astradzhao/issue/DJ-101)
> Parent epic: [DJ-92](https://linear.app/dj-project-astradzhao/issue/DJ-92)
> Blocked-by: DJ-96, DJ-100 (both merged)
> Status: **implemented on `dj-101`.**

Every page still copy-pastes headers, tab pills, search inputs, and loading/empty/error boxes. This ticket extracts those composites. List fetch/filter orchestration stays UI-8.

## 1. What I verified (post DJ-99 / DJ-100)

- `notes-list` / `note-detail` / `new-note-form` standalone header are gone. Remaining headers: Library, Add, library-list (embedded-only), add-track-flow (embedded-only), submission-detail, transition-detail, proposal-review, track-detail.
- Tab active state is `bg-selected`, not the ticket’s `bg-foreground text-background`.
- Search copies: 7 with the icon+`pl-10` recipe; graph-landing still uses `ps-9`; graph-explorer search is a bare `Input` with no icon.
- `LibraryList` and `AddTrackFlow` are **only** rendered with `embedded`. Drop the prop and the dead standalone headers.
- Submissions list already seeds `Skeleton` (DJ-100). Promote that to `ListSkeleton` and reuse on tracks/transitions.

## 2. Decisions

| ID  | Question                  | Decision                                                                                                                                            |
| --- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Where they live           | App-agnostic pieces in `@selecta/ui`. `BackLink` uses Next `Link` → `apps/web/components/common/back-link.tsx`.                                     |
| D2  | SegmentedTabs + Next Link | `asChild` + Radix Slot, same as `Button`. Variant `line` (workspace/nav) and `boxed` (endpoint picker).                                             |
| D3  | `embedded`                | **Delete.** Nested views never render a page header.                                                                                                |
| D4  | Loading                   | Lists use `ListSkeleton` (`aria-busy`). Detail pages use `StatePanel variant="loading"`. Result-count `aria-live="polite"` lines stay in the lists. |

Out of scope: FilteredListShell (UI-8), TrackRow/TrackPicker (UI-9).

## 3. File map

**`@selecta/ui`:** `page-header.tsx`, `section-heading.tsx`, `segmented-tabs.tsx`, `search-field.tsx`, `state-panel.tsx`, `empty-state.tsx`, `list-skeleton.tsx`.

**App-specific:** `apps/web/components/common/back-link.tsx` (Next `Link`).

**Migrated:** app-shell, library/add workspaces, library/submissions/transitions lists, add-track-flow, graph landing picker + explorer, proposal review + endpoint picker, track/submission/transition details, submission track links + proposals.

## 4. Exceptions (not PageHeader)

- Graph landing hero is a centered empty-start, not a page chrome header.
- Track detail **view** keeps the artwork + title media object; edit mode uses `PageHeader`. `BackLink` replaces `LibraryBackLink` in both.
- Home (`app/page.tsx`) stays a display one-off.

## 5. Testing

No new unit tests. Aria-busy / `role="status"` live on `ListSkeleton` and `StatePanel variant="loading"`. List result-count `aria-live="polite"` lines stay in the list components. A React render test would only restate the markup.
