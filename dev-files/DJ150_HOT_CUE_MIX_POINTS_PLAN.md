# DJ-150 — Hot cues alongside mix points

> Ticket: [DJ-150](https://linear.app/dj-project-astradzhao/issue/DJ-150/add-ability-to-use-hot-cue-markings-instead-of-bar-numbers)
> Status: **implemented** on branch `dj-150`.

---

## 1. Goal

A mix point can be a **bar**, a **hot cue**, or both. “Cut out” / “Come in”
were the wrong metaphor: those fields are not when track 1 ends or when track
2 fades in.

---

## 2. Mix-point meaning

| Field                            | Meaning                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| **From** (`fromBar` + `fromCue`) | Outgoing track — where we start playing track 2                    |
| **Into** (`toBar` + `toCue`)     | Incoming track — the bar/cue of track 2 that starts at that moment |
| **Overlap** (`barsOverlap`)      | How many bars both play before fading track 1 out                  |

Either side may set cue only, bar only, or both (`A · 81`). Overlap stays a
bar count.

Hot cues live **on the transition**, not a per-track cue table. Pioneer A–H
and Serato 1–8 are the usual values; a short label is also allowed. Intra-track
cue nodes (`ARCHITECTURE.md` §5.7) stay out of scope.

---

## 3. Decisions

| ID  | Question                          | Decision                                                                            |
| --- | --------------------------------- | ----------------------------------------------------------------------------------- |
| D1  | Cue catalog vs labels on the edge | Labels on the transition (`from_cue`, `to_cue`).                                    |
| D2  | Cue instead of bars?              | **Alongside.** Either or both.                                                      |
| D3  | Display names                     | **From** / **Into** / **Overlap** (not Cut out / Come in / Out / In).               |
| D4  | Normalize                         | Trim; empty → null; single letter `a–h` → uppercase; max 16 chars.                  |
| D5  | NL parse                          | Strip `cue A` / `hot cue B` into `fromCue`/`toCue` the same way bars already strip. |

---

## 4. Surfaces

Editors: Library detail, Graph panel, Add transition, proposal review.
Readouts: mix headline, mix inspector, transition phrase, graph neighbor card.
