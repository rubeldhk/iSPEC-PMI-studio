# Phase 0 Research: Local Project Workspace

**Epic**: `EPIC-041` · **Session**: 2026-09-03 · **Feeds**: [plan.md](./plan.md)

The clarification of 2026-09-03 confirmed all five judgement calls the specification recorded.
Everything below designs *how* those confirmed decisions are carried out; nothing below re-opens
them. Twelve decisions. Where a decision depends on an external tool, the documentation consulted
through Context7 is named so `/speckit-implement` can query the same source.

**Context7 availability**: available in this session. Library IDs recorded per decision.

---

## R-041-1 — Provisioning is two steps in two processes, and the boundary between them is the engine boundary

**Decision**: provisioning has a **prepare** step and an **initialise** step.

- **Prepare** runs in the API process, synchronously with `POST /projects/:id/provision`. It
  creates the directory, initialises git where absent, writes `.pmi/project.json`, merges the
  `pmi-studio` entry into `.mcp.json`, and installs the `setup-PMIStudio` skill. It names no
  engine. On success the project is **prepared**.
- **Initialise** runs as a **worker job** (`kind: initialise_workspace`). It runs the Spec Kit
  initialiser for the chosen agent integration and installs the PMI Spec Kit extension. On success
  the project is **provisioned**. When no worker is available to take the job within a bound, the
  project is **initialisation pending**, and the setup skill completes it on the user's machine.

**Rationale**. `backend/tests/architecture/engine-independence.spec.ts` fails the build if any
file under `backend/src` so much as contains the string `speckit` (widened by `T142a` to string
identifiers). Running `specify init` from the API process is therefore impossible without breaking
the platform's central architectural claim (`ADR-0001`, `ADR-0007`). The worker is *"the ONLY
component that may hold a concrete engine"* (`generation.consumer.ts`), so that is where the
initialiser runs. The split also lands exactly on the clarified requirement: the containerised
stack runs **no worker** (`docker-compose.yml` defines `postgres`, `valkey`, `app`; the entrypoint
starts only the API), so under it every project is *initialisation pending* until the setup skill
runs — which is what the requester chose, and the application image is not required to carry Spec
Kit.

**Alternatives considered**. *Run the initialiser from the API* — rejected: architecture test.
*Never initialise from the platform; the setup skill always does it* — rejected: the requester
chose to initialise where the platform can (question 3, option A over C). *A dedicated
`provision` process* — rejected: a fourth process for one job the worker's queue already carries.

**Docs consulted**: none needed for the split; the initialiser invocation is `R-041-8`.

---

## R-041-2 — The projects root is one configured directory, and paths are relative to it

**Decision**: configuration `PMI_PROJECTS_ROOT` names the directory the API writes under. The user
supplies a **directory name** (or a relative path with no `..` segment); the platform derives the
write path as `PMI_PROJECTS_ROOT/<relative>`. A second setting, `PMI_PROJECTS_ROOT_HOST`, names the
same directory **as the user's machine sees it**, and is what `Project.rootPath` stores and every
screen displays. In the reference-local stack the two are equal; in the containerised stack the
compose file binds `${PMI_PROJECTS_ROOT_HOST}` to `/projects` and sets the two variables
accordingly. An absolute path supplied by the user is accepted only if it resolves to a path under
`PMI_PROJECTS_ROOT_HOST`; anything else is refused naming the root (`FR-LPW-007`).

**Rationale**. The API in a container cannot write to an arbitrary host path and cannot know what a
host path *means*. Making the root the unit of trust keeps `FR-LPW-007`'s refusal decidable by
string comparison after normalisation, keeps the display path truthful on the user's machine
(`FR-LPW-051`), and keeps the mount a single line in `docker-compose.yml`. An unmounted root is
detected by the API at start (`PMI_PROJECTS_ROOT` must exist and be writable) and again per
request, so the refusal *projects root unavailable* precedes any write.

**Two more settings belong to the same decision** (added 2026-09-03, analysis `U2` and `I1`):
`PMI_PUBLIC_URL`, the address the API writes into `.pmi/project.json` and `.mcp.json` — a container
cannot infer what the user's machine calls it, so the operator states it, default
`http://localhost:${PMI_APP_PORT:-3000}`; and `PMI_INITIALISE_WAIT_MS` (default `30000`), the bound
after which a prepared project whose initialise job nobody has claimed reads *initialisation
pending*. Both are in `.env.example` and asserted by `T1310`.

**Alternatives considered**. *Arbitrary absolute host paths* — rejected: not writable from the
container, and "outside the root" becomes undecidable. *A root per workspace* — deferred: one root
suffices for a single-developer machine; per-workspace roots are a tenant-policy question.

**Docs consulted**: none needed. Bind mounts with `${VAR}` substitution are already used in this
compose file for ports.

---

## R-041-3 — The connector credential is a random token, stored as a SHA-256 digest, resolved to a non-human Principal

**Decision**: a credential is 32 bytes from the platform's CSPRNG, presented as
`pmi_ct_<base64url>`; the platform stores `sha256(token)` and a short lookup prefix, never the
value. Verification is a digest comparison in constant time. Each credential owns a `Principal` of
kind **`connector`** registered through `EPIC-028`'s `PrincipalRegistryService`, with the minting
owner as **sponsor**, so a `ConnectorAuthGuard` can produce a `TrustedPrincipalContext` the same
way a session does for a human. The principal's workspace and project scope are what `FR-LPW-025`
and `FR-LPW-026` check.

**Rationale**. Argon2 is the platform's *password* hash (`D-09`), and is deliberately slow; a
high-entropy random token needs no stretching and is verified on every MCP call, so a fast digest is
correct here. Binding the credential to a `Principal` reuses the identity model `D-46` settled
rather than inventing a second answer to *who is acting*, and it is what lets `EPIC-043` mount the
execution registry behind this guard without a new identity concept. `trusted-principal.ts` states
the design intent verbatim: *"this is not authentication. It is the thing authentication will later
produce."*

**Alternatives considered**. *Argon2* — rejected as above. *JWTs* — rejected: a self-describing
token cannot be revoked without a denylist, and `FR-LPW-023` makes revocation a stored fact.
*Principal kind `service`* — rejected: `ExecutionIdentityRefs` already distinguishes a connector
from an agent and a service; collapsing them is the failure `D-46` names.

**Docs consulted**: none needed (Node `crypto.randomBytes`, `createHash`, `timingSafeEqual`).

---

## R-041-4 — Controlled-local is a contract type change, not a new provider

**Decision**: `@pmi/execution-contract` gains `ExecutionEnvironmentKind = 'managed-isolated' |
'controlled-local'` and a `kind` on `ExecutionEnvironmentDescriptor`. The existing `persistent`
arm of `WorkspaceBinding` (`projectRef`, `mode`, `branch`) is the binding a controlled-local
environment uses; no new arm is added. **No local execution provider is built in this Epic**:
in local mode the platform does not run the agent, so there is nothing for a provider to start.
The Docker provider keeps `supportedLifecycles: ['ephemeral']` and its `policy_refused` for a
persistent binding — scoped, as `FR-LPW-033` requires, to that provider.

**Rationale**. The contract's stated purpose is to make dangerous state *unrepresentable*
(`ADR-0009`). A controlled-local environment is persistent **and named** (the project directory
and its git repository), so the existing persistent arm already represents it truthfully; what was
missing was a *kind* that says which governance assurance applies. Building a provider that starts
nothing would be a class that exists to satisfy a diagram.

**Alternatives considered**. *A `local` execution provider* — rejected: no execution runs through
the platform in local mode. *Generalising the Docker provider's refusal into the contract* —
rejected by `FR-LPW-033`.

**Docs consulted**: none needed.

---

## R-041-5 — Assurance is derived from the surface at registration, from a table, never from the caller

**Decision**: `@pmi/execution-registry-contract` gains `ExecutionAssurance = 'managed' | 'local'`
and a total function `assuranceFor(surface)`: `managed-sandbox`, `ci-cd` → `managed`;
`local-cli`, `mcp-client`, `ide-extension` → `local`; `fixture` → whatever the test declares,
defaulting to `local`. The `Execution` table gains a non-null `assurance` column, written by the
registry from that function. A registration body carrying `assurance` is refused as unknown input.

**Rationale**. `FR-LPW-034` says *never supplied by the caller* — a connector asserting its own
assurance is the same shape as the request-body `authenticatedPrincipalId` that got the executions
controller unmounted (`DEF-037-001`). A total function over the existing `EXECUTION_SURFACES`
vocabulary cannot be forgotten for a new surface: adding one without a mapping fails to compile.
This closes `ADR-0024`'s *Open* item with one field and two values, as PMI-DOC-007 `D-9` decided.

**Alternatives considered**. *Three tiers (managed, customer-cloud, local)* — rejected: customer
cloud has no owner or Epic; a value nothing produces is decoration. *Deriving from `environment`
free text* — rejected: free text cannot be total.

**Docs consulted**: none needed.

---

## R-041-6 — The worker reaches the platform's persistence through a narrow, exported barrel of `@pmi/backend`

**Decision**: `backend/package.json` gains an `exports` entry `./worker-api` pointing at
`backend/src/worker-api.ts`, which exports exactly two things: `prismaClient()` and
`GenerationCommitService` (the transactional commit `generate-specification.service.ts` already
implements as `commitGeneration`). `worker/package.json` takes `@pmi/backend: workspace:*`, and
`worker/src/main.ts`'s `persistence()` becomes a real `JobPersistence` whose `transaction` runs the
commit in one Prisma transaction. The `eslint-boundaries` rule set is extended with the single
allowed edge *worker → backend/worker-api*; every other worker → backend import stays forbidden.

**Rationale**. The worker's placeholder throws because *"the models it needs belong to
EPIC-008/EPIC-009 — both held pending PMI-DOC-004"* — a hold discharged 2026-08-20 that nobody
returned for (PMI-DOC-004B §2.1). The commit logic and the Prisma client exist and are tested on
the API side; duplicating them in the worker would create the two-copies problem `EPIC-038`'s
`R-038-1` rejected. Engine independence is untouched: the edge is worker → backend, and backend
still names no engine. The barrel is narrow on purpose: a worker that could import anything from
the backend would erode the transport-independence separation `T142a` protects.

**Alternatives considered**. *Move `backend/prisma` into a `packages/persistence` package* — the
cleaner long-term shape, rejected here as a repository-wide move (every `../../persistence/prisma.js`
import) that belongs to its own task set, not to a wiring repair. *Worker posts results to the API
over HTTP* — rejected: adds a transport and a credential to a same-machine hop, and the contract
`PersistenceTx.write(row)` was designed for a direct write. *Leave the throw* — rejected: it is
the first severed place and `M0` depends on it.

**Docs consulted**: none needed for the design; Prisma interactive transactions are already used by
`PrismaLifecycleTransitionRepository`.

---

## R-041-7 — Durable stores bind to Prisma at the composition root, and an architecture test reads the composition root

**Decision**: `PrismaTaskStore`, `PrismaRunStore`, `PrismaQuestionStore`, `PrismaMarkingStore`,
`PrismaOverrideStore` are added beside their in-memory siblings, and `PrismaGenerationJobLedger`
is implemented over the existing `PrismaJobStore`. Each module's factory selects the Prisma store
when `DATABASE_URL` is set — the exact pattern `projects.module.ts` already uses — and the in-memory
store otherwise, so unit suites keep running without a database. A new architecture test
(`backend/tests/architecture/durable-stores.spec.ts`) reads `tasks.module.ts`, `runs.module.ts` and
`specifications.module.ts` and fails if any store factory can return an in-memory implementation
under `DATABASE_URL`; a Testcontainers integration test boots `AppModule` and asserts the same
through the DI graph.

**Rationale**. `FR-LPW-043` asks for a check that *fails* when a store is in-memory in the composed
application. Reading the composition roots is the mechanism every existing architecture test uses
(`engine-independence`, `executions-unmounted`), and it runs without Docker; the integration test
is the Tier 1 proof that the graph actually resolves. Two checks because one reads intent and the
other observes behaviour.

**Alternatives considered**. *Prisma-only, delete the in-memory stores* — rejected: 3886 unit tests
run without a database and should keep doing so. *Only the integration test* — rejected: it needs
Docker and is skipped where Docker is absent, which is exactly when the regression would hide.

**Docs consulted**: none needed.

---

## R-041-8 — The initialiser is invoked through `uvx` at a pinned Spec Kit tag, in the project directory

**Decision**: the worker's initialise step runs, with the project directory as working directory:

```
uvx --from git+https://github.com/github/spec-kit.git@<PMI_ENGINE_TAG> specify init --here --force --integration <agentIntegration> --script <scriptType>
```

`PMI_ENGINE_TAG` is configuration with default `v0.16.4` — the tag the engine image already pins
(`engine-adapters/speckit/docker/Dockerfile`, `specify-cli==0.16.4`) — so the platform initialises a
directory with the same Spec Kit the sandbox runs. The tag is written into `.pmi/project.json` and
the `ProvisioningRecord` (`FR-LPW-008`). `--ignore-agent-tools` is **not** passed: on the user's
machine the agent tool check is useful information, and its failure is reported as the failed step
rather than suppressed. The implementation lives in `engine-adapters/speckit/src/local-init.ts`
and is composed at the worker root, never imported by `backend/`.

**Rationale**. `uvx` runs the pinned tag without a permanent install, which is what makes the
worker's host requirement *"`uv` on PATH"* rather than *"Spec Kit installed at the right version"*.
`--here --force` is the documented form for initialising the current directory; the integration
and script flags are the documented way to choose the agent and shell type, and both are project
settings the user chose at creation.

**Alternatives considered**. *`uv tool install specify-cli` on the worker host* — rejected: a
global install drifts from the pin. *Copying the baked scaffold from the engine image, as
`SpecKitEngine.scaffold()` does* — rejected: that scaffold is inside a container image, not on the
host, and copying it out would couple provisioning to the sandbox being built.

**Docs consulted**: Context7 `/github/spec-kit` — *`specify init` options: `--here`, `--force`,
`--integration`, `--script`; running via `uvx --from git+…@vX.Y.Z`; upgrading a pinned install.*

---

## R-041-9 — The PMI workspace bundle is one versioned package, copied in two halves

**Decision**: a new workspace package `packages/workspace-bundle` (`@pmi/workspace-bundle`)
carries, versioned together: `skills/setup-PMIStudio/SKILL.md` and `extension/` (the PMI Spec Kit
extension: `extension.yml`, its command files, and the `extensions.yml` hook fragment). The
**prepare** step copies `skills/` into `.claude/skills/` (the API may do this — the package and its
paths name no engine). The **initialise** step copies `extension/` into `.specify/extensions/pmi/`
and registers the hooks in `.specify/extensions.yml` (the worker does this — the extension's content
necessarily names Spec Kit). `bundleVersion` is recorded on the `ProvisioningRecord`.

**The bundle also owns the integration → skills-directory mapping** (`skillsPathFor`, added
2026-09-03 for analysis `C4`): `claude` → `.claude/skills/`, and a typed refusal for any
integration without a row, so provisioning code never names an agent (`FR-LPW-006`) and never
defaults to one.

**This Epic ships bundle v0.1**: a setup skill whose whole job is the hand-off — verify
`.pmi/project.json`, report whether initialisation is pending, run the `R-041-8` command when it is,
copy the extension, and verify `PMI_STUDIO_TOKEN` is present in the environment without ever asking
for its value. The full setup skill and the extension's `speckit.pmi.*` commands are `EPIC-042`'s
and replace v0.1 in place.

**Rationale**. The setup skill must be present **before** initialisation, or a pending project has
no way to complete (the skill is what completes it); the extension can only be installed **after**
initialisation, because it lives under `.specify/`. So the bundle is copied in two halves by two
steps, and versioning it as one package is what stops the halves drifting. A package named without
the engine's name is what lets the API copy the first half.

**Alternatives considered**. *Bundle the files inside `backend/`* — rejected: the extension content
contains `speckit.*` command names, and although the architecture test scans only `.ts`, placing
engine-specific content under `backend/` defeats the boundary's purpose. *Let `EPIC-042` ship the
first skill* — rejected: `FR-LPW-010`'s pending state would have no completion path until then.

**Docs consulted**: Context7 `/github/spec-kit` — *extension manifest (`extension.yml`),
`provides.commands` naming `speckit.{ext}.{cmd}`, hooks registered in `.specify/extensions.yml`
(`before_specify`, `after_*`)*. Context7 `/websites/code_claude` — *project-scoped `.mcp.json`
format: `mcpServers`, `type: stdio`, `command`, `args`, `env` with `${VAR}` expansion; Claude Code
prompts for approval of project-scoped servers on first use.*

---

## R-041-10 — `.mcp.json` is merged, never replaced, and carries an environment-variable reference only

**Decision**: the prepare step reads an existing `.mcp.json` if present (an adopted empty git
repository may carry one — edge case in the spec), adds or replaces only the `mcpServers["pmi-studio"]`
key, and writes the file back preserving every other key. The entry is:

```json
"pmi-studio": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@pmi/mcp-server@<PMI_MCP_SERVER_VERSION>"],
  "env": { "PMI_STUDIO_URL": "<platform address>", "PMI_STUDIO_TOKEN": "${PMI_STUDIO_TOKEN}" }
}
```

`@pmi/mcp-server` does not exist until `EPIC-043`; the entry is written now, at the version
configuration names, so the directory is complete on the day the server ships and the setup skill
can verify the reference. A conformance test asserts the written file parses, contains the entry,
and contains no string matching the credential shape (`FR-LPW-009`, `SC-LPW-003`).

**Rationale**. `.mcp.json` is the agent's own configuration file, checked into the user's
repository; overwriting it would destroy servers the user configured. `${VAR}` expansion is the
documented way to keep a secret out of a committed file, and `FR-LPW-024` forbids the value being
anywhere under the root.

**Docs consulted**: Context7 `/websites/code_claude` — as `R-041-9`.

---

## R-041-11 — The six unmounted components: five mount here, one mounts beside the credentials list

**Decision** (`FR-LPW-044`, enumerated):

| Component | Disposition | Where |
|---|---|---|
| `JobProgress` | mount here | project screen, beside the new *Generate specification* control (`FR-LPW-042`) |
| `LifecycleControls` | mount here | specification detail |
| `ValidationFindings` | mount here | specification detail |
| `VersionHistory` | mount here | specification detail |
| `VersionDiff` | mount here | specification detail, opened from `VersionHistory` |
| `AccessGrants` | mount here | *Workspace & Administration*, beside the connector-credentials list (`FR-LPW-052`) — the same screen family |

None is deferred. Each is small, each already has unit tests, and each has an obvious home on a
screen this Epic touches anyway. Mounting them is what turns `DEF-010-001`'s *"nine pages existed
and four were reachable"* from a recurring finding into a closed one for these six.

**Alternatives considered**. *Defer `AccessGrants` to `EPIC-024`* — rejected: `EPIC-024` is held,
and an administrator screen that lists credentials but not grants would be half an administration
area.

**Docs consulted**: none needed.

---

## R-041-12 — Tier 2 evidence is a run-generated transcript against the containerised stack, plus the reference-local stack for the initialise step

**Decision**: the reachability transcript (`SC-LPW-010`) is produced by an e2e run under `e2e/`
that creates a project, provisions it, mints a credential, and asserts the directory's contents
through the API's own `GET` routes and a file-system check on the mounted root. It runs against the
**containerised** stack (so the projects-root mount is exercised) and records *initialisation
pending* as the expected state there; a second transcript against the **reference-local** stack,
with the worker running, records the provisioned state. Both are committed under
`docs/uat/EPIC-041-*.md` in the shape `docs/deployment/EPIC-014-container-stack-transcript.md`
established, and each names the stack it came from (README: *"any published measurement must say
which stack it came from"*).

**Rationale**. The two stacks answer different questions here by design (`R-041-1`): one proves the
mount and the pending state, the other proves the initialiser. A single transcript could prove only
one.

**Docs consulted**: none needed.

---

## Performance and scale targets

| Target | Value | Why this value |
|---|---|---|
| Prepare step, p95 | < 2 s | a handful of file writes and one `git init`; anything slower is a mount or antivirus problem worth surfacing |
| Initialise step, p95 | < 90 s | dominated by `uvx` fetching the pinned tag on first use; cached thereafter |
| Credential verification | < 5 ms | one indexed lookup by prefix and one digest comparison; on every MCP call |
| Create project → directory open in agent | < 2 min | `SC-LPW-001`, end to end, first-time user |
| Projects per root | 1,000 | a directory listing stays instant; nothing here is designed for more |
