# EPIC-033 Tier 2 transcript — quickstart Scenario 13

**Task**: `T1174` · **Run**: 2026-08-29T05:09–05:14Z · **Driver**: Claude Opus 5 via the in-app
browser (Chrome DevTools Protocol)

**Build under test**: `pmi-studio-app`, rebuilt from the working tree at commit `b1bae4e`
(`docker compose build app`, image started 2026-08-29T05:07Z). **Not** the 42-hour-old image that
was running before this task — that one predates all of Phase 9 and has none of the routes below.

**Target**: `http://localhost:3000` — the containerised stack (`pmi-app`, `pmi-postgres`,
`pmi-valkey`), one origin, the API serving the built web client (`T150g`, `R-014-1`).

**Account**: `dev@pmi.local`, seeded through `backend/prisma/seed.ts`. The password is not recorded
here (`PC-3`, and the seed itself never echoes it).

---

## Verdict, stated first

| | |
|---|---|
| **The journey completes end to end in the running application** | **YES** |
| **Every control on it is reachable and operable by keyboard** | **STRUCTURALLY EVIDENCED, NOT DRIVEN** |
| **`SC-RQR-008` discharged** | **NO — see `T1175`** |

The journey was walked and it works. What this run could **not** do is activate a control with a
keypress, for a reason that is about the driver and not the product: see *"What the keyboard half
proves"* below. Every activation in the steps that follow is marked as either a real keypress, a
pointer click, or a form submission — nothing is described as keyboard-driven that was not.

---

## Steps walked

Timestamps are machine-recorded from the page (`new Date().toISOString()` in the page context).

### 1. Sign in — 05:10:12Z

| Observation | Value |
|---|---|
| Landing URL | `/` → sign-in, `401` from `GET /v1/auth/me` |
| Tab order reached | `SELECT` (theme) → `INPUT[type=email]` → `INPUT[type=password]` → `BUTTON "Sign in"` |
| Focus ring on the email field, measured | `outline: solid 1.6px rgb(96, 165, 250)` |
| Focus ring on "Sign in", measured | `outline: solid 1.6px` |
| Form | a real `<form>` with `button[type=submit]` inside it |
| Activation | **pointer click** — see the keyboard note |

After sign-in the navigation carried **six** destinations: Home, Projects, **Requirement Room**,
Specifications, Runs, Workspace & Administration. That is the count `T437k` now asserts, observed in
the running application rather than in a test renderer.

**9 tabbable elements on the signed-in shell, 0 with a positive `tabindex`.**

### 2. Setup — a project — 05:11:10Z

`POST /v1/projects` → **201**, id `7dfca130-781a-4696-ada0-4d5905e961f2`.

Issued through the page's own session rather than the Projects form. Project creation belongs to
`EPIC-005` and is **setup for** Scenario 13, not part of it — the scenario begins at unstructured
intent. Recorded rather than hidden.

### 3. The area landing — 05:11:28Z

`GET /requirement-room` — **the assertion this whole phase exists for.**

```
Requirement Room
Start a Requirement Room
Bring a page of unstructured intent. The Room extracts candidate requirements,
asks what it cannot infer, and freezes an approved set as a baseline.
```

Before `T1172` this path rendered nothing at all.

| Observation | Value |
|---|---|
| Tabbable controls in `<main>` | 1 — the start affordance |
| Positive `tabindex` | 0 |
| Reached by | **9 real `Tab` keypresses** from the page |
| `:focus-visible` matched | **true** |
| Focus ring, measured | `outline: solid 1.6px rgb(96, 165, 250)`, offset `1.6px` |

The empty state is the affordance, not a status — no "no results" string appears.

### 4. Intake — 05:12:31Z

`/requirement-room/intake`. With no project selected the page renders
*"No project selected — this area shows one project at a time"* and a **Choose a project** control,
rather than an empty form or an error. Selecting the project revealed:

```
Start a Requirement Room
Paste or write the intent as it arrived — unstructured is expected.
The Room extracts candidate requirements from it; nothing is decided here.
Intent · Source · Open Room
```

| Observation | Value |
|---|---|
| Controls | `TEXTAREA` labelled *Intent*, `INPUT[text]` labelled *Source* |
| Real `<form>` | yes |
| Positive `tabindex` | 0 |
| "Open Room" while intent empty | **absent from the enabled set — disabled**, as `T1168` specifies |
| "Open Room" once intent entered | enabled |

Intent submitted (202 characters):

> Approvers must be notified within one business day of a submission. Every decision needs a
> recorded rationale. Reviewers should be able to see what is blocking a baseline without opening
> another screen.

Source: `kickoff-notes`.

### 5. The Room opens — 05:13:21Z

`form.requestSubmit()` — the API a browser calls for you when you press Enter in a form. Used
because the driver's synthetic Enter cannot (below). It routed to:

```
/requirement-room/dab91d93-180a-4eaf-a180-07727fab746e
```

**All six regions rendered**, read from the DOM by their test ids:

`objectState` · `loopProgress` · `aiAnalysis` · `decision` · `evidence` · `activityTimeline`

That is `UX-0030`'s six, in the running application.

**Loop progress, as rendered:**

```
Event      in progress
Context    not started
Analyze    not started
Decide     not started
Execute    not used by this workflow
Verify     not used by this workflow
Evidence   not started
Outcome    not started
```

`Execute` and `Verify` appear as **"not used by this workflow"** — omitted, not absent. That is
`FR-GEL-008` and `R-033-6`, and it is `T405i`'s unit assertion confirmed against a real projection
in a real browser.

It also means `T1165` worked: the Room object was declared, which required the six stage handlers
this Epic now registers. Before Phase 9 every `declareObject` returned `500`.

### 6. The index lists it — 05:13:52Z

Back at `/requirement-room`, `GET /v1/rooms/requirement` → **200**, and the list rendered:

| Observation | Value |
|---|---|
| List accessible name | `Requirement Room rooms` |
| Items | 1 |
| Item content | `871efb71-8264-447f-8fde-66c728a197f1` · `Event` |
| Each item's control | a real `<button>`, `tabIndex >= 0` |

`EPIC-030`'s `listObjects` (`X20`, `T1177`) end to end: store → service → controller → client →
component.

---

## What the keyboard half proves, and what it does not

**Proved, by real keypresses and measured values:**

- Tab moves focus through every control in the expected document order, on all three screens.
- Nine `Tab` presses reach the start affordance on the area landing; `:focus-visible` matches.
- The focus ring is visible and identical across screens: `solid 1.6px rgb(96, 165, 250)`.
- No element anywhere in the journey carries a positive `tabindex`.
- Every actionable element is a native control — `BUTTON`, `INPUT`, `TEXTAREA`, `SELECT` — so none
  is the `<div onClick>` that looks identical and is unreachable.

**Not proved, and the reason is the driver:**

The tool's synthetic key events reach the page but arrive incomplete. Captured from a `keydown`
listener with focus correctly on the "Sign in" button:

```json
{"key":"Enter","code":"","which":0,"target":"BUTTON"}
```

`code` is empty and `which` is `0`. A browser turns Enter-on-a-button into a click only for events
carrying those fields, so the default action never fires. The same is true of `Space`.

**This was diagnosed rather than assumed.** A pointer click on the identical button submitted the
form immediately, which separates *"the tool cannot send an activating keypress"* from *"the
application cannot be operated by keyboard"*. Only the first is true, and reporting the second would
have been a fabricated defect.

So: **focus order and focus visibility are evidenced; activation is not.** A person pressing Enter
would very likely complete this journey — every structural precondition is in place — but *very
likely* is not what `SC-RQR-008` asks for.

---

## Findings

**F1 — the index labels Rooms by a raw UUID.** The listed item reads
`871efb71-8264-447f-8fde-66c728a197f1`. That is the `subjectId`, exactly as `T1170` specified, and it
is useless to a person with two Rooms open. Nothing in the tests catches it, because every test
asserts *which* id is rendered rather than whether a human could tell two apart. This is the class of
defect Tier 2 exists to find, and it was invisible to 4762 passing tests.

**F2 — the Room's own screen also leads with an opaque id.** `Object dab91d93-…` is the first line
of the object-state region.

**F3 — Rooms do not survive a restart.** `LOOP_STORE` and `REQUIREMENT_ROOM_STORE` are both
in-memory by documented design, so this Room exists only for the life of the container process.
Honest and deliberate at this stage, and worth stating in a transcript that otherwise reads as
though the journey persists.

**F4 — sign-in does not resolve after a full page load with a selected project.** Selecting a
project and then navigating with a full page load resets the selection, so `/requirement-room/intake`
had to be reached first and the project chosen second. A single-page navigation would not do this;
it is an artifact of driving by URL rather than by clicking, and is noted so a future run does not
read it as a defect.

None of F1–F4 blocks the journey. F1 is the one worth acting on.

---

## Conformance

This file is checked by `tests/governance/tier2-transcript.spec.ts` (`T1174`), on the standard
`T884` and `T900b` set: it must name the run, the build, and the URL driven; walk each step; carry
machine-recorded timestamps and measured values a hand would not invent; and state its own limits.
A transcript saying only "passed" fails that check, and hand-written evidence is a constitution
violation of the first order (`G-28-02`).
