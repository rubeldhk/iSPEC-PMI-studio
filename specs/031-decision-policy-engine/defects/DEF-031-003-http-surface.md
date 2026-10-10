# DEF-031-003 — the HTTP surface as built differs from the contract in three places

**Epic**: `EPIC-031` | **Raised**: 2026-10-08 | **Status**: CLOSED 2026-10-08
**Originating task**: `T744`, `T763` · **Severity**: MEDIUM

1. **`/decision-metrics`, not `/decisions/metrics`.** `EPIC-016`'s ADR store answers
   `GET /decisions/:id` and is registered first, so `metrics` was read as an ADR id and answered
   `404` (found by `decision-reachability.spec.ts`). The sub-path routes do not collide.
   **Recommendation**: move this engine under `/policy-decisions` — `/decisions/:id` meaning an ADR
   while `/decisions/:id/explanation` means a policy decision is a namespace shared by accident.
2. **`GET` / `POST /decision-policies`** — not in the contract. `FR-DPE-011` makes the burden tunable
   per tenant, and without a route it was tunable by nobody. A policy is validated by the same
   `loadPolicy` the enumeration test drives, versioned, and recorded with who issued it.
3. **`POST /decisions/:id/exceptions`** — not in the contract either; `FR-DPE-013`'s
   proceed-under-recorded-exception had no entry point.

All three are documented in `decision.controller.ts` and driven by the Tier 1 test.
