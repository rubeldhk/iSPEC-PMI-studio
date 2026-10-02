# DEF-037-001 — the executions REST surface answered unauthenticated callers

**Epic**: `EPIC-037` (owns `backend/src/modules/executions/`) · affects the composed `AppModule`
**Raised**: 2026-08-27 | **Status**: **CLOSED — FAILED CLOSED 2026-08-27** (C3C closure, `T1038`)
**Found by**: the C3C closure instruction to classify the controller's security posture rather than
inspect its source. The controller's own header asserted the opposite of what it did, so reading it
confirmed the wrong answer
**Severity**: **HIGH** — a workspace's governed execution history was readable by anyone who could
reach the API, with no session and no workspace membership

## What it did

`ExecutionsModule` listed `ExecutionsController` in `controllers`, and `ExecutionsModule` is
registered in the production `AppModule`. The application's only authentication boundary is
`SessionContextMiddleware`, which stamps `workspaceId`/`userId` onto the request **when a session
cookie resolves** and otherwise stamps nothing — enforcement is each endpoint's decision. The
executions controller made no such decision: it never read `@Req()`, never called
`requireWorkspaceContext`, and took `workspaceId` from the URL or the request body.

Two distinct faults, and they are worth separating because only one of them leaked data.

### 1. Unauthenticated cross-workspace read (the leak)

`GET /v1/executions/:workspaceId/:id/history` passed the path parameter straight to the facade.
Nothing checked that the caller belonged to that workspace, or that there was a caller at all.

### 2. Caller-asserted identity on the write routes

`POST /v1/executions` bound the body to `RegisterExecutionRequest`, whose `identity` is
`ExecutionIdentityRefs` — `authenticatedPrincipalId`, `agentSnapshotId`, `connectorRegistrationId`,
`sponsorUserId`, `delegationId`, `delegationIdentityVersion`. Every one arrived as JSON.

The services do resolve the snapshot authoritatively against EPIC-028 and refuse when it does not
match `authenticatedPrincipalId`, the workspace, or the sponsor. That is a **consistency check
between fields of the same request**, not authentication of a caller. It constrains an attacker to
naming a coherent identity; it does not stop them naming someone else's.

This is the instructive part. Resolving a reference authoritatively feels like authentication, and
the controller's header said so in as many words:

> *"There is deliberately no route that accepts a principal as a claim"*

`ExecutionIdentityRefs` **was** the claim.

## Reproduction

Verified 2026-08-27 by booting the real `AppModule` against a Testcontainers PostgreSQL, seeding one
workspace, one execution and one event, and issuing HTTP with no cookie:

```
GET  /v1/executions/ws_victim/exec_secret/history
  -> 200 [{"eventId":"ev1","executionId":"exec_secret","sequence":1,
           "type":"registered","recordedAt":"...","replayed":false}]

POST /v1/executions   (body naming principal "p_i_say_so")
  -> 500   (reached the service; refused because the fabricated snapshot did
            not resolve — not because the caller was unauthenticated)
```

The `500` matters as much as the `200`: the write path was executing unauthenticated input and
failing on data validity, which means a caller who names a **real** snapshot gets further.

### What was and was not disclosed

The history projection returns `eventId`, `executionId`, `sequence`, `type`, `recordedAt` and
`replayed`. Event **payloads** were not in the response. So the disclosure is the existence,
ordering, type and timing of a workspace's governed executions — not their arguments or outputs.
That is still a cross-tenant disclosure, and sequence and timing are exactly what an audit trail
exists to protect.

## Why it was not caught earlier

`T1039` boots the composed application, which is why the module was known to be registered. But it
resolves `ExecutionRegistryFacade` with `app.get(...)` and drives it **in process** — it never issues
an HTTP request. No test in the repository referenced `ExecutionsController`. The C3C report said as
much ("no HTTP-level test") and still counted `T1038` complete, on the strength of reading the file.

## Fix

Failed closed rather than patched, because the missing piece is not in this Epic.

- `ExecutionsModule` now declares `controllers: []`, with the reason in the module header.
- The controller file is retained and its header rewritten to record what it actually did, so the
  next person to mount it reads the evidence first.
- `backend/tests/architecture/executions-unmounted.spec.ts` fails if the controller is listed again,
  and separately boots the application and asserts all six routes plus `PATCH` return `404` — with a
  control (`GET /v1/auth/me`) proving the 404s come from the router and not from a dead server.
- `T1038` is recorded as **BLOCKED**, not complete.

## Why not simply authenticate it

Three options were available and all are wrong here:

1. **Reuse `SessionContextMiddleware`.** It authenticates a *human* session cookie. These routes are
   for connectors; using it would mean representing an agent as a `User`, which EPIC-028 forbids and
   the C3C authorization forbids explicitly.
2. **Invent connector credentials.** Out of scope by instruction, and inventing an API-key scheme
   under closure pressure is how credential handling gets built badly.
3. **Leave it mounted and note the gap.** The instruction is explicit that security takes precedence
   over claiming all 44 tasks complete.

External REST activation belongs with the transport work that can authenticate a non-human
principal — EPIC-039, or the later parity slice of this Epic.

## Related

- [`DEF-001-006`](../../001-platform-foundation/defects/DEF-001-006-the-error-filter-swallows-every-framework-exception.md)
  — the `500` above is that filter's behaviour for a non-`PlatformError`; it is not a second fault.
- `T1060`–`T1079` — the unauthorized band that will carry REST/MCP/SDK parity.

## Annotation — 2026-09-04, `EPIC-043` `/speckit-plan` (`FR-PIC-061`)

**Closed by mounting, by the mechanism this record named.** *"A transport that authenticates a
non-human principal and mints the trusted context server-side"* now exists: `EPIC-041`'s
`ConnectorAuthGuard` resolves a project-scoped connector credential to a `connector` Principal and
puts a `ConnectorRequestContext` on the request. `EPIC-043` mounts `ExecutionsController` behind
that guard on every route, derives `identity`, `workspaceId`, `projectId`, `surface` and
`assurance` server-side, and refuses a body that carries any of them
(`specs/043-pmi-integration-contract/contracts/mounted-registry-api.md`).

The two faults, each with the test that now proves its absence:

1. **Unauthenticated cross-workspace read** — the `:workspaceId` path segment is gone; the
   workspace is the credential's. `backend/tests/integration/mounted-registry.spec.ts` presents an
   absent, malformed, revoked and other-project credential to every route and receives one `401`.
2. **Caller-asserted identity** — `identity` in the body is `400 identity_not_accepted`;
   `connector-identity.ts` builds `ExecutionIdentityRefs` from the credential's snapshot,
   registration and delegation (`data-model.md` §5).

`backend/tests/architecture/executions-unmounted.spec.ts` is **replaced** by
`executions-mounted.spec.ts` (`R-043-10`): static — every handler carries the guard and a
registered scope; live — every route answers an absent credential with the one `401`. `T1038`'s
posture moves from **BLOCKED** to **delivered by `EPIC-043`** when that Epic closes; until then
this annotation records the plan, not the fact.

## Delivered — 2026-09-04, `EPIC-043` `/speckit-implement` (`T1461`)

The annotation above is now a fact, not a plan. `ExecutionsController` is mounted in
`backend/src/modules/executions/executions.module.ts` behind `ConnectorAuthGuard` on every route;
`backend/tests/architecture/executions-mounted.spec.ts` holds it there (static: guard and a registered
scope on every handler; live: the composed application answers an absent credential with the one
`401` on all eight routes), and was observed red by removing the guard (`SC-PIC-009`).
`backend/tests/integration/mounted-registry.spec.ts` presents absent, malformed, unknown and
other-project credentials to every route and receives byte-identical refusals with nothing performed;
`identity` in a body is `400 identity_not_accepted`. `T1038`'s posture: **delivered by `EPIC-043`**.
