# PMI Studio — UAT checklist

**Scope**: the whole product, against the local Docker stack.
**Written**: 2026-08-23, after the first rebuild in which the application could actually be started.
**Companion**: [`EPIC-029-ui-uat-checklist.md`](./EPIC-029-ui-uat-checklist.md) covers the design
system's UI in depth. This one covers **capability** — can a user do the thing at all — and does not
repeat it.

---

## 0. Read this before reporting anything

### What this stack is, said plainly

**The application is not containerised.** The repository has no Dockerfiles;
`docker-compose.yml` defines `postgres` and `valkey` and nothing else. "Local Docker" here means the
app running on the host **against Docker infrastructure**, which is how this stack has always run.
No Epic in the corpus owns building a deployable artifact, and `EPIC-014` `T156`
(`local → dev → stage → prod`) currently presupposes one that does not exist. Do not report the
absence of containers as a defect — report it as the planning gap it is.

### What is already known to be red

Do not raise these. They are recorded, reasoned and outstanding:

| Known | Where |
|---|---|
| `T884` accessibility record | Waits on `T885`, a **human** keyboard and screen-reader pass. An agent cannot hear a screen reader |
| `scale.spec.ts` p95 | Load-sensitive, passes alone (`DEF-030-002`, deferred to `EPIC-015`) |
| Requirement Room `decide` and baseline approval refuse | `EPIC-031` and `EPIC-032` are unbuilt, so the policy and evidence seams are unbound. **Refusing is the designed behaviour**, not a fault |
| Requirement Room analysis says `aiAvailable: false` | `EPIC-028`'s gateway is unbound. It **degrades** by design and says so in the payload |

### What only this checklist can find

The automated estate is large and green, and it is blind in one specific way: every suite imports
modules directly. `AppModule` in a reachability test, `App` in a jsdom render. **A whole test estate
can pass while the application cannot be started by a person** — which is exactly what
`DEF-014-002` was. Your job is the part no import can reach: start it, sign in, and try to do the
work.

---

## 1. Prerequisites

- Node.js 22 LTS, `pnpm@9.15.9`, Docker running.
- A clean checkout of `main`. Record the commit you tested.

---

## 2. Cold start — `DEF-014-001`, `DEF-014-002`

The first two steps are where two defects were found on 2026-08-23. Run them **verbatim from
`README.md`**; do not improvise round a failure, record it.

| # | Step | Expected |
|---|---|---|
| 2.1 | `pnpm install` | Completes |
| 2.2 | `docker compose up -d postgres valkey` | Both containers healthy. **`redis` is not a service** — `ADR-0003` chose Valkey |
| 2.3 | `pnpm --filter backend prisma migrate dev` | All migrations apply to a fresh database |
| 2.4 | `SEED_USER_EMAIL=… SEED_USER_PASSWORD=… pnpm --filter backend seed` | Prints the workspace and user. **Run it twice** — the second run must leave exactly one workspace and one user |
| 2.5 | `pnpm --filter backend dev` | API listens on :3000 and maps `/v1/*` routes |
| 2.6 | `pnpm --filter frontend dev` | Web on :5173 |

> **2.4 is the step that makes the product usable.** A migrated database holds no workspace and no
> user, so sign-in is impossible until the seed runs. If it is skipped, everything below fails for a
> reason that has nothing to do with the feature under test.

**If a migration fails**, check `_prisma_migrations` for a row with a null `finished_at`. A
half-applied migration blocks every later one, and the local database sat in that state from
2026-08-21 until this rebuild. Record it rather than dropping the database silently.

---

## 3. Sign in and scope — `EPIC-005`, `EPIC-004`

| # | Check | Expected |
|---|---|---|
| 3.1 | Sign in with the seeded credentials | Lands on Projects |
| 3.2 | Sign in with a wrong password | Refused, and the message does not say whether the **email** exists |
| 3.3 | Reload the page while signed in | Session survives; you are not returned to sign-in |
| 3.4 | Sign out, then use the back button | You cannot see workspace data |

---

## 4. Every delivered page is reachable — `DEF-010-001`

**This is the check the product most recently failed.** Five page components existed and nothing
imported them; five capabilities could not be used at all. They were routed on 2026-08-23.

Open a project, then confirm each control exists **and** that its page renders:

| # | Control on the project view | Page | Expected |
|---|---|---|---|
| 4.1 | Traceability | Traceability | Coverage renders |
| 4.2 | Specifications | Specification list | Lists, or says "No specifications yet" |
| 4.3 | Runs | Run list | Lists, or says "No runs yet" |
| 4.4 | Storage connections | External storage | Connection form renders |
| 4.5 | From a specification → Tasks | Tasks | **Needs a specification to exist** |
| 4.6 | From a run → the run | Review session | **Needs a run to exist** |
| 4.7 | Every one of the above | — | A "Back to project" control returns you |

> **4.5 and 4.6 could not be walked on an empty project during the 2026-08-23 rebuild.** They are
> covered by `shell-page-routes.spec.tsx` with stubbed data. Walking them for real needs a
> specification and a run, so do §5 and §6 first and come back.
>
> **An empty page is not a pass.** "No runs yet", "still loading" and "the request failed" must look
> different from each other. If a page is blank, say which of the three it was.

---

## 5. The core loop — requirements to specification

| # | Check | Expected |
|---|---|---|
| 5.1 | Create a project | Appears in the list |
| 5.2 | Add a requirement | Appears; the filter above it works |
| 5.3 | Filter to a type or priority that matches nothing | Says so; does not render an empty list with no explanation |
| 5.4 | Generate a specification | Runs, and reports failure in words if it fails |
| 5.5 | Open the specification | Sections render |
| 5.6 | Open its tasks | §4.5's route, now with data |
| 5.7 | Edit a requirement the specification derived from | The specification is flagged out of date |

---

## 6. Runs and review — `EPIC-023`

| # | Check | Expected |
|---|---|---|
| 6.1 | Start a run | Accepted as long work (`202`), not a synchronous result |
| 6.2 | The run appears in the run list | With its state readable without opening it |
| 6.3 | Open the run's review session | §4.6's route, now with data |
| 6.4 | Answer a question and submit | Accepted |
| 6.5 | Submit with a question unanswered | **Refused, naming the unanswered questions** |

---

## 7. The Requirement Room — `EPIC-033`

Reachable over the API; the Room's own page is `EPIC-033` Phase 8 and is **not built yet**, so
these are API checks.

| # | Check | Expected |
|---|---|---|
| 7.1 | `POST /v1/rooms/requirement/intake` with a document | One candidate per blank-line segment, each labelled `fact`, each `promotedTo: null` |
| 7.2 | The same with an empty body | `400`, **naming every missing field**, not just the first |
| 7.3 | `POST /v1/rooms/requirement/gap-intake` | Candidate with `sourceRef: "defect-room:<id>"` — the Defect Room origin is visible |
| 7.4 | `GET /v1/rooms/requirement/<id>/readiness?workspaceId=…` | Blockers derived, each naming its subject |
| 7.5 | Readiness with nothing else outstanding | Still blocked on `pending-decision` and `unmet-evidence` — see §0, this is correct |

---

## 8. Refusals are readable — the whole platform

The product's stated posture is that a refusal names what to do next. Sample four:

| # | Refusal | Expected |
|---|---|---|
| 8.1 | Edit a requirement frozen into an approved baseline | `409`, carrying the Change Request affordance |
| 8.2 | A validation failure on any form | Names the field, not "something went wrong" |
| 8.3 | A mistyped URL | **Known defect `DEF-001-006`**: every unmatched route answers `500`, never `404`. Confirm it still does; do not raise it as new |
| 8.4 | A project-scoped list for a project that does not exist | **Known defect `DEF-007-001`**: returns a convincing empty list |

---

## 9. Recording the result

Write the run to `docs/uat/PMI-Studio-uat-run-<date>.md` with:

- the **commit** tested, and the fact that the stack was host-run against Docker infrastructure;
- one row per check: pass, fail, or **could not verify** — and *"could not verify"* is a first-class
  outcome, not a failure to try. Say what blocked it;
- for every failure, what you saw beside what you expected. A defect record without the observation
  is a claim;
- **nothing reported as passing that was not exercised.** The 2026-08-21 EPIC-029 run set this
  standard and it holds here: 11 passed, 8 could not be verified by automation, and it said so.

Raise defects under the owning Epic's `specs/<epic>/defects/`, and check §0 before raising anything.
