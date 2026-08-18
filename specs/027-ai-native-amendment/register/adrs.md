# Register: Adrs

**Epic**: `EPIC-027` | **Schema**: [../contracts/reconciliation-register.md](../contracts/reconciliation-register.md)

The seventeen ADR subjects — twelve from Native §27, five from Cosmos §9 (`D-35`).

An ADR whose decision is not yet takeable is recorded as **open, naming what it awaits**. Native §26
forbids answering by assumption, and an ADR that exists as an open question is what prevents one.

Existing `ADR-0001`–`ADR-0005` are **preserved**; `ADR-0002` is *extended*, not superseded (`D-36`).

> **Generated projection**: `register.json` is built from this file by `pnpm register:build`.
> Never hand-edit the projection — `G-27-11` compares its digest to this file and fails on drift.

## Seventeen subjects, and why every one exists now

Native §27 names twelve ADR subjects; Cosmos §9 names five more. **`D-35` decided all seventeen are
created now**, each either decided or explicitly `open` naming what it awaits.

The reasoning is Native §26's: *"Do not make unsupported assumptions where research is required."* An
ADR that exists as an open question is what stops someone assuming the answer later. An ADR that does
not exist at all gets answered by whoever next needs an answer, in a pull request, without a record.

**Eight decided, nine open.** Three of the eight became decidable only because EPIC-028 shipped on
2026-08-17 — an ADR whose decision is already implemented in the tree is not open, it is
undocumented.

## ADR-0001 to ADR-0005 are preserved

Native §28 requires it and `G-27-07` asserts the files still exist. **`ADR-0002` is EXTENDED by the
egress change, never superseded** (`D-36`): its threat model widens from *the agent is untrusted* to
*the agent is untrusted and the neighbouring tenant is untrusted*, and every control it names is now
asserted field-by-field in CI — which was never possible while the interface lived inside the engine
adapter.

`supersedes` is empty on every row. **No existing ADR was superseded by this amendment**, which is
the answer §27 actually asks for.

## Register

| subject | status | awaits | supersedes | superseded_reasoning |
|---|---|---|---|---|
| ADR-0006 AI Agent Gateway and provider independence | decided | — | — | — |
| ADR-0007 Spec Kit as an embedded engine, not an application dependency | decided | — | — | — |
| ADR-0008 ProjectExecutionEnvironment abstraction | decided | — | — | — |
| ADR-0009 Persistent project state versus ephemeral agent execution | decided | — | — | — |
| ADR-0010 PMI Studio MCP architecture | open | R-AI-014 and PMI-DOC-004 | — | — |
| ADR-0011 Agent context authorization | open | R-AI-014 and a Context Engine epic that does not exist | — | — |
| ADR-0012 Agent credential isolation | decided | — | — | — |
| ADR-0013 Controlled network egress | decided | — | — | — |
| ADR-0014 Source-of-truth boundaries between PostgreSQL, Git, Spec Kit and the agent workspace | decided | — | — | — |
| ADR-0015 Requirement, Change and Defect governance authority | open | PMI-DOC-004 and the project owner confirming Finding A | — | — |
| ADR-0016 TDD defect execution policy | open | the Defect Room epic, which does not exist | — | — |
| ADR-0017 Interactive developer workspace versus autonomous agent sandbox | open | an interactive workspace epic, which does not exist | — | — |
| ADR-0018 Governed Engineering Loops as a shared workflow abstraction | open | PMI-DOC-004 and the three Room epics | — | — |
| ADR-0019 Context Engine composition — four capabilities, not one store | open | D-24 and a Context Engine epic | — | — |
| ADR-0020 Engineering Expert model for registered agents | decided | — | — | — |
| ADR-0021 Governed Learning — agent observations are not knowledge | open | PMI-DOC-004 and a Governed Learning epic | — | — |
| ADR-0022 Specification compliance and evidence as the differentiator | open | PMI-DOC-004 and an owning epic for the compliance agent | — | — |
