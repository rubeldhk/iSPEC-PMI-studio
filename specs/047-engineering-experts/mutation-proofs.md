# EPIC-047 — Mutation proofs

Each entry records a mutation **applied** to the source, the tests **observed failing**, and the
revert — written at the moment of observation, as `EPIC-035` established. The two proofs here are
the ones the Epic Exit Criteria require (`T1983`).

The original file was copied aside before each mutation and restored from that copy afterwards;
`cmp` reported the restored file identical to the copy.

---

## 1. `SC-EXP-003` — no run executes outside its contract

**Recorded**: 2026-10-09 · **Task**: `T1983` · **Requirements**: `FR-EXP-012`, `FR-EXP-013`

### The mutation

`backend/src/modules/experts/dispatch.service.ts` — the dispatch contract check made unable to
fire, keeping its shape:

```diff
-      if (byContract) throw new Refusal(byContract);
+      if (byContract && false) throw new Refusal(byContract);
```

### Observed

`npx vitest run --project backend-unit backend/tests/unit/expert-` — **2 failed | 145 passed (147)**:

- `T1935 · registration order and recorded refusals > a refusal is a dispatch-refused event on a
  registered execution, and the error carries its id` — failed (a tool outside the contract ran)
- `T1949 · authority across a chain > a delegate allowed more than its parent is refused what
  only it allows, and the session stores the intersection` — failed

`T1929`'s tests of `contractRefusal` itself kept passing, as they should: they test the function,
and the mutation removed its **caller**. That is why this proof is needed at all — a guard can be
correct and unused.

### Reverted

Restored from the copy; the suite returned to **147 passed**.

---

## 2. `SC-EXP-004` — delegation never widens authority

**Recorded**: 2026-10-09 · **Task**: `T1983` · **Requirement**: `FR-EXP-034`

### The mutation

`backend/src/modules/experts/dispatch.service.ts` — a delegate given its **own** contract's
authority instead of the intersection with its chain:

```diff
-        authority = admitted.authority;
+        authority = authorityOf(contract);
```

### Observed

`npx vitest run --project backend-unit backend/tests/unit/expert-` — **1 failed | 146 passed (147)**:

- `T1949 · authority across a chain > a delegate allowed more than its parent is refused what
  only it allows, and the session stores the intersection` — failed: the delegate ran `shell`,
  which only its own contract allowed.

One test catching it is enough to prove the binding, and is also a finding: the unit tests of
`intersect` cannot see this mutation, because it bypasses `intersect` entirely. `T1957`'s route
test Q11 asserts the same behaviour end to end and is the second guard.

### Reverted

Restored from the copy; the suite returned to **147 passed**.

---

## 3. Phase 9 — the three ports are bound as composed (`T1978`, `T1980`, `T1982`)

Recorded 2026-10-10. Not one of the two the Exit Criteria require; it proves the Constitution XI
Tier 1 claim that the adapters are wired into the composed application, not only unit-tested.

### The mutation

`backend/src/modules/experts/experts.module.ts` — the three Phase 9 adapters removed from the
`EXPERT_PORTS` factory, so every port falls back to `refusingPorts()`:

```diff
-        approvals: decisionApprovals(engine, decisions),
-        evidence: catalogEvidence(catalog),
-        context: assemblyContext(assembly),
+        // MUTATION: Phase 9 binding removed
```

### Observed

`vitest run --project backend-integration tests/integration/experts-reachability.spec.ts` —
**3 failed | 4 passed (7)**: each of the three `Phase 9 · T1978, T1980, T1982` cases failed, the
evidence case because the port threw `EvidenceContracts is not bound`, the approvals and context
cases because the refusal named the unbound port instead of `EPIC-031`'s or `EPIC-038`'s own.

### Reverted

Restored from the copy; the suite returned to **7 passed**.
