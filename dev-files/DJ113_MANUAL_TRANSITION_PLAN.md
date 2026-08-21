# DJ-113 — Manual transition entry (task plan)

> Ticket: [DJ-113 — SET-3: Manual transition entry on /add (no LLM)](https://linear.app/dj-project-astradzhao/issue/DJ-113)
> Mock: [`mocks/add-transition-mock.html`](./mocks/add-transition-mock.html)
> Related: [DJ-138](https://linear.app/dj-project-astradzhao/issue/DJ-138) (Add lives under Library; this ticket's original `/add?mode=` scope is stale), [DJ-118](https://linear.app/dj-project-astradzhao/issue/DJ-118) (sequence deep links — not this ticket), [`SETS_ARCHITECTURE.md`](./SETS_ARCHITECTURE.md) §9
> Design source: [`UI_STYLE_GUIDE.md`](./UI_STYLE_GUIDE.md)
> Status: **implemented.** Work on branch `dj-113`.

---

## 1. Goal

A DJ who already knows the two songs and the mix should be able to write a
transition **without** pasting prose for the model. Today the Library
"Add transition" button opens **New submission**. That is the wrong door.

This ticket adds `/library/add/transitions`: pick From and To (library or
catalog), fill the mix fields, `POST /transitions`, land on the new edge.
No submission row, no proposal, no workflow.

The LLM path stays where it belongs — **New submission** — for nights you
want to dump a paragraph and review later.

---

## 2. What I verified (current tree)

Read this before you start; several things in the Linear description are stale.

- `/add` and `components/add/add-workspace.tsx` **do not exist**. DJ-138 deleted
  them. There is no Transition-mode method switch to hang _Describe it /
  Fill it in_ on, and we should not revive one. Two add pages is the IA:
  describe it = `/library/add/submissions`, fill it in = `/library/add/transitions`.
- The Transitions toolbar still points at
  `libraryAddHref("submissions", "transitions")` → `/library/add/submissions?from=transitions`.
  That is the bug the user is hitting. Home's "Add a transition" does the same.
- `LibraryAddCategory` is `"tracks" | "submissions"` only
  (`apps/web/lib/library/add-routes.ts`). A third category is the whole href
  change.
- Manual create **already works** in the Graph explorer
  (`components/graph/add-transition-panel.tsx`) via `POST /transitions`. That
  panel is library-only, From is locked to the current track, and technique /
  intent / quality are free-text `Input`s. It is the field-group we reuse, not
  the page we copy.
- `TransitionFields` (`components/tracks/transition-fields.tsx`) is shared by
  Library transition detail and the Graph panel. Vocabulary comboboxes belong
  **in this component**, so the three editors stay one grid.
- Allow-lists already exist and are client-safe
  (`packages/library/src/constants.ts`):

  | Field     | Values                                                                                               |
  | --------- | ---------------------------------------------------------------------------------------------------- |
  | Technique | `high_pass_filter`, `low_pass_filter`, `bass_swap`, `loop`, `4_bar_loop`, `echo_out`, `cut`, `blend` |
  | Intent    | `build_hype`, `cool_down`, `maintain_energy`, `peak_time`, `mix_in`, `mix_out`                       |
  | Quality   | `great`, `ok`, `risky`                                                                               |

  Stored values stay these snake_case tokens (or free text). The UI shows
  human labels (`High-pass filter`, `Build hype`, `Great`).

- `POST /transitions` requires existing `fromTrackId` / `toTrackId`. It does
  **not** accept a catalog payload. Catalog picks import through the existing
  `createTrack({ catalog: … })` path, which is idempotent on provider id
  (`packages/library/src/tracks.ts` — reuse the row if `track_external_ids`
  already has that Spotify id). Then `POST /transitions`. No API schema change.
- `TrackPicker` is `source: "library" | "catalog" | "items"` — one source per
  instance. The proposal reviewer uses **tabs** (Suggested / Library / Catalog)
  because it has AI candidates. Manual add has no suggestions, so a single
  search that lists **library hits first, then catalog** is the right control,
  not a three-tab copy of `ProposalEndpointPicker`.
- Parallel A→B edges are allowed. Creating a second transition between the
  same pair is not an error.
- Sequence `from` / `to` / `returnTo` deep links are DJ-118. This page may
  accept `fromTrackId` / `toTrackId` query params as a cheap prefills, but it
  must not invent a second return-URL mechanism.

---

## 3. Decisions

| ID  | Question                                       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Method switch under Add?                       | **No.** Two routes. Submissions stay the LLM path. This page is the manual path.                                                                                                                                                                                                                                                                                                                                                                                                         |
| D2  | Route                                          | `/library/add/transitions`, same `AddPageShell` as the other two add pages. `?from=` records which Library tab to return to.                                                                                                                                                                                                                                                                                                                                                             |
| D3  | Where do "Add transition" buttons go?          | `libraryAddHref("transitions")`. Home, Transitions toolbar, Transitions empty state. Graph's inline panel stays inline.                                                                                                                                                                                                                                                                                                                                                                  |
| D4  | Can you pick a catalog track?                  | **Yes.** Search is one field per endpoint: library matches first (badge `In library`), catalog matches under a `Catalog` group (badge `Will import`). Import happens on submit, not on pick.                                                                                                                                                                                                                                                                                             |
| D5  | Same song on both sides?                       | **No.** Exclude the other endpoint's library id from results. If both somehow resolve to the same id (catalog import colliding), submit is disabled with an error.                                                                                                                                                                                                                                                                                                                       |
| D6  | Auto-reverse checkbox?                         | **No.** A→B is not B→A: bars are not symmetric. A **Swap** control that exchanges the two endpoints is fine — that is editing the one edge, not minting a second.                                                                                                                                                                                                                                                                                                                        |
| D7  | Closed enums for technique / intent / quality? | **Split.** Quality is a closed set rendered as a segmented control: `great` / `ok` / `risky` (plus unset). Ranking (`compareNeighborhoodNeighbors`) sorts on that exact string; a typo is a silent ranking bug. Technique and intent are **comboboxes**: suggest the allow-list, accept free text. DJs invent mixes; rejecting `filter fade` is worse than storing it.                                                                                                                   |
| D8  | New Combobox primitive?                        | **Yes, in `packages/ui`**, because Library detail and Graph already share `TransitionFields`. Do not fork a one-off listbox inside the add form. Native `<datalist>` is not a design-system control.                                                                                                                                                                                                                                                                                     |
| D9  | Where does the form component live?            | `components/add/manual-transition-form.tsx` (add-page, like `new-submission-form.tsx`). SETS §8 said `components/tracks/…`; ignore that — add pages live under `components/add/`. The shared field grid stays in `transition-fields.tsx`.                                                                                                                                                                                                                                                |
| D10 | Prefill from the URL?                          | Optional `fromTrackId` / `toTrackId` (library ids only) so Graph or a future gap can deep-link. Unknown ids are ignored, not 404. Sequence `returnTo` is DJ-118.                                                                                                                                                                                                                                                                                                                         |
| D11 | Where do the mix fields sit?                   | **On the thing they describe.** From bar under From, To bar under To, Overlap on the seam (leave / share / enter, left to right). Technique, intent, quality, and notes are a separate **Mix** block — they describe the edge, not a song. The add page therefore does **not** render `TransitionFields` as one flat 3-column grid. Bar inputs are composed with the endpoint columns; `TransitionFields` grows an `includeBars` flag so Graph/Library detail can keep a stacked layout. |

### Explicitly out of scope

- LLM / submission / proposal rows.
- Extending `POST /transitions` to accept catalog payloads.
- Sequence gap linking (`sequenceId`, `stepId`, `returnTo`) — DJ-118.
- Changing Graph's From-locked inline panel beyond the shared `TransitionFields` comboboxes.
- A reverse-edge wizard.

---

## 4. Page composition

Chrome matches Add track / New submission:

```text
← Back to library
Add a transition
Pick two tracks and the mix. Nothing is sent to the model.

┌──────────────────────────────────────────────────────────────┐
│  FROM                                                    TO  │
│  ┌──────────────────────────┐   →   ┌──────────────────────┐ │
│  │ ▦ Animals    128/8A  Chg │       │ ▤ Backspin Bass  Chg │ │
│  │   Martin Garrix          │       │   Interplanetary…    │ │
│  └──────────────────────────┘       └──────────────────────┘ │
│              Cut out at   Overlap    Come in at              │
│              [ 64 bar ]  [16 bars]   [ 1 bar ]               │
│                                                              │
│  ── Mix ──────────────────────────────────────────────────   │
│  Technique          Intent          Quality                  │
│  [High-pass fil…]   [Build hype ]   [Great| OK |Risky]       │
│  Notes                                                       │
│  [                                                       ]   │
│  ────────────────────────────────────────────────────────    │
│  Pick a "To" track to save.       [ Cancel ] [ Create ]      │
└──────────────────────────────────────────────────────────────┘
```

- **Endpoints are the hero.** Each side is a fixed-height **slot** with the same
  geometry: artwork square, title / artist, BPM / key in a right-hand mono
  column, then a quiet `Change`. It is the crate row from the Transitions list
  you came from.
- **An empty slot is the search field.** Same height, dashed border, and the
  artwork square becomes a magnifier — no input box nested inside a card. Hits
  float as a popover anchored to the slot, so nothing below shifts when you type.
- **Bars are owned by a side, and read as a sentence.** Content-width number
  boxes with an inline unit, clustered around the seam and labelled by what they
  do: `Cut out at 64 bar` · `Overlap 16 bars` · `Come in at 1 bar`. They map to
  `fromBar` / `overlapBars` / `toBar`.
- **Mix is a second block.** Technique, intent, quality, and notes describe the
  edge, so they sit under a Mix label with a hairline, not in the pair grid.
- **Swap** sits on the seam. Disabled until both sides have a pick.
- **One control height everywhere** (34px): search, bar boxes, comboboxes,
  segmented quality, and both buttons. One label tier too — uppercase eyebrows
  for sections (`From`, `To`, `Mix`), sentence-case muted labels for fields.
- **Catalog** rows do not import until submit. The hit shows a `Will import`
  badge so you know you are about to add a track.
- Save is disabled until both endpoints are set, with the reason stated inline
  next to the buttons. Cancel uses the same `backHref` as the shell.

On submit:

1. For each catalog endpoint, `createTrack({ catalog })` → library id
   (no-op reuse if that Spotify id is already in the crate).
2. `POST /transitions` with those ids + parsed fields.
3. `invalidateLibraryCache()` (the new edge changes in/out counts).
4. `router.push(/library/transitions/:id)`.

---

## 5. Vocabulary controls

Human labels (store the token, render the label; free text renders as typed):

| Token              | Label            |
| ------------------ | ---------------- |
| `high_pass_filter` | High-pass filter |
| `low_pass_filter`  | Low-pass filter  |
| `bass_swap`        | Bass swap        |
| `loop`             | Loop             |
| `4_bar_loop`       | 4-bar loop       |
| `echo_out`         | Echo out         |
| `cut`              | Cut              |
| `blend`            | Blend            |
| `build_hype`       | Build hype       |
| `cool_down`        | Cool down        |
| `maintain_energy`  | Maintain energy  |
| `peak_time`        | Peak time        |
| `mix_in`           | Mix in           |
| `mix_out`          | Mix out          |
| `great`            | Great            |
| `ok`               | OK               |
| `risky`            | Risky            |

**Quality** — three values and nothing else, so it is a **segmented control**
(Great / OK / Risky) rather than a dropdown: one click instead of two, and the
whole enum is visible. Pressing the active segment again clears it back to
unset, which means the same `null` today's blank input sends. A `Select` is the
fallback if `packages/ui` should not grow a segmented primitive for one field.

**Technique / Intent** — new `Combobox` in `packages/ui`:

- Input is the value. Typing filters the allow-list by label.
- Arrow keys + Enter pick a suggestion (writes the token).
- Leaving a string that does not match a label stores the trimmed free text.
- A last row, when the query matches nothing: `Use “{query}”`.
- Do not reject unknown values on parse. `parseTransitionFieldPatch` stays
  "trim or null".

Put the label map next to the constants (`packages/library/src/constants.ts`
or a small `vocab-labels.ts` imported by the web app) so Graph, Library
detail, and Add all show the same words.

---

## 6. File map

| Path                                                    | Disposition                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `apps/web/app/library/add/transitions/page.tsx`         | **new** — `AddPageShell` + form                                                                              |
| `apps/web/components/add/manual-transition-form.tsx`    | **new** — endpoints + `TransitionFields` + submit                                                            |
| `apps/web/components/add/transition-endpoint-field.tsx` | **new** — one side: search / selected tile / Change                                                          |
| `apps/web/lib/transitions/endpoint-selection.ts`        | **new** — `library` \| `catalog` selection + `sameEndpoint` helper                                           |
| `apps/web/lib/transitions/endpoint-selection.test.ts`   | **new**                                                                                                      |
| `apps/web/lib/transitions/vocab-labels.ts`              | **new** — token ↔ label, filter suggestions                                                                  |
| `apps/web/lib/transitions/vocab-labels.test.ts`         | **new**                                                                                                      |
| `packages/ui/src/components/combobox.tsx`               | **new** — input + listbox, semantic tokens only                                                              |
| `packages/ui/src/components/segmented.tsx`              | **new** — quality's three-value control (`aria-pressed` group)                                               |
| `apps/web/components/tracks/transition-fields.tsx`      | edit — quality `Segmented`, technique/intent `Combobox`; `includeBars` so the add page can own bar placement |
| `apps/web/lib/library/add-routes.ts`                    | edit — add `"transitions"` category                                                                          |
| `apps/web/lib/library/add-routes.test.ts`               | edit                                                                                                         |
| `apps/web/components/library/library-workspace.tsx`     | edit — Transitions CTA → `libraryAddHref("transitions")`                                                     |
| `apps/web/components/library/transitions-list.tsx`      | edit — empty CTA href                                                                                        |
| `apps/web/app/page.tsx`                                 | edit — home "Add a transition"                                                                               |
| `packages/ui` exports / `UI_STYLE_GUIDE.md` inventory   | edit — document `Combobox`                                                                                   |

No `apps/api` changes. No schema changes.

---

## 7. Phases

### Phase 1 — routes and the empty page

- Extend `LibraryAddCategory` with `"transitions"`.
- Add the page: title "Add a transition", description as in §4, back label
  "Back to library", `libraryAddBackHref(from, "transitions")`.
- Point the three existing "Add transition" hrefs at it. Submissions' own
  button is unchanged.
- Stub the form as two disabled pickers + existing `TransitionFields` so the
  route is walkable.

**Verify:** `libraryAddHref("transitions")` === `/library/add/transitions`;
`libraryAddHref("transitions", "tracks")` records `from`. Clicking Add
transition from the Transitions tab lands here and Back returns to
`/library?view=transitions`.

### Phase 2 — endpoint field

- `TransitionEndpointField`: TrackPicker library search + catalog search
  against the same query (two `useTrackSearch` calls, or one small hook that
  fans out). Group headers `In library` / `Catalog`.
- Selection type:

  ```ts
  type EndpointSelection =
    { kind: "library"; track: ApiTrack } | { kind: "catalog"; track: CatalogTrack };
  ```

- Exclude the opposite library id. Catalog rows whose `providerId` already
  maps to that id (if we know it) should also hide — if we don't, submit-time
  reuse still collapses them.
- Selected state is a crate tile + Change. Catalog selected → `Will import`
  badge.

**Verify (unit):** `sameEndpoint` is true for two library ids, two catalog
provider ids, and a library track whose Spotify id equals a catalog pick.
False across different songs.

### Phase 3 — combobox + TransitionFields

- Ship `Combobox` in `@selecta/ui` (keyboard, `aria-expanded` / `aria-activedescendant`,
  semantic tokens, no hex).
- Quality `Segmented`. Technique / intent `Combobox` with the label map.
- Library transition detail and Graph panel pick this up automatically.

**Verify (unit):** filtering `pass` against techniques returns High-pass and
Low-pass; picking High-pass writes `high_pass_filter`; a custom `filter fade`
round-trips as that string. Quality still omits empty as `null`.

### Phase 4 — submit

- Resolve catalog → `createTrack`, then `createTransition`.
- Disable save while pending or while either side is empty or both sides
  resolve to the same track.
- Errors through `Alert variant="destructive"`.
- Success → `/library/transitions/:id`.

**Verify (manual):** library+library, library+catalog (new song appears in
Tracks), catalog+catalog, duplicate Spotify id reuses the crate row, same
track on both sides cannot save, no `submissions` row is created.

---

## 8. Testing

Only tests that catch a bug a human or typecheck would miss:

| Test                                     | Bug it catches                                                                                     |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `libraryAddHref("transitions")` builders | Transitions CTA silently still points at submissions.                                              |
| `sameEndpoint` library vs catalog        | Submit imports a song that is already the other side, creating a self-edge.                        |
| Vocab filter + token write               | Combobox stores `High-pass filter` instead of `high_pass_filter`, fragmenting filters and ranking. |
| Custom technique round-trip              | Combobox rejects or canonicalizes free text, so `filter fade` cannot be saved.                     |

No render/snapshot tests of the form. No Playwright.

---

## 9. How to walk the mock

Open `dev-files/mocks/add-transition-mock.html` in a browser (or
`python3 -m http.server` from `dev-files/mocks`). Theme toggle is in the
stage bar; `?theme=dark` loads dark directly.

The page shows the same card twice:

1. **Picking** — From is chosen, To is a dashed slot being searched (library
   hits then catalog, floating over the fields below), technique combobox open,
   Create disabled with the reason beside it.
2. **At rest** — both slots filled, the seam sentence complete (`Cut out at 64
bar` · `Overlap 16 bars` · `Come in at 1 bar`), Mix filled in with the
   segmented quality visible, Create enabled.

---

## 10. Acceptance (ticket, restated against the current tree)

- A transition can be created end to end without the LLM path; no submissions
  or proposals row is created.
- Library "Add transition" no longer opens New submission.
- Selecting a catalog track imports it on submit (or reuses the crate row)
  and links the new edge to that track.
- Quality is chosen from Great / OK / Risky. Technique and intent suggest
  known values and still accept new ones.
- The existing New submission flow is untouched.
