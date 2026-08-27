# Epic Specification: Artifact Access Control

**Epic**: `EPIC-024` | **Module**: M-13 Security & Governance | **Tasks**: counted in [tasks.md](./tasks.md), never restated here (`T686`, PP-002)

**Parent design**: [../002-team-review-access-storage/](../002-team-review-access-storage/)
**Shared design**: [../_shared/](../_shared/) — architecture, schema, contracts, research, RAID

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING** — released 2026-08-20 by **PMI-DOC-004 v1.0** (Business Requirement
> Specification, APPROVED; scope ruling T-106). This Epic implements **BR-0003, BR-0062**. The prior
> hold (decision D-10, PMI-TASK-001 T-101/T-106) is discharged; resumption goes through the
> Definition-of-Ready gate, not by declaration (EPIC-026).

## Purpose

Direct read and edit grants to named users on individual artifacts.

A deliberate, bounded advance on the SRS roadmap, which places governance in Phase 3. Roles,
groups, inherited organisational permissions and SSO stay there. What lands here is the minimum
that makes a shared review session safe — because a collaborative surface without access control
is a liability the moment a project holds anything commercially sensitive.

## SRS Traceability *(Constitution II)*

This epic **inherits** the SRS traceability table in the
[parent design](../002-team-review-access-storage/spec.md), which cites every source behind the
requirements below. Authority is layered per decision **D-12**.

## Requirements owned

Requirements are defined once in the [parent design](../002-team-review-access-storage/spec.md);
this epic **owns** the following and is where they are satisfied:

| Requirement |
|---|
| FR-ACC-021, FR-ACC-022 — grant and revoke read or edit access per artifact |
| FR-ACC-023, FR-ACC-024 — refuse and record; hide rather than show as inaccessible |
| FR-ACC-025 — a derived artifact is at least as restricted as its source |
| FR-ACC-026 — every grant and revocation audited |
| FR-ACC-027 — no artifact may reach a state with no user holding edit access |
| FR-ACC-028 — access evaluated against the grants in force when a run started, governing what that run may read and produce |
| FR-ACC-028a — what a reviewer may see in a review session is evaluated against the grants held when the session is opened, so a revocation takes effect on the next open |

## User stories owned

- US4 — control who can see and change each project artifact

## Success criteria owned

- SC-007 — zero artifacts visible to a user holding no grant; every refusal recorded
- SC-008 — zero artifacts can reach a state with no editor
- SC-013 — every grant, revocation and refusal appears in the audit record
- SC-018 — a user whose grant is revoked while a review session is open sees zero restricted questions on their next open

## Depends on

- EPIC-004 — tenancy and audit, which these grants extend
- EPIC-008 — artifacts to grant access on
- **EPIC-023** — the `Run` model, which carries the `access_snapshot` column `T381` writes (FR-ACC-028).
  A run-start snapshot cannot be taken against a `Run` that does not exist

## Clarifications

### Session 2026-08-19

- No questions required.

Scanned against the twenty-category ambiguity taxonomy. **11** categories are not answered in this document, of which **8** — *Out of Scope*, *Domain & Data*, *Scale assumptions*, *UX Flow*, *Reliability*, *External deps*, *Edge cases*, *Constraints* — are answered up the chain from the [parent](../002-team-review-access-storage/spec.md) and inherited here under Constitution II. Asking those again per Epic would require this document to restate what the parent owns, which is the duplication `T686` removed from the task counts.

**3** are answered nowhere in that chain:

- *Error / empty states* — **Outstanding** — a plan-level concern that changes no requirement this Epic owns, recorded rather than asked
- *Performance* — **Outstanding** — recorded, not asked
- *Terminology* — **Outstanding** — no canonical glossary exists programme-wide; naming has held without one so far

## Principle conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register is in [`_shared/platform-spec.md`](../_shared/platform-spec.md); the
epic-level register is in the [parent design](../002-team-review-access-storage/spec.md). This
epic records only where it **differs** or is the place a principle is satisfied:

| Principle | Status in this epic |
|---|---|
| PP-008 Security by Design | ✅ **Satisfied here.** Per-artifact grants, refusals recorded before the response is sent, derived artifacts inheriting restriction. RBAC and SSO remain Phase 3 |

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

- [ ] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `specs/024-artifact-access-control/defects/` contains no open defect records
- [ ] Principle deltas above still hold; any deferral retains a valid owner
- [ ] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**
- [ ] Platform promotion `local → dev → stage → prod` is gated separately by [EPIC-014 F-11.2](../014-devops-release/tasks.md) — it is **not** this epic's to discharge
- [ ] A closing report was published (Constitution IX)

---

## Principal authorization and scoped delegation *(added 2026-08-27, Step C3B)*

*EPIC-024 authorises **both** kinds of principal. It does not define identity — EPIC-028 does — and
it does not read EPIC-028's tables.*

- **FR-ACC-029**: Actor resolution MUST be generalised behind a principal directory: a **human**
  resolves against the authoritative user record, a **non-human** through EPIC-028's public
  registry. EPIC-024 MUST NOT access EPIC-028's persistence directly.
- **FR-ACC-030**: A `suspended` or `revoked` principal MUST be refused at the workspace boundary,
  before grants are consulted.
- **FR-ACC-031**: A sponsoring human's artifact ownership MUST NOT confer access on the principals
  they sponsor. Delegation MUST be **explicit**.
- **FR-ACC-032**: A delegation MUST bind tenant and workspace, the principal, the sponsoring human,
  an artifact scope, an allowed action set, an identity version, effective and expiry times, and
  revocation and correlation evidence.
- **FR-ACC-033**: A delegation MUST carry only `execution.register`, `execution.report`,
  `execution.attach-evidence` and `transition.propose`. `transition.approve`, `transition.apply`,
  `policy.configure` and grant administration MUST NOT be delegable — enforced at the **database**,
  not by convention.
- **FR-ACC-034**: A delegation MUST fail closed when revoked, expired, not yet effective, scoped to
  a different artifact, or pinned to a superseded identity version. An unreadable delegation store
  MUST fail closed with a **distinct operational reason**.

### Success criteria owned *(C3B)*

- **SC-019**: **Zero** non-human principals obtain access through a sponsor's ownership alone; every
  one requires an explicit, scoped, unexpired delegation.
- **SC-020**: **Zero** delegations carrying approval or application can be written, verified by
  attempting each forbidden action against the real constraint.

> Preserved unchanged by this addition: the workspace boundary, deny-by-default on zero grants,
> durable grants and revocations, fail-closed behaviour, and audited access attempts. **No parallel
> authorization system for agents exists** — this answers the same question for a second kind of
> actor and then runs the same grant evaluation.
