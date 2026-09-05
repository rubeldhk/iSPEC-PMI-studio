# Feature Specification: Artifact Sync and Markdown Viewer

**Feature Branch**: `epic/045-artifact-sync-markdown-viewer`

**Epic**: `EPIC-045` — Artifact Sync and Markdown Viewer

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "Artifact Sync and Markdown Viewer — every governed command's
completion syncs the Epic's markdown set into PMI Studio as immutable versioned files bound to the
execution; the Epic detail shows a file tree and renders markdown read-only with a version picker."
*(PMI-DOC-007 §7, verbatim)*

> **This is the fifth Epic of the local-first replan** (`D-7`, PMI-DOC-007) and the second half of
> milestone **M3 — the journey visible**. Since `EPIC-042` the finish hook of every governed
> command already computes the digest of each artifact file of the Epic, calls
> `pmi.artifacts.sync` with the files' paths, digests and content, and records the digests on the
> completion — and the platform answers *not available until `EPIC-045`*, so the call is reported
> as information and the content is discarded. The board `EPIC-044` built therefore knows *that*
> `spec.md` was produced and *when*, but nobody without a checkout can read it, and `plan.md`,
> `tasks.md`, `research.md`, `data-model.md`, the contracts and the checklists are never captured
> anywhere (PMI-DOC-004B `O-9`). This Epic makes the reserved tool live: the platform stores every
> synced file as an **immutable version keyed by its digest**, bound to the execution that produced
> it and, through that execution's binding, to its Epic; shows the Epic's files as a **tree** on the
> Epic detail; renders any of them **read-only** with a **version picker** that names the execution
> each version came from; and treats the Epic's synced `spec.md` as the Epic's specification, so
> the specification list `EPIC-044` decorated has rows in local-first mode. The project directory
> stays authoritative for content; PMI Studio is its mirror and the record of which execution wrote
> what (PMI-DOC-007 §2.3).
>
> **Eight judgement calls were made in writing this document**, each listed under **Assumptions**
> with the reasoning and the alternative, so that `/speckit-clarify` can confirm or overturn them
> with the requester. No `[NEEDS CLARIFICATION]` marker is used: every call has a defensible
> default and none changes whether the Epic should exist.

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §7 `EPIC-045` brief (`US1`, `US2`, `FR-ART-001`, `FR-ART-010`, `FR-ART-020`) | every `FR-ART-` below |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §2.2 step 7 — the Epic's markdown set visible under the Epic after every sync · §5.1 principle 5 *artifacts are synced, then viewed* | FR-ART-001 to FR-ART-009, FR-ART-010 to FR-ART-019 |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §2.3 source-of-truth boundaries — the directory authoritative for `spec.md`, `plan.md`, `tasks.md`, `analysis.md`, `research.md`, `data-model.md`, `contracts/*`, `checklists/*`; PMI mirrors by digest; never edited in the PMI UI | FR-ART-010, FR-ART-017, FR-ART-002 |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §3 domain model — `ArtifactFile` (new): path, kind, digest, size, content, execution, synced at; one row per synced version, immutable | FR-ART-001 to FR-ART-005, Key Entities |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §4.1 `pmi.artifacts.sync` (write; upload one Epic's markdown set bound to an execution; idempotency key; refusals with `structuredContent`) · §4.2 `POST /v1/projects/{id}/artifacts/sync`, `GET /v1/epics/{id}/artifacts`, `GET /v1/artifacts/{id}` | FR-ART-040 to FR-ART-049 |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §5.2 hook map — `speckit.pmi.finish` syncs after every governed command; `after_implement` syncs artifacts and tasks | FR-ART-003, FR-ART-046 |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §6 surfaces — Epic detail: file tree of synced artifacts, markdown viewer, version picker, digest (`O-9`) · §8 milestone `M3` · §10 *one new dependency* (a markdown renderer) is a plan decision | FR-ART-010 to FR-ART-019, FR-ART-061 |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §9.3 `LR-09` every synced artifact readable in PMI Studio under its Epic, versioned and immutable · §11 `R-04` no credential material in the directory or chat · `R-05` digest per sync, conflicts surfaced | FR-ART-001, FR-ART-011, FR-ART-053, FR-ART-009 |
| `SRS/PMI-DOC-004B_…Objective_Verification_and_Replan_v0.1.md` | §5.2 `O-9` and its verdict (no API returns content; no markdown renderer; `plan.md`, `research.md`, `data-model.md`, `contracts/` never captured) | FR-ART-002, FR-ART-011, FR-ART-042 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6 `BR-0035` engine provenance on every generated artifact · `BR-0141` evidence provenance (source, time, artifact, version, integrity) · `RULE-10` every artifact versioned and traceable · §9 *Markdown/Git-compatible authoritative specifications remain exportable and inspectable* | FR-ART-001, FR-ART-004, FR-ART-013, FR-ART-031 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | `BR-0003` authorization — artifact access role- and policy-controlled | FR-ART-050, FR-ART-051 |
| `SRS/PMI-DOC-005_Design_System_and_UX_Standards_v1.0.md` · `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` | the four states of every surface; the Specifications and Requirement Room areas the viewer sits in | FR-ART-015, FR-ART-011 |
| `specs/042-pmi-spec-kit-extension/spec.md` | `FR-EXT-014` the completion carries the digests of what was produced · `FR-EXT-016` `speckit.pmi.finish` calls `pmi.artifacts.sync`; while reserved, the refusal is information — this Epic makes it content | FR-ART-003, FR-ART-009, FR-ART-046 |
| `specs/043-pmi-integration-contract/spec.md` · `contracts/mcp-tool-surface.md` §3 | `FR-PIC-002`, `FR-PIC-045` — the reserved tool is listed, schema-validated and refuses by name; its argument shape is the one this Epic must accept | FR-ART-040, FR-ART-045 |
| `specs/044-epic-model-journey-board/spec.md` | `FR-EPB-025` (deferral note of 2026-09-05) — the hand-off: bind a synced specification to the Epic of the execution that produced it · `FR-EPB-022` a slug change renames nothing on disk · `FR-EPB-008` an unbound execution is listed, never attached | FR-ART-030, FR-ART-034, FR-ART-035, FR-ART-007 |
| `specs/037-governed-execution-registry/contracts/execution-contract.md` | completion with output binding (the generated artifact digests) — what the sync is cross-checked against | FR-ART-009 |
| `specs/005-specification-generation/spec.md` (`FR-014`, `R-007`) | a specification version keeps the engine's output verbatim, with who and when — the entity the synced `spec.md` becomes a version of | FR-ART-030 to FR-ART-033 |
| `.specify/memory/constitution.md` | XII — Execution Registration (contract, never the database; the sync is a contract operation) · IV, V | FR-ART-003, FR-ART-040 |

**Requirements not yet covered by SRS**: none by document — every requirement traces to
PMI-DOC-007, which lives in `SRS/`. **One carries a provisional identifier** (`LR-09`) that receives
a `BR-` number only in PMI-DOC-004 v2.1; the back-fill is owed by the Project Owner before the
platform release gate and is restated under Assumptions (the `D-46` pattern, as `EPIC-041` to
`EPIC-044`).

## Principle Conformance & Deferrals *(mandatory — PMI-DOC-003, decision D-6)*

| ID | Principle | Status | Evidence, or reason for deferral + where it lands |
|----|-----------|--------|---------------------------------------------------|
| PP-001 | Specification First, AI Second | Satisfied | The specification the agent wrote is what is stored and read; PMI Studio adds nothing to it and edits nothing in it (`FR-ART-010`) |
| PP-002 | Single Source of Truth | Satisfied | The directory is authoritative for content, PMI Studio for which execution wrote which digest (`FR-ART-017`); a file exists once per digest (`FR-ART-001`) |
| PP-003 | Human-in-the-Loop | Satisfied | Nothing here changes a file or a status; the viewer is read-only and says so (`FR-ART-010`); a mismatch between what the completion claims and what was synced is shown to a person, never repaired (`FR-ART-009`) |
| PP-004 | End-to-End Traceability | Satisfied | Every version names the execution, command, outcome and time that produced it and its digest (`FR-ART-013`); requirement → Epic → execution → artifact version is one chain (`FR-ART-003`, `FR-ART-030`) |
| PP-005 | Modular Architecture | Satisfied | The artifact store is its own module beside Epics and executions; the renderer is one component of the design system (`FR-ART-061`) |
| PP-006 | Engine Independence | Satisfied | The artifact set is the extension contract's list of file names, read as configuration; the platform code names no toolkit (`FR-ART-002`; `EPIC-041`'s rule stands) |
| PP-007 | API & MCP First | Satisfied | The sync is the reserved MCP tool made live and its REST binding; the tree and the content are routes the screens read (`FR-ART-040` to `FR-ART-042`) |
| PP-008 | Security by Design | Satisfied | Rendering executes no script and fetches nothing remote (`FR-ART-020` to `FR-ART-022`); a sync is scoped to the credential's project (`FR-ART-050`); credential material in a file is refused, never stored (`FR-ART-053`) |
| PP-009 | Quality by Design | Satisfied | Digest-keyed immutability and rendering safety are mutation-tested (`SC-ART-002`, `SC-ART-004`); the sync is proved through the real hook against the composed application (`FR-ART-046`) |
| PP-010 | Observability by Default | Satisfied | Every sync is audited with the execution, the file count and the digests (`FR-ART-052`); the viewer shows what the last sync saw and what it no longer sees (`FR-ART-014`) |
| PP-011 | Documentation as Code | Satisfied | The documents *are* the artifacts; they stay markdown in git and are mirrored, never transformed, in PMI Studio (`FR-ART-001`) |
| PP-012 | Everything Versioned | Satisfied | One immutable row per digest; every execution's manifest kept; nothing overwritten or deleted (`FR-ART-001`, `FR-ART-005`, `FR-ART-014`) |
| PP-013 | Knowledge-Driven Engineering | Deferred | Retrieval over synced artifacts is `EPIC-038`'s (held, PMI-DOC-007 §9.4 — *more valuable once artifacts are synced*); this Epic supplies the corpus, not the retrieval |
| PP-014 | Configuration over Customization | Satisfied | The artifact set, the size limits and the kinds are configuration (`FR-ART-002`, `FR-ART-008`) |
| PP-015 | Open Standards | Satisfied | Markdown as written; SHA-256 digests; MCP for the tool (`D-2`) |
| PP-016 | Explainable AI | Satisfied | A reader sees exactly which execution produced the version in front of them and its digest (`FR-ART-013`, `FR-ART-016`) |
| PP-017 | Cost-Aware AI | Not applicable | No model call is made by this Epic; it stores and renders |
| PP-018 | Scalability First | Satisfied | Content is stored once per digest; the tree lists versions without loading content (`FR-ART-042`); rendering is bounded with a raw fallback (`FR-ART-025`) |
| PP-019 | Continuous Improvement (DORA/SPACE) | Deferred | Sync counts and artifact churn per Epic are inputs to `EPIC-040` Metrics & Reporting (held per §9.4); nothing is derived here |
| PP-020 | Customer Value | Satisfied | `SC-ART-003` — a stakeholder without a checkout reads the Epic's current `spec.md`, `plan.md` and `tasks.md` in PMI Studio after a run, in one session |

**Deferral count**: 2 — `PP-013`, owner `EPIC-038` (held); `PP-019`, owner `EPIC-040` (held);
both reviewed at this Epic's convergence gate.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - I read the Epic's files without a checkout (Priority: P1)

As a stakeholder who has no clone of the project, I open an Epic in PMI Studio and see the files its
governed commands produced — `spec.md`, `plan.md`, `tasks.md` and the rest — as a tree, and I read
any of them rendered as a document. What I read is what the last completed command left on disk,
and the screen tells me which execution that was.

**Why this priority**: it is the objective (`O-9`) and the half of `M3` still missing. Every other
story exists so that this one is trustworthy.

**Independent Test**: with the files of one Epic synced once, open the Epic detail: the tree lists
each file with its kind; opening `spec.md` renders it read-only with the producing execution and the
digest beside it.

**Acceptance Scenarios**:

1. **Given** an Epic whose `specify` execution completed and synced, **When** a member opens the Epic
   detail, **Then** a *Files* section lists `spec.md` under the Epic with its kind, size, digest and
   the execution that produced it.
2. **Given** the same Epic after `plan` and `tasks` completed, **When** the tree is opened, **Then**
   `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `tasks.md` and every file under
   `contracts/` and `checklists/` appear, grouped by their folders, and nothing else.
3. **Given** a file in the tree, **When** it is opened, **Then** its markdown renders as a document —
   headings, lists, tables, code blocks, links — with no control to edit, save, upload or delete.
4. **Given** an Epic with no synced file, **When** the detail is opened, **Then** the section states
   that no governed command has synced files yet and which command produces the first one.
5. **Given** the tree is loading, has failed, or loaded partly, **When** the detail renders, **Then**
   the section states that state in words; the rest of the Epic detail stands.

---

### User Story 2 - Every completion syncs the Epic's markdown set, once and immutably (Priority: P1)

As a developer running governed commands on my own machine, the finish hook that already calls
`pmi.artifacts.sync` now succeeds: PMI Studio stores each file I produced as an immutable version
keyed by its digest, bound to my execution and to my Epic. Syncing an unchanged file creates nothing
new; syncing the same run twice creates nothing new; my `tasks.md` and the digests my completion
reported agree with what was stored.

**Why this priority**: without the store there is nothing to read; without immutability and
idempotence the store lies. The hook has been calling this tool since `EPIC-042`; making it succeed
is the smallest change with the largest effect.

**Independent Test**: run the finish sequence through a real `pmi-studio` server for an Epic with
three files; the store has three versions bound to the execution. Run it again unchanged: still
three. Change one file and run again: four, with the new one bound to the new execution.

**Acceptance Scenarios**:

1. **Given** a completed `specify` execution bound to Epic 3 and its finish hook, **When** the hook
   syncs `specs/003-reports/spec.md`, **Then** one version exists for that path and digest, bound to
   the execution and to Epic 3, and the hook's line reports the count synced.
2. **Given** the same file synced again by a later execution with the same digest, **When** the sync
   completes, **Then** no new version is created and the later execution's manifest lists the
   existing version.
3. **Given** a file whose content changed, **When** the sync completes, **Then** a new version exists
   beside the old one; the old one is unchanged and still readable.
4. **Given** a sync whose stated digest does not match the content sent, **When** it is received,
   **Then** that file is refused with a coded reason, the other files of the sync are stored, and
   the refusal is visible on the execution.
5. **Given** the same sync request sent twice (a retried hook), **When** both are processed — even
   at the same moment — **Then** the store holds each version once and both requests succeed.
6. **Given** a completion whose output binding names a digest the sync never delivered, **When** the
   Epic detail is opened, **Then** the file is marked *reported, not synced* rather than silently
   absent.

---

### User Story 3 - I pick an earlier version and see what a given execution produced (Priority: P2)

As a reviewer, I choose an earlier version of a file and read exactly what the execution that
produced it wrote, with its digest, so that a later change can be traced to the command and the
moment it happened.

**Why this priority**: versions without a picker are storage, not history. This is the review half
of `LR-09`.

**Independent Test**: an Epic with `spec.md` synced by three executions; the picker lists three
versions newest first, each naming its execution, command, outcome and time; choosing the oldest
renders the oldest content and its digest.

**Acceptance Scenarios**:

1. **Given** a file with several versions, **When** it is opened, **Then** the newest version renders
   and the picker lists every version with the producing execution's command, outcome and time and
   the digest.
2. **Given** an earlier version chosen, **When** it renders, **Then** the content is that version's,
   the header says it is not the current one, and the digest shown equals the version's digest.
3. **Given** two executions that synced identical content for the file, **When** the picker is
   opened, **Then** both executions are listed against the one version — the content is stored once.
4. **Given** a file present in an earlier sync and absent from the latest, **When** the tree is
   opened, **Then** the file is still listed, marked *not in the latest sync*, and its versions still
   open.

---

### User Story 4 - The synced `spec.md` is the Epic's specification (Priority: P2)

As a project owner, the specification list shows the specification each Epic's `spec.md` sync
produced, with its Epic and stage, without anyone creating or assigning it by hand — the hand-off
`EPIC-044` left for this Epic.

**Why this priority**: `EPIC-044` decorated the specification list with Epic and stage but, in
local-first mode, nothing yet creates a specification row; this closes the gap on the entity the
platform already has.

**Independent Test**: sync an Epic's `spec.md` from a bound execution; the specification list shows
one specification for that Epic, at the Epic's stage; sync a changed `spec.md`; the specification
has a second version.

**Acceptance Scenarios**:

1. **Given** an Epic with no specification, **When** its bound `specify` execution syncs `spec.md`,
   **Then** the Epic owns exactly one specification whose current version is that content, whose
   provenance names the execution's agent, and which the specification list shows under the Epic.
2. **Given** the Epic's specification exists, **When** a later execution syncs a changed `spec.md`,
   **Then** the specification gains a new version and its current version is the new content; the
   earlier version stays readable.
3. **Given** a later sync of an unchanged `spec.md`, **When** it completes, **Then** the specification
   gains no version.
4. **Given** a sync from an execution bound to a child Epic (`7a`), **When** `spec.md` is synced,
   **Then** the specification belongs to the child, not the parent.

---

### User Story 5 - Rendering is safe and honest (Priority: P3)

As a workspace administrator, I know that a markdown file written by an agent or edited by hand
cannot run code in a colleague's browser or call out to the network when it is opened in PMI Studio,
and that whatever the renderer cannot show is shown as text rather than dropped.

**Why this priority**: the content is produced outside the platform by an agent; the viewer is the
first place untrusted text meets every member's browser.

**Independent Test**: a corpus of hostile markdown (script tags, event-handler attributes,
`javascript:` links, remote images, embedded frames, an unknown fenced language) renders with no
script executed, no outbound request, and every hostile construct shown as escaped text or a plain
code block.

**Acceptance Scenarios**:

1. **Given** a file containing raw HTML with a script and an event handler, **When** it renders,
   **Then** the HTML appears as escaped text and no script runs.
2. **Given** a file with a remote image and a `javascript:` link, **When** it renders, **Then** the
   image is shown as its alternative text and the link is inert; no request leaves the browser.
3. **Given** a fenced block in a language the renderer does not know (a diagram grammar), **When** it
   renders, **Then** the block is shown as code, not hidden.
4. **Given** a relative link to a sibling artifact (`./plan.md`), **When** it is followed, **Then** the
   viewer opens that file's current version within the same Epic.
5. **Given** a file above the rendering size limit, **When** it is opened, **Then** the viewer offers
   the raw text and says why it did not render.

---

### Edge Cases

- **A sync arrives for an execution that is not terminal.** It is stored and bound; the execution's
  completion later names the digests. A sync for an unknown execution id is refused by name.
- **A sync arrives for an execution bound to no Epic** (a hook in a directory whose `specs/` folder
  outran PMI Studio, `FR-EPB-008`). The files are stored under the project as *unbound*, listed with
  the unbound executions on the board, never attached to a guessed Epic.
- **Two executions sync the same path with different content within the same second.** Two
  versions exist; the current one is the one whose execution completed later, and the picker shows
  both with their times.
- **The Epic's slug changes** (`FR-EPB-022`). Paths already synced keep the directory name they were
  synced under; the tree groups files by their path under the Epic, so an Epic may show two
  directory names with a note that the slug changed.
- **A file path outside the artifact set** (`notes.txt`, `../other-epic/spec.md`, an absolute path).
  Refused per file with a coded reason; the rest of the sync is stored.
- **A file larger than the limit, or not UTF-8 text.** Refused per file with a coded reason; the
  digest is not stored, so nothing pretends it has content.
- **A file contains what looks like a credential** (`pmi_ct_…`, `Bearer …`, `sk-…`). The file is
  refused with a coded reason naming the shape, never stored; the refusal is visible on the
  execution (`R-04`).
- **The same content under two paths** (`contracts/api.md` copied to `contracts/api-v2.md`). Two
  versions, one content row; each path lists its own history.
- **A stakeholder opens a version while a sync is in progress.** The version they opened is
  immutable; the tree they see is the one the last completed sync produced until they reload.
- **The connector credential of another project syncs or reads.** Refused as absence — the same rule
  every connector read applies (`FR-EPB-063`).

## Requirements *(mandatory)*

### Functional Requirements

**The sync**

- **FR-ART-001**: A synced file MUST be stored as an **immutable version keyed by its digest** within
  the project: the same path with the same digest MUST exist as one row however many times it is
  synced; content MUST never be overwritten, edited or deleted through any route, tool or screen.
- **FR-ART-002**: The **artifact set** a sync accepts MUST be the extension contract's: the Epic
  directory's `spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`, `analysis.md`,
  `quickstart.md`, and every `.md` file directly under its `contracts/` and `checklists/` folders,
  named relative to the project directory (`specs/<dir>/…`). The set MUST be configuration the
  platform reads, not a code path; each file MUST be classified by **kind** from its path (`spec`,
  `plan`, `tasks`, `research`, `data-model`, `analysis`, `quickstart`, `contract`, `checklist`).
- **FR-ART-003**: Every synced version MUST be bound to the **execution** the sync names, and
  through that execution's input binding to its **Epic** — a plain number, or a parent number and
  split suffix resolved as the board resolves it (`FR-EPB-026`); a sync MUST NOT name an Epic
  directly, and the Epic MUST NOT be inferred from the path.
- **FR-ART-004**: The platform MUST recompute each file's digest from the content received and MUST
  refuse a file whose stated digest differs, with a coded reason; a refused file MUST NOT be stored
  and MUST NOT fail the other files of the same sync.
- **FR-ART-005**: Every sync MUST produce a **sync record** — the execution, who synced, when, and
  the list of (path, digest) it delivered — so that *what a given execution produced* is answerable
  even when every file was unchanged and no version was created (`US3`).
- **FR-ART-006**: A sync MUST be idempotent under retry and under concurrency: the same request sent
  twice, or two syncs of the same content at the same moment, MUST leave exactly one version per
  (path, digest) and MUST both succeed; an idempotency key MUST be accepted and recorded on the sync
  record (`EPIC-037`'s rule for mutating tools).
- **FR-ART-007**: A sync for an execution bound to no existing Epic of the project MUST be stored
  under the project as **unbound**, listed with the board's unbound executions, and MUST NOT be
  attached to an Epic by inference (`FR-EPB-008`).
- **FR-ART-008**: A sync MUST refuse, per file and with a coded reason, a path outside the artifact
  set, a path that leaves the Epic directory, content that is not UTF-8 text, and content above the
  size limit; the limits (bytes per file, files per sync) MUST be configuration with stated defaults
  (1 MiB per file, 200 files per sync).
- **FR-ART-009**: The digests a completion reports in its output binding (`FR-EXT-014`) MUST be
  cross-checked against the execution's sync records on read: a reported digest with no synced
  version MUST be shown on the Epic detail as *reported, not synced*; a synced version the
  completion did not report MUST be shown as *synced, not reported*; neither MUST be repaired or
  hidden (`R-05` pattern).

**The viewer**

- **FR-ART-010**: The viewer MUST NOT offer editing of any kind — no edit, save, upload, rename,
  delete or comment-in-file control — and MUST state that the project directory is authoritative and
  PMI Studio a mirror.
- **FR-ART-011**: The Epic detail MUST show a **file tree** of the Epic's synced files, grouped by
  folder, each with its kind, size, digest and the execution that produced its current version;
  a project member MUST reach it from the Epic detail and from the board card's *Open Epic* link.
- **FR-ART-012**: Opening a file MUST render its **current** version — the version delivered by the
  latest completed sync that included the path — and MUST name that sync's execution, command,
  outcome and time.
- **FR-ART-013**: Every file MUST have a **version picker** listing its versions newest first, each
  with the producing execution's command, outcome and time, the digest, and — where several
  executions delivered the same digest — every execution against the one version.
- **FR-ART-014**: A file present in an earlier sync and absent from the latest MUST stay listed,
  marked *not in the latest sync*, with its versions readable; nothing synced is ever removed from
  the tree.
- **FR-ART-015**: The tree and the viewer MUST state their four states — loading, empty, error,
  partial — in words (`FR-SHL-060`); an empty tree MUST name the command that produces the first
  file; a failure of the tree MUST leave the rest of the Epic detail standing.
- **FR-ART-016**: The rendered document MUST show, beside it, the digest of the version and the
  execution that produced it, and MUST say when the version shown is not the current one.
- **FR-ART-017**: The viewer MUST render markdown as a document — headings, paragraphs, lists,
  tables, code blocks, block quotes, links, emphasis — and MUST show anything it cannot render as
  text or as a plain code block, never dropping content.
- **FR-ART-018**: A relative link to a sibling artifact of the same Epic MUST open that file's
  current version in the viewer; an external link MUST open outside the application without
  referrer or opener; a link to a path the Epic has no version of MUST say so.
- **FR-ART-019**: The specification list's row for an Epic's specification MUST open the same
  rendered `spec.md` the Epic detail shows (one rendering, two ways in).

**Rendering safety**

- **FR-ART-020**: Rendering MUST execute no script from the markdown: no script element, no
  event-handler attribute, no `javascript:` or `data:` URL may reach the document.
- **FR-ART-021**: Raw HTML in a markdown file MUST be shown as escaped text, not interpreted.
- **FR-ART-022**: Rendering MUST fetch nothing remote: images MUST be shown as their alternative
  text or as a plain link, and embedded frames or objects MUST be shown as text; opening a file MUST
  cause no request to any host other than PMI Studio.
- **FR-ART-023**: A fenced block in a language the renderer does not know MUST be shown as a code
  block with the language named, never hidden and never interpreted.
- **FR-ART-024**: The safety rules MUST be tested against a hostile corpus that is part of the
  repository and MUST be mutation-tested: disabling the sanitising step MUST be observed to fail
  the tests (`SC-ART-004`).
- **FR-ART-025**: A file above the rendering size limit (configuration, default 2 MiB) MUST be
  offered as raw text with the reason; a file below it MUST render within the time stated in
  `SC-ART-006`.

**The Epic's specification**

- **FR-ART-030**: The first sync of an Epic's `spec.md` from an execution bound to that Epic MUST
  create the Epic's **specification** with that content as its first version, bound to the Epic
  (`FR-EPB-025`'s hand-off); the Epic MUST own at most one specification created this way.
- **FR-ART-031**: A later sync of the Epic's `spec.md` with a new digest MUST add a new version to
  that specification and make it current; a sync with an unchanged digest MUST add no version.
- **FR-ART-032**: A specification version created by sync MUST carry its **provenance**: the
  execution, the agent identity the execution recorded, and the time — never a person as author
  (`BR-0035`); the specification's human lifecycle state MUST be left where it is.
- **FR-ART-033**: A specification created by sync MUST appear on the specification list with its
  Epic and stage as `FR-EPB-050` requires, and MUST be assignable by an owner only if it has no
  Epic — one created by sync always has one.
- **FR-ART-034**: A sync from an execution bound to a **child Epic** (`<number><suffix>`) MUST create
  or extend the child's specification, never the parent's.
- **FR-ART-035**: A slug change (`FR-EPB-022`) MUST rename nothing in the store: paths are kept as
  synced; the tree groups by path and notes that the Epic's slug differs from a directory name it
  shows.

**The contract**

- **FR-ART-040**: `pmi.artifacts.sync` MUST become live with the argument shape the reserved tool
  already validates (`executionId`, `files[] { path, digest, content }`, an idempotency key) and MUST
  answer with the count of versions created, the versions reused and the files refused with their
  reasons; its refusals MUST use the connector refusal vocabulary (`FR-PIC-002`), and the
  `not_available_until` refusal for this tool MUST disappear from the surface.
- **FR-ART-041**: The REST binding `POST /v1/projects/{id}/artifacts/sync` MUST answer the same
  operation under a connector scope `artifacts.sync`, project-scoped like every connector operation
  (`{id}` is `me` or the credential's project).
- **FR-ART-042**: Session reads MUST exist for the tree and for content: one read returns an Epic's
  files with their versions and producing executions without content; one read returns one version's
  content; both MUST be scoped to the caller's workspace and open to the project's members.
- **FR-ART-043**: A connector credential MUST NOT read artifact content or trees in this Epic; the
  agent has the files. (Recorded as a judgement call — Assumption 6.)
- **FR-ART-044**: Sync refusals per file MUST be recorded on the execution as a comment of a type the
  registry admits, so that a refused credential-shaped file or a digest mismatch is visible on the
  timeline, not only in the hook's output.
- **FR-ART-045**: `EPIC-043`'s tool-surface contract MUST be amended with a dated note moving
  `pmi.artifacts.sync` from *reserved* to *live*, and its contract test MUST pass with fourteen
  tools and one fewer reserved row.
- **FR-ART-046**: The hooks MUST NOT change: `speckit.pmi.finish` as `EPIC-042` shipped it MUST
  produce the sync, proved through a real `pmi-studio` server against the composed application, so
  the stub-proved call becomes a content-proved one.

**Security and scoping**

- **FR-ART-050**: Versions, sync records and the specification they create MUST be scoped by
  workspace and project as every product record is; a credential or session of another project MUST
  read nothing and sync nothing.
- **FR-ART-051**: Reading the tree and content MUST be open to every workspace member with access to
  the project; no artifact write exists for a session.
- **FR-ART-052**: Every sync MUST produce an audit entry naming the credential, the execution, the
  Epic, the number of versions created and reused, the files refused, and the digests.
- **FR-ART-053**: A file whose content matches a credential shape (`pmi_ct_…`, `sk-…`, `Bearer …`)
  MUST be refused with a coded reason naming the shape and MUST NOT be stored; the refusal MUST
  never echo the matched text (`R-04`; `EPIC-043`'s scrubbing rule).

**Governance records**

- **FR-ART-060**: `governance/repository-layout.md` MUST register this Epic's directory, and the
  artifact store's module and the viewer component MUST be registered where the layout registers
  modules and components.
- **FR-ART-061**: The one new runtime dependency PMI-DOC-007 §10 anticipates (a markdown renderer)
  MUST be a recorded decision in `specs/_shared/dependencies.md` at the plan step, with the
  sanitising strategy stated beside it; no second renderer may be added.

### Key Entities

- **Artifact version**: an immutable synced file — project, path, kind, digest, size, content,
  first synced at; exists once per (project, path, digest); bound to one or more executions
  through sync records; bound to an Epic through the execution, or *unbound*.
- **Sync record**: one sync — the execution, the credential, the time, the idempotency key, the
  list of (path, digest) delivered, the versions created, the versions reused, the files refused
  with reasons.
- **Artifact kind**: the classification of a path within the artifact set — `spec`, `plan`,
  `tasks`, `research`, `data-model`, `analysis`, `quickstart`, `contract`, `checklist`; configuration.
- **Current version**: a projection — for a path, the version delivered by the latest completed
  sync that included it; never stored.
- **Reported-versus-synced finding**: a projection on read — a digest the completion reported with
  no version, or a version the completion did not report.
- **Specification by sync**: the Epic's specification created from its `spec.md`, one version per
  new digest, provenance from the execution.
- **Hostile corpus**: the repository's set of markdown files exercising every rendering-safety rule.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-ART-001**: After any governed command completes with the finish hook, **100%** of the
  Epic's artifact files it produced are readable in PMI Studio on the next load of the Epic detail,
  each naming that execution.
- **SC-ART-002**: **Zero** duplicate versions: syncing the same content twice, or from two syncs at
  the same moment, yields exactly one version per (path, digest) and both syncs succeed —
  mutation-tested by removing the digest-keyed uniqueness and observing the tests fail.
- **SC-ART-003**: **Milestone M3, second half**: from a governed command completing on the
  reference-local stack to a person without a checkout reading the Epic's current `spec.md`,
  `plan.md` and `tasks.md` in PMI Studio, in **one session**, recorded as a transcript.
- **SC-ART-004**: Against the hostile corpus, **zero** scripts execute and **zero** requests leave
  the browser to any host other than PMI Studio; disabling the sanitising step is observed to fail
  the tests.
- **SC-ART-005**: For an Epic whose `spec.md` was synced by ten executions, every version is
  retrievable by picker, and the digest shown for each equals the digest recomputed from its
  content in **100%** of cases.
- **SC-ART-006**: The tree of an Epic with 50 files and 20 versions each lists in under **2
  seconds**; a 500 KiB markdown file renders in under **2 seconds** on the reference-local stack.
- **SC-ART-007**: **100%** of Epics whose `spec.md` was synced from a bound execution show exactly
  one specification on the specification list, under the Epic, at the Epic's stage.
- **SC-ART-008**: **Zero** controls on the tree or the viewer edit, upload, rename or delete a file;
  both surfaces state their four states on **100%** of loads.

## Assumptions

Eight judgement calls, each with the alternative that lost. All eight await `/speckit-clarify`.

1. **The synced `spec.md` becomes the Epic's specification — a version of the existing
   specification entity, not only an artifact** (`FR-ART-030` to `FR-ART-034`). `EPIC-044` left the
   hand-off that artifact sync binds the specification row to the Epic; the specification list,
   the out-of-date tracking and the Rooms already work on that entity. The alternative — keep
   synced files apart from specifications — leaves the specification list empty for every
   local-first project and two notions of *specification* in one product. The risk accepted: a
   specification's engine identity becomes *the agent that ran the command*, which is the truth.
2. **The file tree and viewer live on the Epic detail, reached from the board card** (`FR-ART-011`).
   PMI-DOC-007 §6 places the viewer under *Specifications*; `EPIC-044` put the Epic detail in the
   Requirement Room and the board in Specifications, with the card linking to the detail. One place
   with two ways in beats two renderings; the specification list's row opens the same rendering
   (`FR-ART-019`). The alternative — a second viewer in Specifications — is a second thing to keep
   equal.
3. **Immutability is by digest across the project, with a sync record per execution**
   (`FR-ART-001`, `FR-ART-005`). PMI-DOC-007 §3 says *one row per synced version, immutable* and
   `FR-ART-001` says *a re-sync of an unchanged file creates no row*; both hold only if the row is
   the content and the per-execution history is a separate record. The alternative — a row per
   sync — duplicates every unchanged `spec.md` on every command.
4. **The artifact set is the extension contract's list, not "any markdown"** (`FR-ART-002`). The
   finish hook digests exactly `spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`,
   `analysis.md`, `quickstart.md`, `contracts/*.md` and `checklists/*.md`; accepting more would
   store files no hook sends and invite paths outside the Epic. The alternative — accept any path
   under the Epic directory — is reversible at the plan step by widening the configuration.
   `closure.md` and `defects/*.md` are therefore **not** synced in this Epic (recorded).
5. **The Epic is resolved from the execution's binding, never from the path** (`FR-ART-003`). A
   path names a directory; `EPIC-044` decided directories and Epics are matched by execution, and
   a slug may change. The alternative — parse `specs/007-intake` into Epic 7 — breaks the moment a
   directory is hand-made or renamed.
6. **Connector credentials sync but do not read artifacts** (`FR-ART-043`). The agent holds the
   files; a read scope would widen the credential for no consumer. The alternative — a
   `GET /v1/epics/{id}/artifacts` connector read for digest comparison — is unnecessary while the
   server deduplicates by digest, and is the follow-up if a hook ever needs it.
7. **Rendering fetches nothing remote and interprets no HTML** (`FR-ART-020` to `FR-ART-022`).
   Remote images would leak every reader's address to any host an agent names; raw HTML is the
   classic injection path. The alternative — allow images from an allow-list — is a configuration
   the requester may add later; the default is closed.
8. **Per-file refusal, not whole-sync refusal** (`FR-ART-004`, `FR-ART-008`, `FR-ART-053`). One bad
   file should not cost a stakeholder the other nine; the refused file is visible on the execution
   (`FR-ART-044`). The alternative — all-or-nothing — is simpler to reason about and loses more.

**Provisional identifier**: `LR-09` (PMI-DOC-007 §9.3) receives a `BR-` number only in PMI-DOC-004
v2.1; the back-fill is owed by the Project Owner before the platform release gate.

**Dependencies**: `EPIC-043` complete (the `pmi-studio` server, the reserved tool's schema, the
connector scopes and refusal vocabulary); `EPIC-042` complete (`speckit.pmi.finish` digests and
calls the sync; the completion carries the digests); `EPIC-044` complete (Epics, the binding
resolution, the board's unbound group, the specification list's Epic and stage columns);
`EPIC-037`'s execution records and comments; `EPIC-005`'s specification and version entities.
**Out of scope**: parsing `tasks.md` into tasks and the Kanban (`EPIC-046`); a diff between two
versions; search or retrieval over artifacts (`EPIC-038`, held); syncing non-markdown or binary
files; editing anything; syncing `closure.md`, `defects/` or the constitution (the constitution
has its own render and digest, `EPIC-042`); renaming directories on disk; any change to the hooks
or to the execution tools beyond making the reserved tool live.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

This Epic may be declared complete and promoted out of `local` only when ALL hold:

- [ ] Every implementation task has a passing unit test — or, for document/configuration outputs, a
      passing executable conformance check (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/045-artifact-sync-markdown-viewer/defects/` contains no open defect records
- [ ] Promotion follows `local → dev → stage → prod` with no skipped environment
- [ ] A closing report was published: work completed, work deferred, and the recommended next task
      named as a concrete Spec Kit command (Constitution IX)
- [ ] **`SC-ART-002` and `SC-ART-004` are mutation-tested** and the suite observed failing under
      each mutation
- [ ] **The sync is proved concurrent**: two simultaneous syncs of the same content through the
      composed application both succeed and leave one version (`FR-ART-006`; the `DEF-044-003`
      lesson applied before, not after)
- [ ] **Constitution XI Tier 2**: a transcript of User Story 1, User Story 2 and User Story 3
      against the running application is recorded (`SC-ART-003`)
- [ ] `EPIC-043`'s tool-surface contract carries the dated note and its test is green with the
      reserved row removed (`FR-ART-045`); `governance/repository-layout.md` registers this Epic
      (`FR-ART-060`); the renderer dependency is recorded (`FR-ART-061`)
- [ ] The hooks are unchanged and the real finish sequence produces the store's content against
      the composed application (`FR-ART-046`)
