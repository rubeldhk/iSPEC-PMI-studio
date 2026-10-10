# EPIC-048 — example policy documents (`RK-9`)

Governed learning is **safe by default**: with none of these documents, every candidate waits for a
person (`SC-LRN-008`). Opting a category into automatic approval takes **three** recorded
declarations, each a versioned document with an actor and an instant (`R-048-12`):

| File | Owner | Steering subject / where | What it declares |
|---|---|---|---|
| `learning-policy.example.json` | `EPIC-048` | steering, subject `learning_policy`, workspace scope | categories, which are explicitly low-risk, reuse, the three settings |
| `epic-031-classification-rule.example.json` | `EPIC-031` | steering, subject `risk-classification` | `learning.approve.test-setup` is **low**; `learning.review.*` stays **high** |
| `epic-031-tenant-policy.example.json` | `EPIC-031` | the tenant policy | `low` auto-executes, and the intake automation may act on `learning.*` under rule `learning.candidate-submitted` |

Two hazards the examples avoid, and `T2412` checks:
- **Never classify `learning.review.*` low** (`RK-5`): an auto-executed review is refused by this
  Epic's approver guard and the candidate waits for a human whom `EPIC-031` can no longer route.
- **Never classify a learning action medium** (`RK-11`): `EPIC-031` refuses a medium-band request that
  names no gates, and this Epic names none.

Checked by `backend/tests/architecture/learning-steering-example.spec.ts` against
`learning-policy.ts` and the decision requester's own constants.
