# DEF-032-002 — the HTTP surface as built differs from contracts/evidence-contract.md §5 in two places

**Epic**: `EPIC-032` | **Raised**: 2026-10-07 | **Status**: CLOSED 2026-10-07
**Originating task**: `T857g` · **Severity**: MEDIUM

## Expected

§5 lists five routes, and `403` *"when the attested artifact's access rules refuse the read"*.

## Actual, and why

1. **A sixth route, `POST /evidence/bindings`.** The contract names the binding (data-model §4) and
   `FR-EVS-021` requires it at work creation, but no route creates one — leaving the requirement
   reachable from no real entry point, which Constitution XI Tier 1 forbids.
2. **`404`, not `403`.** `backend/src/core/errors.ts` states the platform rule: *"a resource in
   another workspace must be indistinguishable from one that does not exist, because 403 confirms
   existence"*, and reserves `ForbiddenError` for one documented `EPIC-023` case — *"Never use this
   for artifact visibility; that stays 404."* Evidence about an unreadable specification is artifact
   visibility. The platform rule wins over the Epic's contract.

## Resolution

Both are recorded in the controller's header and asserted by `evidence-reachability.spec.ts` and
`evidence-access.spec.ts`; §5 of the contract is annotated with this record.
