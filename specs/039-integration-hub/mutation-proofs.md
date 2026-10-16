# EPIC-039 — Mutation proofs

**Session**: 2026-10-10 · `/speckit-implement` (`T2228`, `T2229`)

A check that has never been seen to fail is a check nobody has tested. Each entry below applies a
mutation to production source by hand, from a copy, records the tests that failed while it stood,
reverts it from the copy, and re-runs the check green. Recorded at the moment of observation, on the
`specs/034-change-room/mutation-proofs.md` template. No mutation tooling is committed.

---

## `T2228` — `SC-HUB-001` / `FR-HUB-061`

*"Platform business-rule modules MUST NOT name a provider or depend on an adapter. An automated
boundary check MUST enforce this and fail naming any offending module."*

Check: `backend/tests/architecture/capability-independence.spec.ts`, run alone with
`npx vitest run --project architecture tests/architecture/capability-independence.spec.ts`.

### Mutation (a) — a provider named in a core module

**Applied** to `backend/src/modules/integrations/resolver/resolver.service.ts`, line 34:

```ts
const PROVIDER = 'github';
void PROVIDER;
```

**Observed failing** (1 failed | 11 passed):

- `T2152 · rule 1 — no provider names outside the adapters (FR-HUB-061) > backend/src names no
  provider (the composition file excepted)` — offender reported as
  `backend/src/modules/integrations/resolver/resolver.service.ts:34: const PROVIDER = 'github';`
  (file **and line**).

**Reverted** from the copy: 12 passed.

### Mutation (b) — an adapter imported by a business-rule module

**Applied** to `backend/src/modules/loop/loop.service.ts`, line 36:

```ts
import '@pmi/capability-adapter-github';
```

**Observed failing** (2 failed | 10 passed):

- `T2152 · rule 1 — no provider names outside the adapters (FR-HUB-061) > backend/src names no
  provider (the composition file excepted)` —
  `backend/src/modules/loop/loop.service.ts:36: import '@pmi/capability-adapter-github';`
- `T2152 · rule 2 — no adapter import outside the composition file > backend/src imports no
  @pmi/capability-adapter-* (statically or dynamically)` — the same file and line.

**Reverted** from the copy (`git status --short backend/src` empty): 12 passed.

### The caller-level half

`backend/tests/integration/integrations-caller-suite.spec.ts` runs one suite twice against
`AppModule` — fixture adapters, then `github-rest` over recorded responses — and the second run
differs from the first only by `PUT …/configuration/:capability` (plus the credential the real
provider needs). No file under `backend/src/modules` changes between the runs: they are two `it`
blocks in one process, against one build. Observed: 4 passed.

---

## `T2229` — `SC-HUB-004` / `FR-HUB-043`

*"Zero credential values are recoverable through any read, screen, export, error, log, execution
event, agent or connector — mutation-tested by returning the stored value from the configuration
read and observing the suite fail."*

Check: `backend/tests/integration/integrations-credential-canary.spec.ts`, run alone against
PostgreSQL (Testcontainers).

**Applied** to `backend/src/modules/integrations/credentials/credential.service.ts` → `status()`:
each configured entry's status opened the vault and returned `value` — the decrypted credential —
beside `state`, `kind`, `setBy` and `setAt`.

**Observed failing** (1 failed | 8 passed):

- `T2181 · SC-HUB-004 — the canary appears nowhere > searched raw, base64 and URL-encoded across
  everything collected` — the hit was the response of
  `GET /v1/projects/:id/integrations/credentials`.

The unit suite failed too (1 failed | 6 passed in `backend/tests/unit/integrations-credentials.spec.ts`):
`T2177 · set, replace, remove > status returns { entryId, state, kind, setBy, setAt } and nothing
else`.

**Reverted** from the copy (`git status --short backend/src` empty): canary suite 9 passed; unit
suite 7 passed.
