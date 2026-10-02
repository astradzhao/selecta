# Selecta — epic architecture plan

> The plan above the per-epic docs: where the platform goes after Sets, in what order, and which
> architecture decisions have to land early because they are expensive to retrofit.
>
> Status: **proposal** for Daniel's review. Nothing here is locked until the decisions in §10 are
> answered.
>
> Last updated: 2026-10-02
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
                   ┌──────────────── clients ────────────────┐
  Web (Next.js)          Mobile (Expo, iOS first)      Desktop (Electron)
  prep, sets, graph,     booth notes, Follow,          rekordbox library read,
  social, billing        now-playing, offline          live now-playing, offline
        │                     │  local SQLite              │  local SQLite
        │                     └──────────┬─────────────────┘
        │                                │ sync stream (read)  +  upload queue (write)
        ▼                                ▼
  ┌──────────────────────── Vercel ────────────────────────────────┐
  │ apps/web            apps/api  (/v1 contracts, authz, limits)   │
  │                     Workflow DevKit: extraction, publish,      │
  │                     performance-log → proposals, webhooks      │
  └───────────────┬───────────────────────────┬────────────────────┘
                  │                           │
          Managed Postgres  ◄── logical ──  Sync service (managed:
          (Neon / Supabase)    replication   PowerSync or Electric)
                  │
   Auth (Better Auth in-PG or Clerk) · Billing (Stripe + RevenueCat) · AI Gateway · Sentry
```

Principles carried forward, plus three new ones:

1. **One Postgres, one writer per domain.** Domain packages stay the only code that writes music
   rows. Clients — including offline ones — write through `apps/api`, never directly to the DB.
2. **LLM and devices propose; deterministic code commits.** Live performance data from rekordbox
   becomes proposals, exactly like NL notes do today.
3. **Every row has an owner** (new). Authorization lives in the domain layer, not in routes.
4. **Personal data is private; shared data is a published snapshot** (new). Sharing never exposes
   a live pointer into someone's library.
5. **Musical time, not file time** (new). Shared mix points are stated in bars relative to the
   music; each user's desktop maps them onto their own files.

### 2.1 Package changes this implies

| Package                         | Change                                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `@selecta/contracts` (new)      | Zod schemas + types for every API request/response and sync row. Pure TS, no `pg`, no React DOM. Consumed by web, api, mobile, desktop.        |
| `@selecta/api-client` (new)     | Typed fetch client over `contracts`, auth-token aware. Replaces per-app `apiFetch` wrappers over time.                                         |
| `@selecta/identity` (new)       | Users, libraries, membership, `AuthContext`, entitlement checks. Domain package (writes Postgres).                                             |
| `@selecta/social` (new, Epic 2) | Follows, publications, clone-into-library.                                                                                                     |
| `@selecta/library`              | Every query takes an `AuthContext`; recordings + musical positions.                                                                            |
| `@selecta/ui`                   | Stays DOM/shadcn. Design tokens get exported as data (`tokens.ts`) generated from `globals.css` so NativeWind on mobile reads the same values. |
| `apps/mobile`, `apps/desktop`   | New deployables. Import `contracts`, `api-client`, pure helpers from `library` (gap display, mix-point formatting) — never `@selecta/db`.      |

The current domain packages import `@selecta/db` (node-postgres), so they cannot run on React
Native. Splitting **pure logic** (formatting, gap-state derivation, completeness math) from
**Postgres access** is the enabling refactor for Epics 4 and 5; do it incrementally as each pure
helper is needed off-server.

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
   - add `deleted_at` tombstones only where sync needs them (Epic 4), not speculatively;
   - define the `from_bar` origin now (§4.3) and say it in the editor copy, so existing data is
     interpretable later.

**Risks.** Building more set chrome before the gig validates the workflow
(`SETS_ARCHITECTURE.md` §11 caveat still applies). Follow mode is the surface mobile will reuse, so
keep its view-model in pure TS (`lib/sequences/*` already is).

---

## 4. Epic 2 — Accounts, social sharing, cross-user standardization

This is three sub-epics with very different risk. **2A must ship right after Sets**; 2B and 2C
follow.

### 4.1 Epic 2A — Identity and ownership (foundation)

**Goal.** Real users, each with their own library; every row owned; authz enforced in one place.
Unblocks social, sync, mobile, desktop, and billing. Absorbs
[DJ-16](https://linear.app/dj-project-astradzhao/issue/DJ-16).

**Decisions.**

| Decision      | Options                                                                    | Recommendation                                                                                                                                                                                                        |
| ------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth provider | **Better Auth** (library, tables in our PG) · **Clerk** (hosted) · Auth.js | **Better Auth**: users live in our Postgres (no webhook mirroring), no per-MAU bill, has Expo and bearer-token plugins for mobile/desktop. Pick **Clerk** instead if hosted UI and zero auth maintenance matter more. |
| Session shape | Cookie on web · bearer/JWT for api                                         | Web keeps a cookie; `apps/api` accepts either cookie or bearer token so mobile and desktop use the same routes.                                                                                                       |
| Tenancy unit  | user-owned rows · library-owned rows                                       | **Library-owned.** `libraries` + `library_members(role)`; one personal library per user at signup. Leaves room for shared crew libraries later without migration.                                                     |
| Enforcement   | route checks · domain-layer `AuthContext` · Postgres RLS                   | **Domain layer** (`AuthContext` is a required argument of every `@selecta/library` / `submissions` query). Add RLS later as defense-in-depth only if a second writer appears.                                         |
| Global vocab  | per-library · global                                                       | Artists / genres / subgenres stay **global**; folders become library-owned (they are personal).                                                                                                                       |

**Migration.** Create the owner's user + library, backfill every `library_id`, make it
`NOT NULL`, add it to `transitions`, `submissions`, `folders`. One migration, then delete
`DEV_LIBRARY_ID`.

**Milestones.** (1) schema + backfill; (2) sign-in on web + api middleware; (3) `AuthContext`
threaded through domain packages, with tests that one library cannot read or write another's
tracks, transitions, or sets; (4) account settings, data export, account deletion.

### 4.2 Epic 2B — Social sharing

**Goal.** Share sets, blocks, and transitions with friends/followers; anyone can view a public
link; viewers can clone what they like into their own library.

**Decisions.**

| Decision       | Options                                            | Recommendation                                                                                                                                                                                                                                                         |
| -------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What is shared | live reference to my rows · **published snapshot** | **Snapshot.** `publications(id, owner, kind, visibility, version, payload)` with the expanded sequence, recordings, and musical positions. Blocks compose by reference, so a live share would mutate under the viewer; snapshots also keep private step notes private. |
| Visibility     | private · followers · unlisted link · public       | All four, default **private**. Republishing bumps `version`; viewers see "updated".                                                                                                                                                                                    |
| Social graph   | mutual friends · one-way follows                   | **One-way follows** (simpler, fits "DJs I learn from"). Friends = mutual follow if ever needed.                                                                                                                                                                        |
| Feed           | fan-out on write · read-time query                 | **Read-time query** over `follows ⋈ publications` until it is slow.                                                                                                                                                                                                    |
| Clone          | copy rows · link                                   | **Copy** into the viewer's library with `source_publication_id` provenance; recordings resolve to the viewer's own tracks (import if missing). Cloned transitions are normal graph edges.                                                                              |
| Public pages   | SPA · SSR                                          | SSR on `apps/web` with OG images; **viewing is free and needs no account** (growth loop: shared link → view → sign up to clone).                                                                                                                                       |

**Milestones.** (1) publish + unlisted link + public view page; (2) profiles + follows + feed;
(3) clone into library; (4) moderation basics (report, block, takedown) before anything is
discoverable publicly.

### 4.3 Epic 2C — Standardizing transitions across users

**The problem.** "Into A at bar 81" means nothing on someone else's machine: their file may be a
different edit, their beatgrid may start somewhere else, and their hot cue A is a different spot
(DJ-150 stores the letter, not the position).

**Decisions.**

| Decision          | Options                                                       | Recommendation                                                                                                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Track identity    | per-library rows only · **canonical recording**               | Add global `recordings` keyed by ISRC, then Spotify id, then MusicBrainz recording id; `tracks.recording_id` links each library track to it. ISRC usually distinguishes edits (extended vs radio), which is exactly the distinction that matters. |
| Mix-point origin  | seconds · bars from file start · **bars from first downbeat** | **Bar 1 = first downbeat of the beatgrid.** Define it now in the editor copy so existing `from_bar` / `to_bar` data stays meaningful.                                                                                                             |
| Shared position   | bar only · cue letter · **musical position**                  | `MusicalPosition { bar, beat?, anchor? }` where `anchor` is an optional semantic landmark (`intro`, `drop_1`, `breakdown_1`, `outro`). Shared points carry bar + anchor; anchors survive intro-length differences between edits.                  |
| Hot cues          | shared letters · **personal mapping**                         | `from_cue` / `to_cue` stay personal. On publish, a cue letter is converted to a bar via the author's beatgrid (desktop) or dropped if unknown. On clone, the viewer's desktop suggests which of _their_ cues matches.                             |
| Per-user mapping  | server-side · **desktop-side**                                | Desktop reads the user's rekordbox beatgrid (first-beat offset, BPM, tempo changes) and hot cues, and converts bar ↔ ms ↔ nearest cue locally (Epic 5).                                                                                           |
| Version mismatch  | ignore · **detect and warn**                                  | Compare recording id, then duration (±2 s) and BPM. A mismatch shows "your file may be a different edit" rather than a wrong bar.                                                                                                                 |
| Audio fingerprint | Chromaprint / analysis now · later                            | **Later.** Metadata matching covers the common case; fingerprinting is a server-job problem (§5) if mismatches turn out to be frequent.                                                                                                           |

**Milestones.** (1) `recordings` + ISRC capture on catalog import (Spotify returns ISRC) — do this
**inside 2A** while data is small; (2) define bar origin + optional `anchor` columns on
transitions; (3) publish-time conversion of cues to bars; (4) desktop mapping (lands with Epic 5).

**Risks.** Beatgrid quality varies (live drummers, tempo drift, bad analysis); ISRC is missing for
some promos/bootlegs (fall back to user-confirmed matching); "drop 1" is subjective across genres.

---

## 5. Epic 3 — Hosting and distributed architecture

**Goal.** Production, preview, and staging environments with minimal ops, and a clear trigger for
when (if ever) AWS earns its keep.

**Decisions.**

| Decision        | Options                                         | Recommendation                                                                                                                                                                      |
| --------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App hosting     | **Vercel** · AWS (ECS / Lambda / Amplify)       | **Stay on Vercel** for web + api. Two projects, same region as the DB. Absorbs [DJ-15](https://linear.app/dj-project-astradzhao/issue/DJ-15).                                       |
| Postgres        | **Neon** · Supabase · RDS                       | **Neon** (Vercel Marketplace): branch-per-PR preview databases, logical replication for the sync service. Supabase is fine too; RDS only if we move to AWS wholesale.               |
| Background jobs | **Vercel Workflow** · Vercel Cron · SQS/Lambda  | Keep **Workflow DevKit** (already used for extraction); add Cron for periodic jobs. No queue infra.                                                                                 |
| Realtime sync   | own WebSocket service · **managed sync engine** | **Managed sync engine** (Epic 4). Vercel functions are request-scoped and cannot hold sockets, so this is the first real non-Vercel component — but it is a vendor, not our server. |
| Observability   | —                                               | Sentry (web, api, mobile, desktop), Vercel logs, a `/health` that checks DB + sync.                                                                                                 |
| IaC             | none · Terraform · SST                          | Vercel + Neon config are small enough for env files and dashboards at first. Introduce **Terraform** when the first AWS resource appears.                                           |

**Environments.** `local` (Docker Compose, as today) → `preview` (per-PR Vercel deploy + Neon
branch, migrations auto-applied) → `staging` (long-lived, real auth/billing sandboxes) →
`production`. Migrations run in CI before promote, never at function cold start.

**When to add AWS.** Only for a measured need: self-hosted sync (cost or vendor exit), audio
analysis / fingerprinting workers (CPU, long runtimes), or Vercel cost at scale. Start with one
container service (ECS Fargate or Fly.io) rather than splitting the API.

**Milestones.** (1) prod + preview on Vercel + Neon (DJ-15); (2) CI: lint, typecheck,
`format:check`, `db:test` against a Neon branch; (3) staging + secrets per env; (4) Sentry +
uptime alerts.

---

## 6. Epic 4 — Mobile app, sync, and release process

**Goal.** An iPhone app for capturing notes and following the set while DJing on the laptop,
working offline in the booth, synced to the same account.

**Decisions.**

| Decision       | Options                                                                | Recommendation                                                                                                                                                                                                                             |
| -------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework      | **Expo (React Native)** · Swift · PWA                                  | **Expo** with expo-router + EAS. Reuses `contracts`, `api-client`, and pure domain helpers. A PWA cannot do reliable background sync or IAP.                                                                                               |
| Styling        | shadcn (DOM) · **NativeWind** with shared tokens                       | NativeWind reading tokens generated from `packages/ui/src/styles/globals.css`. Components are rewritten natively; tokens and copy are shared.                                                                                              |
| Data model     | pure server round-trips · **local-first sync**                         | **Local-first.** Booth Wi-Fi is unreliable; capture must never fail.                                                                                                                                                                       |
| Sync engine    | **PowerSync** · ElectricSQL · Zero / Replicache · CRDT (Automerge/Yjs) | **PowerSync** (or Electric): streams owned rows from Postgres into on-device SQLite; offline writes go to an upload queue that calls **our `apps/api` routes**, so domain packages stay the only writer and validation/limits still apply. |
| Conflict model | CRDT · **server-authoritative, last-write-wins per row**               | **LWW per row**, using the existing `expectedUpdatedAt` optimistic checks. Data is mostly single-author; CRDTs only earn their cost for collaborative set editing, which is not planned.                                                   |
| Sync scope     | whole library · **scoped buckets**                                     | Sync the user's sets/blocks, their tracks/transitions, and recent submissions. Proposals and audit tables stay server-only.                                                                                                                |

**Mobile MVP scope.** (1) quick-capture note → `POST /submissions` (queued offline, the existing
async pipeline does the rest); (2) Follow mode for the active set (reuses SET-10 view-model);
(3) "now playing" pushed from desktop (Epic 5) to pre-fill which transition the note is about.

**Versioning and release process** (introduced here; desktop reuses it).

- **API contracts:** additive-only changes on `/v1`; breaking changes get `/v2` routes. Clients
  send `X-Selecta-Client: mobile@1.4.0`; api can return `426` with a minimum version.
- **Mobile:** semver; EAS channels `development` → `preview` (TestFlight) → `production`. JS-only
  fixes ship as EAS Update (OTA) within the same runtime version; native changes ship via App Store.
- **Changesets** at the repo root for app versions and changelogs. Web/api keep continuous deploy.

**Milestones.** (1) `contracts` + `api-client` extraction; (2) bearer auth for mobile;
(3) sync service on Neon + read-only mobile Follow; (4) offline capture queue; (5) TestFlight beta
→ App Store.

**Risks.** Sync engine is a new vendor dependency (mitigate: writes go through our API, so the
engine is replaceable); App Store review timelines; Expo/RN upgrade churn.

---

## 7. Epic 5 — Rekordbox integration and desktop app

**Goal.** A desktop app that reads the user's rekordbox library, follows what is actually being
played, and feeds that back into the graph — synced with mobile through the account.

**Decisions.**

| Decision             | Options                                                                                         | Recommendation                                                                                                                                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shell                | **Electron** · Tauri                                                                            | **Electron.** The best live-data library (`prolink-connect`) and SQLCipher bindings are Node; Electron runs them in-process and reuses TS packages directly. Tauri is smaller but would need a Node or Python sidecar for both.                        |
| Library read         | rekordbox XML export · **`master.db`** (SQLCipher, via pyrekordbox or a Node port)              | **Both.** `master.db` for automatic import (tracks, beatgrids, hot cues, playlists, history); XML as the fallback when the DB key or schema changes. pyrekordbox documents the format; bundle it as a sidecar or port the reader to Node.              |
| Live now-playing     | Pro DJ Link (`prolink-connect` in TS, beat-link in Java) · `master.db` history polling · memory | **Pro DJ Link** when CDJs/XDJs are on the network. For a laptop + controller in Performance mode there is no Pro DJ Link stream, so fall back to **polling rekordbox's play history** (coarse: track changes, no beat position).                       |
| What live data does  | write transitions directly · **write proposals**                                                | **Proposals.** A `performance_events` log (track loaded / on-air / off-air, timestamps, deck) is folded into "A → B at ~bar N, ~M bars overlap" proposals that the user approves, same invariant as NL notes. Also advances Follow mode automatically. |
| Writing to rekordbox | write `master.db` · **export XML / playlists**                                                  | **Never write `master.db`.** Export sets as rekordbox XML playlists (and later hot cues) for the user to import. Writing the live DB risks corrupting their library.                                                                                   |
| Release pattern      | —                                                                                               | Semver, beta/stable channels, `electron-updater` from signed release artifacts, macOS Developer ID + notarization, Windows code signing, Sentry crash reports.                                                                                         |

**Note on DJ-39.** Persisted live sessions were deliberately dropped. `performance_events` is a
different thing — an append-only history of what was played, used to propose edges and to sync
"now playing" to mobile — not a server-side cursor. Call out the distinction when this lands.

**Milestones.**

1. **Spike now** (parallel with 2A, timeboxed): on Daniel's actual setup, prove (a) decrypting and
   reading `master.db` beatgrid + hot cues, and (b) getting track-change events live. This decides
   whether 2C's mapping and the "auto-update graph" promise are realistic.
2. Desktop shell + sign-in + library import (match rekordbox tracks to recordings).
3. Beatgrid/hot-cue mapping for musical positions (completes Epic 2C).
4. Live now-playing → mobile sync → Follow auto-advance.
5. Performance log → transition proposals.
6. Export sets to rekordbox XML.

**Risks.** The `master.db` encryption key and schema are undocumented and can change with any
rekordbox update (AlphaTheta could also object to decryption); Performance-mode laptops expose no
live stream; Pro DJ Link needs the laptop on the CDJ network; code-signing and notarization cost
real setup time.

---

## 8. Epic 6 — Monetization

**Goal.** A ~$5–10/month subscription with a generous free tier and a viewing experience that
drives signups.

**Tiers (draft).**

| Free                                                | Pro (~$6–8/mo, ~$60/yr)                         |
| --------------------------------------------------- | ----------------------------------------------- |
| Unlimited tracks and manual transitions             | Unlimited sets and blocks                       |
| Graph exploration (Freeform)                        | Publish / share sets, blocks, transitions       |
| Up to 3 sets / blocks                               | Desktop rekordbox integration and live tracking |
| NL note extraction with a monthly quota             | Higher NL extraction quota                      |
| View and follow shared content; clone limited items | Mobile sync across devices (open question, §10) |

NL extraction is the only feature with a real marginal cost (model tokens), so it is quota-based
on both tiers; usage is already recorded per run (`submission_agent_runs`).

**Decisions.**

| Decision    | Options                                           | Recommendation                                                                                                                                                               |
| ----------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web billing | **Stripe Billing** + Checkout + customer portal   | Stripe.                                                                                                                                                                      |
| iOS billing | Apple IAP · external link                         | **IAP** for subscriptions bought in the app (required outside the US; the US storefront now permits linking out, but IAP is still the low-friction path).                    |
| Unifying    | own webhook reconciliation · **RevenueCat**       | **RevenueCat** over Stripe + App Store; its webhooks write an `entitlements` row in our Postgres. Our DB is the only thing the API checks.                                   |
| Enforcement | client-side · **server-side in domain packages**  | Limits checked in `@selecta/identity` (`assertEntitlement(ctx, "sets.create")`) inside the write path, so web, mobile, desktop, and sync uploads are all gated the same way. |
| Downgrade   | delete over-limit data · **read-only over limit** | Never delete. Over-limit sets stay readable and followable; creating new ones is blocked.                                                                                    |

**Milestones.** (1) entitlement model + limits enforced (no billing yet, everything "Pro" for
beta users); (2) Stripe on web; (3) RevenueCat + IAP when mobile ships paid features.

**Risks.** Paywall before there is a reason to pay (sharing and rekordbox are the reasons — do not
launch billing before one of them exists); App Store review of subscription copy; price testing
with a small user base is noisy.

---

## 9. Sequencing

```text
Epic 1 Sets ──► 2A Identity + recordings ──┬──► 4 Mobile + sync ───────────┐
 (finish,         (+ DJ-15 deploy, Epic 3)  │                              │
  dogfood)                                  ├──► 2B Social ──► 6 Billing ◄─┤
                                            │                    (web)     │
   Rekordbox spike ─────────────────────────┴──► 5 Desktop + 2C mapping ───┘
   (parallel, timeboxed)                                        6 IAP (mobile)
```

| Phase | Ships                                                                                                      | Why this order                                                                                                                                                  |
| ----- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | SET-8, SET-10, gig dogfood                                                                                 | Finish what is in flight; validate the core loop.                                                                                                               |
| 1     | Vercel + Neon prod/preview (DJ-15) · 2A identity + ownership · `recordings` + bar origin · rekordbox spike | Everything else needs owners and a deployed backend. Recordings and bar origin are cheapest before other users' data exists. The spike de-risks 2C and 5 early. |
| 2     | `contracts` / `api-client` · sync service · mobile MVP (capture + Follow)                                  | Single-user, multi-device value — Daniel's own booth use case — with no social or billing dependency.                                                           |
| 3     | 2B publish + view + follow + clone · entitlements · Stripe                                                 | Sharing is the first feature worth paying for; free viewing is the growth loop.                                                                                 |
| 4     | Desktop: import, mapping (2C), now-playing, performance-log proposals, XML export                          | Highest-value but highest-risk; by now auth, sync, and versioned releases exist for it to stand on.                                                             |
| 5     | RevenueCat + IAP · AWS components only if measured need                                                    | Only once mobile sells something and scale justifies it.                                                                                                        |

Phases 2 and 3 can swap if social growth matters more than Daniel's own booth workflow; they share
only Phase 1.

---

## 10. Decisions and open questions for Daniel

1. **Auth provider:** Better Auth (users in our Postgres) or Clerk (hosted, faster to wire)?
2. **Booth hardware:** CDJs/XDJs on Pro DJ Link, or laptop + controller in Performance mode? This
   decides whether live tracking gives beat position or only track changes.
3. **Bar origin:** agree that bar 1 = first downbeat of the beatgrid, and is it acceptable to
   reinterpret existing `from_bar` / `to_bar` data that way?
4. **Mobile before social?** Phase 2 assumes your own booth workflow comes before public sharing.
5. **Paid boundary:** is mobile sync free (adoption) or Pro (revenue)? Is clone free?
6. **Rekordbox risk appetite:** comfortable shipping a `master.db` reader that depends on an
   undocumented key, with XML as fallback?
7. **Collaboration:** will two DJs ever co-edit one set (B2B prep)? If yes, revisit CRDTs for
   sequences; if no, LWW stays.
8. **Other DJ software:** Serato / Traktor / Engine DJ in scope ever? If yes, keep the desktop
   adapter interface (`LibrarySource`, `NowPlayingSource`) vendor-neutral from day one.

---

## 11. Invariants to carry forward

- One Postgres; domain packages are the only writers; clients write through `apps/api`.
- LLM output and device telemetry become proposals; deterministic code commits.
- Every row is owned by a library; `AuthContext` is required by every domain query.
- Sharing publishes snapshots; private notes and live library rows are never exposed.
- Shared mix points are musical positions; hot-cue letters stay personal.
- Never write to the user's rekordbox database.
- API changes on `/v1` are additive; native clients declare their version.
- Entitlements are checked server-side; downgrades never delete data.
