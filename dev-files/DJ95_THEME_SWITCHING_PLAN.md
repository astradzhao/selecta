# DJ-95 — Wire up light/dark theme switching (task plan)

> Ticket: [DJ-95 — UI-3: Wire up light/dark theme switching](https://linear.app/dj-project-astradzhao/issue/DJ-95)
> Parent epic: [DJ-92 — UI Cleanup](https://linear.app/dj-project-astradzhao/issue/DJ-92)
> Epic plan: [`UI_CLEANUP_PLAN.md`](./UI_CLEANUP_PLAN.md)
> Blocked-by: DJ-93 (merged — [`.dark` tokens are real](./DJ93_SEMANTIC_COLOR_PLAN.md))
> Independent of: DJ-96 (typography) — can ship in parallel after UI-1
> Status: **implemented on `dj-95`.** Decisions D1–D7 landed as recommended.
> DJ-96 had already merged, so this branched off `main` with no `app-shell` rebase.

Dark tokens already exist. This ticket is the missing _activation_: put `.dark`
on `<html>`, persist the choice, and give the sticky nav a toggle. It is not a
re-theme.

## 1. Goal

Make light and dark actually reachable. Today `:root` always wins, so the
`.dark` block, `@custom-variant dark`, and every `dark:` utility are dead.

## 2. What I verified (post DJ-93, current tree)

Re-audited against the workspace that already has UI-1 tokens and UI-2 recipes.
The ticket's 2026-08-12 inventory is **directionally right** and **stale in
the details**.

### 2.1 Activation is still missing (confirmed)

| Ticket claim                           | Now                                                                               |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| `.dark { … }` token block              | Yes — `globals.css:105–146`, including brand/status/surface/overlay from UI-1     |
| `@custom-variant dark (&:is(.dark *))` | Yes — `globals.css:8`, class-based                                                |
| `next-themes` installed                | **No** — not in `apps/web` or `packages/ui`                                       |
| `ThemeProvider` / `.dark` on `<html>`  | **No** — `apps/web/app/layout.tsx` has no provider, no `suppressHydrationWarning` |
| `color-scheme`                         | **No** — neither `:root` nor `.dark`                                              |
| Theme toggle                           | **No**                                                                            |

`layout.tsx` is a server component. Fonts live on `<html>`:

```tsx
<html
  lang="en"
  className={`${fontSans.variable} ${fontMono.variable} h-full font-sans antialiased`}
>
  <body className="flex min-h-full flex-col">{children}</body>
</html>
```

`AppShell` is also a server component (no `"use client"`). Every page wraps
through it, including Home.

### 2.2 `dark:` utilities — ticket count is stale

Ticket: **18** `dark:` across **9** files (14 shadcn, 4 app-specific).

Now: **zero** `dark:` in `apps/web`. The four app-specific ones were the
palette sites UI-1 migrated (`dark:bg-amber-500/30`, `dark:text-amber-400`,
`dark:text-red-400`). Remaining `dark:` are shadcn internals in `packages/ui`
only — `button`, `badge`, `input`, `textarea`, `combobox`, `input-group`,
`field`. They use semantic tokens (`dark:bg-input/30`,
`dark:aria-invalid:ring-destructive/40`), not raw palette colors.

Acceptance line _"zero remaining `dark:` that hardcode a palette color"_ is
**already green**. Do not sweep shadcn `dark:bg-input/30` in this ticket;
those washes become meaningful once `.dark` is reachable.

### 2.3 Overlay / dialog — already on the token

Ticket calls out `dialog.tsx` `bg-black/10` as too weak on dark. UI-1 already
replaced it with `bg-overlay`. Tag-remove hits use `hover:bg-overlay` too.

| Token       | Light                    | Dark                 |
| ----------- | ------------------------ | -------------------- |
| `--overlay` | `oklch(0.145 0 0 / 10%)` | `oklch(0 0 0 / 50%)` |

Graph landing is the only `Dialog` call site (`graph-landing.tsx`). Scrim
audit is: open the track picker in both themes and check it reads. Do not
re-tune `--overlay` unless the 10% light / 50% dark pair actually fails.

### 2.4 Native controls the ticket cares about

Still native — UI-5 has not landed. `color-scheme` is the whole fix for this
ticket; do not introduce `Select` / `Checkbox`.

| File                    | Control                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| `submissions-list.tsx`  | `<select>` status filter + `type="checkbox"` "Needs review only" |
| `transitions-list.tsx`  | same pair                                                        |
| `folder-tag-editor.tsx` | `<select>` folder kind                                           |
| `proposal-review.tsx`   | `type="checkbox"` bidirectional                                  |

### 2.5 Surfaces to audit (ticket list, slightly expanded)

All of these already sit in `AppShell`, so one toggle covers them:

1. Home (`app/page.tsx`)
2. Add — Track and Transition tabs
3. Library — Tracks / Transitions / Submissions
4. Graph landing + in-session explorer
5. Track detail (view + edit)
6. Transition detail
7. Submission detail
8. Proposal review (includes the dialog-less page + Graph's `Dialog` picker)

`/notes` redirects to Library/Add (UI-4 still deletes the files). Do not
treat `/notes` as a tenth product surface.

### 2.6 Sticky header, artwork, graph meters

- Header: `border-border/80 bg-background/90 sticky top-0 z-20 … backdrop-blur`
  (`app-shell.tsx:20`). Tokens, so it will follow the theme. Check whether
  90% + blur is too glassy on dark; bump to `/95` only if the audit says so.
- Artwork placeholders: `bg-muted`. Dark `--muted` is `oklch(0.269)` on
  `--background oklch(0.145)` — placeholders will show. No code change
  expected.
- Graph explorer meters / gradient: `bg-foreground/10|15|20|45|70` and
  `from-foreground/30`. These invert automatically because `--foreground`
  inverts. **Do not restyle them here** (UI-13 owns graph chrome) unless a
  bar disappears against the dark panel.
- Selected nav is already `bg-selected` (inverts in `.dark`). Should just
  work.

### 2.7 Next.js 16 + next-themes

`apps/web` is Next **16.3.0**, React **19.2.4**, Tailwind **v4**. Current
`next-themes` still matches the shadcn App Router recipe:

- Client `ThemeProvider` wrapping `{children}` **inside** `<body>` (do not
  wrap `<html>`)
- `attribute="class"` so it toggles `.dark` on `<html>`
- `suppressHydrationWarning` on `<html>` (the blocking script mutates it
  before hydrate)
- `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`

Our `@custom-variant dark (&:is(.dark *))` matches descendants of `.dark`.
With the class on `<html>`, every node under it matches. CSS variables on
`.dark { }` apply to `html.dark` itself. No variant change needed.

**Font-class hazard:** some `next-themes` script versions used to _replace_
`html.className`, which would wipe `${fontSans.variable}`. Safer to put the
next/font `variable` classes on `<body>` so Geist cannot disappear even if
the script is clumsy. See D3.

## 3. Decisions for review

Recommended answers are marked.

### D1 — Install `next-themes` on `@selecta/web` only

**Recommend: yes.** It is an App Router concern. `packages/ui` has no Next
dependency and should stay that way. `pnpm --filter @selecta/web add next-themes`.

### D2 — Thin passthrough provider; no custom theme logic

**Recommend:** `apps/web/components/theme-provider.tsx` as the shadcn wrapper
(`"use client"`, re-export `ThemeProvider` from `next-themes`). Layout stays
a server component and wraps `children` with it.

No storage-key rename, no `forcedTheme`, no extra context. Persistence,
cross-tab sync, and OS live-updates come from the library.

Skip a unit test (ticket + repo testing rule). Pure passthrough has nothing
a test would catch that typecheck would miss.

### D3 — Move font variable classes from `<html>` to `<body>`

**Recommend: yes.** `<html>` keeps `lang`, `suppressHydrationWarning`, and
`h-full`. `<body>` takes the Geist variables plus `font-sans antialiased`.
`@layer base` already `@apply font-sans` on `html`, so typography still
inherits if a class gets dropped.

### D4 — Toggle is a cycling icon button, not a menu

**Recommend: one ghost `Button size="icon-sm"` in the sticky header, to the
right of the nav.** We have no DropdownMenu/Select primitive (UI-5). Ticket
asks for icon-only + `aria-label`.

- Icons (lucide, already in `apps/web`): `Sun` = light, `Moon` = dark,
  `Monitor` = system. Icon shows the **stored setting**, not
  `resolvedTheme`, so `dark → system` is visible even when the OS is already
  dark.
- Cycle: `system → light → dark → system`.
- `aria-label` like `Color theme: System. Switch to Light.`
- Until `useTheme` has mounted, render the **same-size** button disabled /
  `aria-hidden` so the header does not shift. Icon flash on hydrate is OK;
  layout shift is not.
- Keep `AppShell` a server component. New client island:
  `apps/web/components/theme-toggle.tsx`.

Do not paint the toggle `brand`. Ghost + muted icon, like the inactive nav
pills.

### D5 — `color-scheme` in CSS, leave next-themes `enableColorScheme` on

**Recommend:**

```css
:root {
  color-scheme: light;
}
.dark {
  color-scheme: dark;
}
```

Native `<select>` / checkbox / scrollbars then follow the class even without
relying on the library's inline style. `enableColorScheme` defaults to true
and will set the same property on `<html>` — they agree, so leave the
default.

### D6 — Audit both themes; change tokens only if something fails

**Recommend: yes, as a required implementation step, not a hope.** Walk the
§2.5 list in light, dark, and system-with-OS-dark. Expected non-changes:

- Graph `bg-foreground/NN` meters — leave for UI-13 unless a bar vanishes
- `--overlay` — leave unless the picker scrim fails
- Header `bg-background/90` — bump opacity only if content fights the bar
- shadcn `dark:bg-input/30` — leave; that is the intended dark input fill

If a **token** is wrong in dark (not a one-off class), fix it in
`globals.css` `.dark`, not with a new `dark:` at the call site.

### D7 — Do not wait on DJ-96, but expect an `app-shell` rebase

**Recommend: branch `dj-95` off up-to-date `main`.** UI-3 does not need the
typography recipes. `app-shell.tsx` is the overlap with DJ-96 (wordmark +
`rounded-lg` pills). If #76 is merged first, just start from that main. If
not, rebase onto main after it lands before opening the UI-3 PR — do not
stack this on `dj-96`.

## 4. Proposed shape

### 4.1 `apps/web/app/layout.tsx`

```tsx
<html lang="en" suppressHydrationWarning className="h-full">
  <body
    className={`${fontSans.variable} ${fontMono.variable} flex min-h-full flex-col font-sans antialiased`}
  >
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  </body>
</html>
```

### 4.2 Header slot

```tsx
<div className="flex items-center gap-2">
  <nav>…existing pills…</nav>
  <ThemeToggle />
</div>
```

Right cluster stays `justify-between` with the wordmark. Toggle is `size-7`
(`icon-sm`), so it lines up with the `h-14` bar.

### 4.3 CSS

Add `color-scheme` to the existing `:root` / `.dark` blocks. Do not add a
third theme. Do not retouch `@custom-variant dark`.

## 5. Implementation tasks (when approved)

One branch: `dj-95`, off up-to-date `main`. Do not mix UI-2 or UI-4.

1. `pnpm --filter @selecta/web add next-themes`
2. Add `theme-provider.tsx` (passthrough) and wire it in `layout.tsx` with
   `suppressHydrationWarning`. Move font variables to `<body>` (D3).
3. Add `color-scheme` to `:root` / `.dark`.
4. Add `theme-toggle.tsx` and slot it into `AppShell` (D4).
5. Visual audit §2.5 in light, dark, and system. Record any token tweak in
   the epic doc; do not drive-by restyle graph-explorer.
6. Cross-link this plan from the UI-3 bullet in `UI_CLEANUP_PLAN.md`. After
   ship, add a short "Theme switching (shipped in UI-3 / DJ-95)" note under
   Target conventions (provider props, cycle order, `color-scheme`).
7. Verify (no new tests):

```bash
rg -n 'next-themes' apps/web/package.json
rg -n 'suppressHydrationWarning' apps/web/app/layout.tsx
rg -n 'color-scheme' packages/ui/src/styles/globals.css
rg -n 'bg-black/|bg-amber-|text-red-[0-9]' apps packages --glob '*.tsx'
# expect: zero (already true post UI-1)

pnpm --filter @selecta/web typecheck
pnpm --filter @selecta/web build   # confirms the client provider compiles
```

Spot-check by hand: hard reload on `/` and `/library` in both OS themes
(FOUC), toggle light → dark → system without reload, change OS theme while
on `system`, native `<select>` on Submissions, Graph picker scrim, sticky
header over a long list.

## 6. Out of scope

- Select / Checkbox primitives (UI-5)
- Restyling graph-explorer meters, gradients, or motion (UI-13)
- Deleting `/notes` (UI-4)
- Brand-colored toggle, animated sun/moon morph, or a theme menu
- Putting `next-themes` in `packages/ui`
- Changing light/dark token values unless the audit finds a real failure
- Sweeping leftover shadcn `dark:` input/invalid washes
- Unit tests for the passthrough provider

## 7. File touch list (expected)

| File                                     | Why                                                |
| ---------------------------------------- | -------------------------------------------------- |
| `apps/web/package.json` + lockfile       | `next-themes`                                      |
| `apps/web/app/layout.tsx`                | provider, `suppressHydrationWarning`, font classes |
| `apps/web/components/theme-provider.tsx` | new, client wrapper                                |
| `apps/web/components/theme-toggle.tsx`   | new, client island                                 |
| `apps/web/components/app-shell.tsx`      | slot the toggle; stays a server component          |
| `packages/ui/src/styles/globals.css`     | `color-scheme` only (plus any audit token fix)     |
| `dev-files/UI_CLEANUP_PLAN.md`           | cross-link + shipped note                          |

## 8. Acceptance

- Toggle light → dark → system updates instantly, no reload, no color-sweep
- Hard reload preserves the choice; `system` follows OS changes live
- No FOUC on `/` or `/library` in either OS theme
- Header does not shift when the toggle hydrates
- Native selects/checkboxes/scrollbars follow the theme (`color-scheme`)
- §2.5 surfaces are legible in both themes: no invisible text, no vanished
  borders, picker scrim reads, artwork placeholders visible
- Zero `dark:` utilities that hardcode a palette color (already true)
- `pnpm --filter @selecta/web typecheck` and `build` pass

## 9. How this feeds the rest of the epic

```text
UI-1 (done) → UI-3 (this)     ← independent after UI-1
UI-1 (done) → UI-2 (PR #76) → UI-5 / UI-6
```

After this lands, every later UI PR must be checked in **both** themes
before merge (already in the epic maintenance rules).
