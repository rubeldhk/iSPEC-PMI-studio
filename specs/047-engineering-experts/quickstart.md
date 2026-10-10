# Quickstart: validating Engineering Experts

**Epic**: `EPIC-047` · **Contract**: [contracts/experts-api.md](./contracts/experts-api.md) ·
**Model**: [data-model.md](./data-model.md)

## Prerequisites

- Docker running (Testcontainers PostgreSQL 16), `pnpm install` at the repository root.
- For scenarios marked **(after merge)**: `EPIC-031`, `EPIC-032` and `EPIC-038` merged to `main`
  and their adapter phase complete (`research.md` `R-047-13`). Before that, those scenarios must
  produce the documented `503` — which is itself a scenario.

## Run

```bash
pnpm --filter backend vitest run tests/unit/expert-
```

```bash
pnpm --filter backend vitest run tests/integration/expert- --no-file-parallelism
```

## Scenarios

| # | Scenario | Expected |
|---|---|---|
| Q1 | Register an Expert omitting three contract elements | `400` naming all three |
| Q2 | Register with `memoryPolicy: "session"`; then with `memoryPolicy: "governed-knowledge"` | `session`: `400` naming Governed Learning; `governed-knowledge`: `201`, a draft that can be submitted and approved like any other (`FR-EXP-020`, amended by `A-047-1`) |
| Q3 | Submit a version while `ContractApprovals` is unbound | `503` naming the port; version stays `draft` |
| Q4 | **(after merge)** Submit, approve in the Decision Inbox, read the Expert | Version `approved`, effective |
| Q5 | Dispatch with a tool outside the contract | `400`; a `dispatch-refused` event on a registered execution |
| Q6 | Dispatch touching a prohibited action that is also allowed | `400` — prohibition wins |
| Q7 | Dispatch when the preferred model has no gateway, a fallback does | `201`, `usedFallback: true` with reason |
| Q8 | Dispatch with a token limit on a gateway that cannot enforce it (default posture) | `400` — unenforceable under `refuse` |
| Q9 | Same, contract posture `proceed` | `201`; limit row `unenforceable`, never `enforced` |
| Q10 | Run reaches its time limit | Outcome `stopped-by-limit`; limit `reached: stopped` |
| Q11 | Delegate A → B where B allows more than A | B's effective authority = A ∩ B |
| Q12 | Delegate A → B → A | `400` cyclic; `delegation-refused` on B's session |
| Q13 | Read the tree of a depth-2 delegation | Root, children, grandchildren, each with its own version |
| Q14 | Assign a task to an Expert lacking a capability | `400` naming it |
| Q15 | Assign a `high` task where `maxUnattendedBand` is `medium` | `state: pending-decision` with a `decisionId`; nothing runs |
| Q16 | Reassign Expert → person | Both rows in history; the first superseded |
| Q17 | Open `/experts` at 360px | Contract, status and delegation readable; no authoring controls |

Q5–Q13 at the **real HTTP routes against the composed module** satisfy Constitution XI Tier 1;
Q17 plus Q1, Q5 and Q13 against a running stack form the Tier 2 transcript.
