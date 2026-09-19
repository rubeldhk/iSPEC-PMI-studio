# PMI Studio — Programme Status Report

**Date**: 2026-08-17 · **Produced by**: `/speckit-plan` (programme-level review)
**Working branch**: `epic/003-specification-engine` · **Constitution**: v1.2.0

**Scope of this review**: the whole repository — infrastructure, system design, solution plan,
technology plan — assessed against the requirement corpus, plus the state of the five amendment
documents that arrived on 2026-08-11/12/13/14.

**Method**: every number below is **measured** from the repository on 2026-08-17 — task checkboxes
counted by enumeration, tests actually executed, git state actually queried. Nothing is estimated.
Where something could not be verified on this machine, it says so.

---

## 1. Executive summary

| Dimension | Verdict | One-line reason |
|---|---|---|
| **Infrastructure** | 🟡 **Complete for local; absent for delivery** | Postgres 16 + Valkey + CI + Prisma migration all real and green. No `dev`/`stage`/`prod` exists, and the SaaS decision (`D-31`) created an infrastructure surface no epic owns |
| **System design** | 🟢 **Complete and current** | `_shared/system-design.md` + `ai-native-architecture.md` cover Phase 1 *and* the amendment's target seams. 8 new conflicts raised, 8 resolved |
| **Solution plan** | 🟡 **Planned in full; 23% executed** | All 28 epics carry `spec.md` + `plan.md`; 26 carry `tasks.md`. **163 of 722 tasks done.** The amendment's own mandated deliverable — the §18 impact report — is **not produced** |
| **Technology plan** | 🟡 **Phase 1 settled; AI-native additions undecided** | Stack is chosen, justified and in use. But **12 of 17 required ADRs do not exist**, and four amendment-forced technology questions are still open |
| **New requirements / amendments** | 🟢 **Incorporated into the register; ⚠️ not yet reconciled** | All five documents are analysed, 22 conflicts and 22 decisions recorded, EPIC-027 specified/planned/tasked — but **0 of 51 tasks executed**, so the formal reconciliation report does not yet exist |

**The honest headline**: the *thinking* is in excellent shape and is fully current with the
amendments. The *building* is 23% done and concentrated entirely in the engine/seam layer. Three
things — not engineering effort — are what actually gate the programme:

1. **`PMI-DOC-004` (Business Requirement Specification) + approved business scope.** 393 tasks
   across 19 epics wait on this. No engineering sequence changes that number.
2. **A machine with a container runtime.** Two epics (004, 028) cannot close without it.
3. **A `git commit`.** 25 files of finished work — including four of the five amendment source
   documents — exist only in this working copy. See Finding F1/F2.

---

## 2. Measured programme state

### 2.1 Task ledger — all 28 epics

| | Count | Share |
|---|---|---|
| Epics | **28** (26 with tasks; `002` and `017` are parent designs) | |
| Total tasks | **722** | 100% |
| ✅ Complete | **163** | 23% |
| ⏸ Held on `PMI-DOC-004` | **393** across 19 epics | 54% |
| ▶ Proceeding and open | **166** across 7 epics | 23% |

*Movement since the 2026-08-14 corpus review: 714 → 722 tasks, 114 → 163 complete (+49, all in
EPIC-028 and EPIC-004). The held figure is unchanged at 393 — as expected, since nothing that
happened since could release it.*

### 2.2 Per-epic detail

**▶ Proceeding**

| Epic | Title | Done | Open | State |
|---|---|---|---|---|
| 001 | Platform Foundation | 39 | 4 | 91% — only `Phase Z` closure (T165–T168) remains |
| 003 | Specification Engine & Sandbox | 39 | 1 | 98% — only `T138`, blocked by held product surface |
| 004 | Workspace Tenancy & Audit | 16 | 8 | 67% — **Prisma + first migration landed**; `T649` needs Docker |
| 018 | Repository Governance | 32 | 2 | 94% — `T445` human walkthrough, `T446` ownership call |
| 026 | Epic Stage Register & DoR | 0 | 71 | Specified, planned, tasked — **not started, and untracked in git** |
| 027 | AI-Native Amendment Reconciliation | 0 | 51 | Specified, clarified, planned, tasked — **not started** |
| 028 | Agent & Execution Seam | 37 | 29 | 56% — contracts + seam landed; Docker provider and closure remain |

**⏸ Held on `PMI-DOC-004`** — 19 epics, 393 tasks, 0 complete

`005` Identity (15) · `006` Projects (13) · `007` Requirements (24) · `008` Authoring (23) ·
`009` Lifecycle (28) · `010` Interface (19) · `011` Traceability (19) · `012` Workflow (16) ·
`013` Engine API (8) · `014` DevOps (18) · `015` QA (9) · `016` ADRs (12) · `019` Steering (27) ·
`020` Living Specs (22) · `021` Review Gates (23) · `022` Product Traceability (16) ·
`023` Unattended Runs (43) · `024` Artifact Access (21) · `025` External Storage (37)

Held is **not** cancelled. Every one of these epics is specified, planned, tasked and Constitution V
compliant. They are complete work waiting on a business input.

### 2.3 Code actually built

| Area | Files | Lines | Assessment |
|---|---|---|---|
| `backend/` | 59 | 5,103 | Core, observability, audit, engines, jobs modules. **No product-surface modules** — projects, requirements, specifications, traceability are all held |
| `engine-adapters/` | 24 | 2,908 | Spec Kit adapter + fixture adapter. The programme's most complete layer |
| `packages/` | 16 | 1,668 | `engine-contract`, `agent-contract`, `execution-contract` — all three seams exist |
| `governance/` | 19 | 1,492 | Steering files + conformance-checked process docs |
| `tests/` (governance) | 14 | 1,115 | 12 executable governance checks |
| `worker/` | 10 | 863 | Composition roots, queue processing |
| `agent-adapters/` | 7 | 443 | Fixture agent only — `ClaudeAgent` is `T564`, not yet written |
| `adr/` | 6 | 353 | ADR-0001 … ADR-0005 |
| `execution-providers/` | 3 | 71 | Scaffold — the Docker provider (`T646a`) is not yet written |
| `frontend/` | 5 | **64** | **Scaffold only.** No UI exists; every UI task lives in a held epic |

### 2.4 Test suite — executed 2026-08-17

```
Test Files  1 failed | 59 passed (60)
     Tests  706 passed | 6 skipped (712)
  Duration  30.25s
```

- ✅ **706 tests pass.** Unit, architecture, contract, engine-conformance, agent-conformance and
  governance suites are all green.
- ❌ **`pnpm test` exits 1 on this machine.** `backend/tests/integration/audit-immutability.spec.ts`
  (T453) cannot start: *"Could not find a working container runtime strategy."* Testcontainers has
  no Docker daemon to talk to.
- **This is an environment gap, not a code defect** — but it must not be reported as passing. The
  six append-only-audit assertions are **unverified**, and `T649` exists precisely to run them on a
  machine that has a container runtime.
- CI (`.github/workflows/ci.yml`) runs typecheck → lint → `test:unit` → `test:arch` →
  `test:contract` → governance checks. It does **not** run `test:integration`, so CI is green while
  this gap is open — by design, and worth knowing.

---

## 3. Dimension 1 — Infrastructure

### ✅ What is complete and verified

| Component | Evidence |
|---|---|
| Local service topology | `docker-compose.yml` — Postgres 16-alpine + Valkey 7-alpine, both with healthchecks, configurable host ports |
| Valkey over Redis | Deliberate: Redis relicensed away from BSD in 2024. Recorded in `ADR-0003` and RAID `R-03` |
| Database schema + migration | `backend/prisma/schema.prisma` + `migrations/20260814000000_init/` — **`T012a`/`T013` landed**, closing the corpus-wide blocker `C-28` |
| Tenancy from the first migration | Every tenant-scoped model carries `workspaceId` from migration one, so Phase 3 RLS is a switch, not a data migration (`FR-002`) |
| CI pipeline | 6 gates, architecture tests and governance checks are **build-failing**, not advisory |
| Workspace/monorepo | pnpm 9.15.9, Node ≥22, 7 workspace globs, 13 Vitest projects |
| Environment contract | `.env.example` — and `AI_PROVIDER_TOKEN` is documented as the *only* credential entering a sandbox (`ADR-0002`) |

### ⚠️ What is not complete

| Gap | Impact | Owner today |
|---|---|---|
| **No container runtime on the working machine** | `test:integration` cannot run; `T649` (EPIC-004) and `T646b` (EPIC-028) are both blocked `MANUAL` tasks. Neither epic can close | Operator |
| **`dev` / `stage` / `prod` do not exist** | Constitution VII mandates `local → dev → stage → prod`. Only `local` has ever existed. No promotion has been possible, so the gate has never been exercised | EPIC-014 (held) |
| **No SaaS/production infrastructure** | `D-31` decided **multi-tenant SaaS first** on 2026-08-13. That implies a hosting substrate, tenant isolation, and an operations posture. `_shared/plan.md` still records *"Hosting substrate deliberately not chosen"* — **this is now stale against `D-31`** | **Unowned** |
| **Egress proxy not built** | `D-28` decided named, proxy-enforced egress profiles. The proxy is a new operational component. Not specified into any epic | **Unowned** |
| **Credential broker not built** | `D-27` (per-run minted tokens) + `D-41` (BYOK) both decided. Neither has an owning epic; `R-AI-011` (git credential delegation) is uninvestigated | **Unowned** |

> **Verdict: 🟡 PARTIAL.** Everything Phase 1 requires of infrastructure exists and works. Everything
> the *August amendments* require of infrastructure — SaaS hosting, egress proxy, credential broker —
> is decided but unbuilt and, more importantly, **unassigned to any epic**. That assignment is
> exactly what EPIC-027 exists to produce.

---

## 4. Dimension 2 — System design

### ✅ What is complete

| Artifact | Content |
|---|---|
| `_shared/system-design.md` (309 lines) | Component architecture, SRS layer mapping, runtime topology, generation sequence flow, failure handling, sandbox security, data-design principles, extension seams — and a *"decisions deliberately NOT made"* section |
| Principle-derived constraints | **PC-1** services callable without REST (enforced by architecture test) · **PC-2** cost containment in scope, optimisation deferred · **PC-3** observability first-class |
| `_shared/ai-native-architecture.md` (363 lines) | Part A architecture reassessment · Part B technology reassessment · Part C the target seams with today's boundaries marked, and the four dependency rules extended |
| `_shared/data-model.md` + `schema.sql` | 15 entities, 16 tables, 15 enums, append-only triggers |
| Contracts | `specification-engine.md`, `platform-api.md`, plus `agent-contract.md` / `execution-contract.md` (EPIC-028) and `agent-gateway.md` / `project-execution-environment.md` (EPIC-027) |
| Dependency rule enforcement | Engine independence and service/transport separation are **build-failing architecture tests**, not review conventions |

### The amendment's design impact — all eight conflicts resolved

| # | Conflict | Resolution |
|---|---|---|
| C-19 🔴 | Engine independence enforced; **agent** independence was not | `D-20` — `packages/agent-contract` + architecture test. **Built** |
| C-20 🔴 | `T646` about to hard-code Docker as the substrate | `D-21` — `ProjectExecutionEnvironment` port with a Docker provider |
| C-21 🟠 | Persistent project state had no home | `D-22` — the git remote is the durable substrate; volumes are cache |
| C-22 🟠 | Egress allow-list made implementation agents impossible | `D-28` — named profiles, proxy-enforced. `ADR-0002` **extended**, not superseded |
| C-23 🔴 | Two sources of truth: Postgres row vs tracked markdown | `D-29` — **Postgres authoritative; markdown is a one-way projection** |
| C-24 🟠 | `waiting_for_approval` cannot live in a BullMQ job | `D-25` — database state machine; the queue serves compute segments |
| C-25 🟠 | MCP deferred to a marketplace, but needed as the agent's access path | `D-26` — split: agent-facing core now, marketplace stays M-09 Phase 3 |
| C-26 🟠 | Target market implied a hosting decision the corpus refused to make | `D-31` — **multi-tenant SaaS first** (widest blast radius of the session) |

### ⚠️ What is not complete

- **3 of 20 capability areas have no owning epic** — Governed Engineering Loops, Governed Learning,
  Specification Compliance Agent (all introduced by the 2026-08-14 Cosmos amendment). All three are
  product surface and therefore held, so nothing is *blocked* — but nothing owns them either.
- **7 decisions remain open**: `D-23` (18-module re-cut), `D-24` (pgvector), `D-30` (AI Gateway
  native vs integrated), `D-34` (the `PMI-DOC-004` hold), `D-36` (`ADR-0002` extended vs superseded —
  effectively settled by `D-28`, needs only recording), `D-37` (Human/AI register in `_shared/`),
  `D-39` (branch-vs-epic conformance check).
- **`_shared/plan.md` Technical Context is stale** in one respect: it still says *"Hosting substrate
  deliberately not chosen — no Phase 1 requirement depends on it."* `D-31` chose it.

> **Verdict: 🟢 COMPLETE and current.** The design absorbed a five-document amendment without a
> reset, resolved every conflict it raised, and recorded its own accepted costs. The open items are
> genuinely open questions, not gaps in the work.

---

## 5. Dimension 3 — Solution plan

### ✅ What is complete

- **28 epics**, each with `spec.md` and `plan.md`. 26 carry `tasks.md` (`002` and `017` are
  deliberate parent designs holding shared requirements and carrying no tasks).
- **722 tasks**, every one Constitution V compliant — every implementation task carries a paired
  unit test, and every documentation task carries an **executable conformance check**.
- **Zero duplicate task identifiers corpus-wide**, verified by enumeration after `C-27` was
  resolved on 2026-08-14 (`T447`/`T448`/`T449` had meant two different things in three epics).
- **Build order and dependency graph** recorded in `specs/README.md`.
- **Delivery sequence** — Tiers 0–6, in `srs-alignment.md` Part 9, superseding the per-epic
  "recommended next task" lines which optimised locally.
- **Decision register** — 28 conflicts (`C-01`…`C-28`) and 42 decisions (`D-1`…`D-42`), each with
  consequences recorded, not just outcomes.

### Sequence status against the 2026-08-14 plan

| Tier | Work | Status today |
|---|---|---|
| 0 | Fix the `T447`/`T448`/`T449` collision | ✅ **Done** 2026-08-14 |
| 1 | EPIC-004 `T012a`, `T013` → `T453`, `T454` | ✅ **Done** — Prisma + first migration landed; `T453` written but **unverified** (no container runtime) |
| 2 | EPIC-001 `T165`–`T168`; EPIC-018 `T445`, `T446` | ⬜ **Not started** — 6 tasks close two epics sitting at 91% and 94% |
| 3 | EPIC-028 (66 tasks) | 🔄 **56% done** — 37/66. Remaining work needs a Docker daemon for `T646b` |
| 4 | EPIC-003 closure | ⬜ Blocked behind Tier 3 |
| 5 | EPIC-027 (51 tasks) | ⬜ **Not started** |
| 6 | EPIC-026 (71 tasks) | ⬜ Not started; **and untracked in git** |
| — | `PMI-DOC-004` + business scope approval | ⬜ **Worth more than all six tiers** — releases 393 tasks |

### ⚠️ What is not complete

- **The amendment's own mandated deliverable does not exist.** Plan Amendment §18 requires a
  25-part impact report; Cosmos §10 requires a 17-part one. EPIC-027 is specified, clarified,
  planned and tasked to produce exactly that — and stands at **0/51**. Until it runs, the
  reconciliation exists as decisions in `srs-alignment.md` but not as the report the SRS asked for.
- **No epic has ever closed.** Constitution IV requires `/speckit-converge` before an epic is
  complete. Four epics sit at 91–98% with only `Phase Z` closure remaining. **Constitution IV counts
  nothing until convergence runs**, so the programme's formal completion count is currently **zero
  epics**.
- **`specs/random-requirements.txt` is empty** (0 bytes) and untracked. If it was meant to carry
  requirements, they are not there.

> **Verdict: 🟡 PLANNED IN FULL, 23% EXECUTED.** The plan itself is arguably over-complete relative
> to the build. Nothing is missing from the planning chain; the gap is entirely execution, and 54%
> of that execution is legitimately held on a business input.

---

## 6. Dimension 4 — Technology plan

### ✅ What is complete

| Choice | Status | Recorded in |
|---|---|---|
| TypeScript 5.x / Node 22 LTS | ⚠ Highest-impact, decided | `tech-stack.md`, `ADR-0003` |
| NestJS (API, DI adapter registration) | Decided, in use | `ADR-0003` |
| PostgreSQL 16 + Prisma | Decided, **now in use** — schema + migration landed | `ADR-0003` |
| BullMQ on Valkey | Decided, in use; preserved by `D-25` | `ADR-0003`, `docker-compose.yml` |
| React + Vite | Decided; **not yet exercised** — frontend is 64 lines | `tech-stack.md` |
| Docker engine sandbox | ⚠ Non-negotiable in this design | `ADR-0002`, widened by `D-21` |
| Vitest / Supertest / Testcontainers / Playwright | Decided; first three in use | `tech-stack.md` |
| OpenTelemetry + pino | Decided (`D-7`), built as F-00.5 | `system-design.md` PC-3 |
| Third-party register | 32 components with purpose, licence and risk | `dependencies.md` |

### ⚠️ What is not complete

| Gap | Detail |
|---|---|
| **ADR debt: 12 of 17 missing** | `adr/` holds ADR-0001…ADR-0005. Native §27 names **twelve** required subjects and Cosmos §9 adds **five** more (ADR-0018…ADR-0022). `D-35` decided on 2026-08-14 that **all seventeen are created now** — each decided, or explicitly `open` naming what it awaits. That is EPIC-027 `T659`, unstarted. Seven are decidable immediately from the 2026-08-13 session |
| **`pgvector` undecided** (`D-24`) | Recommendation on file: adopt when the first similarity requirement is planned, not before |
| **AI Gateway build-vs-integrate undecided** (`D-30`) | Recommendation on file: split — agent layer native, model routing integrable |
| **Egress proxy — no incumbent chosen** | `D-28` decided the *shape*; `R-AI-009` (concrete destination list) deliberately left open, because guessing registry hostnames produces an allow-list that fails in production |
| **Secrets/credential store — no incumbent chosen** | `ADR-0002` §B.2.3 records this as a gap with no incumbent. `D-27` names the model; the mechanism is unverified |
| **14 `R-AI-` research items** | Registered as required by Native §26; `R-AI-001/002/005` gate the real Claude and Cursor adapters, `R-AI-011` gates credential delegation, `R-AI-014` gates MCP least-privilege authorization. Registration is EPIC-027 work, unstarted |

> **Verdict: 🟡 PHASE 1 SETTLED, AI-NATIVE ADDITIONS OPEN.** Every technology the current code
> depends on is chosen, justified, and carries a recorded change cost. Every technology the
> amendment *adds* is either an open decision with a recommendation, or an unwritten ADR. The ADR
> debt is the most concrete and most fixable item on this page.

---

## 7. New requirements and amendments — incorporation status

### The five documents

| # | Document | Arrived | Tracked in git? | Reconciliation status |
|---|---|---|---|---|
| 1 | `PMI Studio Plan Amendment.docx` (+ identical `.md`) | 2026-08-11 | ❌ **No** | Analysed → `srs-alignment.md` Part 8 |
| 2 | `Native Spec-Kit Execution Environment & AI Agent Integration Architecture.docx` | 2026-08-12 | ❌ **No** | Analysed → Part 8; drove `D-20`, `D-21`, `D-27`, `D-28` |
| 3 | `Recommended PMI Studio lifecycle.docx` | 2026-08-13 | ❌ **No** | Analysed → Part 8; drove `D-32`, `D-33` |
| 4 | `Defect Management governed intelligence workflow.docx` | 2026-08-13 | ❌ **No** | Analysed → Part 8 |
| 5 | `PMI_Studio_Augment_Cosmos_Learnings_Amendment.docx` | 2026-08-14 | ✅ Yes | Analysed → Part 10; folded into EPIC-027 by `D-42` |

### What has been done with them

✅ **The "start over?" question is answered — by the source, not by preference.** Three passages
(Plan Amendment §Purpose and §19; Native §28) forbid a reset, and Constitution II makes the SRS
binding. Starting over would discard 722 tracked tasks, five ADRs, a working engine contract with
two adapters, and the entire `_shared/` design — to rebuild toward an architecture the amendment
describes as an *extension* of that same design. **Decision: do not start over. Apply incrementally.**

✅ **Two false premises caught rather than inherited.**

- **Finding A** — the amendment says *"maintain and enhance the existing Change Room"* and
  *"the existing Defect Room"*. A search of all 26 other epic specs returns **zero** occurrences of
  Change Room, Defect Room, Requirement Room, Decision Room, Agent Gateway, Integration Hub, Context
  Engine, Evidence Package, or "change request". **These are builds, not enhancements** — a
  programme-sized estimate difference. Settled by `D-32`.
- **Finding B** — EPIC-007 "Requirement Intelligence" is a *name collision*, not the amendment's
  Requirement Intelligence Engine. EPIC-007 owns six CRUD requirements and states *"AI-assisted
  analysis is Phase 2 and out of scope."* Settled by `D-33`: EPIC-007 keeps its identifier and
  scope; the Engine becomes a new, held epic.

✅ **22 conflicts and 22 decisions recorded** (`C-19`…`C-28`, `D-20`…`D-42`) — 15 decided, 7 open,
1 subsumed. Every decided row carries its *consequences*, including the ones that made other
decisions harder.

✅ **Two amendment-driven epics created and specified.**

- **EPIC-027** AI-Native Amendment Reconciliation — analysis-only by construction (`FR-AMD-016`),
  which is the direct answer to the scope-creep concern. 18 requirements, 12 success criteria,
  51 tasks, 14 conformance checks (2 blocking CI, 12 reporting).
- **EPIC-028** Agent & Execution Seam — the one part of the amendment that could not wait, because
  `C-19` and `C-20` were about to be baked into the next task. **56% built.**

✅ **`C-19` closed in code.** `packages/agent-contract` exists, `agent-adapters/fixture` exists, and
`backend/tests/architecture/agent-independence.spec.ts` makes a hardcoded AI provider a **build
failure**. The commit history records it plainly: *"remove the hardcoded AI provider and defend the
seam with a build failure."*

### ⚠️ What remains

| Item | Status |
|---|---|
| The §18 twenty-five-part impact report | ❌ Not produced (EPIC-027, 0/51) |
| The Cosmos §10 seventeen-part report | ❌ Not produced (same epic) |
| ~470 clause-level verdicts | ❌ Not produced |
| 17 ADR records (`D-35`) | ❌ 5 of 17 exist |
| 14 `R-AI-` research registrations | ❌ Not produced |
| 3 unowned capability areas | ❌ Governed Engineering Loops · Governed Learning · Specification Compliance Agent |
| `D-34` — does the amendment release the `PMI-DOC-004` hold? | 🟠 Open. **Recommendation: no** — the amendment is architecture and positioning, not a BRS |

> **Verdict: 🟢 INCORPORATED into the decision register · ⚠️ NOT YET RECONCILED into the formal
> report.** Every amendment document has been read, its premises verified rather than accepted, and
> its architectural consequences decided and partly built. What does not yet exist is the
> clause-by-clause register and the impact report the amendment itself demands — which is EPIC-027,
> deliberately sequenced late at Tier 5 because the capability areas it would unblock are held
> behind `PMI-DOC-004` regardless.

---

## 8. Findings requiring action

| # | Finding | Severity | Why it matters |
|---|---|---|---|
| **F1** | **Four of the five amendment source documents are untracked in git** — the entire `SRS/August112026/` folder | 🔴 **HIGH** | Constitution II makes `SRS/` the source of truth. EPIC-027's SRS traceability table cites five documents; four of them are not in history. A fresh clone cannot reproduce the reconciliation, and the audit trail points at files that do not exist upstream |
| **F2** | **EPIC-026's entire artifact set is untracked** — `spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`, `quickstart.md`, 2 contracts, checklist — plus 8 checklists across epics 019–025 | 🔴 **HIGH** | 71 tasks of finished planning exist only on this disk. One `git clean` loses it |
| **F3** | **`pnpm test` fails on this machine** — no container runtime | 🟠 MEDIUM | 6 append-only-audit assertions (`T453`, `FR-033`) are unverified. `T649` and `T646b` are both blocked `MANUAL` tasks. EPIC-004 and EPIC-028 cannot close |
| **F4** | **12 of 17 required ADRs do not exist** | 🟠 MEDIUM | `D-35` decided all 17 are created now. Seven are decidable immediately from decisions already taken. An unwritten ADR is how a decided question gets re-answered by assumption |
| **F5** | **Zero epics have formally closed** | 🟠 MEDIUM | Four sit at 91–98%. Constitution IV counts nothing until `/speckit-converge` runs. Six tasks would close two of them |
| **F6** | **`_shared/plan.md` Technical Context is stale on hosting** | 🟡 LOW | Still says the hosting substrate is *"deliberately not chosen"*. `D-31` chose it — multi-tenant SaaS |
| **F7** | **13 modified spec files uncommitted** | 🟡 LOW | Epics 002, 017, 019, 023, 024, 025 — 74 insertions, 41 deletions, unreviewed |
| **F8** | **`~$` Office lock files in `SRS/`** and `specs/random-requirements.txt` is 0 bytes | 🟡 LOW | Lock files should be gitignored; the empty requirements file either needs content or removal |
| **F9** | **SaaS infrastructure, egress proxy and credential broker have no owning epic** | 🟠 MEDIUM | Three decided architectural components (`D-31`, `D-28`, `D-27`/`D-41`) with nowhere to be built. Assignment is EPIC-027's job |

---

## 9. Recommended sequence

Ordered by **value released per unit of effort**, not by epic number.

| Priority | Action | Effort | Releases |
|---|---|---|---|
| **0** | **`git add` + commit the untracked SRS documents, EPIC-026, and the 8 checklists** | Minutes | Closes F1 and F2. Restores Constitution II traceability |
| **1** | **Obtain a machine with a container runtime**, then run `T649` and `T646b` | Environment | Unblocks EPIC-004 and EPIC-028 closure; verifies `FR-033` |
| **2** | **EPIC-001 `T165`–`T168`; EPIC-018 `T445`–`T446`** | 6 tasks | **Two epics close.** First formal convergence in programme history |
| **3** | **EPIC-028 remaining 29 tasks** — Docker provider, `ClaudeAgent`, closure | 29 tasks | The execution seam; the first real container in the programme |
| **4** | **EPIC-003 closure** — only `T138` remains, deferred to EPIC-006 | 1 + closure | Third epic closes |
| **5** | **EPIC-027 (51 tasks)** — the reconciliation, the §18 report, the 17 ADRs | 51 tasks | Closes F4 and F9. Assigns the 3 unowned capability areas |
| **6** | **EPIC-026 (71 tasks)** — clarify or **park explicitly** | 71 tasks | Process tooling. Competes with the 393 a BRS would release |
| **★** | **`PMI-DOC-004` + approved business scope** | **Owner deliverable** | **393 tasks across 19 epics.** Worth more than all six tiers combined |

**The single most valuable thing that can happen to this programme is not an engineering task.**
Nineteen epics — identity, projects, requirements, specification authoring, lifecycle, traceability,
workflow, QA, DevOps, steering, review gates, unattended runs, access control, external storage —
are fully specified, planned and tasked, and are waiting on one business document.

---

## 10. Conformance to the Constitution

| Principle | Status |
|---|---|
| I — Spec Kit Command Gate | ✅ Honoured. This report is `/speckit-plan` output; it changes no product code |
| II — SRS as source of truth | ⚠️ **At risk (F1)** — four cited SRS documents are untracked |
| III — Epic-driven delivery | ✅ 28 epics, all with stable `EPIC-###` identifiers and their own directories |
| IV — Convergence gate per epic | ⚠️ Not yet exercised — **zero epics have converged** (F5) |
| V — Mandatory task-level unit tests | ✅ 722/722 tasks compliant; documentation tasks carry executable conformance checks |
| VI — Defect traceability | ✅ `defects/` folders exist; no open records found |
| VII — Promotion pipeline | ⚠️ Never exercised — only `local` exists |
| VIII — Session labelling | ⚠️ Branch is `epic/003-specification-engine` while recent work was EPIC-027/028. `D-39` proposes the check that would catch this |
| IX — Mandatory closing report | ✅ Below |

---

*Sources: measured repository state 2026-08-17 · `specs/srs-alignment.md` Parts 8–10 ·
`specs/README.md` · `specs/_shared/plan.md`, `system-design.md`, `tech-stack.md`,
`ai-native-architecture.md` · `specs/027-ai-native-amendment/spec.md` ·
`.specify/memory/constitution.md` v1.2.0 · `pnpm test` executed 2026-08-17.*
