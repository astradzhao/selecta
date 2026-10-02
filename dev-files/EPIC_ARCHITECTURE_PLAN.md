# Selecta — epic architecture plan

> The plan above the per-epic docs: where the platform goes after Sets, in what order, and which
> architecture decisions have to land early because they are expensive to retrofit.
>
> Status: **proposal, first round of decisions answered** (§10). Remaining open questions are in
> §10.2.
>
> Last updated: 2026-10-02 — Daniel's answers: Better Auth, account sync (not offline sync), bar 1 =
> first downbeat, co-editing in scope, laptop + controller booth, social and rekordbox are paid.
>
> Builds on [`ARCHITECTURE.md`](./ARCHITECTURE.md) (historical v1 plan),
> [`NEXT_PRODUCT_ARCHITECTURE.md`](./NEXT_PRODUCT_ARCHITECTURE.md) (Library / Graph product model
> and pipeline invariants), [`SETS_ARCHITECTURE.md`](./SETS_ARCHITECTURE.md) (Epic 1), and
> [`TICKET_ORDER.md`](./TICKET_ORDER.md) (deferred DJ-15 deploy, DJ-16 auth, DJ-77 Rekordbox).

---

## 1. Where we are

| Area     | Today                                                                                                                                                     |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apps     | `apps/web` (Next.js UI, `:3000`) talks to `apps/api` (Next.js route handlers, `:3001`) through the `/backend` rewrite. No Server Actions, no react-query. |
| Data     | One Postgres (Drizzle, `@selecta/db`). Music domain in `@selecta/library`, intake pipeline in `@selecta/submissions`, model calls in `@selecta/agentics`. |
| Jobs     | Submission extraction already runs on **Vercel Workflow DevKit** (`workflow` in `apps/api`).                                                              |
| Identity | None. `library_id` columns exist on `tracks` and `blocks` but are filled from `DEV_LIBRARY_ID`. Artists / genres / folders are global rows.               |
| Tracks   | Library-scoped rows. External identity is `track_external_ids` (`spotify:<id>`). No ISRC, no canonical recording.                                         |
| Mixes    | `transitions.from_bar` / `to_bar` (integers, no defined origin) plus `from_cue` / `to_cue` (DJ-150: personal hot-cue letters like `A`).                   |
| Sets     | SET-1…SET-7, SET-9, DJ-148, DJ-153 on `main`. SET-8 (add-context deep links) and SET-10 (Follow) open. Dogfood (DJ-47 → DJ-45) still open.                |
| Deploy   | Local Docker Compose only. Vercel deploy (DJ-15) deferred.                                                                                                |

Three of these become blockers for everything after Sets: **no owner on any row**, **no canonical
track identity**, and **mix points that only mean something on the author's own files**. Fixing
them is cheap now (one user, little data) and expensive after anyone else has data in the system.

---

## 2. Target architecture

```text
                   ┌──────────────────── clients (all online) ────────────────────┐
  Web (Next.js)              Mobile (Expo, iOS first)          Desktop (Tauri)
  prep, sets, graph,         booth notes, Follow,              rekordbox library read,
  social, collaboration,     now-playing from desktop          now-playing detection
  billing                                                      (track changes)
        │                          │                                 │
        └──────────────────────────┴───────── HTTPS + session ───────┘
                                   ▼
  ┌──────────────────────────── Vercel ─────────────────────────────┐
  │ apps/web          apps/api  (/v1 contracts, authz, entitlements, │
  │                             revision checks, presence)           │
  │                   Workflow DevKit: extraction, publish,          │
  │                   play-history → proposals, billing webhooks     │
  └───────────────────────────────┬─────────────────────────────────┘
                                  ▼
                     Managed Postgres (Neon) — single source of truth
                                  │
     Better Auth (tables in our PG) · Stripe + RevenueCat · AI Gateway · Sentry
```

**Account sync means "same data on every device you sign into."** Postgres behind `apps/api` is
the only source of truth. Mobile and desktop are online API clients that read and write the same
rows the web app does; there is no on-device database, sync engine, or CRDT. Freshness comes from
refetch-on-focus plus short polling where it matters (now-playing, presence). Offline support is a
possible future idea (§6), not part of the plan.

Principles carried forward, plus three new ones:

1. **One Postgres, one writer per domain.** Domain packages stay the only code that writes music
   rows. Every client writes through `apps/api`, never directly to the DB.
2. **LLM and devices propose; deterministic code commits.** Play history from rekordbox becomes
   proposals, exactly like NL notes do today.
3. **Every row has an owner** (new). Authorization lives in the domain layer, not in routes.
4. **Personal data is private; shared data is a published snapshot** (new). Publishing never
   exposes a live pointer into someone's library. Collaboration is the one exception, and it is an
   explicit, role-based grant on a single set (§4.4).
5. **Musical time, not file time** (new). Shared mix points are stated in bars from the first
   downbeat; each user's desktop maps them onto their own files.

### 2.1 Package changes this implies

| Package                         | Change                                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `@selecta/contracts` (new)      | Zod schemas + types for every API request/response. Pure TS, no `pg`, no React DOM. Consumed by web, api, mobile, desktop.                     |
| `@selecta/api-client` (new)     | Typed fetch client over `contracts`, session-token aware. Replaces per-app `apiFetch` wrappers over time.                                      |
| `@selecta/identity` (new)       | Better Auth config, users, libraries, membership, `AuthContext`, entitlement checks. Domain package (writes Postgres).                         |
| `@selecta/social` (new, Epic 2) | Follows, publications, clone-into-library, set collaborators, presence.                                                                        |
| `@selecta/library`              | Every query takes an `AuthContext`; recordings + musical positions; set revision checks.                                                       |
| `@selecta/ui`                   | Stays DOM/shadcn. Design tokens get exported as data (`tokens.ts`) generated from `globals.css` so NativeWind on mobile reads the same values. |
| `apps/mobile`, `apps/desktop`   | New deployables. Import `contracts`, `api-client`, pure helpers from `library` (gap display, mix-point formatting) — never `@selecta/db`.      |

The current domain packages import `@selecta/db` (node-postgres), so they cannot run on React
Native. Splitting **pure logic** (formatting, gap-state derivation, completeness math) from
**Postgres access** is the enabling refactor for Epics 4 and 5; do it incrementally as each pure
helper is needed off-server. The desktop app's webview can reuse `@selecta/ui` DOM components
directly.

---

## 3. Epic 1 — Sets, blocks, transitions, Graph / Set mode

**Goal.** Building and following a night is easy and flawless. Already underway under
[DJ-110](https://linear.app/dj-project-astradzhao/issue/DJ-110); the design record is
[`SETS_ARCHITECTURE.md`](./SETS_ARCHITECTURE.md).

**Remaining milestones.**

1. SET-8 ([DJ-118](https://linear.app/dj-project-astradzhao/issue/DJ-118)) add-context deep links,
   SET-10 ([DJ-120](https://linear.app/dj-project-astradzhao/issue/DJ-120)) Follow mode.
2. Dogfood on a real gig (DJ-47 → DJ-45), then a polish pass driven by what broke.
3. **Future-proofing exit criteria** (small, but do them before Epic 2 starts):
   - every new table has a text UUID `id`, `created_at`, `updated_at` (already the convention);
   - say "bar 1 = first downbeat" in the mix-point editor copy (decided, §4.3), so new data is
     entered with the origin everyone will share.

**Risks.** Building more set chrome before the gig validates the workflow
(`SETS_ARCHITECTURE.md` §11 caveat still applies). Follow mode is the surface mobile will reuse, so
keep its view-model in pure TS (`lib/sequences/*` already is).

---

## 4. Epic 2 — Accounts, social, collaboration, cross-user standardization

Four sub-epics with very different risk. **2A must ship right after Sets**; 2B–2D follow. All of
2B and 2D is a paid feature (§8).

### 4.1 Epic 2A — Identity and ownership (foundation)

**Goal.** Real users, each with their own library; every row owned; authz enforced in one place.
Unblocks social, collaboration, mobile, desktop, and billing. Absorbs
[DJ-16](https://linear.app/dj-project-astradzhao/issue/DJ-16).

**Decisions.**

| Decision      | Status      | Choice                                                                                                                                                                                                                                                                                                                 |
| ------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth provider | **Decided** | **Better Auth.** Users and sessions live in our Postgres via its Drizzle adapter (no webhook mirroring), it fits the monorepo as a library in `@selecta/identity`, has no per-user vendor cost, and supports Expo. Rejected: Clerk (hosted, per-MAU, users live outside our DB), Auth.js (weaker native-client story). |
| Session shape | Recommended | Web keeps a cookie; `apps/api` accepts the cookie or a bearer session token, so mobile and desktop call the same routes.                                                                                                                                                                                               |
| Tenancy unit  | Recommended | **Library-owned rows.** `libraries` + `library_members(role)`; one personal library per user at signup. Leaves room for shared crew libraries later without migration.                                                                                                                                                 |
| Enforcement   | Recommended | **Domain layer** (`AuthContext` is a required argument of every `@selecta/library` / `submissions` query). Add Postgres RLS later as defense-in-depth only if a second writer appears.                                                                                                                                 |
| Global vocab  | Recommended | Artists / genres / subgenres stay **global**; folders become library-owned (they are personal).                                                                                                                                                                                                                        |

**Migration.** Create the owner's user + library, backfill every `library_id`, make it
`NOT NULL`, add it to `transitions`, `submissions`, `folders`. One migration, then delete
`DEV_LIBRARY_ID`. Better Auth's tables are generated into `@selecta/db/schema` like every other
table.

**Milestones.** (1) schema + backfill; (2) Better Auth sign-in on web + api session middleware;
(3) `AuthContext` threaded through domain packages, with tests that one library cannot read or
write another's tracks, transitions, or sets; (4) account settings, data export, account deletion.

### 4.2 Epic 2B — Social sharing (paid)

**Goal.** Pro users share sets, blocks, and transitions with followers and by link, and clone what
they like into their own library.

**Decisions.**

| Decision       | Options                                            | Recommendation                                                                                                                                                                                                                                                         |
| -------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What is shared | live reference to my rows · **published snapshot** | **Snapshot.** `publications(id, owner, kind, visibility, version, payload)` with the expanded sequence, recordings, and musical positions. Blocks compose by reference, so a live share would mutate under the viewer; snapshots also keep private step notes private. |
| Visibility     | private · followers · unlisted link · public       | All four, default **private**. Republishing bumps `version`; viewers see "updated".                                                                                                                                                                                    |
| Social graph   | mutual friends · one-way follows                   | **One-way follows** (simpler, fits "DJs I learn from"). Friends = mutual follow if ever needed.                                                                                                                                                                        |
| Feed           | fan-out on write · read-time query                 | **Read-time query** over `follows ⋈ publications` until it is slow.                                                                                                                                                                                                    |
| Clone          | copy rows · link                                   | **Copy** into the viewer's library with `source_publication_id` provenance; recordings resolve to the viewer's own tracks (import if missing). Cloned transitions are normal graph edges.                                                                              |
| Gating         | —                                                  | Publishing, following, and cloning all require Pro (`assertEntitlement`).                                                                                                                                                                                              |
| Public pages   | SPA · SSR                                          | SSR on `apps/web` with OG images. **Recommended, pending Daniel's decision (§10.2):** anyone can _view_ a public or unlisted publication without an account, as the growth loop (shared link → view → sign up → upgrade to clone/follow).                              |

**Milestones.** (1) publish + unlisted link + view page; (2) profiles + follows + feed;
(3) clone into library; (4) moderation basics (report, block, takedown) before anything is
discoverable publicly.

### 4.3 Epic 2C — Standardizing transitions across users

**The problem.** "Into A at bar 81" means nothing on someone else's machine: their file may be a
different edit, their beatgrid may start somewhere else, and their hot cue A is a different spot
(DJ-150 stores the letter, not the position).

**Decisions.**

| Decision          | Status      | Choice                                                                                                                                                                                                                                            |
| ----------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mix-point origin  | **Decided** | **Bar 1 = first downbeat of the beatgrid.** Existing `from_bar` / `to_bar` data is read that way; no data migration.                                                                                                                              |
| Track identity    | Recommended | Add global `recordings` keyed by ISRC, then Spotify id, then MusicBrainz recording id; `tracks.recording_id` links each library track to it. ISRC usually distinguishes edits (extended vs radio), which is exactly the distinction that matters. |
| Shared position   | Recommended | `MusicalPosition { bar, beat?, anchor? }` where `anchor` is an optional semantic landmark (`intro`, `drop_1`, `breakdown_1`, `outro`). Anchors survive intro-length differences between edits.                                                    |
| Hot cues          | Recommended | `from_cue` / `to_cue` stay personal. On publish, a cue letter is converted to a bar via the author's beatgrid (desktop) or dropped if unknown. On clone, the viewer's desktop suggests which of _their_ cues matches.                             |
| Per-user mapping  | Recommended | Desktop reads the user's rekordbox beatgrid (first-beat offset, BPM, tempo changes) and hot cues from `master.db` and converts bar ↔ ms ↔ nearest cue locally (Epic 5). This needs only the library file, not live playback data.                 |
| Version mismatch  | Recommended | Compare recording id, then duration (±2 s) and BPM. A mismatch shows "your file may be a different edit" rather than a wrong bar.                                                                                                                 |
| Audio fingerprint | Deferred    | Metadata matching covers the common case; fingerprinting is a server-job problem (§5) if mismatches turn out to be frequent.                                                                                                                      |

**Milestones.** (1) `recordings` + ISRC capture on catalog import (Spotify returns ISRC) — do this
**inside 2A** while data is small; (2) bar-origin copy + optional `anchor` columns on transitions;
(3) publish-time conversion of cues to bars; (4) desktop mapping (lands with Epic 5).

**Risks.** Beatgrid quality varies (tempo drift, bad analysis, unquantized edits); ISRC is missing
for some promos/bootlegs (fall back to user-confirmed matching); "drop 1" is subjective across
genres.

### 4.4 Epic 2D — Collaborative set editing (paid, online-only)

**Goal.** Two or more DJs co-edit one set (B2B prep) with clear roles and no silent overwrites.

**Model.**

- `sequence_collaborators(block_id, user_id, role)` with roles **owner** (delete, manage
  collaborators), **editor** (edit steps, connectors, seams, notes, alternates, versions), and
  **viewer** (read, Follow). Invites by username or link; accepting requires an account and Pro for
  editors.
- The set stays in the owner's library. When an editor adds a track or transition from their own
  library, it is **copied into the owner's library** through the same clone path as 2B, with
  provenance. That keeps "one graph per library" intact and means the owner's graph gets denser
  from B2B prep. Alternative if this proves awkward: move the set into a shared crew library
  (`library_members`), which 2A already allows.

**Concurrency — phase 1 (simple, no realtime infra).**

| Mechanism                          | How                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Row versions + conflict prompt** | Add `blocks.revision` (integer), bumped by every structural write to the set (steps, reorder, connectors, alternates, versions). Every mutation sends `expectedRevision`, generalizing today's `expectedUpdatedAt`. A stale write returns `409` with the current set and who changed it; the UI shows "Alex changed this set — review their changes, then re-apply yours". Reorder already sends the full ordering, which makes re-apply safe. |
| **Soft edit locks + presence**     | `sequence_presence(block_id, user_id, focus_step_id?, last_seen_at)` updated by a heartbeat (~10 s poll). The workspace shows who is in the set and marks a step or gap someone else is editing ("Alex is editing this gap"). Locks are advisory and expire after ~30 s without a heartbeat; they reduce conflicts, while revisions guarantee correctness.                                                                                     |

Both run on plain API routes and Postgres, so they fit Vercel with no sockets.

**Phase 2 (later): real-time collaboration.** Live cursors and instant updates need a persistent
connection: a hosted realtime service (Liveblocks, PartyKit, Ably) or our own WebSocket service
(the first AWS/Fly candidate, §5). Reconsider a CRDT (Yjs) only at this point, and only for the
running order; the server would still validate and commit through domain packages.

**Milestones.** (1) collaborators + roles + invite; (2) `revision` checks + conflict prompt;
(3) presence + soft locks; (4) later: realtime.

---

## 5. Epic 3 — Hosting and distributed architecture

**Goal.** Production, preview, and staging environments with minimal ops, and a clear trigger for
when (if ever) AWS earns its keep.

**Decisions.**

| Decision        | Options                                        | Recommendation                                                                                                                                     |
| --------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| App hosting     | **Vercel** · AWS (ECS / Lambda / Amplify)      | **Stay on Vercel** for web + api. Two projects, same region as the DB. Absorbs [DJ-15](https://linear.app/dj-project-astradzhao/issue/DJ-15).      |
| Postgres        | **Neon** · Supabase · RDS                      | **Neon** (Vercel Marketplace): branch-per-PR preview databases, serverless driver. Supabase is fine too; RDS only if we move to AWS wholesale.     |
| Background jobs | **Vercel Workflow** · Vercel Cron · SQS/Lambda | Keep **Workflow DevKit** (already used for extraction); add Cron for periodic jobs (presence cleanup, entitlement reconciliation). No queue infra. |
| Realtime        | polling · hosted realtime · own WebSockets     | **Polling** for now-playing and presence. A persistent-connection service arrives only with real-time collaboration (§4.4 phase 2).                |
| Observability   | —                                              | Sentry (web, api, mobile, desktop), Vercel logs, a `/health` that checks the DB.                                                                   |
| IaC             | none · Terraform · SST                         | Vercel + Neon config are small enough for env files and dashboards at first. Introduce **Terraform** when the first AWS resource appears.          |

**Environments.** `local` (Docker Compose, as today) → `preview` (per-PR Vercel deploy + Neon
branch, migrations auto-applied) → `staging` (long-lived, real auth/billing sandboxes) →
`production`. Migrations run in CI before promote, never at function cold start.

**When to add AWS.** Only for a measured need: a WebSocket service for real-time collaboration,
audio analysis / fingerprinting workers (CPU, long runtimes), or Vercel cost at scale. Start with
one container service (ECS Fargate or Fly.io) rather than splitting the API.

**Milestones.** (1) prod + preview on Vercel + Neon (DJ-15); (2) CI: lint, typecheck,
`format:check`, `db:test` against a Neon branch; (3) staging + secrets per env; (4) Sentry +
uptime alerts.

---

## 6. Epic 4 — Mobile app and release process

**Goal.** An iPhone app for capturing notes and following the set while DJing on the laptop,
showing the same account data as every other device.

**Decisions.**

| Decision   | Options                                          | Recommendation                                                                                                                                              |
| ---------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework  | **Expo (React Native)** · Swift · PWA            | **Expo** with expo-router + EAS. Reuses `contracts`, `api-client`, and pure domain helpers; Better Auth's Expo client handles sign-in. A PWA cannot do IAP. |
| Styling    | shadcn (DOM) · **NativeWind** with shared tokens | NativeWind reading tokens generated from `packages/ui/src/styles/globals.css`. Components are rewritten natively; tokens and copy are shared.               |
| Data model | **online API client** · local-first sync         | **Online client.** Reads and writes go straight to `apps/api`; data refreshes on focus and by short polling for now-playing.                                |

**Mobile MVP scope.** (1) quick-capture note → `POST /submissions` (the existing async pipeline
does the rest); (2) Follow mode for the active set (reuses SET-10 view-model); (3) "now playing"
reported by desktop (Epic 5), polled by mobile, to pre-fill which transition the note is about.

**Possible future idea: offline support.** If booth Wi-Fi proves unreliable, the cheapest step is
a local outbox for note capture only (retry `POST /submissions` when back online), not a sync
engine. A full offline-read cache would come after that, and only if needed.

**Versioning and release process** (introduced here; desktop reuses it).

- **API contracts:** additive-only changes on `/v1`; breaking changes get `/v2` routes. Clients
  send `X-Selecta-Client: mobile@1.4.0`; api can return `426` with a minimum version.
- **Mobile:** semver; EAS channels `development` → `preview` (TestFlight) → `production`. JS-only
  fixes ship as EAS Update (OTA) within the same runtime version; native changes ship via App Store.
- **Changesets** at the repo root for app versions and changelogs. Web/api keep continuous deploy.

**Milestones.** (1) `contracts` + `api-client` extraction; (2) bearer-session auth for mobile;
(3) note capture + Follow; (4) now-playing from desktop; (5) TestFlight beta → App Store.

**Risks.** Note capture needs a connection in the booth (see the offline idea); App Store review
timelines; Expo/RN upgrade churn.

---

## 7. Epic 5 — Rekordbox integration and desktop app (paid)

**Goal.** A desktop app that reads the user's rekordbox library, detects which track is playing,
and feeds that back into the graph and to mobile through the account.

**Scope set by the booth.** Daniel plays **laptop + controller** in rekordbox Performance mode, no
CDJs. Performance mode broadcasts no Pro DJ Link data, so there is **no beat position or tempo
stream**. Live tracking is **track-change level only**: which track is playing now, and roughly
when it changed. CDJ / Pro DJ Link support (`prolink-connect`, beat-link) is **out of scope for
now**; the `NowPlayingSource` adapter interface leaves room to add it later.

**Decisions.**

| Decision             | Options                                                                               | Recommendation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Library read         | rekordbox XML export · **`master.db`** (SQLCipher)                                    | **Both.** `master.db` for automatic import (tracks, beatgrids, hot cues, playlists, history); XML export as the fallback when the DB key or schema changes. pyrekordbox documents the format; the reader we need is small (open with the key, query a handful of tables).                                                                                                                                                                                                                                                             |
| Now-playing          | **poll `master.db` play history** · controller MIDI tap · screen OCR / memory reading | **Poll the history table** (read-only, every few seconds) for new rows. Optional refinement: listen to the controller's MIDI alongside rekordbox (load buttons, channel faders) for sharper timing of when the next track became audible. Reject OCR and memory reading as too fragile.                                                                                                                                                                                                                                               |
| What live data does  | write transitions directly · **write proposals**                                      | **Proposals.** Each track change becomes a `play_history` event, and consecutive plays become an "A → B" transition proposal with timestamps but no bar positions; the user approves it and fills in bars and cues later. Track changes also advance Follow mode on web and mobile.                                                                                                                                                                                                                                                   |
| Writing to rekordbox | write `master.db` · **export XML / playlists**                                        | **Never write `master.db`.** Export sets as rekordbox XML playlists (later, hot cues) for the user to import. Writing the live DB risks corrupting their library.                                                                                                                                                                                                                                                                                                                                                                     |
| Shell                | Electron · **Tauri**                                                                  | **Tauri** (reconsidered). Electron's main advantage was Node-native `prolink-connect`, which is now out of scope. What remains — read an SQLCipher file, poll it, optionally read MIDI — is straightforward in Rust (`rusqlite` with SQLCipher, `midir`). Tauri's small memory and CPU footprint matters on a laptop that is also running rekordbox live, where resource contention risks audio dropouts. The webview reuses `@selecta/ui` and `api-client`. Electron stays the fallback if a Node-only dependency becomes essential. |
| Release pattern      | —                                                                                     | Semver, beta/stable channels, Tauri's built-in signed updater, macOS Developer ID + notarization, Windows code signing, Sentry crash reports.                                                                                                                                                                                                                                                                                                                                                                                         |

**Note on DJ-39.** Persisted live sessions were deliberately dropped. `play_history` is a
different thing — an append-only record of what was played, used to propose edges and to report
"now playing" to mobile — not a server-side cursor. Call out the distinction when this lands.

**Milestones.**

1. **Spike now** (parallel with 2A, timeboxed) on Daniel's laptop + controller: prove (a) opening
   `master.db` read-only while rekordbox is running and reading beatgrids + hot cues, and (b) when
   rekordbox writes a history row during Performance mode (on load, on play, or after a delay) and
   how much lag that adds. This decides whether polling is good enough or the MIDI tap is needed.
2. Desktop shell + Better Auth sign-in + library import (match rekordbox tracks to recordings).
3. Beatgrid/hot-cue mapping for musical positions (completes Epic 2C).
4. Now-playing detection → `play_history` → mobile + Follow auto-advance.
5. Play history → transition proposals.
6. Export sets to rekordbox XML.

**Risks.** The `master.db` encryption key and schema are undocumented and can change with any
rekordbox update (AlphaTheta could also object to decryption); history rows may be written late or
only after a track has played for a while, which makes change times approximate; reading the DB
while rekordbox holds it open must be verified as safe; code signing and notarization take real
setup time.

---

## 8. Epic 6 — Monetization

**Goal.** A ~$5–10/month subscription. Personal prep is free; everything social and the rekordbox
integration is paid.

**Tiers (decided shape).**

| Free                                                   | Pro (~$6–8/mo, ~$60/yr)                                         |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| Notes (NL extraction, monthly quota)                   | Everything in Free, with a higher NL quota                      |
| Create your own tracks and transitions                 | Unlimited sets                                                  |
| Create your own sets, up to a limit (~5–10, see §10.2) | **All social:** sharing, publishing, following, cloning         |
| Basic graph exploration (Freeform)                     | **Collaboration:** co-editing sets with roles (§4.4)            |
|                                                        | **Rekordbox integration:** desktop import, now-playing, history |

NL extraction is the only feature with real marginal cost (model tokens), so it is quota-based on
both tiers; usage is already recorded per run (`submission_agent_runs`). Viewing a public link
without an account is outside the tiers and is a separate decision (§10.2).

**Decisions.**

| Decision    | Options                                           | Recommendation                                                                                                                                                 |
| ----------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web billing | **Stripe Billing** + Checkout + customer portal   | Stripe.                                                                                                                                                        |
| iOS billing | Apple IAP · external link                         | **IAP** for subscriptions bought in the app (required outside the US; the US storefront now permits linking out, but IAP is still the low-friction path).      |
| Unifying    | own webhook reconciliation · **RevenueCat**       | **RevenueCat** over Stripe + App Store; its webhooks write an `entitlements` row in our Postgres. Our DB is the only thing the API checks.                     |
| Enforcement | client-side · **server-side in domain packages**  | Limits checked in `@selecta/identity` (`assertEntitlement(ctx, "sets.create")`) inside the write path, so web, mobile, and desktop are all gated the same way. |
| Downgrade   | delete over-limit data · **read-only over limit** | Never delete. Over-limit sets stay readable and followable; creating new ones is blocked. Publications stay up; collaborators drop to viewer.                  |

**Milestones.** (1) entitlement model + limits enforced (no billing yet, everything Pro for beta
users); (2) Stripe on web, launched together with the first paid feature (publishing);
(3) RevenueCat + IAP when the iOS app sells Pro.

**Risks.** Paywalling all of social limits the network effect (the free-viewing decision in §10.2
is the counterweight); App Store review of subscription copy; price testing with a small user base
is noisy.

---

## 9. Sequencing

```text
Epic 1 Sets ──► 2A Identity + recordings ──┬──► 4 Mobile (online) ─────────────┐
 (finish,         (+ DJ-15 deploy, Epic 3)  │                                  │
  dogfood)                                  ├──► 6 Entitlements + Stripe ──► 2B Social
                                            │                              └─► 2D Collaboration
   Rekordbox spike ─────────────────────────┴──► 5 Desktop (Tauri) + 2C mapping
   (parallel, timeboxed)                              (paid; needs entitlements)
                                                         ▼
                                                 6 IAP · 2D realtime · AWS if needed
```

| Phase | Ships                                                                                                         | Why this order                                                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0     | SET-8, SET-10, gig dogfood                                                                                    | Finish what is in flight; validate the core loop.                                                                                                |
| 1     | Vercel + Neon prod/preview (DJ-15) · 2A Better Auth + ownership · `recordings` + bar origin · rekordbox spike | Everything else needs owners and a deployed backend. Recordings are cheapest before other users' data exists. The spike de-risks 2C and 5 early. |
| 2     | `contracts` / `api-client` · mobile MVP (capture + Follow)                                                    | Free-tier, single-user value — Daniel's own booth workflow — with no social or billing dependency. No sync infrastructure needed.                |
| 3     | Entitlements + Stripe · 2B publish / follow / clone · 2D collaborators + revisions + presence                 | Social and collaboration are the paid features; billing ships with them. Collaboration reuses 2B's clone path.                                   |
| 4     | Desktop: import, mapping (2C), now-playing, play-history proposals, XML export                                | Highest-value but highest-risk; a paid feature, so entitlements must exist. Now-playing then lights up mobile Follow.                            |
| 5     | RevenueCat + IAP · real-time collaboration · AWS components only if measured need                             | Only once iOS sells Pro and collaboration usage justifies a persistent-connection service.                                                       |

Phases 2 and 3 can swap if social growth matters more than Daniel's own booth workflow (§10.2);
they share only Phase 1. Phase 4 can start right after Phase 1 if the spike goes well and Daniel
wants rekordbox first, as long as entitlements land before it is released.

---

## 10. Decisions

### 10.1 Decided (2026-10-02)

| Topic          | Decision                                                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sync           | **Account sync only.** Postgres + `apps/api` is the single source of truth; mobile and desktop are online clients. No local-first sync engine or CRDTs. Offline is a future idea. |
| Auth           | **Better Auth** (users in our Postgres, Drizzle adapter, no per-user cost, Expo support). Clerk rejected.                                                                         |
| Bar origin     | **Bar 1 = first downbeat**, including for existing `from_bar` / `to_bar` data.                                                                                                    |
| Co-editing     | **In scope, online-only.** Collaborator roles; revision checks + conflict prompts; soft locks with presence. Real-time collaboration is a later phase.                            |
| Booth hardware | **Laptop + controller.** Track-change-level now-playing via rekordbox history polling. CDJ / Pro DJ Link out of scope for now. Desktop shell moves to **Tauri**.                  |
| Paid boundary  | Free: notes, own tracks/transitions, own sets up to a limit, basic graph. Pro: all social (share, publish, follow, clone, collaborate) and rekordbox integration.                 |

### 10.2 Still open

1. **Viewing without an account:** recommended as the growth loop (anyone with a public or
   unlisted link can view, read-only; signing up and Pro are needed to clone, follow, or
   collaborate). Daniel to decide.
2. **Free set limit:** pick a number in the 5–10 range, and decide whether blocks count toward it
   (they share the `blocks` table; counting only `kind = 'set'` keeps blocks free for building).
3. **Mobile before social?** Phase 2 assumes Daniel's own booth workflow comes before paid social.
4. **Rekordbox risk appetite:** comfortable shipping a `master.db` reader that depends on an
   undocumented key, with XML as the fallback?
5. **Other DJ software:** Serato / Traktor / Engine DJ ever in scope? If yes, keep the desktop
   adapters (`LibrarySource`, `NowPlayingSource`) vendor-neutral from day one.

---

## 11. Invariants to carry forward

- One Postgres is the single source of truth; domain packages are the only writers; every client
  writes through `apps/api`.
- LLM output and device play history become proposals; deterministic code commits.
- Every row is owned by a library; `AuthContext` is required by every domain query.
- Publishing shares snapshots; private notes and live library rows are never exposed except to a
  set's invited collaborators.
- Collaborative edits are online-only and revision-checked; a stale write never silently wins.
- Shared mix points are musical positions from the first downbeat; hot-cue letters stay personal.
- Never write to the user's rekordbox database.
- API changes on `/v1` are additive; native clients declare their version.
- Entitlements are checked server-side; downgrades never delete data.
