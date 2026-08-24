# Research: Evidence Store & Evidence Contracts

**Epic**: `EPIC-032` · **Phase**: 0 · **Date**: 2026-08-22 · **Plan**: [plan.md](./plan.md)

Eight decisions. Two were settled at the 2026-08-22 clarification session; six resolve
`NEEDS CLARIFICATION` items or choices those answers created.

**Current-docs discipline**: Context7 MCP was available and was used for `R-032-1`, which is the
decision that most changes what this Epic builds. Library IDs are recorded for
`/speckit-implement` and `/speckit-converge`.

---

## `R-032-1` — Adopt the in-toto Attestation envelope; do not invent one

**Decision**: Typed evidence is expressed as an **in-toto Attestation v1 Statement** —
`_type`, `subject[]` with `name` and `digest`, `predicateType`, `predicate`. **No npm dependency is
taken**: the format is a specification, and conforming to the JSON shape costs nothing under
`TS-001` while satisfying `PP-015` Open Standards.

**Rationale**: the requirements and the format line up almost field for field, which is unusual
enough to be worth checking rather than assuming — so it was checked:

| Requirement | in-toto field |
|---|---|
| `FR-EVS-003` — typed by **what it proves**, not which tool made it | `predicateType` is exactly this: `.../test-result/v0.1`, `.../vulns/v0.2` |
| `FR-EVS-011` — identifies the artifact **and its version** | `subject[].digest` — `sha256`, `gitCommit`, `gitBlob` |
| `FR-EVS-013` — integrity and provenance metadata, tamper detectable | `subject[].digest` plus the signed envelope |
| `FR-EVS-041` — names the contributing tool **and its version** | `predicate.scanner.uri` and `.version` |
| `FR-EVS-042` — a contribution naming no artifact version is refused | `subject[].digest` is **required** by the spec, so the refusal is a schema failure |

**Two limits, recorded rather than discovered later.**

1. **in-toto is artifact-centric.** Its subjects are files, images and commits. This Epic also
   stores evidence about **approvals and decisions**, which are not artifacts. `predicateType` is an
   open URI, so PMI Studio defines its own predicates where no standard one exists — an approval
   predicate, a transcript predicate — while reusing `test-result` and `vulns` where they fit.
2. **in-toto has no Evidence Contract.** It describes what *was* attested, never what *must* be.
   `BR-0142` is ours entirely, and adopting the envelope does not import a gate.

**Alternatives considered**:
- *A bespoke evidence record* — rejected. It would reinvent subject/digest/predicate badly, and
  `PP-015` explicitly prefers an open standard where one fits.
- *SLSA provenance only* — rejected as too narrow: it covers build provenance, and `BR-0140`
  enumerates nine evidence kinds including approvals, screenshots and review findings.
- *Taking an in-toto npm library* — rejected under `TS-001`/`TS-002`. Conforming to a JSON shape
  needs no runtime dependency, and this repository has repeatedly declined one for a small job.

**Docs consulted**: `/in-toto/attestation` — *attestation envelope structure with subject digest and
predicate type for test and scan results*. The `test-result` and `vulns` predicate schemas and the
JSONL bundle format were read directly.

---

## `R-032-2` — Reuse `packages/storage-contract` for referenced evidence

**Decision**: Referenced evidence (`FR-EVS-005`) resolves through the existing
`packages/storage-contract` `StorageProvider`. Stored evidence — small, structured attestations —
lives in this Epic's own table.

**Rationale**: `EPIC-025` already built the abstraction, including the failure vocabulary this Epic
needs. `StorageFailure.reason` has `provider_unavailable`, `authorisation_expired` and
`destination_missing`, which is precisely how `FR-EVS-014` distinguishes *unresolvable* from
*satisfied*.

More importantly it establishes the **result-not-exception** rule this Epic should follow. The
contract states it outright: *"S1 — adapters RETURN failures; they never throw."* `FR-EVS-030`'s
refused completion is a **result**, not an exception a caller might swallow — the same reasoning
`EPIC-030` applied to its transition refusals, arrived at independently in two Epics and already
settled in a third.

**Alternatives considered**: a second storage path for evidence — rejected; it would fork the
provider health, authorisation and failure model `EPIC-025` owns.

---

## `R-032-3` — Where the evidence model lives

**Decision**: A workspace package **`packages/evidence-contract/`** for the attestation types, the
Evidence Contract shape and the gate result; the store and gate in
**`backend/src/modules/evidence/`**.

**Rationale**: the sixth `*-contract` package, after engine, agent, execution, loop (`EPIC-030`) and
decision (`EPIC-031`). Three Rooms and `EPIC-031` consume the Evidence Contract shape, and they must
depend on a contract rather than on the backend module. `TS-004` requires it to typecheck
independently.

---

## `R-032-4` — Evidence Contract definitions, and their conformance check

**Decision**: Evidence Contracts are **JSON documents under
`packages/evidence-contract/contracts/`**, one per governed work class, each carrying a
`schemaVersion` and a monotonic `contractVersion`. A conformance check in
`backend/tests/architecture/` fails on a Contract item naming no accepting `predicateType`, on an
unknown work class, or on a **zero-item Contract without the explicit policy declaration**
`FR-EVS-026` requires.

**Rationale**: Constitution V requires a non-code output to carry an **executable** conformance
check — *"a check that cannot fail is decoration"*. `FR-EVS-024` forbids weakening a Contract on
work in flight, and a versioned repository-resident file makes that a reviewable diff rather than a
runtime event.

The zero-item case is called out because it is the silent one: an empty Contract is a gate that
always passes, and it looks identical to a Contract nobody has written yet.

---

## `R-032-5` — Fail closed when the store is unreachable

**Decision**: The completion gate **refuses** when the evidence store cannot be reached
(`FR-EVS-035`, clarified 2026-08-22). The refusal is a `Result`, not a thrown error (`R-032-2`).

**Rationale**: an unreachable store means the Contract cannot be evaluated, and an unevaluated
Contract is not a satisfied one. It also completes the set: `EPIC-030` `FR-GEL-041`, `EPIC-031`
`FR-DPE-050` and this all refuse on the same failure. A governed action that can slip through any
one of the three is ungoverned, so the three failing differently would be worse than any of them
failing wrongly.

---

## `R-032-6` — The `EPIC-015` boundary, checked rather than assumed

**Decision**: `EPIC-015` owns **running** validation; this Epic owns **retaining and gating on** its
evidence. `FR-EVS-050` is honoured by consuming `EPIC-015`'s outputs as attestations, never by
re-running anything it runs.

**Rationale, and a correction**: the first pass of this research recorded `EPIC-015` as *specified
but unbuilt*, on a grep that returned nothing. **That was wrong.** The grep matched `- [x]`
lower-case while the file uses `- [X]`. `EPIC-015` is **built and closed** — `closure.md` dated
2026-08-20, *"5 of 5 implementation tasks complete"*.

What it delivered is the useful detail: its plan says *"every task here **is** a test"* — a
Playwright end-to-end journey, a nightly real-engine smoke test, a performance check, a job
outcome-rate measurement. Those are **validation runs**. `BR-0080` requires validation *"with the
validation evidence retained"*, and retention is the half `EPIC-015` did not build. That is the
boundary, and it is a clean one: `EPIC-015`'s suites become attestation **producers**.

**Alternatives considered**: folding this Epic into `EPIC-015` — rejected at clarification, and the
closure record supports the rejection: `EPIC-015` is closed, and reopening a closed Epic to host
substrate for three unbuilt Rooms would be the larger disruption.

---

## `R-032-7` — Retention, volume and performance targets (`PP-018`, deferred here by the spec)

**Decision**:

| Target | Value |
|---|---|
| Evidence write (stored attestation) | **p95 < 60 ms** |
| Contract evaluation at the completion gate | **p95 < 150 ms** at 50 items |
| Unmet-items query for one object (`FR-EVS-022`) | **p95 < 100 ms** |
| Aggregate unmet query across a project (`FR-EVS-006`) | **p95 < 500 ms** at 10,000 items |
| Retention | attestations are **append-only and never pruned**; referenced payloads follow the retention of the store holding them |

**Rationale**: the gate sits in every completion path, so its budget must compose with `EPIC-030`'s
150 ms transition and `EPIC-031`'s 120 ms decide. Aggregate queries get a load figure because
`FR-EVS-006` is fast at ten items and the number that matters is where it stops being.

Attestations are never pruned because `FR-EVS-012` requires evidence for a superseded version to
stay readable — a retention policy that deleted it would silently convert *"evidence exists for the
old version"* into *"no evidence was ever produced"*.

---

## `R-032-8` — Constitution XI: Tier 1 only, and why Tier 2 cannot apply yet

**Decision**: Tier 1 uses `EPIC-030`'s pattern — `Test.createTestingModule({ imports: [AppModule] })`
against the real HTTP route. **Tier 2 does not apply**, and the reason is a rule rather than a
judgement.

**Rationale**: this Epic delivers the Evidence region **projection** (`FR-EVS-027`), which a Room
renders. The *Evidence & Compliance* navigation area of PMI-DOC-006 §4.1 needs the compliance half
too, and `UX-0060` states that an area in the unowned rows **MUST NOT be implemented before its Epic
is declared**. That half is `U-09`, still unowned. So this Epic cannot deliver the screen even if it
wanted to, and recording that is more useful than recording *"no journey"*.

**Alternatives considered**: shipping a partial Evidence screen — rejected by `UX-0060`, not by
preference.

---

## Resolved `NEEDS CLARIFICATION` items

| Item | Resolved by |
|---|---|
| Attestation and provenance format (`PP-015`) | `R-032-1` |
| Store versus reference, and the failure vocabulary | `R-032-2` |
| Retention and volume targets | `R-032-7` |
| Where the Contract definitions live and how they are checked | `R-032-4` |
| The `EPIC-015` boundary | `R-032-6` (clarified 2026-08-22, then verified against `closure.md`) |

**None remain.**

## Library IDs for downstream commands

| Dependency | Context7 library ID | Consulted for |
|---|---|---|
| in-toto Attestation (**format adopted, no package taken**) | `/in-toto/attestation` | Statement envelope, `subject[].digest`, `predicateType`, the `test-result` and `vulns` predicates, JSONL bundles (`R-032-1`) |
| NestJS (`@nestjs/core` `^10.4.15`) | `/nestjs/docs.nestjs.com` | composed-graph e2e testing — pattern from `EPIC-030` `R-030-8`, reused unchanged |
| Prisma (`@prisma/client` `^5`) | `/prisma/web` | as `EPIC-030` `R-030-1`; no new Prisma concept here |

**No new runtime dependency.** Adopting a JSON schema is not adopting a package. If signature
verification later needs a crypto library, that is a `TS-001` register entry and a decision of its
own — not a consequence of this one.
