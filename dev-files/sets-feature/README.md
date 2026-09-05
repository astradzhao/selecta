# Sets feature

Canonical architecture for Blocks / Sets lives at
[`../SETS_ARCHITECTURE.md`](../SETS_ARCHITECTURE.md) (Linear, `TICKET_ORDER.md`, and the SET-\*
tickets all point there). This folder holds the design mockup and the per-ticket implementation
plans for that epic.

| Doc                                                                  | Ticket                                                          | Status                                                                                 |
| -------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [`../SETS_ARCHITECTURE.md`](../SETS_ARCHITECTURE.md)                 | [DJ-110](https://linear.app/dj-project-astradzhao/issue/DJ-110) | Source of truth for the model, schema, API, and slice order                            |
| [`Sets feature mockup/`](./Sets%20feature%20mockup/)                 | [DJ-110](https://linear.app/dj-project-astradzhao/issue/DJ-110) | **Source of truth for chrome and interaction.** Interactive prototype of the end state |
| [`DJ114_SETS_WORKSPACE_PLAN.md`](./DJ114_SETS_WORKSPACE_PLAN.md)     | [DJ-114](https://linear.app/dj-project-astradzhao/issue/DJ-114) | SET-4 task plan — Sets tab + two-pane workspace, built to the mockup                   |
| [`DJ115_BLOCK_CONNECTORS_PLAN.md`](./DJ115_BLOCK_CONNECTORS_PLAN.md) | [DJ-115](https://linear.app/dj-project-astradzhao/issue/DJ-115) | SET-5 task plan — block connectors, detach, save-trail-as-block                        |
| [`DJ116_ALTERNATES_PLAN.md`](./DJ116_ALTERNATES_PLAN.md)             | [DJ-116](https://linear.app/dj-project-astradzhao/issue/DJ-116) | SET-6 task plan — alternates as substitutable spans                                    |
| [`DJ117_VERSIONS_PLAN.md`](./DJ117_VERSIONS_PLAN.md)                 | [DJ-117](https://linear.app/dj-project-astradzhao/issue/DJ-117) | SET-7 task plan — named versions and nested version pins                               |
| [`DJ119_GRAPH_SET_MODE_PLAN.md`](./DJ119_GRAPH_SET_MODE_PLAN.md)     | [DJ-119](https://linear.app/dj-project-astradzhao/issue/DJ-119) | SET-9 — Graph Set mode overlay, seams, off-script edits (**implemented**)              |

## The mockup

`Sets feature mockup/Selecta Sets.dc.html` plus `support.js` (its runtime — keep them together).
Open the HTML in a browser: it is a working prototype on the real Haze tokens, covering the browse
list, the two-pane workspace, all gap states, palette drag-and-drop, block connectors, alternates,
and versions.

It is the **end state of the whole epic**, not one slice. Split by ticket:

| Mockup surface                                                                                                     | Slice                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browse list, workspace shell, running order, gaps, seams, notes, Tracks/Transitions palette, drag-and-drop, toasts | SET-4 ([DJ-114](https://linear.app/dj-project-astradzhao/issue/DJ-114))                                                                           |
| Blocks palette tab, block gap rows, "moves as one" unit, Expand / Edit block / Detach                              | SET-5 ([DJ-115](https://linear.app/dj-project-astradzhao/issue/DJ-115))                                                                           |
| `+ alt`, `⤷ alt · …` rows on **blocks**; sets omit that chrome                                                     | SET-6 ([DJ-116](https://linear.app/dj-project-astradzhao/issue/DJ-116))                                                                           |
| Version select on **blocks**; `alternate · …` chips; nested block version pin on sets                              | SET-7 ([DJ-117](https://linear.app/dj-project-astradzhao/issue/DJ-117))                                                                           |
| Open in graph, Follow                                                                                              | SET-9 / SET-10 ([DJ-119](https://linear.app/dj-project-astradzhao/issue/DJ-119), [DJ-120](https://linear.app/dj-project-astradzhao/issue/DJ-120)) |

Each slice ships its own piece of that chrome and **omits** the later controls rather than rendering
them disabled. The mockup's inline `oklch()` values mirror
`packages/ui/src/styles/globals.css` — translate them to semantic classes, never copy them.

The mockup's alternates are keyed to a single gap; the SET-1 schema already models an alternate as a
**span** (`fromStepId` / `toStepId`). SET-6 must build for spans.

## Status

SET-1 through SET-7 are on `main` (SET-5 #102, SET-6, SET-7 #104). SET-3 shipped the manual
transition page at `/library/add/transitions`. Architecture §11 still says not to start SET-5…SET-10
until SET-4 has been used on a real gig; SET-5–7 shipped anyway. SET-9
([`DJ119_GRAPH_SET_MODE_PLAN.md`](./DJ119_GRAPH_SET_MODE_PLAN.md)) is implemented on `dj-119`.

Linear still shows DJ-115 / DJ-116 as Backlog blockers of DJ-119 — that is stale; git is the
authority. SET-8 (add-context deep links) is independent. SET-10 (Follow) waits on SET-9.
