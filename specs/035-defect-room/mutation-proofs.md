# EPIC-035 — Mutation proofs

Each entry records a mutation **applied**, the named test **observed failing**, and the
revert. Written at the moment of observation rather than assembled afterwards: `DEF-034-001`
was two artifacts written minutes apart from one misreading, agreeing with each other, and
*a second recollection is not a second source*.

The four proofs the Epic Exit Criteria require are `T999l`, `T999m` and `T999n` (a) and (b),
in the polish phase. This first entry is not one of them — it was owed for a different
reason, recorded below.

---

## 1. `FR-DFR-023` — an agent must not confirm a defect

**Recorded**: 2026-08-31 · **Task**: `T998d` · **Not one of the four required proofs**

### Why this one was owed

`T998d`'s tests passed the first time they ran. Constitution V asks for a paired test
observed failing first, and these never failed — the guard they describe already existed in
`triage.service.ts`, written under `T998a` before the tests that name it.

A test that has never been seen to fail proves the code does what it does. That is the same
sentence `FR-DFR-040` uses about a defect's own failing test, and it applies here: without
this proof, `T998d` would be eight green assertions with no evidence they bind to anything.

### The mutation

`backend/src/modules/defect-room/triage.service.ts` — the guard rewritten so it can never
fire, keeping its shape so nothing else changed:

```diff
- if (outcome === 'confirmed-defect' && input.classifiedByKind !== 'human') {
+ if (outcome === 'confirmed-defect' && input.classifiedByKind === 'nobody-at-all') {
```

### Observed

`npx vitest run backend/tests/unit/defect-room-agent-triage.spec.ts` — **4 failed | 4
passed (8)**:

- `the service refuses it` — failed
- `and names the requirement, so the refusal is actionable` — failed
- `writing nothing` — failed
- `and the same is true whatever the agent calls itself` — failed

The four that continued to pass are the ones asserting an agent **may** propose a change
request or a requirement gap, and that a human may confirm. That split is the useful part of
the observation: the file is not vacuous in either direction. A guard that refused everything
would have failed those four, and a guard that refused nothing failed the first four —
`T998d` distinguishes the two, which is exactly what `RULE-03` asks it to.

### Reverted

The line was restored from a copy taken before the edit and confirmed by `grep`. The suite
returned to 8 passed.

---

## 2. `FR-DFR-041` — a fix accepted with no failing test

**Recorded**: 2026-08-31 · **Task**: `T999l` · **Epic Exit Criterion** (`SC-DFR-001`)

### The mutation

Two, because the first produced a result worth reporting rather than the one the task
predicted.

**(a) The service bypass**, in `defect-test.service.ts`. `acceptFix`'s final refusal —
*"no failing test is on record"* — replaced with an acceptance.

Worth noting how it had to be written. The `accepted: true` arm of `FixAcceptance` **carries**
the `DefectTest`, so the obvious bypass does not compile: there is no test to put in it. The
mutation therefore had to fabricate one (`id: 'none'`, `reference: 'no test recorded'`). That
is the type doing its job — it did not prevent the bypass, it forced whoever writes it to
state a falsehood explicitly, where a reviewer can see it.

**(b) The type guard**, in `test-first.types.ts`: `readonly test: DefectTest` relaxed to
`readonly test?: DefectTest`. The tidy-up somebody makes when a call site is awkward.

### Observed

**The named test did not fail, and that is a finding rather than a problem.**

`T998i` (`defect-room-test-first.spec.ts`) passed with mutation (a) standing — **13 passed**.
The task list says it *"must fail while the mutation stands"*, and it did not.

The reason is structural and correct: `T998i` proves the **three guards refuse separately**,
and exercises each one by going *around* the service — the type by compiling a fixture, the
loop configuration by reading `defect-room.json`, and the database trigger by raw SQL. A
service-level bypass touches none of the three. That is the division of labour the file was
written for, not a gap in it.

`SC-DFR-001` asks for *"a bypass added and the suite observed failing"*, and the suite did
fail — **5 tests across 2 files**:

- `T998g` · `a fix with no failing test on record is not accepted > refuses`
- `T998g` · `… > naming the route that records one`
- `T998g` · `… > and it carries no test, because there is none`
- `T998g` · `the not-automatable exception, and its limit > and a reproduction that is merely
  hard to reproduce is not the exception`
- `T998m` · `closure requires the defect test AND the regression set > refuses with no defect
  test on record`

Mutation (b) then confirmed `T998i` **can** fire, against a guard it actually tests:

- `T998i` · `guard 1 — the type refuses, at compile time > an acceptance with no test does not
  compile` — failed

Without (b) this entry would record a test that passed under mutation with an explanation, and
an explanation is not evidence. The anti-vacuity rule applies to proofs as much as to
assertions.

### Reverted

Both files restored from copies taken before each edit; `git diff --stat` reported no change
under `backend/src`. **48 passed** across the three affected files.

---

## 3. `FR-DFR-044` — a passing reproduction test reclassified automatically

**Recorded**: 2026-08-31 · **Task**: `T999m` · **Epic Exit Criterion** (`SC-DFR-004`)

`ADR-0016` names this failure mode in the imperative, and the specification calls it *the
easiest of the eight requirements to "simplify" into a defect*.

### The mutation

Both halves, as the task requires.

**Service**, in `evidence-check.service.ts`: `raise()` returning
`{ paths, autoChosen: 'reclassify' }`. Written the way it actually gets written — not as
*"reclassify everything"*, but as a helpful shortcut for the case that looks obvious.

**Loop configuration**, in `packages/loop-contract/workflows/defect-room.json`: a
`Verify → Decide` transition appended, which is the edge whose absence makes the failure mode
unrepresentable rather than merely forbidden.

### Observed, and the hole it found

`T998x` failed immediately on the configuration half — **2 tests**:

- `no transition returns from Verify to Decide`
- `and nothing at all transitions INTO Decide except Analyze`

`T998u` **passed**. The service half was uncaught, and the reason is worth stating: `T998u`
already asserted *"nothing is chosen by raising it"*, but it asserted that nothing was
**written** — `evidenceChecksFor` returning zero rows. A raise that *returns* a suggested path
writes nothing and passes, while every screen rendering the response shows one pre-selected.
That is the automatic reclassification arriving through the caller instead of through the
store, and `SC-DFR-004` counts it the same way.

So an assertion was added **while the mutation stood**, and observed failing:

- `T998u` · `a passing run raises a check, and offers exactly three ways out > and the answer
  it gives carries no choice either` — failed

with a control (`the no-choice check can fire`) so the matcher is not vacuous. Both named
tests then failed together, which is what `T999m` asks for.

### Reverted

Service and workflow restored from copies; `git diff --stat` reported no change under
`backend/src` or `packages/`. **27 passed** across both files, including the new assertion.

---

## 4. `FR-DFR-077` — a classification resting with nowhere to go

**Recorded**: 2026-08-31 · **Task**: `T999n` (a) · **Epic Exit Criterion**
*(promoted 2026-08-23, analysis finding `L1`)*

### The mutation

Both halves, because `FR-DFR-077` is guarded in two places.

**Type**, in `classification.types.ts`: `readonly destination: string` relaxed to
`string | null` — the shape somebody reaches for when a caller has nowhere sensible to route
to yet.

**Constraint**, in the base migration: the `destination` column relaxed to nullable and
`defect_classifications_destination_matches_outcome` widened with `"destination" IS NULL OR`.

### Observed, and the second hole this phase found

**Neither named test failed.** `T997e` and `T997u` both passed — **46 passed**.

The gap in each is precise, and the same shape in both:

- `T997e` asserts `DESTINATIONS` is a **total `Record` over the outcome union**, which
  guarantees every *outcome* has a destination. It says nothing about whether a stored
  *classification* must carry one. `string | null` satisfies every assertion in the file.
- `T997u` proves a **wrong** destination is refused — `change-room` on a confirmed defect,
  `requirement-room` on a change request. Neither case tried an **absent** one.

A total mapping and a non-null column are different guarantees, and the file that checks the
first reads as though it checks both.

Two assertions were added **while the mutation stood**, and observed failing:

- `T997e` · `the mapping is total by construction > and \`destination\` is not nullable on the
  Classification itself` — failed
- `T997u` · `FR-DFR-077 · a classification cannot exist without its destination > and refuses
  a NULL destination outright` — failed

each with a control alongside it.

### Reverted

Type and migration restored from copies; `git diff --stat` reported no change under
`backend/src` or `backend/prisma`. **49 passed** across both files.

---

## 5. Constitution XI Tier 1 — the Room unreachable

**Recorded**: 2026-08-31 · **Task**: `T999n` (b) · **Epic Exit Criterion**

This is the defect class the repository has now recorded **seven times** (`DEF-005-001`,
`T1178`, and four found at once by `EPIC-034`'s convergence pass): built, tested, and
reachable from nowhere. Every unit test passes throughout.

### The mutation

`DefectRoomModule` removed from the `imports` array in `backend/src/app.module.ts`. The import
statement left in place, so nothing about the file looks obviously wrong — which is how this
happens in practice.

### Observed

`T997v` failed — **5 of 7**:

- `registers DefectRoomModule in the composition root`
- `resolves DefectRoomService from the graph the application actually builds`
- `declares its nine ports, eight refusing and one degrading`
- `and TestExecution is among the refusing eight`
- `the routing resolver is in the graph, with no destination bound`

The two that continued to pass are the ones asking whether the **workflow type** loads and
whether the sibling Rooms still load — which is the useful part of the split. The loop
contract does not know or care whether anything registered the module, so a Room can be a
valid workflow type and be absent from the running application at the same time. That is
precisely the state `DEF-005-001` was in.

### Reverted

`app.module.ts` restored from a copy; `git diff --stat` reported no change. **59 passed**
across the reachability and route specs.

---

## What the four proofs changed

Two of them found holes, and neither hole was in the code being protected:

| Proof | The guard held | The test did not |
|---|---|---|
| `FR-DFR-041` | yes — 5 tests failed | `T998i` cannot see a service bypass, by design |
| `FR-DFR-044` | configuration yes | `T998u` asserted nothing was **written**, not that nothing was **answered** |
| `FR-DFR-077` | — | neither test tried a **null**, only a wrong one |
| Tier 1 | yes — 5 tests failed | — |

Three assertions were added as a result, each written while its mutation stood and each
observed failing before the revert. That ordering is the whole value of the exercise: an
assertion added afterwards is a restatement of what the code already does, and
**a second recollection is not a second source**.
