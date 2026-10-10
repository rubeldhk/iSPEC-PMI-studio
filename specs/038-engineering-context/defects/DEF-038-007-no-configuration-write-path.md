# DEF-038-007 — source classes, budget policies and reusable authorisations have no write path

**Epic**: `EPIC-038` | **Raised**: 2026-10-08 | **Status**: DEFERRED to `EPIC-024` (administration roles)
**Originating task**: `T1844` (convergence finding against `FR-CTX-034`, `FR-CTX-036`, `FR-CTX-051`) · **Severity**: MEDIUM

## Finding

Three kinds of configuration govern assembly, and the running application can read all three and
write none of them:

| Table | What its absence does in a deployment |
|---|---|
| `context_source_classes` | Every candidate is excluded as `classification` (`FR-CTX-034`), and `reindex` refuses every source |
| `context_budget_policies` | Every assembly refuses with `400` naming `FR-CTX-036` |
| `context_reusable_authorisations` | No source can ever cross a workspace or project boundary (`FR-CTX-051`) |

Only the in-memory test seams (`addSourceClass`, `addBudgetPolicy`, `addAuthorisation`) write
them. The contract lists `GET /context/sources` and no write route.

## Decision (T1844)

**No write routes now.** All three are decisions a person must be *entitled* to make — an
authorisation in particular lets one workspace's material into another's packages, which is the
one failure in this Epic that cannot be walked back. The platform has no roles and no
administration model (`DEF-038-005`): a write route today would let any member of a workspace
classify sources, set budgets, or authorise a crossing. Shipping that would trade a configuration
gap for a privilege-escalation path.

Until the owner of administration roles exists, the configuration is supplied the way the tests
and the quickstart already supply it — by an operator, in SQL, against the three tables above,
whose CHECK constraints and foreign keys refuse malformed rows independently of any route.

## Why deferred

When `EPIC-024` (or the Epic that introduces administration roles) can answer *"may this actor
configure context for this workspace"*, three routes behind that check close this record:
`PUT /context/sources/:sourceType`, `PUT /context/budget-policy`, and
`POST /context/authorisations` — the last restricted to the **owning** workspace's administrators,
since the grant is theirs to give.
