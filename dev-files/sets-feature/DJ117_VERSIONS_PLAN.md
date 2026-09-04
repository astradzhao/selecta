# DJ-117 — SET-7: Versions — named selections of alternates (task plan)

> Ticket: [DJ-117](https://linear.app/dj-project-astradzhao/issue/DJ-117)
> Architecture: [`../SETS_ARCHITECTURE.md`](../SETS_ARCHITECTURE.md) §2.4, §5.2–§5.3
> Predecessor: [`DJ116_ALTERNATES_PLAN.md`](./DJ116_ALTERNATES_PLAN.md) — SET-6 on `dj-116`
> Status: implemented on `dj-117` (stacked on `dj-116`).

A version is **which alternates are on**. It is not a copy of the sequence. Base is the path with
no choices, so it is not a row.

SET-6 authored the tree on **blocks**. SET-7 is how you name a branch of that tree, preview it, and
pick it when the block is nested in a night.

---

## 1. What already exists

| Capability                         | Where                                                     | State    |
| ---------------------------------- | --------------------------------------------------------- | -------- |
| Tables + FKs                       | `block_versions`, `block_version_choices`                 | **done** |
| Create / patch / delete            | `POST`/`PATCH`/`DELETE /blocks/:id/versions[/:versionId]` | **done** |
| Overlap rejected at save           | `assertNoOverlappingChoices` → 422                        | **done** |
| Choices anchored to alternate IDs  | Domain tests in `blocks.test.ts`                          | **done** |
| `GET ?version=` + expand           | `applyVersionToSteps` only when `expand=1`                | **done** |
| Delete-alt warns if versions point | SET-6 `ConfirmDialog`                                     | **done** |

No version switcher. Detail `steps` are always the base spine. Nested block connectors have no way
to pin a child version.

---

## 2. Product split (from SET-6 D20)

| Surface       | SET-7 chrome                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| `/blocks/:id` | Header switcher (Base + saved versions). Resolved path + `alternate · {label}` chips. Save / rename / delete. |
| `/sets/:id`   | No sequence-level switcher. Each nested **block connector** can pin a child version (or Base).                |

Viewing a non-base version is a **preview of the resolved path**. Spine edits (add / remove /
reorder / link / unlink / + alt) stay on Base — the banner says so. Title still saves.

---

## 3. Decisions

| ID  | Question            | Decision                                                                                                                                                                                             |
| --- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Resolve where       | Client derives the running order from `steps` + `alternates` + `versions[].alternateIds`. Same splice as `applyVersionToSteps`. Detail stays the base spine so edits never write to a resolved view. |
| D2  | Base                | Synthetic. Not a row. Switcher value `base`. Zero choices ≡ identity.                                                                                                                                |
| D3  | How you choose alts | "Save version" dialog: required name + checkboxes of **mapped** alts. Overlap is disabled in the dialog and still 422s on the server. Edit uses the same dialog.                                     |
| D4  | Overlap copy        | Name both labels: `Chosen alternates overlap the same step ("A" and "B").` Keep the word `overlap`.                                                                                                  |
| D5  | Nested pin          | `block_steps.in_block_version_id` nullable FK → `block_versions` `ON DELETE SET NULL`. Must belong to `in_block_id`. Cleared when the connector is unlinked, seamed, or swapped to a transition.     |
| D6  | Nested expand       | Collapsed row shows a version `<Select>` when the child has saved versions. Expand renders the child's **resolved** interior for that pin.                                                           |
| D7  | Chip                | `Badge variant="brand"`: `alternate · {label}` on the substituted gap. No `⤷` rows while a version is active.                                                                                        |
| D8  | Omit empty chrome   | Switcher on a block only when there is ≥1 saved version or ≥1 mapped alt. Nested select only when the child has versions.                                                                            |

Out of scope: Graph Set mode (SET-9), Follow (SET-10), resolved `GET` changing `steps` (expand still uses `applyVersionToSteps`, now honoring nested pins).

---

## 4. Acceptance

- On a block, save a version from one mapped alt, switch to it: skipped span gone, join shows the alt connector, chip on that gap, `+ alt` hidden, banner visible.
- Switch back to Base: primary line and alt rows return. Unrelated insert/reorder does not retarget the version.
- Overlapping checkboxes cannot be saved; API 422 names both labels.
- Empty choices render identically to Base.
- On a set, pin a nested block's version; reload still shows that pin; expand shows the resolved child. Base remains the default.
- `pnpm --filter @selecta/web test` covers resolve/overlap helpers. `pnpm db:test` covers the pin FK and nested expand.
