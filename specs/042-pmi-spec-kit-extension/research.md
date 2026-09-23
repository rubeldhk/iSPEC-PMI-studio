# Research — EPIC-042 PMI Spec Kit Extension, Setup Skill and Constitution Sync

**Session**: 2026-09-04 · **Plan**: [plan.md](./plan.md)

Thirteen decisions. Each records what was chosen, why, what lost, and the documentation consulted.
Context7 was available in this session; the one external system this Epic builds against — the
Spec Kit extension mechanism — was verified against it. No new runtime dependency is introduced.

## `R-042-1` — The extension is a manifest, three prompt files and a hook fragment

**Decision**: the `pmi` extension ships in `packages/workspace-bundle/extension/` as:
`extension.yml` (schema `1.0`, id `pmi`, version = bundle version, `requires.speckit_version
">=0.14.0"`), three command files `commands/begin.md`, `commands/finish.md`,
`commands/progress.md` declared as `speckit.pmi.begin`, `speckit.pmi.finish`,
`speckit.pmi.progress`, and a `hooks` block registering `before_<cmd>` → `begin` and
`after_<cmd>` → `finish` for the nine governed commands (`specify`, `clarify`, `checklist`,
`plan`, `tasks`, `analyze`, `implement`, `converge`, `constitution`). The project-side registry
`.specify/extensions.yml` lists `pmi` under `installed` and carries one entry per hook with
`extension: pmi`, `command`, `enabled: true`, **`optional: false`**, a `description` and no
`condition`. The stock skills pinned in this repository (Spec Kit `0.14.3`) read exactly that file
and, for a mandatory hook, emit `EXECUTE_COMMAND` and wait — which is what makes *registration
precedes execution* a control rather than an instruction.

**Rationale**: the stock skills' *Pre-Execution Checks* already implement the dispatch; the
extension only has to be shaped the way they read. `optional: false` is the difference between a
hook the agent may skip and a gate. A `condition` is never used because the stock skill does not
evaluate conditions and would skip the hook.

**Alternatives considered**: (a) edited stock skills — forbidden by `D-8` and `FR-EXT-001`;
(b) a single `speckit.pmi.govern` command with a mode argument — hooks carry no arguments in the
registry schema, so the command could not know which stock command it wraps; rejected.

**Docs consulted**: Context7 `/github/spec-kit` — *extension.yml manifest schema (schema_version,
extension, requires, provides.commands name pattern `speckit.<id>.<cmd>`, hooks)*;
*`.specify/extensions.yml` hook registry fields (`extension`, `command`, `enabled`, `optional`,
`priority`, `prompt`, `description`, `condition`) and the `installed` list*. The hook event names
were taken from this repository's pinned skills, which are the authority for what runs here.

## `R-042-2` — Stock-skill immutability is a digest check, and it is mutation-tested

**Decision**: `.specify/integrations/claude.manifest.json` pins the digests of the ten stock skill
files. The bundle test `stock-skills-immutable.spec.ts` initialises a temporary project with the
pinned toolkit, installs the extension, executes every hook fragment's file operations, and asserts
the ten digests are unchanged; the setup skill's step 5 performs the same comparison on the user's
machine and reports it as a row. The mutation observation owed at closure: make the install step
append one line to `speckit-specify/SKILL.md` and observe the test fail (`SC-EXT-001`).

**Rationale**: `FR-EXT-001` is a property of the *installed* state, not of the bundle's contents;
only a check that runs the installation proves it.

**Alternatives considered**: a lint rule over the bundle's file list — cannot see a merge that
writes into the wrong place; rejected.

**Docs consulted**: none needed.

## `R-042-3` — Command files are prompts to the agent; the extension ships no script

**Decision**: `begin.md`, `finish.md` and `progress.md` are agent prompts, as every stock skill
is. Each names, in order: what to read (`.pmi/project.json`, the constitution file, the Epic's
files), what to compute (the git branch, worktree and `HEAD`, the SHA-256 of each artifact file),
which `pmi-studio` tools to call with which arguments, and the one line to print for each
outcome (`FR-EXT-017`). The agent performs file reads, git queries and digests with its own
tools; the extension provides no shell script for any platform (`R-03`, `FR-EXT-003`). The
conformance test over the three files asserts: every tool name they mention exists in the
`EPIC-043` surface; the argument names they mention exist in that tool's schema; no line names an
engine or a provider; no line asks for a credential value.

**Rationale**: a script would have to exist twice (`sh`, `ps`) and be maintained against two shells;
the agent already has both. The cost is that the *sequence* is verified by a harness rather than by
executing the prompt (see `R-042-12`).

**Alternatives considered**: a Node script the extension ships and the command invokes — a third
runtime the setup skill must verify; rejected for this Epic, revisitable if prompt drift is
observed.

**Docs consulted**: none needed.

## `R-042-4` — The render is deterministic, and the invariant text lives in the bundle

**Decision**: `ConstitutionRenderService` (backend, `modules/governance/`) assembles the file as
plain string concatenation in the §5.4 order — header, Core Principles, Constraints, Non-goals,
Decomposition Policy, Governed Execution, Steering — with `\n` endings and a trailing newline;
the digest is SHA-256 of the exact bytes written. The **Governed Execution section and the
generated-file header template are exported by `@pmi/workspace-bundle`** (`constitution/`), not
written in `backend/src`: the invariant text necessarily names the toolkit's command prefix, and
`backend/src` must not contain that string (`engine-independence.spec.ts`). The backend imports
the function, never the text. The Steering section renders the documents `EPIC-019`'s
`resolveSteering` returns for the project scope, broadest to narrowest, as `### <subject>`
blocks with their content.

**Rationale**: determinism is what makes the digest meaningful (`FR-EXT-024`, `FR-EXT-025`); the
bundle is already the one package allowed to name the toolkit, and it is versioned with the
extension that reads the file.

**Alternatives considered**: a template engine — a dependency for six headings; rejected. A
template file per project — a second editable source; rejected (`D-3`).

**Docs consulted**: none needed.

## `R-042-5` — Drift is reported by the workstation and shown from its record

**Decision**: `pmi.health` gains an optional `constitutionDigest` argument (the on-disk file's
SHA-256, or `null` when absent). The platform classifies it — `current` (equals the latest
render), `stale` (equals an earlier render), `drift` (equals no render), `missing` — and stores
`constitutionDigest` and `constitutionState` on the workstation connection record with the
report time. `pmi.constitution.get` returns `{ content, digest, version, renderedAt, state }`
where `state` is computed the same way from an optional `onDiskDigest` argument, so a hook can ask
*what is this file?* in one call. The project screen's connection rows and the Constraints screen
read the state from the connection record (`FR-EXT-067`); a later report that is `current`
clears it.

**Rationale**: the platform cannot see the developer's disk; the workstation is the only party
that can report it, and it already reports on every health call. Keeping the classification on
the platform means both screens and both hooks use one rule.

**Alternatives considered**: a `constitution-drift` execution event — ties drift to an execution
that may not exist (the setup skill runs no command); rejected. A drift table — one more table for
one nullable pair of columns; rejected.

**Docs consulted**: none needed.

## `R-042-6` — Offline mode is read from the file; provisional records are contract-shaped

**Decision**: the Governed Execution section renders one machine-readable line,
`Offline mode: strict` or `Offline mode: provisional`, immediately under its heading; `begin.md`
reads that line and nothing else to decide. A provisional record is `.pmi/provisional/<executionId>.json`
holding exactly one item of the `POST /v1/executions/sync` batch shape `EPIC-037`'s contract
defines: the registration request (with client-generated `executionId` = `prov_<uuid>`,
`correlationId`, `idempotencyKey` = the execution id), the events appended locally in order —
the first is `execution-sync-queued` — and, after `finish.md`, the completion. `begin.md` submits
every file in that directory to `pmi.execution.sync` before registering; `accepted` ids are
deleted, `conflicts` are kept and named, and `not_available_until` keeps all and prints one
line. Every printed line about a provisional execution ends with *(not governed)*.

**Rationale**: `BR-0202` and XII.1 name the record, the event and the label; the batch shape
means reconciliation is a replay, not a translation (`FR-EXT-052`). Reading the mode from the
constitution is the one option that works when the platform cannot be asked (Assumption 3,
confirmed).

**Alternatives considered**: SQLite or a single append-only log — heavier than one file per
execution and harder for a person to inspect; rejected.

**Docs consulted**: none needed (`specs/037-governed-execution-registry/contracts/execution-contract.md`).

## `R-042-7` — Decomposition: the platform supplies the bundle, the agent estimates, the decision is a comment

**Decision**: `pmi.project.decompose` / `GET /v1/projects/{id}/decomposition` return
`{ firstRun, policy: { oneSpecPerEpic, taskCeiling, splitRequiresConfirmation, offlineMode,
version }, epics: [{ number, slug, name, requirements: [...] }], unassigned: [...], epicSource }`
— the Epic list and requirement grouping come from `EPIC-043`'s `ProjectContextService`
(derivation stated, `FR-PIC-043`), the policy from the new record. `begin.md` asks the agent for
one integer estimate per Epic from the bundle alone, prints the plan, and for each Epic above the
ceiling prints a proposed split (children, seams, estimates) and waits for the person. **The
decision is recorded as an execution comment** on that Epic's `specify` execution, comment type
`decomposition-decision`, whose body is a JSON document `{ policyVersion, epic, estimate, ceiling,
decision: confirmed | edited | rejected, children: [...], decidedBy }`. `EPIC-044` reads those
comments to create child Epics. Until then, children are directories `specs/<parent>a-<slug>/`,
`<parent>b-…` (the `D-18`/`D-19` shape).

**Rationale**: the surface stays exactly `EPIC-043`'s; a comment is already bound to an execution,
audited, immutable and readable through `history`; and `FR-EXT-045` asks for exactly that binding.

**Alternatives considered**: a new mutating tool `pmi.decomposition.decide` — a surface change
for one write that a comment already carries; rejected. Recording nothing until `EPIC-044` — loses
the human decision; rejected.

**Docs consulted**: none needed.

## `R-042-8` — First-run state is a marker provisioning writes

**Decision**: `EPIC-041`'s `project-files.ts` gains `writeFirstRunMarker()` writing
`.pmi/first-run` (content: the ISO time and the provisioning record id) at provisioning; the
decompose read returns `firstRun: true` only when **no completed `specify` execution exists for
the project**. `begin.md` treats the marker as first-run only when the read agrees; a marker the
read contradicts is deleted with one printed line. The loop deletes the marker after the last
Epic completes.

**Rationale**: Assumption 5 as recorded; the platform fact is the tie-breaker, the marker is what
lets the hook act when the platform cannot be reached (strict mode then refuses anyway).

**Docs consulted**: none needed.

## `R-042-9` — The setup skill is the full ten-step skill, and it installs three things only

**Decision**: `skills/setup-PMIStudio/SKILL.md` in the bundle is replaced in place (bundle
`0.2.0`). Ten steps in §5.3 order. It **installs**: the toolkit at the pinned tag (`uv tool
install specify-cli --from git+https://github.com/github/spec-kit.git@<engineTag>`), the
extension (copy + merge of the hook fragment), and `.mcp.json` entries. It **guides** for `uv`,
Node ≥ 22, Docker, and for `PMI_STUDIO_TOKEN`. The `.mcp.json` entries it may add: `pmi-studio`
(the `EPIC-041` entry, unchanged), `context7` and `github`, each with `${VAR}` references only
(`${CONTEXT7_API_KEY}` optional, `${GITHUB_TOKEN}`), never a value. Step 10 calls `pmi.health`
with the extension version, the toolkit version and the on-disk constitution digest (`R-042-5`).
The final table has the six states `FR-EXT-038` names.

**Rationale**: PMI-DOC-007 §5.3 is prescriptive; the only choices were which servers and which
variable names, taken from the servers this repository already uses.

**Docs consulted**: none needed beyond `R-042-1`.

## `R-042-10` — The Governance area is delivered with the Constraints screen

**Decision**: `frontend/src/shell/areas.ts` flips `governance` to `delivered` with element
`GovernanceArea`, whose one page is `pages/Constraints.tsx`: a project selector (workspace
projects), three filtered tables (principles, constraints, non-goals) with add, edit, reorder and
retire, the policy form (one-spec-per-Epic, ceiling, split confirmation, offline mode), and a
read-only constitution preview with version and digest, the Governed Execution section marked
*owned by PMI Studio*. Session-authenticated routes under `/v1/projects/:id/`: `constraints`
(`GET`, `POST`), `constraints/:cid` (`PATCH`, `POST …/retire`), `policy` (`GET`, `PUT`),
`constitution` (`GET` — the current render, forcing a render when none matches the current
inputs). Four states and a filter per table (`FR-EXT-068`).

**Rationale**: Assumption 6, confirmed. Reuses the shell's area registry (`FR-SHL-002`), so the
area appears in navigation with no shell change.

**Alternatives considered**: a project-screen panel — rejected by the requester.

**Docs consulted**: none needed.

## `R-042-11` — Two tools go live; two scopes are added; the bundle goes to 0.2.0

**Decision**: `packages/mcp-server/src/tools/reads.ts` gains `pmi.constitution.get` (`GET
/v1/projects/me/constitution?onDiskDigest=`) and `pmi.project.decompose` (`GET
/v1/projects/me/decomposition`); `reserved.ts` drops those two and keeps `execution.sync`,
`artifacts.sync`, `tasks.sync`. `connector-scope.ts` registers `constitution.read` and
`decomposition.read`; `connector-boundary.spec.ts`'s expected list grows by two;
`contracts/mcp-tool-surface.md` (`EPIC-043`) is amended so its conformance test stays green
(`FR-EXT-062`). `@pmi/workspace-bundle` → `0.2.0`, extension version `0.2.0`; the provisioning
record and `pmi.project.context` report it.

**Rationale**: `FR-EXT-060`, `FR-EXT-061`; the registry was left extensible for exactly this
(`EPIC-041` analysis `U1`).

**Docs consulted**: none needed.

## `R-042-12` — How the M2 transcript is produced without an agent

**Decision**: the hooks are prompts an agent executes; Playwright cannot run an agent. The Tier 2
evidence is therefore produced by `e2e/tests/epic-042-m2.spec.ts`, which (1) drives the UI to enter
two principles, a constraint, a non-goal, the policy and three Epics' requirements, (2) provisions
a project, (3) **executes the documented hook sequences** through a real `pmi-studio` server over
stdio — the same calls `begin.md` and `finish.md` instruct, in the same order, with the same
arguments — for a first run with one split, and (4) asserts on the timeline, the constitution
file on disk against the preview's digest, and the decomposition comments. The transcript states
that the hook *prompts* were verified by conformance (`R-042-3`) and the hook *sequences* by this
run. A person running the real agent against the same stack is recorded, when done, as a second
section of the same transcript.

**Rationale**: honest evidence beats a claim that a prompt "was run"; the sequence harness is
also the regression net for the prompts' tool calls.

**Docs consulted**: none needed (Playwright and the MCP client are already in `e2e/`).

## `R-042-13` — The governance records the plan step writes

**Decision**: (a) `ADR-0030` gains an amendment recording the extension as the mechanism for
PMI-aware commands (`D-8`) and the constitution as generated content (`D-3`) — `FR-EXT-070`.
(b) The repository constitution goes `1.6.0 → 1.6.1` (PATCH) through `/speckit-constitution`,
adding to the **Directory contract** the sentence PMI-DOC-007 §9.2 names: a PMI-managed project's
`.specify/memory/constitution.md` is generated from PMI Studio and not hand-edited; no principle
changes — `FR-EXT-071`. Both are done by this plan step, as `EPIC-043` closed `ADR-0010` at its
plan step.

**Docs consulted**: none needed.
