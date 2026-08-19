# DEF-026-004 — eight tasks reported unpaired, eight tests already existed

**Epic**: `EPIC-026` (owns `DOR-08`) · corrections land in **EPIC-001**, **EPIC-003**, **EPIC-028**
**Raised**: 2026-08-19 | **Status**: **CLOSED — FIXED 2026-08-19**
**Found by**: `T679` — running the narrowed `DOR-08` across all 28 Epics
**Severity**: MEDIUM — no Constitution V gap exists; the check reported eight that do not

## What was reported

After `T679` narrowed `DOR-08` to application code, five Epics still failed. Two are parent designs
carrying no tasks by design. The other three held **eight tasks** naming application code with no
recognised verification:

| Task | Names | Epic |
|---|---|---|
| `T004` | `worker/src/main.ts` | EPIC-001 |
| `T005` | `packages/engine-contract/src/index.ts` | EPIC-001 |
| `T462` | `backend/src/modules/engines/engines.module.ts` | EPIC-003 |
| `T463` | `backend/src/modules/engines/engine-registration.store.ts` | EPIC-003 |
| `T465` | `engine-adapters/fixture/src/fixture.adapter.ts` | EPIC-003 |
| `T587` | `agent-adapters/fixture/src/fixture.agent.ts` | EPIC-028 |
| `T668` | `execution-providers/docker/src/index.ts`, `scripts/v6-real-run.mjs` | EPIC-028 |
| `T670` | `execution-providers/docker/src/index.ts` | EPIC-028 |

## What is actually true

**Every one of the eight has a real test, and each was verified by reading it — not by trusting a
filename.**

| Task | Test | Verified how |
|---|---|---|
| `T004` | `worker/tests/unit/worker-bootstrap.spec.ts`, `observability-installation.spec.ts` | both reference `src/main` |
| `T005` | `packages/engine-contract/tests/unit/contract.spec.ts` | imports `../../src/index` |
| `T462` | `backend/tests/unit/engines/engines.module.spec.ts` | **its header reads "T462 — the engine layer is actually reachable"** |
| `T463` | `backend/tests/unit/engines/engine-registration.store.spec.ts` | imports the store |
| `T465` | `engine-adapters/fixture/tests/unit/fixture.spec.ts` | imports `../../src/fixture.adapter.js` |
| `T587` | `agent-adapters/fixture/tests/conformance.spec.ts` | **named in the task line itself** |
| `T668` | `socket-resolution.spec.ts`, `v6-entry-point.spec.mjs` | **named in the task line itself** |
| `T670` | `egress-network-preflight.spec.ts` | **named in the task line itself** |

**There is no Constitution V gap.** There are two record faults, and they are different from each
other.

### Fault 1 — the pairing is named by PATH, and the check demands an id

`T587`, `T668` and `T670` each name their test **in the task line**, as a file path:

```text
… (`DEF-028-007`, `DEF-028-008`; unit test: `execution-providers/docker/tests/unit/egress-network-preflight.spec.ts`)
```

`T679`'s `PAIRING` pattern requires a `Tnnn` reference, deliberately — *"check the output carefully"
is prose, not a pairing*. But a `.spec.ts` path is not prose either. **It is a stronger reference
than a task id**: it names the artifact rather than a number that has to be looked up.

### Fault 2 — the test knows the task, and the task does not know the test

`T004`, `T005`, `T462`, `T463` and `T465` cite nothing. Their tests exist and are correct;
`engines.module.spec.ts` is even *titled* after the task it verifies. The traceability runs one way
only, and `DOR-08` reads the other.

## Resolution

**Fault 1** — `PAIRING` accepts a `.spec.`/`.test.` file path as well as a `Tnnn` reference. Prose
still does not qualify, and a red test asserts that.

**Fault 2** — the five task lines gain a reference to the test that already verifies them. This is a
record correction with evidence, not an annotation added to satisfy a check: each test was read and
confirmed to exercise the file its task names before the citation was written.

**What was deliberately NOT done**: relaxing `DOR-08` until the eight disappeared. Seven of the eight
would have been silenced by dropping the application-code requirement, and the eighth by dropping the
pairing requirement — leaving a condition that reports nothing and a repository that looks compliant.

---

## Resolution — 2026-08-19 (`T681`)

**Fault 1**: `PAIRING_BY_PATH` accepts a `.spec.`/`.test.` path as a pairing. Prose still does not
qualify, and naming a second non-test file still fails — both asserted.

**Fault 2**: `T004`, `T005`, `T462`, `T463` and `T465` now cite the test that already verified them.
Each test was read first and confirmed to exercise the file its task names:

- `T004` — `worker-bootstrap.spec.ts` imports `../../src/worker-bootstrap.js`, **not** `main.ts`. A
  filename match would have been wrong. `observability-installation.spec.ts` and
  `worker-bootstrap.spec.ts` both reference `src/main`, which is why both are cited.
- `T462` — `engines.module.spec.ts` reads source rather than importing the module, and its header
  reads *"T462 — the engine layer is actually reachable from the application."*

**`DOR-08` now passes for 26 of 28 Epics.** The two that remain are EPIC-002 and EPIC-017, parent
designs carrying no tasks by design; their readiness is `n/a` and the verdict is unused.

**Recording this defect withdrew EPIC-026's readiness while it was open** — `DOR-11` reads
`defects/`, and an open record means not ready. The same thing happened with `DEF-026-002`. It is
`data-model.md` §4's *"evaluation is fresh, never stamped"* working: the register does not remember
that an Epic was ready, it asks again.