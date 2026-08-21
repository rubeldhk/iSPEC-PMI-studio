# RAID Log: PMI Studio Phase 1 Platform Core

**Epic**: `EPIC-001` | **Date**: 2026-08-02 | **Owner**: Project owner | **Review cadence**: per Epic convergence

Risks, Assumptions, Issues, and Dependencies. **Issues are live problems that exist right now** —
four of them are open and two block implementation.

**Scoring**: Probability × Impact, each Low(1) / Medium(2) / High(3). Score ≥6 requires an active
mitigation owner.

---

## R — Risks

| ID | Risk | Prob | Impact | Score | Mitigation | Owner |
|----|------|------|--------|-------|-----------|-------|
| **R-01** | **Spec Kit or AI model output drifts, breaking the parser and silently changing generation quality** | H | H | **9** | Pin Spec Kit and agent versions in the engine image; store raw output alongside parsed (R-007) so a parser fix needs no re-run; record engine + model version on every artifact (FR-022); conformance suite catches shape changes | Tech lead |
| **R-02** | **AI agent run cost is unbounded per job; a runaway job or a busy week produces a surprise bill.** ⚠ **Re-scored 2026-08-20 (EPIC-021 T291) against the twelve-role gate profile**: one gated transition may now bill up to **twelve concurrent model invocations** (one per role, review-role-contract cost note), with M-07's optimisation controls deferred — the multiplier the original score never priced. Likelihood H, impact H; the score stays **9** because it is already the ceiling, but the EXPOSURE behind it is materially larger and is accepted, not mitigated | H | H | **9** | Containment as before — per-job wall-clock/CPU/memory caps (R-006, FR-025; default now 10 min per SC-011) — plus the three controls EPIC-021 built in: **(1) gates fail closed** — an unconfigured transition runs zero roles, never twelve (clarification 2026-08-19); **(2)** `required_roles` is per-gate configuration and the source contract's own guidance is "the roles a transition actually needs — twelve is the maximum, not the default"; **(3)** roles within a gate run concurrently, bounded by the per-job caps, so a gate is one job's budget, not twelve. Configuration guidance: start gates at 2–3 roles (security-reviewer, qa-agent, +1 domain role); add roles only where findings prove their value. Re-score again when M-07 lands or when per-workspace budget alerting ships | Tech lead |
| **R-03** | **Redis licence terms restrict commercial redistribution of the platform** | M | H | **6** | Default to Valkey (BSD, wire-compatible); treat backing store as swappable; verify licence of the deployed version before ship (D-08) | Project owner |
| **R-04** | Container-in-container execution makes engine tests unreliable or impossible in CI | M | M | 4 | Fixture adapter backs the normal suite; real engine only in a nightly job (R-010, T146) | Tech lead |
| **R-05** | Engine-independence erodes under delivery pressure; a "quick" Spec Kit reference lands in the backend | M | H | **6** | Architecture test fails the build (T047, T142); ESLint dependency-boundary rule (T008); fixture adapter proves neutrality | Tech lead |
| **R-06** | Sandbox escape or credential leakage from the AI agent | L | H | 3 | Non-root, read-only root FS, egress allow-list to the AI provider only, no platform credentials mounted, ephemeral container per job | Tech lead |
| **R-07** | Generation latency under concurrent load makes the product feel broken | M | M | 4 | Asynchronous jobs by design (FR-028); bounded worker concurrency; SC-011 measurement — **currently unmeasured, see I-04** | Tech lead |
| **R-08** | Docker Desktop commercial licensing applies to developer workstations | M | L | 2 | Confirm organisational entitlement; Docker Engine on servers is Apache-2.0 (D-28) | Project owner |
| **R-09** | The stack decision (TypeScript/Node) mismatches the delivery team's actual skills | M | H | **6** | Flagged as ⚠ reversible-now in tech-stack.md; **decide before `/speckit-implement`** — after that it invalidates ~all 156 task paths | Project owner |
| **R-10** | Phase 3 RBAC proves harder than assumed because Phase 1 shipped a single-user surface | L | M | 2 | `workspace_id` on every row from migration 1; identity-provider interface boundary (R-008) | Tech lead |
| **R-11** | EPIC-002 arrives and finds Phase 1 made access control retrofitting expensive | L | M | 2 | `access_snapshot` already on `generation_jobs`; per-artifact grants were designed for in EPIC-002 clarification | Tech lead |

---

## A — Assumptions

Each carries what happens if it turns out to be false.

| ID | Assumption | Source | If wrong |
|----|-----------|--------|----------|
| **A-01** | Spec Kit is invoked by scaffolding a workspace and running an AI agent headlessly — there is no generation API | research R-001, verified against official docs | **The largest component in the Epic is wrong.** T086–T092 rewritten; the sandbox may become unnecessary |
| **A-02** | An AI coding agent CLI can run non-interactively with credentials supplied, inside a container | research R-001 | Generation cannot be automated; the whole product premise needs rethinking |
| **A-03** | Generated Markdown is parseable into structured entities reliably enough to be useful | research R-007 | Higher `malformed_output` rate; raw output is still stored, so recoverable |
| **A-04** | "Basic sign-in" means session-based auth is sufficient for Phase 1 | Clarification session | Auth work grows; identity-provider boundary limits the blast radius |
| **A-05** | Multi-tenant-ready data model with a single-user surface is acceptable for Phase 1 | Clarification session | Phase 3 becomes a data migration rather than a switch |
| **A-06** | The SRS remains the requirement authority and will be back-filled where it has gaps | Constitution II | Traceability claims weaken; FR-024/FR-025 stay unbacked — **see I-02** |
| **A-07** | 500 specifications per project is a realistic Phase 1 ceiling | SC-009 | Indexing and pagination strategy revisited |
| **A-08** | Hosting substrate can be chosen after Phase 1 without rework | plan.md | Containerisation assumptions may need revisiting; low exposure |
| **A-09** | One AI provider is sufficient; multi-provider is not a Phase 1 need | tech-stack.md | Engine image gains configuration; contract unaffected |
| **A-10** | Task-level unit tests are achievable for every code artifact including thin controllers and UI | Constitution V | **Held.** Resolved via I-01 without amending the constitution: component tests count as unit tests for UI, and controller unit tests with mocked services are legitimate. 197 tasks now comply |

---

## I — Issues (open, live now)

> These are not hypothetical. Four are open; **I-01 and I-02 block implementation.**

| ID | Issue | Severity | Raised by | Status | Resolution needed |
|----|-------|----------|-----------|--------|-------------------|
| **I-01** | 35 application-code tasks had no paired unit-test task, violating Constitution V (NON-NEGOTIABLE) — all 14 frontend tasks plus 21 backend tasks | **CRITICAL** | `/speckit-analyze` D1 | ✅ **CLOSED 2026-08-02** | Resolved by adding 34 unit-test tasks and annotating one existing pair, using suffixed IDs so cross-references stayed valid. Constitution **not** amended — component tests satisfy "unit test" for UI, and controllers now have unit tests alongside their contract tests. Verified: 0 remaining gaps across 197 tasks |
| **I-02** | FR-012 had zero task coverage — "view, edit, and list specifications" is defined in `contracts/platform-api.md` but no task implemented the list/detail endpoints | **HIGH** | `/speckit-analyze` E1 | ✅ **CLOSED 2026-08-02** | Resolved by adding 6 tasks to Phase 5 (T076a, T076b, T083a–T083d): read service, list/detail/edit endpoints, list page, plus unit, contract, and component tests |
| **I-03** | SRS back-fill declared but not gated — FR-024/FR-025 have no SRS source, yet Exit Criteria omitted the gate | **HIGH** | `/speckit-analyze` D2 | ✅ **CLOSED 2026-08-03** | Two Exit Criteria added to spec.md (SRS back-fill; principle register review) plus closure task **T155a** |
| **I-04** | SC-011 unmeasured — "95% of generation requests complete or report a named failure within the time limit" had no measuring task | **MEDIUM** | `/speckit-analyze` E2 | ✅ **CLOSED 2026-08-03** | Measurement task **T147a** added in M-12 QA |
| **I-05** | Tasks carry no FR-level traceability — they reference user stories but never requirement IDs. Coverage can only be verified by inference, which is what let I-01 and I-02 hide until analysis. **Now also an SRS violation**: PMI-DOC-000 §5 and PP-004 both require upstream/downstream ID references on every artifact | **HIGH** *(raised from MEDIUM — now SRS-mandated)* | `/speckit-analyze` F1 | 🟠 Open | Annotate all 201 tasks with requirement IDs — **execute as part of D-1**, since D-1 renumbers the very labels being added. Doing it first means doing it twice |
| **I-06** | Two SRS source documents in `SRS/` are byte-identical duplicates; `raw study.docx` contains its content twice verbatim | **LOW** | EPIC-001 specify | 🟠 Open | Remove the duplicate; harmless but noise as the corpus grows |

---

## D — Dependencies

External things this Epic waits on or is coupled to. Register with licences: [dependencies.md](./dependencies.md).

| ID | Dependency | Type | Criticality | Exposure | Handling |
|----|-----------|------|-------------|----------|----------|
| **D-A** | Spec Kit (`specify` CLI) | External tool | **Critical** | Version drift changes output shape; project is external and evolving | Pinned in engine image; behind the engine contract; conformance suite |
| **D-B** | AI coding agent CLI + model API | External service | **Critical** | Vendor terms, rate limits, metered cost, availability, model deprecation | Pinned version; caps enforced; `engine_unavailable` handled as a first-class failure |
| **D-C** | AI provider credentials | Secret | **Critical** | Generation cannot run without them; leakage is severe | Held only by the worker; never mounted into platform containers; never in engine output or diagnostics |
| **D-D** | Docker Engine on every worker host | Infrastructure | **Critical** | No sandbox means no generation | Documented prerequisite in quickstart.md |
| **D-E** | PostgreSQL 16 | Infrastructure | Critical | Standard | Testcontainers in CI; managed service in higher environments |
| **D-F** | Redis / Valkey | Infrastructure | High | Licence exposure — see R-03 | Default Valkey; wire-compatible swap |
| **D-G** | GitHub | Platform | High | Constitution names it canonical for repo and promotion trail | Constitution §Repository & Environment Governance |
| **D-H** | SRS back-fill by the project owner | Internal | Medium | Two requirements lack SRS coverage — see I-03 | Owner action; gates Epic exit (T155a) |
| **D-K** | **`PMI-DOC-004` Business Requirement Specification + approved business scope** | Internal | **Critical** | **135 of 201 tasks are held pending these** (decision D-10). The BRS is cited by three governing documents and does not exist; the Charter is still `Draft` | Owner action — PMI-TASK-001 **T-101** and **T-106**. Nothing in M-02, M-03, M-04, or M-06 starts until both land |
| **D-I** | EPIC-002 | Internal | Low | EPIC-002 depends on this Epic, not the reverse | Seams present: `access_snapshot`, job state machine |
| **D-J** | SRS Volume 8 design system | Internal | Low | Phase 1 UI is deliberately plain; no component library chosen | Revisit when Volume 8 exists |

---

## Escalation summary

**Blocking implementation** — resolve before `/speckit-implement`:

1. ~~**I-01** — Constitution V violation across 35 tasks~~ ✅ **CLOSED 2026-08-02**
2. ~~**I-02** — FR-012 has no coverage~~ ✅ **CLOSED 2026-08-02**
3. **R-09** — confirm the stack matches your team, while it is still cheap to change — **now the
   only open blocker**

**Resolve before production**:

4. **R-01, R-02** (score 9) — engine drift and unbounded AI cost
5. **R-03** — Redis licence position
6. **I-03** — SRS back-fill gate

**Track through delivery**: R-05 (independence erosion), I-04, I-05, and the remaining assumptions.
