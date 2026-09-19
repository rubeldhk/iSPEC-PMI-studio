# Quickstart — EPIC-043 PMI Integration Contract

**Session**: 2026-09-04 · **Plan**: [plan.md](./plan.md)

Twelve scenarios. Each names the stack it runs on (README §Setup: **reference local** or
**containerised**) and the test that automates it. Nothing here is implementation; it is what a
person or a test does to see the Epic hold.

## Prerequisites

- A provisioned project with a credential copied once (`EPIC-041` quickstart, Scenario 1).
- `PMI_STUDIO_TOKEN` set in the shell that starts the agent (never in a file).
- For the reference-local stack, the checkout override so the server runs from source:

```bash
export PMI_MCP_SERVER_COMMAND="node ./packages/mcp-server/dist/main.js"
```

## Scenarios

| # | Scenario | Stack | Automated by |
|---|---|---|---|
| 1 | `tools/list` names exactly the contract's tools, each with a schema | any (in-memory transport) | `packages/mcp-server/tests/server.spec.ts`, `backend/tests/contract/mcp-tool-surface.spec.ts` |
| 2 | `pmi.health` answers project id, contract and API versions; the project screen shows the workstation as connected | reference local | `backend/tests/integration/connector-reads.spec.ts`, `frontend/tests/unit/pages/project-executions.spec.tsx` |
| 3 | register → appendEvent → complete over MCP; the execution is on the timeline with surface `mcp-client`, assurance `local`, the proposal pending | reference local | `backend/tests/integration/execution-parity.spec.ts`, `e2e/tests/epic-043-m1.spec.ts` |
| 4 | the same sequence over REST with the credential; surface `local-cli`; identical history | reference local | `execution-parity.spec.ts` |
| 5 | no credential, a malformed one, a revoked one, another project's — one identical refusal on every tool and every route; nothing performed | any | `mounted-registry.spec.ts`, `packages/mcp-server/tests/refusals.spec.ts` |
| 6 | a body carrying `identity`, `surface` or `assurance` is refused by field name | any | `mounted-registry.spec.ts` |
| 7 | revoke in PMI Studio; the very next tool call is refused | reference local | `mounted-registry.spec.ts` |
| 8 | replay `register` with the same key: the original; with a different payload or credential: a conflict, no sequence consumed | any | `execution-parity.spec.ts` |
| 9 | `pmi.project.context` and `pmi.requirements.list` return this project only, requirements under `unassigned`, `epicSource` stated | any | `connector-reads.spec.ts` |
| 10 | a reserved tool refuses `not_available_until` naming its Epic, after validating its arguments | any | `server.spec.ts` |
| 11 | the fixture connector conformance suite passes against the MCP server through a real client | any | `packages/mcp-server/tests/conformance.spec.ts` (`SC-PIC-001`) |
| 12 | **`M1`**: create project → credential → agent starts `pmi-studio` from `.mcp.json` → governed command → execution on the timeline within 5 s | reference local | `e2e/tests/epic-043-m1.spec.ts` (`SC-PIC-005`, Tier 2 transcript) |

## Running the checks

```bash
pnpm test:unit             # includes the new mcp-server project
pnpm test:contract         # the tool surface against the running server
pnpm test:integration      # mounted routes, parity, reads, timeline (Docker)
pnpm test:arch             # executions-mounted, mcp-server-boundary, connector-boundary
pnpm --filter e2e test -- epic-043-m1
```

## Mutation observations owed at closure

- **`SC-PIC-003`**: make a refusal echo the presented credential; `refusals.spec.ts` and the
  sanitiser test fail.
- **`SC-PIC-004`**: remove the project-scope check from the guard; `mounted-registry.spec.ts`
  Scenario 5 fails.
- **`SC-PIC-009`**: remove `@UseGuards` from one route; both halves of `executions-mounted.spec.ts`
  fail.

## Results


### Recorded 2026-09-04 (`T1455`)

| Measurement | Bound | Measured | Stack / method |
|---|---|---|---|
| Timeline latency after the completion call (`SC-PIC-005`) | < 5 s | **118 ms** | in-process against the composed `AppModule` (`execution-parity.spec.ts`), Windows 11, Node 22.13 |
| Credential verification per call (`FR-PIC-023`) | < 1 ms | **0.024 ms** p95 | `EPIC-041` `T1382` measurement, unchanged code path |
| Fixture conformance suite against the MCP server (`SC-PIC-001`) | 100 % | **5 of 5** pass | `packages/mcp-server/tests/conformance.spec.ts`, expectations unchanged |
| Parity across the four surfaces (`SC-PIC-002`) | zero differences | **zero** | `execution-parity.spec.ts`: command, lifecycle, governance agree; only surface and assurance differ |

| Scenario | Result |
|---|---|
| 1 tools/list equals the contract | ✅ `server.spec.ts`, `mcp-tool-surface.spec.ts` (14 tools) |
| 2 health and the connection record | ✅ `connector-reads.spec.ts`, `project-provisioning.spec.tsx` |
| 3 register → appendEvent → complete over MCP, on the timeline | ✅ `execution-parity.spec.ts` |
| 4 the same over REST, surface `local-cli` | ✅ `execution-parity.spec.ts` |
| 5 four bad credentials, one refusal, nothing performed | ✅ `mounted-registry.spec.ts`, `refusals.spec.ts` |
| 6 body identity / surface / assurance refused by field | ✅ `mounted-registry.spec.ts`, `executions.controller.spec.ts` |
| 7 revocation effective on the next call | ✅ `mounted-registry.spec.ts` |
| 8 replay returns the original; conflicts refused | ✅ `execution-replay.spec.ts` |
| 9 context and requirements, this project only | ✅ `connector-reads.spec.ts` |
| 10 reserved tools validate, then refuse by Epic | ✅ `server.spec.ts`, `connector-reads.spec.ts` |
| 11 fixture conformance through a real client | ✅ `conformance.spec.ts` |
| 12 **M1** end to end on a running stack | ⏳ `e2e/tests/epic-043-m1.spec.ts` written; the transcript is `T1458`'s (no stack was brought up in the implementing session) |
