# Contract: Controlled-Local Execution Mode and Assurance

**Epic**: `EPIC-041` · **Feeds**: [plan.md](../plan.md) · **Decisions**: `R-041-4`, `R-041-5` ·
**Amends**: `ADR-0009`, `ADR-0024` · **Records**: `ADR-0030`

Two packages change. Neither gains a runtime component; both gain a word the platform can now say
truthfully.

---

## `@pmi/execution-contract`

```ts
/** Where an execution environment lives, and therefore which governance assurance it can offer. */
export type ExecutionEnvironmentKind = 'managed-isolated' | 'controlled-local';

export interface ExecutionEnvironmentDescriptor {
  readonly provider: string;
  readonly kind: ExecutionEnvironmentKind;           // NEW — required
  readonly supportedLifecycles: readonly ExecutionLifecycle[];
  readonly supportsPersistentState: boolean;
  readonly supportsNetworkPolicy: boolean;
  readonly maxWallClockMs: number;
}
```

Rules:

1. A `controlled-local` environment binds a **`persistent`** workspace whose `projectRef` is the
   project id and whose `branch` is the directory's current branch. The existing arm is used; no
   new arm is added (`FR-LPW-030`).
2. The Docker provider declares `kind: 'managed-isolated'`, keeps `supportedLifecycles: ['ephemeral']`,
   and keeps refusing a persistent binding with `policy_refused`. **That refusal is the provider's,
   not the contract's** (`FR-LPW-033`), and the conformance suite for providers asserts it only for
   providers declaring `managed-isolated`.
3. **No provider of kind `controlled-local` is delivered by this Epic.** In local mode the platform
   does not start the agent; the descriptor exists so that a registration from a local surface can
   name the environment it ran in. A future provider (customer cloud, `BR-0131`) adds a kind here.
4. `controlled-local` is the **default** kind for a project with a `rootPath` (`FR-LPW-035`);
   `managed-isolated` remains selectable and unchanged.

---

## `@pmi/execution-registry-contract`

```ts
export type ExecutionAssurance = 'managed' | 'local';

/** Total over EXECUTION_SURFACES — adding a surface without a mapping fails to compile. */
export function assuranceFor(surface: ExecutionSurface): ExecutionAssurance;
```

| Surface | Assurance | Why |
|---|---|---|
| `managed-sandbox` | `managed` | disposable, allowlist egress, platform-held credential |
| `ci-cd` | `managed` | an environment the organisation controls, not a developer's machine |
| `local-cli` | `local` | the developer's machine |
| `mcp-client` | `local` | the developer's agent, on the developer's machine |
| `ide-extension` | `local` | as above |
| `fixture` | `local` unless the test declares otherwise | a fixture proves the contract, and should default to the weaker word |

Rules:

1. Assurance is **derived at registration** from the surface and written to `Execution.assurance`.
   A registration body carrying `assurance` is refused with `400` naming the field (`FR-LPW-034`).
2. Assurance is **recorded, never consulted by policy** in this Epic (`FR-LPW-031`, `BR-0133`). A
   later Epic may let tenant policy weigh it; nothing here does.
3. Every execution read back carries it, including the projections `EPIC-037` serves.
4. **Two values, not three.** Customer-cloud has no owner and no Epic; a value nothing produces is
   decoration (PMI-DOC-007 `D-9`).

---

## Migration note

`executions.assurance` is added nullable, back-filled by surface using the table above, then made
`NOT NULL`. No existing row is ambiguous: every execution to date came from `managed-sandbox` or
`fixture`.

---

## What `ADR-0024` said, and what changes

| Before | After this Epic |
|---|---|
| controlled local is `MAY`, opt-in per tenant | controlled local is the **default** for a project with a directory; managed isolated stays available |
| *"Open — how evidence assurance level is represented"* | closed: one field, two values, derived from surface |
| governance identical across modes | unchanged — and assurance is the honest label on the evidence, not a switch |

The amendment text is in `adr/ADR-0024-workspace-fabric-execution-modes.md` (§Amendment 2026-09-03)
and the inversion itself is `adr/ADR-0030-local-first-execution-and-integration-contract.md`.
