# Quickstart results: EPIC-033

**Task**: `T405j` · **Run**: 2026-08-28 · **Commit**: Phase N

Each scenario in [quickstart.md](./quickstart.md) and the executed test that demonstrates it, run
**individually** rather than as one suite — a scenario that only passes alongside its neighbours is
a scenario nobody has isolated.

| # | Scenario | Demonstrated by | Result |
|---|---|---|---|
| 1 | Raw intent becomes an approved, immutable baseline | `requirement-room-baseline.spec.ts`, `requirement-room-intake.spec.ts` | **39/39 pass** |
| 2 | A baselined requirement cannot be edited in place | `baseline-immutability.spec.ts` (`T338g`) | **9/9 pass** |
| 3 | Every AI element carries exactly one epistemic label | `requirement-room-labelling.spec.ts` (`T337h`), `room-contract/tests/epistemic.spec.ts` | **22/22 pass** |
| 4 | Nothing baselines without measurable acceptance criteria | `requirement-room-criteria.spec.ts` | **11/11 pass** |
| 5 | Material decisions come with real options | `requirement-room-options.spec.ts` | **15/15 pass** |
| 6 | No AI takes a requirement decision | `requirement-room-no-ai-decision.spec.ts` (`T339q`), `requirement-room-decision.spec.ts` | **27/27 pass** |
| 7 | A baseline is a selectable specification input | `requirement-room-handoff.spec.ts`, `requirement-room-handoff-version.spec.ts` | **20/20 pass** |
| 8 | The Room shows what is blocking it | `requirement-room-readiness.spec.ts`, `Blockers.spec.tsx` (`T403q`) | **26/26 pass** |
| 9 | The Room cannot omit or invent a region | `room-contract/tests/regions.spec.ts` (`T337f`), `vocabulary.spec.tsx` (`T403o`), `RoomShell.spec.tsx` | **27/27 pass** |
| 10 | The Room is its own workflow type | `requirement-room-type-isolation.spec.ts` (`T403v`) | **8/8 pass** |
| 11 | An external stakeholder is told, not failed | `RequirementRoom.access.spec.tsx` (`T403u`) | **5/5 pass** |
| 12 | Constitution XI Tier 1: the Room is wired | `requirement-room-reachability.spec.ts` (`T337x`) | **13/13 pass** |
| 13 | Constitution XI **Tier 2**: the journey, by keyboard, against a running application | — | **NOT RUN — outstanding human step** |

## Scenario 13 is outstanding, and is not being counted

`R-033-8` requires a **run-generated** transcript of *unstructured intent → approved baseline*
against a running application, completable **using only a keyboard** (`SC-RQR-008`). No test
discharges it, and none can: the failure mode it exists to catch is a Room whose regions each work
and whose flow does not, found by a person opening a browser — which is exactly how `DEF-005-001`
was found after that Epic closed.

It is recorded here as outstanding rather than approximated, for the same reason the EPIC-029
accessibility record is: a transcript nobody generated is not evidence, and writing one from what
the tests imply would be fabricating the observation the criterion exists to obtain.

This blocks `SC-RQR-008` and Phase Z, not Phase N.

## The five mutation proofs

Each mutation applied, the named test observed **failing**, the mutation reverted, and the suite
observed green again. A check that has never been seen to fail is a check nobody has tested.

| Task | Mutation | Observed failing | On revert |
|---|---|---|---|
| `T405a` | `baseline.service.ts` — `assertEditable` returns instead of throwing `InPlaceEditRefusedError`, shaped as an "already baselined, allow the correction" convenience | **6 of 18** in `baseline-immutability` + `requirement-room-supersede` | 18/18 |
| `T405b` | `room-contract/src/epistemic.ts` — `epistemic` made optional | **3 typecheck errors** in `room-contract` | 0 errors |
| `T405c` | `epic033` migration — the `requirement_decisions_decided_by_a_human` CHECK dropped, as "the service already checks this" | **5 of 7** in `requirement-room-no-ai-decision` | 7/7 |
| `T405d(i)` | `room-contract/src/regions.ts` — `activityTimeline` removed | **5 of 19** across `regions` + `RoomShell`, **3 typecheck errors** | — |
| `T405d(ii)` | `room-contract/src/regions.ts` — a seventh region `approvals` added | **9 of 48** across `regions`, `RoomShell`, `vocabulary`, **1 typecheck error** | 48/48, 0 errors |
| `T405e` | `app.module.ts` — `RequirementRoomModule` unregistered | **12 of 13** in `requirement-room-reachability` | 13/13 |

### `T405b` is the one worth reading twice

The runtime suite **passed** under the mutation — all 55 tests. Vitest transpiles without
typechecking, so making a type field optional changes nothing it can observe. `FR-RQR-011`'s
guarantee is a **compile-time** one, and its proof is `tsc`, not the test runner.

The three errors it produced are worth naming, because the test had anticipated this exact mutation:

- two `TS2578: Unused '@ts-expect-error' directive` — the assertions that an unlabelled element must
  not compile started compiling;
- one `TS2322` on the exhaustiveness check.

`epistemic.spec.ts` even names the shape: *"The optional-variant bypass: `epistemic?: Epistemic`
would satisfy every other assertion here and permit exactly the element FR-RQR-011 forbids."*

### `T405e` found a stale check, and it was rebuilt

The first run failed only **4 of 13**. The eight route-loop tests **passed with the module
unregistered** — the loop could not tell a matched route from an unmatched one.

The cause is a check that decayed without anyone touching it. The loop asserted *"any platform error
code means a handler ran"*, on the reasoning recorded in its own comment: an unmatched path returns
`internal_error`. That was true under `DEF-030-001`. `DEF-001-006` then fixed the error filter, and
an unmatched path became `404 not_found` — a platform code. The assertion kept passing and stopped
meaning anything, and its comment kept explaining a mechanism that no longer existed.

The discriminator was rebuilt on the **message**: `toErrorBody` keeps a `PlatformError`'s own text,
while the filter authors a generic sentence for a framework status. So an unmatched path says
exactly *"The requested resource does not exist."*, and a handler that ran says something of its own
or succeeds. Re-running the mutation against the rebuilt check: **12 of 13 fail**.

This is the mutation proof earning its keep in the way the technique is supposed to — not by
confirming a check works, but by finding one that had quietly stopped.

## Performance — `R-033-7`, `T405f`

`requirement-room-performance.spec.ts`, p95 over the sample counts shown.

| Target | Value | Measured p95 | Result |
|---|---|---|---|
| Blocker query (`UX-0032`) | < 200 ms | **0.30 ms** (60 samples, 200 candidates) | pass |
| Room load, six regions populated | < 1.2 s at 200 | **0.13 ms** (30 samples) | pass |
| Baseline creation | < 2 s at 200 members | **0.43 ms** (30 samples) | pass |
| AI clarification round | — | **not measured, deliberately** | n/a |

**What these figures do and do not mean.** `REQUIREMENT_ROOM_STORE` defaults to in-memory, so this
measures the projection, the set hashing and the store reads — **not PostgreSQL**. The database
round-trips that would dominate a real Room load are not in the number. The targets are met for the
work that exists today; they are not a claim about production latency, and the headroom (three orders
of magnitude) is itself the signal that the dominant cost is not yet in the measurement.

**The AI round has no figure here on purpose.** `R-033-7` bounds it by `EPIC-028`'s
`WallClockOutcome` and withholds a second budget, because inventing one is the `BR-0106` mistake the
spec forbids. A target measured in the wrong Epic becomes the number people quote.

## Set size — `R-033-7`, `T405g`

Designed for **500**. Degradation above it, measured at four sizes so the shape is recorded rather
than a single figure:

| Set size | Blocker query p95 |
|---|---|
| 200 | 0.13 ms |
| 500 | 0.56 ms |
| 1000 | 0.66 ms |
| 2000 | 1.03 ms |

**Roughly linear.** Ten times the rows costs about eight times the time, so above the designed size
the cost grows predictably rather than falling off a cliff. The stated limit is therefore *500 is the
designed size; beyond it the projection continues to work and costs proportionally more* — which is
a recorded limit rather than a surprise.

The test asserts the **shape** (2000 within 16× of 500) rather than a threshold, because above the
designed size the target no longer applies and a tight bound would be a flaky test asserting nothing
anyone promised.

## Boundary confirmations

**`T405h` — no second requirement store (`FR-RQR-002`, `D-33`).** Confirmed by inventory rather than
by reading the comment that claims it. The six tables this Epic owns — `requirement_candidates`,
`clarifications`, `requirement_decisions`, `baselines`, `baseline_exceptions`, `handoffs` — carry no
`description`, `type`, `priority`, `title` or `statement` column between them. What they do hold is
`normalizedText` (the Room's own record of submitted **intent**, which is not a requirement until
promoted), `promotedTo` (a reference), `memberVersionIds` (references) and `setHash`.

The boundary the tokens file calls *"the one most likely to be crossed, because a local cache of
requirement text would feel convenient every single day"* is intact.

**`T405i` — `Execute` and `Verify` render as omitted, not absent (`FR-GEL-008`, `R-033-6`).**
Asserted for **both** stages in `requirement-room-type-isolation.spec.ts`, plus that each is
`pending` — `FR-GEL-008` keeps *omitted* and *how far has this got* as two facts rather than one. A
test naming only `Execute` would pass a projection that dropped `Verify`.

## Not applicable

- **Scenario 13** — see above. Outstanding human step, not a result.
- **AI round latency** — `EPIC-028`'s, by `R-033-7`.
- **Production latency** — not measurable while the store is in-memory; stated above rather than
  estimated.


## Phase 9 mutation observations (`T1173`, 2026-08-28)

Two more, run the same way: applied, observed failing, reverted.

| Mutation | Observed failing | On revert |
|---|---|---|
| `areas.ts` — the `element` removed while `status` still reads `delivered` | **4 of 20** across `areas` + `page-reachability`, including *"delivered with nothing to render"* | 20/20 |
| `requirement-room.controller.ts` — `GET /rooms/requirement` unregistered | **1 of 15**, naming it exactly: *"GET /v1/rooms/requirement answered 404 with the framework's own not-found message — no handler matched"* | 15/15 |

The second is `T405e`'s repair earning its keep. Before that mutation proof, the
reachability loop asserted only *"any platform error code means a handler ran"* — which stopped
discriminating when `DEF-001-006` made an unmatched path return `404 not_found`. Rebuilt on the
message, it now names the unregistered route rather than passing quietly. A check repaired in Phase N
caught a Phase 9 regression it would previously have missed.

The first is the pair `areas.ts` records as a rule: a status without an element is a claim, and an
element added to justify a status is the status driving the product. Phase 9 did them in the order
that makes the claim true — index first, `element` second, status third.
