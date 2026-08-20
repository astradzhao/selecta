# DJ-100 — Fill the `@selecta/ui` primitive gaps (task plan)

> Ticket: [DJ-100 — UI-5: Fill the @selecta/ui primitive gaps — Select, Checkbox, Alert, Skeleton](https://linear.app/dj-project-astradzhao/issue/DJ-100)
> Parent epic: [DJ-92 — UI Cleanup](https://linear.app/dj-project-astradzhao/issue/DJ-92)
> Epic plan: [`UI_CLEANUP_PLAN.md`](./UI_CLEANUP_PLAN.md)
> Blocked-by: DJ-93, DJ-96 (merged)
> Status: **implemented on `dj-100`.** Decisions D1–D4 landed as recommended.

`apps/web` still hand-rolls native `<select>`, unstyled checkboxes, and six flavors of “show the user a message.” Errors often look like hints. This ticket adds the missing primitives and migrates those call sites before UI-6 composites land.

## 1. Goal

One Select, one Checkbox, one Alert, one Skeleton in `@selecta/ui`. Errors render as `destructive`. Unused shadcn scaffolding that nothing imports is deleted (`field.tsx` stays for UI-11).

## 2. What I verified (post DJ-99 tree)

Ticket inventory is **directionally right** and **stale in the details**.

- `note-detail.tsx` is gone. Its leftover alerts live in `submission-detail.tsx`.
- Native `<select>` still in 3 files; native checkbox still in 3 files.
- Inline message classes are now `bg-surface-2` (UI-1), not `bg-muted/40`. The bug is the same: errors look like info.
- `input.tsx` is `h-8 rounded-lg` with `focus-visible:ring-3`, not the ticket’s `h-9 rounded-md`.
- Unused: `card`, `combobox`, `command`, `input-group`, `popover`. `field` unused (UI-11). `dialog` is used (graph landing).
- `@base-ui/react` is only imported by `combobox`. `cmdk` is only imported by `command`.

## 3. Decisions

| ID  | Question              | Decision                                                                                                                                                |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Select implementation | **Styled native `<select>`**, matching `input.tsx` (height, border, ring, disabled). Not a JS listbox. `color-scheme` from UI-3 themes the OS dropdown. |
| D2  | Checkbox              | **Styled native `<input type="checkbox">`** with focus ring, disabled, `accent-brand`. No indeterminate call site — skip indeterminate.                 |
| D3  | Unused primitives     | **Delete** `card`, `combobox`, `command`, `input-group`, `popover`. Drop `cmdk` and `@base-ui/react`. **Keep `field.tsx`** for UI-11.                   |
| D4  | Skeleton this ticket  | **Add the primitive** and seed it on the submissions list loading placeholder so it is imported. Full loading-state migration remains UI-6.             |

Alert variants: `info \| success \| warning \| destructive`. `role="alert"` for destructive/warning, `role="status"` for info/success. Optional icon slot + `AlertTitle` / `AlertDescription`. Default variant is `info`; every error call site passes `destructive`.

Out of scope: Field forms (UI-11), list shells / empty / loading composites (UI-6), combobox in tag editors (UI-9).

## 4. File map

Add: `select.tsx`, `checkbox.tsx`, `alert.tsx`, `alert-role.ts`, `skeleton.tsx`.

Migrate: 3 selects, 3 checkboxes, inline alerts in submissions/transitions lists, details, proposal review, add-track, new-note-form, graph explorer/landing, endpoint picker, submission track links.

Delete: unused shadcn files listed in D3.

## 5. Testing

Alert variant → `role` mapping in `alert-role.test.ts` (`node:test`). No render-only tests.
