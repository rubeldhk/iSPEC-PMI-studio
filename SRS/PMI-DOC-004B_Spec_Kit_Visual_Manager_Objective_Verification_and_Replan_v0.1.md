# PMI-DOC-004B — Spec Kit Visual Manager: Objective Verification & Replan

**Document ID**: PMI-DOC-004B · **Version**: 1.0 · **Status**: ACCEPTED — actioned by [PMI-DOC-007 v1.0](./PMI-DOC-007_Local_First_Replan_v0.1.md), approved 2026-09-03 (`D-47`)
**Owner**: Project Owner (Product) · **Date**: 2026-09-03
**Baseline verified**: repository `iSPEC-PMI-studio` at commit `62644ba` (branch
`epic/037-governed-execution-registry`), 408 commits, 40 declared Epics, constitution v1.6.0,
PMI-DOC-004 v2.0, PMI-DOC-004A v1.1.
**Method**: every claim below was checked against code, composition roots and tests on 2026-09-03.
`pnpm test:unit` was executed: 395 files, 3886 tests, all passing. Where a capability is "built but
not wired", the file that severs it is named.

---

## 0. Disposition — read first

The Project Owner restated the product's core objectives on 2026-09-03 as ten numbered points
(§1). Read together they describe **a visual manager for GitHub Spec Kit**: the user creates a
project, PMI creates a real directory on disk, the user's own Claude Code runs the `/speckit-*`
commands in that directory, and PMI Studio shows the journey — specs, stages, markdown files,
tasks on a Kanban — updated automatically because the constitution tells Claude to report each
execution back to PMI.

The repository has built something adjacent but structurally different: **a governed control
plane that runs Spec Kit itself**, headlessly, inside a disposable Docker sandbox, with the user's
Claude Code nowhere in the loop. That model is recorded and deliberate (`ADR-0002`, `ADR-0009`,
`ADR-0024`), and much of it is well engineered. It is also the reason nine of the ten objectives
are not met.

**This document does two things.** §2 verifies each objective against what exists. §5–§9 propose
the replan: keep the platform, **invert its execution model** to local-first, and declare the six
Epics that close the gap. The Owner authorised "a whole or big change" if warranted; §5 argues one
is, and §10 lists the decisions only the Owner can take.

Nothing here changes a posture, declares an Epic or edits the stage register. Those remain
separate acts (`RULE-14`, `ADR-0029`).

---

## 1. The objectives, as restated

| # | Objective (Owner's words, condensed) |
|---|---|
| O-1 | Creating a project creates a **physical directory** to start working with Spec Kit |
| O-2 | Add requirements: **core baseline, functions, or epics** |
| O-3 | Add **constraints / constitution** — this *is* the Spec Kit constitution |
| O-4 | User works with **Claude or another Spec-Kit-compatible AI provider** |
| O-5 | **`/setup-PMIStudio`** installs Spec Kit from GitHub and the environment (Docker, Context7, GitHub MCP), or guides the user through it |
| O-6 | First **`/speckit-specify`** analyses all requirements in the PMI app and creates **separate specs per registered constitution rules** — default: one spec per Epic; split an Epic that would exceed 50 tasks |
| O-7 | PMI displays **all specs with current stage** by which Spec Kit command last ran |
| O-8 | Default constitution instructs Claude to **post an entry for each execution** so status is live in PMI |
| O-9 | All project **markdown files** are accessible in the PMI UI under each Epic |
| O-10 | Tasks managed on a **Kanban board**, status **updated automatically** |

Cross-cutting: *"a visual manager of Spec Kit, plus continuous development, monitoring, discussion
and recording"*; method **80 % documentation and AI work, 20 % development and human work**.

---

## 2. Verification — objective by objective

Legend: ✅ met · 🟡 partly met · ❌ not met · ⛔ contradicted by a recorded decision

| # | Verdict | What exists | What is missing | Evidence |
|---|---|---|---|---|
| O-1 | ⛔ | `ProjectsService.create()` writes a row: `id, workspaceId, name, description, status, engineName, ownerUserId`. The only workspace a run ever has is a tmpfs inside a disposable container, destroyed in `finally`. | Any project path, repository or volume. `Project` has no `path`/`repositoryUrl` field. The Docker provider **refuses** `lifecycle: 'persistent'` (`policy_refused`). `ADR-0009`: "the git remote is the durable substrate; volumes are cache only". `ADR-0017` (interactive workspace) is **Open, unowned**. | `backend/src/modules/projects/projects.service.ts` · `engine-adapters/speckit/src/workspace.ts` · `execution-providers/docker/src/index.ts:127-133` |
| O-2 | 🟡 | Requirements with four types (`business, functional, non_functional, constraint`), append-only versions, filters, free-text intake via the Requirement Room, and a `Baseline` entity. Requirements feed generation. | **No `Epic` entity anywhere in the schema** (0 `model Epic`; one nullable `DefectRecord.epicId` string). No requirement hierarchy. "Epic" exists only as a `specs/` directory convention of this repository. | `backend/src/modules/requirements/requirement.validation.ts:12` · `backend/prisma/schema.prisma` |
| O-3 | ❌ | EPIC-019 steering: ten fixed subjects, org→workspace→project→product scoping, rendered as prose into `pmi-input.md` before generation. Backend only, **no UI**. | A per-project constitution model, endpoint or screen. `.specify/memory/constitution.md` in the sandbox is whatever `specify init` baked at image build; the adapter never writes it. `'constitution'` exists only as a label in `GOVERNED_COMMANDS`. | `backend/src/modules/steering/` · `engine-adapters/speckit/src/speckit.adapter.ts` `scaffold()` · `frontend/src/shell/areas.ts:282` |
| O-4 | 🟡 | A genuinely provider-neutral seam (`AgentGateway`, `specKitIntegrationName`, architecture test). Claude adapter runs `claude -p --allowedTools Bash,Write` **inside the container**. One real end-to-end run recorded 2026-08-20. | The user's own Claude Code session is never involved. The production worker resolves the **FixtureAgent** by default; nothing on the production path selects Claude. No provider-selection surface. No local execution provider. | `agent-adapters/claude/src/index.ts` · `worker/src/agent-composition.ts:92-97` · `specs/028-agent-execution-seam/v6-transcript.md` |
| O-5 | ❌ | `docs/operator-setup.md`, a five-step manual runbook for Docker, engine image, egress network, token. | The skill. Zero repository matches for `setup-PMIStudio`. No installer, no `.mcp.json`, no Context7 or GitHub MCP provisioning. The ten `.claude/skills/speckit-*` are **stock upstream Spec Kit v0.14.3**, hash-pinned. | `.specify/integrations/claude.manifest.json` · `docs/operator-setup.md` |
| O-6 | ❌ | Platform side (EPIC-008): reads **user-selected** requirement IDs from Postgres, renders `pmi-input.md`, runs `/speckit-specify` once, commits **exactly one** spec. Structure conformance checks required headings. | The skill reads free text, not PMI; "one feature per invocation" by design. No scan of the whole register, no multi-spec output, no "one spec per epic", no task-count ceiling (**`50` as a threshold appears nowhere**). Historical splits (D-15/D-18/D-19) were human rulings on module boundaries; one child has 58 tasks. | `.claude/skills/speckit-specify/SKILL.md:60,111` · `backend/src/modules/specifications/generate-specification.service.ts` |
| O-7 | ❌ | `SpecificationList` shows `lifecycleState` (`draft→…→archived`, a **human approval** lifecycle), engine, out-of-date flag. | Any per-spec Spec Kit **command stage**. `JobKind` has three members, none of them plan/clarify/analyze/implement. The only stage vocabulary is `GOVERNED_COMMANDS`, read by nothing. EPIC-026's stage register is a **governance test over this repository's own `specs/**` markdown** — its own spec says "process, not product". | `frontend/src/pages/SpecificationList.tsx` · `governance/epic-stage.config.json` · `tests/governance/epic-stage/derive.ts` |
| O-8 | 🟡 policy / ❌ mechanism | Constitution **Principle XII** (v1.6.0) states exactly this obligation, with a better rule than the objective: *"Contract, never the database."* EPIC-037 built `ExecutionsController` (`POST /executions`, `/events`, `/completion`, `/proposals`). | The controller is **deliberately unmounted** (`controllers: []`, architecture-tested) because no caller can be authenticated. No agent credential model. No MCP server (13 `mcp` hits, all comments/enum members; `ADR-0010` Open). The skills contain **zero** instruction to report anything; the word "PMI" does not occur in them. | `.specify/memory/constitution.md:430` · `backend/src/modules/executions/executions.module.ts:73-76` · `backend/tests/architecture/executions-unmounted.spec.ts` |
| O-9 | ❌ | `SpecificationVersion.contentRaw` holds the spec markdown blob. `PublishService` can push artifacts to external storage. | No API returns content; no markdown renderer in the frontend (0 hits); `plan.md`, `research.md`, `data-model.md`, `contracts/` are **never produced or captured**; `tasks.md` is parsed then discarded. Publishing is wired to `InMemoryProjectArtifacts`, an empty `Map`, so it publishes nothing. | `frontend/src/services/api.ts:129` · `backend/src/modules/storage/storage.module.ts:53-62` |
| O-10 | ❌ | `Tasks.tsx`: a `<ul>` with a three-value `<select>` per task, reached only by typing `/specifications/:id/tasks`. | No board (0 hits for `kanban` in source). The only writer of `Task.status` is a human `PATCH`. Tasks are stored in **`InMemoryTaskStore`** — the `tasks` table is unused by the composed app. `/speckit-implement` is never invoked by the platform. | `backend/src/modules/tasks/tasks.module.ts:95` · `frontend/src/pages/Tasks.tsx` |

### 2.1 The four places the end-to-end loop is severed

These matter more than any single objective, because they mean "Ready" in the stage register
describes module completeness, not a working journey:

1. **The worker cannot persist a generation.** `worker/src/main.ts:32` throws by design: *"the
   specification and version models are owned by EPIC-008/EPIC-009, which are held pending
   PMI-DOC-004"* — a hold that PMI-DOC-004 v1.0 discharged on 2026-08-20 and nobody came back for.
2. **Tasks, runs, generation jobs, findings, storage and publishing are all in-memory** in the
   composed application. Only specifications and lifecycle transitions reach Prisma.
3. **The UI cannot start anything.** `api.ts` has no `generateSpecification` and no `startRun`.
   Six built components (`VersionHistory`, `VersionDiff`, `ValidationFindings`, `JobProgress`,
   `LifecycleControls`, `AccessGrants`) are rendered by nothing.
4. **The execution registry has no transport** and no way to authenticate an agent.

### 2.2 What is genuinely good and must be kept

- The engine and agent **contracts and adapters** (`packages/*`, `engine-adapters/speckit`,
  `agent-adapters/claude`) with architecture tests that keep them honest.
- **Requirement Room, Change Room, Defect Room** and the Governed Engineering Loop (EPIC-030–035):
  delivered, tested, and exactly the "discuss and record" half of the objective.
- **EPIC-037 execution registry** — the domain model for O-8 is done; only the transport is missing.
- **EPIC-026's stage derivation** (`derive.ts`, `dor.ts`, `epic-stage.config.json`) — the logic O-7
  needs already exists; it reads a file tree today and can read synced artifacts tomorrow.
- The **application shell**, design system, and the repository's governance discipline.
- The unit suite: 3886 tests green.

---

## 3. Root cause — one architectural assumption

Every ❌ above traces to a single decision made in EPIC-001/003 and never revisited when the
objectives sharpened:

> **PMI Studio executes Spec Kit.** The platform owns the sandbox, the credential, the CLI and the
> workspace; the user supplies requirements and reads results.

The objectives assume the opposite:

> **The user executes Spec Kit, in their own Claude Code, in their own directory. PMI Studio
> supplies the inputs, receives the events, and shows the journey.**

Under the first model a project directory is pointless (it is thrown away), a setup skill is
pointless (the image is pre-built), the skills need no PMI awareness (PMI drives them), and a
Kanban cannot update automatically (nothing runs `/speckit-implement`). Under the second model all
ten objectives are natural consequences.

The repository has already half-admitted this. Constitution XII says *"execute anywhere through an
approved integration; govern, record and trace everything in PMI Studio"*. `ADR-0024` names
**controlled local** as a fabric mode, then makes it `MAY` and optional. `ADR-0017` calls the
interactive workspace *"exactly this objective… unowned and unspecified"*. `ADR-0010` designs an
MCP server that has no code. The replan does not invent a new direction; it promotes the one the
corpus keeps deferring to the default.

---

## 4. Options considered

| Option | Description | Reaches O-1…O-10 | Cost | Risk |
|---|---|---|---|---|
| **A — Local-first pivot** *(recommended)* | Keep the platform; make **controlled local** the default and only required fabric mode for R-next; add a project directory, a PMI skill pack, an MCP/API integration contract, Epic model, artifact sync, Kanban. Managed sandbox becomes an optional later mode. | All ten | Six new Epics, ~5–6 waves; two ADR amendments | Governance guarantees are weaker on a developer machine (`ADR-0024` already says so) — accepted for the target user |
| B — Additive | Keep managed sandbox as default; add local mode beside it as `ADR-0024` intended. | All ten, later | Same six Epics **plus** finishing the sandbox path (worker persistence, provider selection, container-in-container CI) | Two execution models to keep identical (`ADR-0024`'s own stated negative); objectives arrive last |
| C — Fresh lightweight product | New repo "PMI Studio Local", reuse `packages/*` only. | All ten, fastest to first demo | Abandons ~100k lines of tested backend, the Rooms, the shell | Loses "discuss and record"; rebuilds tenancy, audit, requirements |

**Recommendation: A.** It is the only option where the delivered Rooms, registry and shell become
the product rather than a parallel product, and the only one consistent with the 80/20 method —
most of the work is skills, constitution and contract documents, not new services.

---

## 5. Target model under Option A

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Developer machine                                                           │
│                                                                              │
│   ~/projects/<project-slug>/            ◄── O-1  created by PMI, `specify init` │
│     .specify/memory/constitution.md     ◄── O-3  generated from PMI constraints │
│     .claude/skills/speckit-*/           ◄── O-5  PMI skill pack (wrapped)       │
│     .claude/skills/setup-PMIStudio/                                          │
│     .mcp.json  → pmi-studio MCP server  ◄── O-8  the integration contract     │
│     specs/<epic>/spec.md plan.md tasks.md ─► synced ─► PMI  (O-7, O-9, O-10)  │
│                                                                              │
│   Claude Code (user's own)  runs /speckit-specify … /speckit-implement  (O-4) │
│        │ MCP tools: get_requirements, get_constitution, register_execution,   │
│        │           complete_execution, sync_artifacts, report_task_status     │
│        ▼                                                                     │
│   PMI Studio (docker compose up)  API :3000 · Postgres · Valkey · Web         │
│     Epic model · Spec journey board · Markdown viewer · Task Kanban           │
│     Requirement/Change/Defect Rooms · Execution registry · Audit             │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.1 Principles of the pivot

1. **The project directory is the durable substrate for local mode.** `Project.rootPath` (and
   later `repositoryUrl`) are first-class. Amends `ADR-0009` for local mode only.
2. **PMI never runs the agent in local mode.** The user's Claude Code (or Codex, Cursor —
   anything Spec Kit supports) runs the commands. PMI is source of inputs and sink of events.
3. **Contract, never the database** (Constitution XII.7 stands). Claude reports through the MCP
   server or the mounted EPIC-037 REST surface, authenticated by a **project-scoped connector
   token** minted by PMI when the directory is created. O-8's "post entry in the db" is satisfied
   *through* the contract, never by a direct write.
4. **Epic is a domain entity.** Requirements group under Epics; a spec belongs to an Epic; the
   Epic's stage is derived from its execution records using EPIC-026's derivation logic.
5. **Artifacts are synced, then viewed.** Every `/speckit-*` completion uploads the Epic's
   markdown set; PMI stores it versioned and renders it. No UI edits the files — the directory
   stays authoritative for content, PMI for status.
6. **Tasks mirror `tasks.md`.** `- [X] T### …` lines are the Kanban's truth; `/speckit-implement`
   completion events move cards. Manual moves in the UI write back only via a governed proposal
   (EPIC-037 `StatusTransitionProposal`), never by editing the file silently.
7. **Managed sandbox is retained, demoted.** It stays the answer for unattended runs (EPIC-023)
   and CI, and is not required for any objective.

### 5.2 Objective coverage under the target model

| Objective | Satisfied by |
|---|---|
| O-1 | EPIC-041 — `POST /projects` with `rootPath` provisions the directory, runs `specify init`, drops the skill pack and `.mcp.json`, mints the connector token |
| O-2 | EPIC-044 — `Epic` model; requirement types gain `epic` grouping; baseline = EPIC-033 `Baseline` |
| O-3 | EPIC-042 — PMI "Constraints" screen edits a per-project constitution; `/setup-PMIStudio` and every sync write `.specify/memory/constitution.md` from it. EPIC-019 steering becomes its source layers |
| O-4 | EPIC-041/043 — any Spec-Kit-compatible agent; PMI records which one via `AgentIdentitySnapshot` (already in schema) |
| O-5 | EPIC-042 — `/setup-PMIStudio` skill: checks `uv`/`specify`, Docker, Node; installs Spec Kit from GitHub; writes `.mcp.json` for `pmi-studio`, Context7, GitHub; verifies by calling the PMI health tool; guides on anything it cannot do itself |
| O-6 | EPIC-042 — a wrapped `/speckit-specify`: on first run calls `get_requirements` + `get_decomposition_policy`, groups by Epic, applies the policy (one spec per Epic; propose a split when the estimate exceeds the ceiling, default 50), then runs the stock specify flow once per Epic, registering each execution |
| O-7 | EPIC-044 — `Epic.stage` derived from `Execution` rows per command (specify → clarified → planned → tasked → analyzed → implementing → converged); spec list shows stage and last command |
| O-8 | EPIC-043 — mount EPIC-037 with connector-token auth; MCP server exposes `register_execution`/`complete_execution`; the generated constitution carries the instruction |
| O-9 | EPIC-045 — `ArtifactFile` per Epic per version; markdown viewer under each Epic |
| O-10 | EPIC-046 — Kanban board over `Task` rows (Prisma-backed), auto-moved by implement events and `tasks.md` sync; manual moves become proposals |

---

## 6. Epics to declare

Numbering continues the register (`EPIC-041`–`EPIC-046`). Each is written to be one
`/speckit-specify` invocation. Task counts are estimates for sizing only.

| Epic | Title | Closes | Depends on | Est. tasks | Notes |
|---|---|---|---|---|---|
| **EPIC-041** | Local Project Workspace | O-1, O-4 | — | ~35 | `Project.rootPath`, directory provisioning service (host-side, not in a container), `specify init` runner, connector-token mint, "controlled local" as a fabric mode in `execution-contract`. **Also repairs severed places 1–3 of §2.1** as its Foundational phase, because nothing local can be demonstrated while the worker throws and tasks live in memory |
| **EPIC-042** | PMI Skill Pack & Constitution Sync | O-3, O-5, O-6 | 041, 043 | ~40 | `/setup-PMIStudio`; wrapped `/speckit-*` skills that call PMI before and after the stock command; constitution generator from PMI constraints + steering; decomposition policy (`one spec per Epic`, `split above N tasks`) stored in PMI and rendered into the constitution. Mostly markdown — squarely the 80 % |
| **EPIC-043** | PMI Integration Contract: MCP Server & Mounted Registry | O-8 | 041 | ~30 | Closes `ADR-0010`. `packages/mcp-server` (stdio) with the six tools in §5; mounts `ExecutionsController` behind connector-token auth (resolving the reason it was unmounted, `DEF-037-001`); idempotency and correlation per XII.7 |
| **EPIC-044** | Epic Model & Spec Journey Board | O-2, O-7 | 043 | ~30 | `Epic` entity; requirement→epic grouping; stage derivation reusing `tests/governance/epic-stage/derive.ts` extracted into `packages/epic-stage`; specification list and Epic board with stage + last command + next expected command |
| **EPIC-045** | Artifact Sync & Markdown Viewer | O-9 | 043 | ~20 | `sync_artifacts` tool; `ArtifactFile` model (path, digest, version, epic); markdown renderer in the design system; file tree under each Epic |
| **EPIC-046** | Task Kanban with Governed Auto-Status | O-10 | 044, 045 | ~30 | Prisma task store wired; `tasks.md` parser (checkbox → status); Kanban board component; implement-event listener; manual move → `StatusTransitionProposal` |

**Build order**: 041 → 043 → 042 → 044 → 045 → 046. 042 and 044 can run in parallel once 043
lands. 045 and 046 can run in parallel.

**First demonstrable milestone** (after 041 + 043 + the `/setup-PMIStudio` half of 042): create a
project in PMI, open the directory in Claude Code, run `/speckit-specify`, and see the execution
appear in PMI. That is the moment the product becomes the thing the objectives describe.

---

## 7. What is parked, not cancelled

The Owner noted that many PMI features are unrelated to Spec Kit and remain wanted. Nothing is
withdrawn from Target Product Scope (`RULE-15` would require a MAJOR BRS revision). The following
move behind the six Epics above in **release** sequencing only:

| Epic / area | Current stage | Proposed posture |
|---|---|---|
| EPIC-038 Engineering Context (pgvector retrieval) | Ready, in progress on this branch | **Finish the current task block, then hold.** It is valuable and unrelated to the ten objectives |
| EPIC-039 Integration Hub | Specified | Hold; EPIC-043 delivers the one integration that matters first and becomes 039's first adapter |
| EPIC-040 Metrics & Reporting | Specified | Hold |
| EPIC-031 Decision & Policy Engine | Ready | Hold; EPIC-046's proposal path uses the existing EPIC-030 adjudication, not 031 |
| EPIC-023/024/025 unattended runs, artifact access, external publishing | Ready | Hold; managed-sandbox family |
| Managed isolated sandbox (`EPIC-003`, `EPIC-028` Docker provider) | Delivered | **Retain as optional mode.** No further investment until local mode ships |

---

## 8. Governance and architecture impacts

| Artifact | Change | Kind |
|---|---|---|
| `ADR-0024` Workspace Fabric | **Controlled local becomes the default and MUST mode for R3-local**; managed isolated becomes optional. The governance contract stays mode-independent | Amend |
| `ADR-0009` Persistent project state | For local mode the **project directory (and its git repository) is the durable substrate**; the "volumes are cache only" rule is scoped to managed mode | Amend |
| `ADR-0017` Interactive workspace | Close: owned by EPIC-041 | Close |
| `ADR-0010` MCP architecture | Close: delivered by EPIC-043 with a stdio server and connector-token authorization (`R-AI-014` resolved as project-scoped tokens) | Close |
| **New `ADR-0030`** Local-first execution and the PMI integration contract | Records the inversion in §3, the token model, and why the database is never written directly | New |
| Constitution | **No principle changes.** XII already says what O-8 wants. Add one sentence to the Directory Contract: a PMI-managed project's `.specify/memory/constitution.md` is **generated** from PMI and must not be hand-edited | Patch (1.6.1) |
| PMI-DOC-004 v2.0 | Add `BR-` requirements for O-1, O-5, O-6, O-9, O-10 under §6.2, §6.4, §6.14, §6.16 (the objectives that no current `BR-` states). **MINOR** revision: nothing leaves scope, release slice `R3-local` is inserted before `R3` | Minor (v2.1) |
| `epic-declarations.json` / stage register | Six Epic directories created via `/speckit-specify`; postures for §7 recorded as `held` with reasons | Declaration act |

---

## 9. Effort and the 80/20 method

| Epic | Documentation & AI (skills, constitution, contracts, specs) | Human development |
|---|---|---|
| 041 | spec, plan, contract for local fabric mode | directory service, token mint, **wiring repairs** (the largest human share) |
| 042 | almost entirely: eleven skill files, constitution generator template, decomposition policy | thin API for policy and constraints |
| 043 | MCP tool contract doc, auth contract | MCP server (small), mounting with auth |
| 044 | spec, stage config reuse | Epic model + migration, board screen |
| 045 | spec | artifact store, viewer |
| 046 | spec, `tasks.md` grammar | parser, board, event listener |

The **wiring repairs in EPIC-041** are the one place the 20 % cannot be avoided, and they are owed
regardless of any pivot: a platform whose worker throws on every generation is not demonstrable
under either model.

---

## 10. Decisions required from the Project Owner

| # | Decision | Recommendation |
|---|---|---|
| D-1 | Adopt Option A (local-first pivot) over B or C | **A** |
| D-2 | Integration transport for O-8: MCP server, REST with token, or both | **Both, MCP first** — MCP is what Claude Code speaks natively; REST is what CI and other agents will use, and EPIC-037 already built it |
| D-3 | Where the constitution lives: PMI is source and the file is generated (recommended), or the file is source and PMI mirrors it | **PMI is source** for constraints and the decomposition policy; generated file carries a "do not edit" header |
| D-4 | Decomposition policy defaults: one spec per Epic; split ceiling **50 tasks**; split proposal requires human confirmation or is automatic | Human confirms the split (Principle X); the ceiling is a project setting with default 50 |
| D-5 | Kanban manual moves: forbidden, proposal-gated (recommended), or direct | **Proposal-gated** — keeps `tasks.md` and the board from disagreeing silently |
| D-6 | Park list in §7 as stated, or adjust | As stated, with EPIC-038's current block finished first |
| D-7 | Sequence: declare all six now, or 041+043 first and the rest after the first milestone | **041 + 043 + 042 now**; 044–046 after the milestone demo, so their specs can cite real execution records |

---

## 11. Related documents

- [PMI-DOC-007_Local_First_Replan_v0.1.md](./PMI-DOC-007_Local_First_Replan_v0.1.md) — the full replan this document summarises in §5–§9

- [`PMI-DOC-004_Business_Requirement_Specification_v2.0.md`](./PMI-DOC-004_Business_Requirement_Specification_v2.0.md) — target scope this amends by MINOR revision
- [`PMI-DOC-004A_V2_Gap_Analysis_and_Amendment_Package_v1.1.md`](./PMI-DOC-004A_V2_Gap_Analysis_and_Amendment_Package_v1.1.md) — the previous gap analysis; `G-16`, `G-17`, `G-18` are the same gaps seen from the control-plane side
- [`PMI-DOC-AMENDMENT-2026-08-25_Execution_Registration.md`](./PMI-DOC-AMENDMENT-2026-08-25_Execution_Registration.md) — Principle XII, which O-8 relies on
- `../.specify/memory/constitution.md` v1.6.0
- `../adr/ADR-0009`, `ADR-0010`, `ADR-0017`, `ADR-0024`, `ADR-0029`
- `../governance/epic-stage-register.md` — the register the six declarations will enter
- `../docs/operator-setup.md` — the manual runbook `/setup-PMIStudio` replaces

## 12. Revision history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-09-03 | First draft from the Owner's ten restated objectives; verified against commit `62644ba` |
