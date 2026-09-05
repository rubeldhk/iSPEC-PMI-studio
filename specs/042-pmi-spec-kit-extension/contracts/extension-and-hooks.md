# Contract — the `pmi` extension, its hooks and its commands (`EPIC-042`)

**Owner**: `@pmi/workspace-bundle` `0.2.0` · **Checked by**: `packages/workspace-bundle/tests/extension-conformance.spec.ts`,
`stock-skills-immutable.spec.ts` · **Research**: `R-042-1`, `R-042-2`, `R-042-3`, `R-042-6`, `R-042-7`

## 1. Manifest — `extension/extension.yml`

```yaml
schema_version: "1.0"
extension:
  id: "pmi"
  name: "PMI Studio"
  version: "0.2.0"                    # = BUNDLE_VERSION
  description: "Registers every governed Spec Kit command with PMI Studio, refreshes the generated constitution, and syncs artifacts."
  author: "PMI Studio"
  repository: "https://github.com/pmi-studio/pmi-studio"
  license: "UNLICENSED"
requires:
  speckit_version: ">=0.14.0"
provides:
  commands:
    - { name: "speckit.pmi.begin",    file: "commands/begin.md",    description: "Register a governed command before it runs" }
    - { name: "speckit.pmi.finish",   file: "commands/finish.md",   description: "Complete a governed command after it ends" }
    - { name: "speckit.pmi.progress", file: "commands/progress.md", description: "Report ticked tasks as progress events" }
hooks:
  before_specify:      { command: "speckit.pmi.begin",  optional: false, description: "Register with PMI Studio (first run: decompose)" }
  after_specify:       { command: "speckit.pmi.finish", optional: false, description: "Complete and sync" }
  before_clarify:      { command: "speckit.pmi.begin",  optional: false }
  after_clarify:       { command: "speckit.pmi.finish", optional: false }
  before_checklist:    { command: "speckit.pmi.begin",  optional: false }
  after_checklist:     { command: "speckit.pmi.finish", optional: false }
  before_plan:         { command: "speckit.pmi.begin",  optional: false }
  after_plan:          { command: "speckit.pmi.finish", optional: false }
  before_tasks:        { command: "speckit.pmi.begin",  optional: false }
  after_tasks:         { command: "speckit.pmi.finish", optional: false, description: "Complete, sync artifacts and tasks" }
  before_analyze:      { command: "speckit.pmi.begin",  optional: false }
  after_analyze:       { command: "speckit.pmi.finish", optional: false }
  before_implement:    { command: "speckit.pmi.begin",  optional: false }
  after_implement:     { command: "speckit.pmi.finish", optional: false, description: "Progress events, then complete (partially-completed if tasks remain)" }
  before_converge:     { command: "speckit.pmi.begin",  optional: false }
  after_converge:      { command: "speckit.pmi.finish", optional: false }
  before_constitution: { command: "speckit.pmi.begin",  optional: false }
  after_constitution:  { command: "speckit.pmi.finish", optional: false }
```

## 2. Project registry fragment — merged into `.specify/extensions.yml`

Provisioning and the setup skill merge this fragment: add `pmi` to `installed` if absent; for each
event, append the entry if no entry with `extension: pmi` and the same `command` exists; never
touch another extension's entries; never remove anything.

```yaml
installed: [pmi]
hooks:
  before_specify:
    - { extension: pmi, command: speckit.pmi.begin, enabled: true, optional: false, description: "Register with PMI Studio" }
  after_specify:
    - { extension: pmi, command: speckit.pmi.finish, enabled: true, optional: false, description: "Complete and sync" }
  # … one pair per event in §1
```

`optional: false` is load-bearing: the stock skill executes a mandatory hook and waits for it.
No entry carries a `condition` (the stock skill skips conditioned hooks).

## 3. Rules every command file obeys (`FR-EXT-003`, `FR-EXT-011`, `FR-EXT-017`)

- Calls PMI Studio only through `pmi-studio` tools that exist in
  `specs/043-pmi-integration-contract/contracts/mcp-tool-surface.md` (as amended by this Epic);
  every argument name it uses exists in that tool's schema.
- Ships no script; asks the agent to read files, query git and compute SHA-256 with its own
  tools.
- Never asks for, prints or writes a credential value; never passes one as an argument.
- Names no engine, agent product or provider.
- Prints **exactly one line per outcome**, in this vocabulary:
  `PMI · registered <executionId> (<command>, <epic|no epic>)` ·
  `PMI · completed <executionId> (<outcome>)` ·
  `PMI · refused <code>: <message>` ·
  `PMI · queued <executionId> (not governed)` ·
  `PMI · constitution <current|stale→refreshed|restored|drift — waiting for confirmation>` ·
  `PMI · left open <executionId> from <time> — complete as failed? (yes/no)` ·
  `PMI · sync not available until <epic>` ·
  `PMI · nothing to decompose — add requirements in PMI Studio → <where>`.

## 4. `speckit.pmi.begin` — sequence

1. Read `.pmi/project.json`; absent → print the refusal line and **stop the stock command**.
2. Read `.specify/memory/constitution.md`; compute its digest (or `null`).
3. Call `pmi.health { extensionVersion, toolkitVersion, constitutionDigest }`.
   - Refusal `invalid_connector_credential` or a forbidden refusal → print, **stop** (`FR-EXT-056`).
   - `platform_unreachable` → read the `Offline mode:` line: `strict` → print the refusal naming
     the platform address and the mode, **stop** (`FR-EXT-010`); `provisional` → go to step 9.
4. Constitution: `state = current` → nothing; `stale` or `missing` → call `pmi.constitution.get`,
   write the content, print `refreshed`/`restored`; `drift` → print the difference, print the
   drift line, **wait for confirmation**; on *yes* write the current render, on *no* continue
   with the file as it is (the state stays `drift` on the platform) (`FR-EXT-025`, `FR-EXT-026`).
5. Provisional queue: for each `.pmi/provisional/*.json` call `pmi.execution.sync { batch: [item] }`;
   `accepted` → delete the file; `conflicts` → keep, print; `not_available_until` → keep all,
   print once (`FR-EXT-055`).
6. Left-open check: call `pmi.execution.history`-backed listing for this directory's last
   registered execution id kept in `.pmi/last-execution`; if non-terminal, print the left-open
   line and wait; *yes* → `pmi.execution.complete { outcome: 'failed', completionComment }`
   (`FR-EXT-018`).
7. **First run** (`specify` only): if `.pmi/first-run` exists, call `pmi.project.decompose`;
   `firstRun: false` → delete the marker, continue as a single run; `firstRun: true` → the
   decomposition loop (§7).
8. Register: `pmi.execution.register { command, idempotencyKey, correlationId, input: {
   targetType: 'epic', targetId, repositoryId, branch, worktree, commitBefore,
   inputArtifactDigests }, environment }`; write the id to `.pmi/last-execution`; print the
   registered line. The stock command now runs.
9. Provisional path: write `.pmi/provisional/<prov_id>.json` with the registration item and the
   `execution-sync-queued` event; print the queued line *(not governed)*; the stock command runs
   (`FR-EXT-050`, `FR-EXT-053`).

## 5. `speckit.pmi.finish` — sequence

1. Read `.pmi/last-execution` (or the provisional file).
2. Compute `commitAfter` and the digests of the Epic's artifact files; list which changed.
3. `implement` only: run `speckit.pmi.progress` (§6).
4. `pmi.artifacts.sync` and, after `tasks`/`implement`, `pmi.tasks.sync`; `not_available_until`
   → print once, continue (`FR-EXT-016`).
5. `pmi.execution.complete { outcome, occurredAt, completionComment, output: { commitAfter,
   generatedArtifactDigests }, idempotencyKey }` — outcome `partially-completed` after
   `implement` when unchecked tasks remain (`FR-EXT-015`); print the completed line. Provisional:
   append the completion to the file instead; print *(not governed)*.
6. Delete `.pmi/last-execution`.

## 6. `speckit.pmi.progress` — sequence (`FR-EXT-006`, `R-07`)

Diff `tasks.md` against its digest at registration; for each task newly `[X]`, call
`pmi.execution.appendEvent { type: 'progress-reported', payload: { taskId }, occurredAt,
idempotencyKey: '<executionId>:<taskId>' }`. Runs from `finish` after `implement`; where the
toolkit later offers an in-flight hook, the same command is registered there with no change.

## 7. The first-run decomposition loop (`FR-EXT-042`–`FR-EXT-048`)

1. From the decompose response, print the plan: one line per Epic — number, name, requirement
   count — then **ask the agent for one integer estimate per Epic from the bundle alone**, and
   print it beside each line. No Epic and no baselined/approved requirement → print the
   nothing-to-decompose line, **stop**.
2. For each Epic with `estimate > taskCeiling`: propose a split (children with suffix, slug,
   requirements, estimate, seam); print; **wait**: `confirm` / `edit: …` / `reject`.
3. For each delivery Epic (or child) in number order: register (§4 step 8, `targetId` = the Epic
   number or `<number><suffix>`), run the stock specify flow with the requirement bundle as the
   feature description and `specs/<number>[suffix]-<slug>/` as the directory, then `finish`
   (§5). After a split, record the decision on the parent's first child execution as a comment
   `pmi.execution.comment { commentType: 'decomposition-decision', body: <JSON> }`
   (`data-model.md` §8).
4. Delete `.pmi/first-run`. Print one summary line: `PMI · first run: <n> specifications,
   <k> splits`.

The stock rule *one feature per invocation* is unchanged: the loop invokes the stock flow once
per Epic (`R-08`).

## 8. Provisional record — `.pmi/provisional/<executionId>.json`

One item of the `POST /v1/executions/sync` batch (`EPIC-037` contract §sync):

```json
{
  "registration": { "executionId": "prov_<uuid>", "command": "plan", "correlationId": "<uuid>", "idempotencyKey": "prov_<uuid>", "input": { … }, "surface": "mcp-client" },
  "events": [
    { "type": "execution-sync-queued", "occurredAt": "…", "payload": { "reason": "platform_unreachable" } },
    { "type": "lifecycle.completed", "occurredAt": "…", "payload": { "outcome": "completed", "output": { … }, "completionComment": "…" } }
  ],
  "governed": false
}
```

`governed` is always `false` in the file; the platform sets governance on acceptance.

## 9. Conformance tests over this contract

| Test | Asserts |
|---|---|
| `extension-conformance.spec.ts` | manifest parses and validates §1; every hook names a provided command; every command file exists; every `pmi.*` name and every argument name in the command files exists in the tool surface; no engine/provider name; no credential request; the outcome vocabulary of §3 is the only `PMI ·` line form used |
| `stock-skills-immutable.spec.ts` | after `specify init` at the pinned tag + extension install + hook-fragment merge, the ten stock skill digests equal the integration manifest (`SC-EXT-001`; mutation: append a line during install → red) |
| `hook-fragment-merge.spec.ts` | merge is idempotent; foreign entries untouched; `installed` gains `pmi` once |
| `provisional-record.spec.ts` | a file written per §8 is accepted by the contract's sync batch schema |
