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
