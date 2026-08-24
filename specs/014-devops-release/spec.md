# Epic Specification: DevOps & Release

**Epic**: `EPIC-014` | **Module**: M-11 | **Tasks**: 17 *(+ containerised local deployment, scope added 2026-08-24 by [`D-45`](./decisions/D-45-containerised-local-deployment-lands-in-epic-014.md); task count is restated by `/speckit-tasks`, not here)*

**Parent product spec**: [../_shared/platform-spec.md](../_shared/platform-spec.md)
**Shared design**: [../_shared/](../_shared/) — architecture, schema, contracts, research, RAID

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING** — released 2026-08-20 by **PMI-DOC-004 v1.0** (Business Requirement
> Specification, APPROVED; scope ruling T-106). This Epic implements **BR-0090**. The prior
> hold (decision D-10, PMI-TASK-001 T-101/T-106) is discharged; resumption goes through the
> Definition-of-Ready gate, not by declaration (EPIC-026).

## Purpose

Developer enablement and the mandatory Epic closure gate — including the architecture and security reviews the MPS quality gates require, and the promotion pipeline.

**Two halves, and they do not run at the same time.** Developer enablement — the seed (`T149`), the
README (`T150`) and **containerised local deployment** (below) — depends on nothing and has been
delivering since 2026-08-20. The closure gate (`T151`–`T156`, `F-11.2`) genuinely runs last. See
*Depends on*, and [`D-45`](./decisions/D-45-containerised-local-deployment-lands-in-epic-014.md).

### Containerised local deployment *(added 2026-08-24 — `D-45`)*

**The platform cannot currently be run from this repository as containers.** `docker-compose.yml`
defines only `postgres` and `valkey`; there is no `Dockerfile` anywhere; the API runs from source
through `tsx` on the host; and **nothing serves the built web client at all**.

`EPIC-036` recorded that rather than filling it. [`R-036-3`](../036-application-shell/research.md)
names the consequence and the owner: *"the production case belongs to whoever owns serving the
client — which today is nobody"*, and *"the gap is `EPIC-014`'s."* `EPIC-036`'s closure record
therefore states that the Epic does **not** prove deep links survive a refresh outside the Vite dev
server. `EPIC-029`'s UAT had to serve `dist/` from a scratchpad static server with a hand-rolled
`/v1` proxy for the same reason. This section gives that gap its owner.

**In scope.**

- A **runnable containerised local stack**: the API and the built web client as images, wired to the
  existing `postgres` and `valkey` services, reachable on **one origin** so the `/v1` path the
  client already assumes keeps working without the client changing.
- **Unknown paths serve the application, not a 404.** A client-side router needs the server to
  return the app for `/runs/abc`. The Vite dev server does this and nothing else here does — which
  is the whole of `R-036-3`.
- **The reference local stack keeps working, and stays distinguishable.** `EPIC-036` `T442l` defines
  it and `SC-SHL-006`'s p95 was measured on it. The containerised stack is an **addition**; a
  measurement taken on one is not a measurement of the other, and the documentation must not let
  them be confused.
- **The broken `dev` script.** `pnpm --filter @pmi/backend dev` fails outright — the invocation is
  `tsx --env-file-if-exists=../.env watch src/main.ts`, and `tsx` reads `watch` as a filename
  because the flag precedes it, so it dies with `Cannot find module '…/backend/watch'`. It is in
  scope because an image that shells the same wrong invocation inherits the defect, and because
  developer enablement is this Epic's job. Found during `EPIC-036` UAT on 2026-08-24.

**Out of scope, explicitly.**

- **`dev`, `stage` and `prod`.** This Epic delivers **local**. `BR-0090` owns environment promotion
  and Constitution VII's `local → dev → stage → prod` is untouched. **A container that runs on a
  developer's machine proves nothing about a deployed environment**, and this scope must not be read
  as claiming otherwise.
- **Baking any credential into any image.** `backend/prisma/seed.ts` already refuses
  `NODE_ENV=production` and has **no default password** — an unset one fails loudly rather than
  creating a predictable account. That posture is a requirement of this work, not a detail of it
  (`BR-0173` secret handling, owner `EPIC-028`; `BR-0135` credential isolation).
- **A registry, a CI publish step, or image signing.** Those belong with the promotion pipeline
  (`T156`) and are not needed to run the stack locally.

## SRS Traceability *(Constitution II)*

This epic **inherits** the SRS traceability table in the
[platform product specification](../_shared/platform-spec.md), which cites every source document
behind the requirements below. No requirement in this epic originates outside that table.

Authority is layered per decision **D-12**: the MPS governs product content, PMI-DOC-000 governs
documentation standards, PMI-DOC-003 governs principles.

**Where the containerisation scope traces** (`D-45`). It adds **no numbered requirement** — this
Epic owns none, by design — so Constitution II is satisfied by naming the sources it serves and
consumes rather than by inventing an `FR`:

| Source | Requirement | Relationship |
|---|---|---|
| `SRS/PMI-DOC-004…v2.0` | `BR-0090` — environment promotion | **Served.** The delivery posture above already states this Epic implements it. Containerising **local** builds the first rung; `dev`/`stage`/`prod` remain out of scope and unproven |
| `SRS/PMI-DOC-004…v2.0` | `BR-0173` — secret handling | **Consumed, owned by `EPIC-028`.** No image may carry a credential; this Epic conforms and does not redefine |
| `SRS/PMI-DOC-004…v2.0` | `BR-0135` — credential isolation | **Consumed, owned by `EPIC-028`.** Same posture |
| `specs/036-application-shell/research.md` | `R-036-3` | **The origin.** A recorded gap naming this Epic as its owner — not an SRS requirement, and not treated as one |

**No SRS document requires the platform to be containerised.** That is stated rather than papered
over: the scope is justified by `BR-0090`'s first rung and by a recorded gap (`R-036-3`).

**The back-fill question, and who answers it.** Whether containerisation should become a *business
requirement* in `PMI-DOC-004` is a question about product scope, and this Epic cannot answer it —
amending the BRS is the **project owner's** decision, taken the way `D-44` and `D-45` were taken.
It is **raised at this Epic's convergence gate** (`T214`), where it must be answered one of two
ways and recorded either way:

| Answer | What follows |
|---|---|
| **Back-fill it** | A `BR-####` is added to `PMI-DOC-004`, this Epic's traceability table cites it, and F-11.3 stops being SRS-unsourced |
| **Accept it unsourced** | Recorded as a decision with its reasoning — that `BR-0090`'s promotion pipeline implies a first rung, and a rung nobody can run is not a rung |

**Until then F-11.3 proceeds as SRS-unsourced infrastructure**, which is the same standing `T149`
(the seed) and `T150` (the README) have had since 2026-08-03 and is why *Requirements owned* reads
*None directly*.

> **Corrected 2026-08-24 (analysis `C1`).** This paragraph named the back-fill owner as
> **`unassigned`**, which Constitution II's *"list + back-fill owner"* does not accept and which
> `EPIC-036`'s `handovers.md` discipline exists to prevent — **owner-less debt is this programme's
> recurring failure mode, and an unowned line is how it starts.** The owner is the project owner,
> the venue is `T214`, and the two admissible answers are written down so the question cannot be
> closed by drift.

## Requirements owned

Requirements are defined once in the [parent product spec](../_shared/platform-spec.md); this
epic **owns** the following and is where they are satisfied:

*None directly.* This epic delivers infrastructure or governance rather than a numbered
functional requirement. See Purpose and Exit Criteria.

## User stories owned

*None* — no user-facing behaviour originates here.

## Success criteria owned

*None directly.*

## Depends on

**The dependency is on the release gate, not on the Epic** (`D-45`, 2026-08-24).

- **The release gate (`T151`–`T156`, `F-11.2`) depends on every other epic, including EPIC-015**,
  and runs last. Confirming fifteen `closure.md` records cannot precede the records existing.
  The dependency is one-way: QA validates the product epics, then DevOps closes and promotes.
- **Developer enablement depends on nothing** and runs whenever it is needed — the seed (`T149`),
  the README (`T150`) and containerised local deployment.

> **Corrected 2026-08-24 (`D-45`).** This section read *"**Every other epic** … this is the final
> closure gate and runs last"*, without qualification. **That was already untrue when it was
> written**: `T149`, `T149a`, `T150` and `T452` ran and closed on 2026-08-20, long before the other
> Epics. The sentence described the gate and was read as describing the Epic, which would have made
> a `Dockerfile` wait on fifteen closure records. Splitting the two halves is a correction, and it
> weakens the gate by nothing — every clause governing `T151`–`T156` is unchanged.

## Clarifications

### Session 2026-08-19

- No questions required.

Scanned against the twenty-category ambiguity taxonomy. **13** categories are not answered in this document, of which **10** — *Out of Scope*, *Domain & Data*, *Lifecycle / States*, *Scale assumptions*, *UX Flow*, *Performance*, *Reliability*, *External deps*, *Edge cases*, *Constraints* — are answered up the chain from the [parent](../_shared/platform-spec.md) and inherited here under Constitution II. Asking those again per Epic would require this document to restate what the parent owns, which is the duplication `T686` removed from the task counts.

**3** are answered nowhere in that chain:

- *Error / empty states* — **Outstanding** — a plan-level concern that changes no requirement this Epic owns, recorded rather than asked
- *Accessibility / i18n* — settled in this session as **WCAG 2.2 Level AA** — automated checks in CI plus a manual keyboard and screen-reader pass at Epic exit — recorded against [EPIC-010](../010-specification-interface/spec.md)
- *Terminology* — **Outstanding** — no canonical glossary exists programme-wide; naming has held without one so far

## Principle conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register lives in the [parent product spec](../_shared/platform-spec.md).
This epic records only where it **differs** or is the place a principle is satisfied:

*No deltas.* This epic inherits the platform register unchanged.

## Notes

Closure now includes the **architecture review (T152a)** and **security review (T152b)** required by MPS Volume 6 §8, discharging PMI-TASK-001 T-306. Promotion follows `local → dev → stage → prod` with no environment skipped (Constitution VII).

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI)*

- [ ] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [ ] **The containerised local stack starts from a clean checkout**, serves the client on one
      origin, answers `/v1` from the API, and returns the application — not a 404 — for an address
      the client routes itself (`R-036-3`). Verified by **running it**, not by inspecting the files
- [ ] **No image contains a credential.** Asserted by an executable conformance check, not by
      review — Constitution V requires a non-code output to carry one, and a `Dockerfile` is exactly
      that kind of output. The seed's refusal of `NODE_ENV=production` and its absent default
      password both survive containerisation
- [ ] **The reference local stack (`EPIC-036` `T442l`) still runs**, and the documentation states
      which stack any published measurement was taken on
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `specs/014-devops-release/defects/` contains no open defect records
- [ ] Principle deltas above still hold; any deferral retains a valid owner
- [ ] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**
- [ ] **This epic owns the platform release gate** (F-11.2): all 15 `closure.md` records confirmed, then promotion `local → dev → stage → prod` with no skipped environment
