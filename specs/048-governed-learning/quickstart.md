# Quickstart: validating Governed Learning

**Epic**: `EPIC-048` · **API**: [contracts/learning-api.md](./contracts/learning-api.md) ·
**Package**: [contracts/learning-contract.md](./contracts/learning-contract.md) ·
**Model**: [data-model.md](./data-model.md)

## Prerequisites

- Docker running (Testcontainers PostgreSQL 16), `pnpm install` at the repository root.
- For scenarios marked **(after merge)**: `EPIC-032`, `EPIC-031` (with `A-031-1`), `EPIC-038` (with
  `A-038-1`) and `EPIC-047` (with `A-047-1`, `A-047-2`) merged to `main`, in that order, and this
  Epic's adapter phase complete (`research.md` `R-048-20`, `R-048-21`). Before that, those scenarios
  must produce the documented `503` or `proposed` — which is itself a scenario (Q3).
- A workspace with a `learning_policy` steering document declaring categories `test-setup`
  (`lowRisk: true`) and `architecture` (`lowRisk: false`). A tenant policy (`EPIC-031`
  `POST /decision-policies`) whose `automatedActions` covers `learning.*` with rule
  `learning.candidate-submitted` — **for every path**, not only the automatic one: every decision this
  Epic requests is automated, and without that entry `EPIC-031` refuses it (`FR-DPE-030`; found by
  `T2402`). For the automatic path (Q9) additionally: an `EPIC-031` classification rule
  `learning.approve.test-setup → low` (steering subject `risk-classification`).
- **Classify learning actions `low` or `high`, never `medium`**: `EPIC-031` refuses a medium-band
  request that names no gates, and this Epic names none (`R-048-12`).

## Run

```bash
pnpm --filter backend vitest run tests/unit/learning-
pnpm --filter backend vitest run tests/integration/learning- --no-file-parallelism
pnpm vitest run --project architecture tests/architecture/learning-
pnpm vitest run --project learning-contract
pnpm vitest run --project frontend tests/unit/pages/LearningCandidateDetail tests/unit/pages/KnowledgeBrowser
```

Never the whole-repository suite for this Epic's checks; the scoped projects above are the gate.

## Scenarios

| # | Scenario | Expected |
|---|---|---|
| Q1 | Submit with no evidence, no confidence and no scope | `400` naming all three; `refused` event on the execution |
| Q2 | Submit naming an execution that is not registered | `400`; nothing stored |
| Q3 | Submit while `EvidenceReads` is unbound | `503` naming the port; nothing stored |
| Q4 | Submit a statement containing a GitHub token | `400` naming rule `github-token` and the field; no row anywhere (`FR-LRN-018`) |
| Q5 | Retry Q6's request with the same `idempotencyKey` | `200`, the same `candidateId`; one row (`FR-LRN-061`) |
| Q6 | **(after merge)** Submit a complete candidate in `architecture` | `201`, `pending-review`; `submitted` event; an Inbox entry for every human except the submitter |
| Q7 | Assemble context for the same project while Q6 is pending | No `knowledge-entry` item; the candidate is not a source at all (`FR-LRN-002`) |
| Q8 | Submit the same subject from a second execution | `200` corroboration; still one candidate (`FR-LRN-017`) |
| Q9 | **(after merge)** Submit in `test-setup`, project scope, verified evidence | `auto-executed`; entry version `approvedByKind: policy`; `approval/v1` attestation; explanation names the rule (`FR-LRN-022`, `-024`, `-025`) |
| Q10 | Same as Q9 with `claimedScope: workspace` | `pending-review`; eligibility names `scope` (US3-6) |
| Q11 | Same as Q9 with no `learning_policy` low-risk flag but the 031 rule still `low` | `pending-review`; eligibility names `category not declared low-risk` (`MP-2`) |
| Q12 | Q9 with no classification rule (the tenant policy above in place) | `pending-review` (unclassified ⇒ `high`); `SC-LRN-008`. *With no tenant policy at all*, `EPIC-031` refuses every automated learning request (`FR-DPE-030`): the candidate stays `proposed`, reason `decision-refused-by-policy` — never approved either way (Tier 1 `T2402`, Q12a) |
| Q13 | Approve Q6 through the review route as the submitting **agent's** principal | `403`; audited; decision still pending (`FR-LRN-027`) |
| Q14 | Approve Q6 through `EPIC-031`'s own `POST /decisions/:id/approve` from a session whose user id is an agent principal | 031 records it `human`; the `learning.resolve-decisions` job **does not accept** it; no entry; flag `decision-not-accepted` (`MP-3`) |
| Q15 | Approve Q6 as another human, narrowing scope and editing the statement | Entry v1 holds both forms (`FR-LRN-028`); retrievability `not-yet-retrievable` naming the unbound embedding port (`FR-LRN-053`) |
| Q16 | Approve with a scope wider than claimed | `400` |
| Q17 | Reject a pending candidate with a reason | `rejected`; candidate and reason readable; nothing deleted (`FR-LRN-029`) |
| Q18 | Let a candidate pass the review window | `expired`, not `rejected`; gone from the Inbox (`A-031-1`) |
| Q19 | Submit `kind: supersede` for Q15's entry in a low-risk category | `pending-review` regardless (`FR-LRN-034`); after approval v1 reads `superseded` naming v2 |
| Q20 | Inspect a package assembled before Q19 | Shows v1 as supplied, with a drift note (`FR-LRN-054`) |
| Q21 | Assemble for another project in the workspace (Q15 entry, project scope) | Exclusion `boundary`, detail `scope: …` (`FR-LRN-041`, `-045`) |
| Q22 | Widen Q15's entry to workspace scope through `kind: widen-scope`; assemble in another project whose permitted classifications include it | Included, marked *approved knowledge* with entry, version and scope (US5-2) |
| Q23 | Same, with a classification the receiving project does not permit | Exclusion `classification` (US5-3) |
| Q24 | Assemble in another workspace | The entry never reaches it: it is indexed in its own workspace's partition only, so the other workspace's retrieval cannot return it (the admission's `boundary`/`workspace: …` verdict is the second fence, unit-tested); inserting a `context_reusable_authorisations` row for a `knowledge-entry` fails the CHECK (`FR-LRN-043`) |
| Q25 | Submit from an Expert whose contract version declares `none` | `400`; `memory-policy-refused` event; that Expert's packages contain no knowledge (`SC-LRN-009`) |
| Q26 | Submit from a provisional (offline) execution | `proposed`; no decision requested until reconciliation (`FR-LRN-063`) |
| Q27 | `INSERT` a `knowledge_entry_versions` row whose decision is `pending` | Trigger refuses; `UPDATE` of any version refused by `reject_mutation` (`FR-LRN-031`) |
| Q28 | Open `/decisions` at 360px with a superseding candidate | Statement, status, provenance and scope readable; current and proposed side by side (`FR-LRN-072`, `-075`) |
| Q29 | Open `/context/knowledge`, filter by status `superseded`, open history | Every version, candidate and decision in order (`FR-LRN-035`, `-073`) |

**Constitution XI.** **Tier 1**: Q1–Q27 drive the real entry points — the HTTP routes, the connector
route through `ConnectorAuthGuard`, and the jobs through the job runner — against the composed
`AppModule`, with unmerged ports bound by visible in-test recorders where a scenario needs them.
**Tier 2**: Q6, Q15, Q19, Q28 and Q29 against a running stack, as one Playwright spec
(`e2e/tests/epic-048-learning.spec.ts`) whose run writes `docs/uat/EPIC-048-transcript.md`.
