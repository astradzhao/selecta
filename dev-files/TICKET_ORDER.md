# Local MVP — ticket order

> Source of truth for **what to work on next**, local-first.  
> Project: [MVP — Library → Notes → Graph Explorer](https://linear.app/dj-project-astradzhao/project/mvp-library-notes-graph-explorer-08d4f2152899)  
> Last updated: 2026-08-02  
> Strategy: library import → free-form notes → graph traversal on `pnpm dev` **before** auth or Vercel.

---

## Product model note (important)

Do **not** collapse musical labels and crates into one “section” node.

| Node       | Meaning                                                               | Relationship  |
| ---------- | --------------------------------------------------------------------- | ------------- |
| `Genre`    | Provider catalog metadata (Spotify etc.)                              | `IN_GENRE`    |
| `Subgenre` | DJ musical label (“UKG”, “melodic house”)                             | `IN_SUBGENRE` |
| `Folder`   | Organizational container (playlist / crate / folder); optional `kind` | `IN_FOLDER`   |

Canonical ticket: [DJ-51](https://linear.app/dj-project-astradzhao/issue/DJ-51).

---

## Done

- **M0** foundations (DJ-6, DJ-12–14, DJ-17, DJ-49, DJ-50)
- **M1** local data foundation (DJ-10, DJ-18–24)

Deferred outside MVP: [DJ-15](https://linear.app/dj-project-astradzhao/issue/DJ-15) Vercel, [DJ-16](https://linear.app/dj-project-astradzhao/issue/DJ-16) auth.

Canceled: DJ-30 default library, DJ-39 live session, DJ-44 bar stepper.

---

## Now — M2 Song discovery & library

Parent: [DJ-8](https://linear.app/dj-project-astradzhao/issue/DJ-8)

| #   | Ticket                                                        | Title                                                  |
| --- | ------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | [DJ-51](https://linear.app/dj-project-astradzhao/issue/DJ-51) | Schema: Subgenre vs Folder (separate nodes)            |
| 2   | [DJ-53](https://linear.app/dj-project-astradzhao/issue/DJ-53) | API: external music catalog search adapter             |
| 3   | [DJ-25](https://linear.app/dj-project-astradzhao/issue/DJ-25) | Graph writes for Song/Artist/Genre/Subgenre/Folder     |
| 4   | [DJ-26](https://linear.app/dj-project-astradzhao/issue/DJ-26) | API: import or manually create a song                  |
| 5   | [DJ-27](https://linear.app/dj-project-astradzhao/issue/DJ-27) | API: search/list local library                         |
| 6   | [DJ-28](https://linear.app/dj-project-astradzhao/issue/DJ-28) | API: song detail                                       |
| 7   | [DJ-29](https://linear.app/dj-project-astradzhao/issue/DJ-29) | UI: search/import + separate Subgenre & Folder pickers |
| 8   | [DJ-31](https://linear.app/dj-project-astradzhao/issue/DJ-31) | UI: library list + song detail                         |

---

## Parallel-capable — M3 Free-form notes

Parent: [DJ-7](https://linear.app/dj-project-astradzhao/issue/DJ-7)  
Raw notes do **not** require M2. Linking/parse/commit do.

| #   | Ticket                                                        | Title                                        | Needs library? |
| --- | ------------------------------------------------------------- | -------------------------------------------- | -------------- |
| 9   | [DJ-52](https://linear.app/dj-project-astradzhao/issue/DJ-52) | API: create/list/edit arbitrary notes        | No             |
| 10  | [DJ-37](https://linear.app/dj-project-astradzhao/issue/DJ-37) | UI: notes list and detail                    | No             |
| 11  | [DJ-36](https://linear.app/dj-project-astradzhao/issue/DJ-36) | UI: free-form note composer + optional parse | No for save    |
| 12  | [DJ-54](https://linear.app/dj-project-astradzhao/issue/DJ-54) | Optional manual note → song links            | Yes            |
| 13  | [DJ-33](https://linear.app/dj-project-astradzhao/issue/DJ-33) | Zod schema for optional extraction           | No             |
| 14  | [DJ-32](https://linear.app/dj-project-astradzhao/issue/DJ-32) | Versioned free-form extraction prompt        | No             |
| 15  | [DJ-34](https://linear.app/dj-project-astradzhao/issue/DJ-34) | API: parse saved note into proposals         | No             |
| 16  | [DJ-35](https://linear.app/dj-project-astradzhao/issue/DJ-35) | Resolve song mentions + ambiguity picker     | Yes            |
| 17  | [DJ-38](https://linear.app/dj-project-astradzhao/issue/DJ-38) | API: commit accepted transitions             | Yes            |

---

## Then — M4 Song graph explorer

Parent: [DJ-11](https://linear.app/dj-project-astradzhao/issue/DJ-11)

| #   | Ticket                                                        | Title                                               |
| --- | ------------------------------------------------------------- | --------------------------------------------------- |
| 18  | [DJ-40](https://linear.app/dj-project-astradzhao/issue/DJ-40) | API: ranked song graph neighborhood                 |
| 19  | [DJ-55](https://linear.app/dj-project-astradzhao/issue/DJ-55) | Reusable song-neighborhood visualization            |
| 20  | [DJ-41](https://linear.app/dj-project-astradzhao/issue/DJ-41) | UI: graph explorer + next-song list                 |
| 21  | [DJ-43](https://linear.app/dj-project-astradzhao/issue/DJ-43) | UI: traverse by selecting next song                 |
| 22  | [DJ-42](https://linear.app/dj-project-astradzhao/issue/DJ-42) | Optional discovery: same-artist / subgenre / folder |

---

## Then — M5 Dogfood

Parent: [DJ-9](https://linear.app/dj-project-astradzhao/issue/DJ-9)

| #   | Ticket                                                        | Title                                       |
| --- | ------------------------------------------------------------- | ------------------------------------------- |
| 23  | [DJ-47](https://linear.app/dj-project-astradzhao/issue/DJ-47) | Import ~10 songs + representative notes     |
| 24  | [DJ-45](https://linear.app/dj-project-astradzhao/issue/DJ-45) | End-to-end dogfood checklist                |
| 25  | [DJ-48](https://linear.app/dj-project-astradzhao/issue/DJ-48) | Measure catalog search + graph latency      |
| 26  | [DJ-46](https://linear.app/dj-project-astradzhao/issue/DJ-46) | Accept local MVP + file post-MVP follow-ups |

---

## Critical path

```
DJ-51 → DJ-53 → DJ-25 → DJ-26 → DJ-29 / DJ-27 / DJ-28 → DJ-31
                 ↘
DJ-52 → DJ-37 / DJ-36 → DJ-54 → DJ-33/32/34 → DJ-35 → DJ-38
                                                      ↓
                                              DJ-40 → DJ-55 → DJ-41 → DJ-43
                                                      ↓
                                              DJ-47 → DJ-45 → DJ-46
```
