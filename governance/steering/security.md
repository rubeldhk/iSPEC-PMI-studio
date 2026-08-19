---
subject: security
scope: repository
version: 1
status: active
owner: tech-lead
last_reviewed: 2026-08-07
supersedes: null
---

# Security

## Why this exists

This platform executes generated code in a container and holds customer requirements in a
multi-tenant database. The controls below are the ones whose relaxation would not be visible in any
test that was passing before — which is why they are written down rather than assumed.

## Standards

### SEC-001 · The sandbox holds one credential and no platform credentials

The container receives the AI provider credential. It does not receive a database URL, a session
secret, or any other platform credential.

**Check**: `engine-adapters/speckit/src/correlation.ts` — `buildSandboxEnvironment` returns exactly
`PMI_CORRELATION_ID` and `AI_PROVIDER_TOKEN`; its unit test asserts the exact key set, not a subset.
**Rationale**: [ADR-0002](../../adr/ADR-0002-container-sandbox.md). The sandbox runs code the
platform did not write. Anything mounted into it is available to that code.

### SEC-002 · Sandbox egress reaches the AI provider endpoint and nothing else

Network egress from the container is restricted to the provider endpoint.

**Check**: sandbox image and network policy under `engine-adapters/speckit/`, asserted at
integration level.
**Rationale**: Unrestricted egress turns the sandbox from a containment boundary into a staging
post. This is also why telemetry is not emitted from inside it — see
[`./architecture.md`](./architecture.md) `ARC-004`.

### SEC-003 · Secrets are absent from logs, metrics, errors and diagnostics

No credential reaches any observability sink.

**Check**: `pnpm test:unit` covers logger redaction. See
[`./coding-standards.md`](./coding-standards.md) `CS-006` for the code-level rule.
**Rationale**: A secret in a log is a secret in every system the logs are shipped to, with that
system's access controls and retention rather than the platform's.

### SEC-004 · Cross-tenant requests are answered as not-found

See [`./coding-standards.md`](./coding-standards.md) `CS-004`.

**Check**: `pnpm test:unit` covers `workspace.guard.ts`.
**Rationale**: Recorded here as well because it is a tenancy control, and someone auditing tenancy
should not have to know it was implemented as a coding standard.

### SEC-005 · The audit trail is append-only below the application

Enforced by database trigger. See [`./coding-standards.md`](./coding-standards.md) `CS-007`.

**Check**: migration under `backend/prisma/`, asserted by an integration test.
**Rationale**: The application is the component most likely to be compromised, so it is the wrong
place to enforce a control against tampering.

### SEC-006 · Every access refusal is recorded before the response is sent

A denied request produces an audit entry regardless of the status code returned.

**Check**: `pnpm test:unit` covers the audit interceptor.
**Rationale**: Refusals are the signal that matters in an incident. Recording them after the
response makes the record contingent on the request completing normally, which is exactly what an
attack does not do.

## Deliberately not covered here

- **The sandbox design and its alternatives** — [ADR-0002](../../adr/ADR-0002-container-sandbox.md).
- **Authentication and sign-in** — [EPIC-005](../../specs/005-identity-signin/).
- **Per-artifact access grants** — [EPIC-024](../../specs/024-artifact-access-control/).
- **RBAC, groups and SSO** — SRS Phase 3; deliberately out of current scope.
