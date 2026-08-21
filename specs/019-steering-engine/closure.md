# Closure record: EPIC-019 Steering Engine

**Date**: 2026-08-20 · **Session**: `/speckit-implement EPIC-019`, executed in the isolated
worktree branch `epic/009-011-016-lifecycle-wave` (concurrent-session rule) · **Released by**:
PMI-DOC-004 v1.0 (BR-0070). First of the EPIC-017 family, as the split ruling D-18 requires.

## `T247` — every implementation task has a passing unit test (Constitution V)

**23 of 23 implementation tasks complete**, every one red-first (observed import failures or
assertion failures before the implementation existed — including the generation-path stamping
tests, which failed against the pre-steering `GenerateSpecificationService`).

| Implementation task | Paired test | Result |
|---|---|---|
| T226/T227 `Organization` + required `organizationId` on Workspace ONLY, RESTRICT delete, default-org seed | T225 `organization.spec.ts` (6, schema + migration) | pass |
| T229/T230 `SteeringScope` model + pure scope path resolution | T228 `scope.spec.ts` (7 — all four levels, mismatched ref, missing parent, unknown type) | pass |
| T232/T233 `SteeringDocument` + versioned service (append-only history, retire marks) | T231 `steering-document.spec.ts` (8) | pass |
| T235 the ten subjects, others refused BY NAME with the valid set listed | T234 `steering-subjects.spec.ts` (14) | pass |
| T238 controller + `SteeringModule` wiring | T237 `steering.controller.spec.ts` (6) + **T236 contract (8)** | pass |
| T240 pure resolution — narrower wins, override names winner AND loser, broadest-first order | T239 `steering-resolution.spec.ts` (6) | pass |
| T242 `SteeringApplication` model (write-once trigger) + stamping service + **generation-path wiring** | T241 `steering-application.spec.ts` (7 — incl. engine receives `input.steering`, empty-set row, failed run stamps nothing) | pass |
| T244 contract: `SteeringInput[]`, `steering?` on input, `findings?` on output (S6), `isSteeringOrdered` | T243 `steering-input.spec.ts` (6) | pass |
| T245 conformance C-14/C-15/C-16 (+ required `createSteeringViolating` harness method) | **green against BOTH adapters** (6 cases) | pass |
| T246 fixture consumes steering; violation injection on demand | conformance C-14–C-16 + fixture suite | pass |
| T246a architecture backstop — steering never becomes a prompt in `backend/src/**` | 4 checks incl. anti-vacuity, in `engine-independence.spec.ts` | pass |

Suites at closure (all executed this run): 1231 across backend-unit/contract/architecture/
worker/engine-contract/fixture-adapter/speckit-adapter/frontend (134 files) · 71 integration on
real PostgreSQL + 2 skipped by name — **the new migration applies cleanly to a real database** ·
governance re-run after register refresh · typecheck clean (backend, worker; frontend untouched
but re-verified in the suite run).

## Design notes that will matter later

- **The tenancy tier landed the cheap way.** `organizationId` is required WITH a database default
  pointing at a seeded `org_default` row — every pre-organization workspace row and every
  existing test seed stays valid, no data migration, and the column is still NOT NULL with a
  RESTRICT FK. EPIC-020/021/022 inherit this tier as built.
- **Steering leaves `backend/` only as structured `SteeringInput[]`** (S1). The ONE place
  structured steering becomes prose is inside each adapter (`renderRequirements` for Spec Kit,
  the content section for the fixture) — the correct place per the contract. T246a fails the
  build if `backend/src/**` ever interpolates, concatenates, or joins steering content into
  text; the subject VOCABULARY (`STEERING_SUBJECTS`) is excluded so a refusal message may list
  valid names.
- **A violation is a finding, not a failure** (S6): `GeneratedSpecification` gained optional
  `findings`; the Spec Kit adapter extracts `<!-- steering-violation: … -->` markers the agent
  is instructed (in the adapter-rendered input document) to record.
- **Provenance is stamped in the same act as the commit**, empty-set when nothing applied, and
  write-once at three layers: the service refuses restamps, the table has a unique
  `(artifactType, artifactId)`, and the shared `reject_mutation()` trigger refuses UPDATE/DELETE.
- **Resolution failure fails the run** rather than quietly generating an unconstrained artifact
  with false provenance.

## `T248` — convergence

Performed within this run per the `speckit-converge` method. **No unbuilt work found in scope**
— including the one gap a naive reading would have left: FR-ENH-004's "every generation" is
wired into `GenerateSpecificationService` itself (resolve → pass structured → stamp), not left
as a free-standing service. Deferrals with owners: Prisma-backed steering stores + the composed
`GenerationSteeringPort` binding → **EPIC-014 F-11.2** (the platform composition root, same as
every module); steering UI surface → EPIC-020/EPIC-010's family; quickstart V17-1/2/3 as
browser journeys → ride the EPIC-015 journey infrastructure once the app shell exists.

## `T249` — defect triage

`specs/019-steering-engine/defects/` contains no records. **0 open.**

## `T250` — closing report

**Work completed**: `backend/src/modules/steering/` (scope-resolver, steering.service,
steering.validation, steering.controller, steering-resolver, steering-application.service,
steering.module), the `Organization`/`SteeringScope`/`SteeringDocument`/`SteeringApplication`
models + migration `20260820180000_epic019_steering`, the `GenerationSteeringPort` wiring in
`generate-specification.service.ts`, the engine-contract extension (`SteeringInput`,
`steering?`, `findings?`, `isSteeringOrdered`, conformance C-14–C-16), fixture + Spec Kit
adapter steering consumption, T246a in the architecture suite, AppModule registration, and 8
test files (~54 new tests). **Deferred with owners**: as listed under T248.

### Epic Exit Criteria

- [x] Every implementation task has a passing unit test (T247)
- [x] Convergence reports no unbuilt work in scope (T248)
- [x] `defects/` contains no open records (T249)
- [x] Principle deltas hold (PP-006 defended by T246a, now executable); deferrals have valid owners (T250)
- [x] Conformance cases C-14 to C-16 green against BOTH adapters
- [x] `pnpm test:arch` green including T246a
- [x] Closing report published (this record + the session report)
- [x] Closure recorded — **EPIC-019 is CLOSED and release-eligible**
- [ ] Platform promotion — EPIC-014 F-11.2's

### Recommended Next Task

`/speckit-implement EPIC-020` — Living Specifications & Impact; it inherits the organization
tier this epic just built, and the family is sequenced 019 → 020/021/022.
