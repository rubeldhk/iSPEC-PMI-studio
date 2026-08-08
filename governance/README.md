# Governance

**Epic**: [`EPIC-018`](../specs/018-repository-governance/) · **Requirement**: `FR-RGP-009` ·
**Check**: `G-05b`

One document answering *what governs this repository, and where is it written down*.

## The four questions

Each governing document answers exactly one question. The division is strict — it is what keeps
these documents from restating each other, which is the failure mode this epic exists to prevent.

| Question | Answered by |
|---|---|
| *What governs how we work?* | [`.specify/memory/constitution.md`](../.specify/memory/constitution.md) |
| *What shape does a document take?* | [`document-structure.md`](./document-structure.md), [`template-conformance.md`](./template-conformance.md) |
| *What standards apply to the work?* | [`steering/`](./steering/) |
| *Where does an artifact live?* | [`repository-layout.md`](./repository-layout.md) |

## Index

| Artifact | Purpose | Path | Version | Constitution I |
|---|---|---|---|---|
| Governance index | This document — names every governance artifact | `governance/README.md` | 1 | not exempt |
| Repository layout | Maps each artifact type to one location; records the D-13 dependency | `governance/repository-layout.md` | 1 | not exempt |
| Template conformance record | Measures each template against `PMI-DOC-000` §4; evidence for D-4 | `governance/template-conformance.md` | 1 | not exempt |
| Document structure | Required sections for plans and task documents | `governance/document-structure.md` | 1 | not exempt |
| Traceability convention | Which artifact links are mandatory | `governance/traceability-convention.md` | 1 | not exempt |
| Session labelling | Label and branch naming; Constitution VIII as an artifact | `governance/session-labelling.md` | 1 | not exempt |
| Closing report format | Mandatory sections and the honesty rule; Constitution IX as an artifact | `governance/closing-report.md` | 1 | not exempt |
| Steering register | Ten subjects of repository standards | `governance/steering/` | 1 | not exempt |
| Check configuration | Review interval, subjects, section list | `governance/governance.config.json` | 1 | not exempt |
| Conformance checks | Executable checks for everything above | `tests/governance/` | 1 | not exempt |

### The Constitution I column

Constitution I gates code changes behind Spec Kit commands, and exempts `.specify/**` and
`specs/**`. `governance/**` and `tests/governance/**` sit **outside** both exempt paths, so their
status needed deciding rather than assuming: **not exempt**. Changes here are made through a Spec
Kit command like any other work, which is how this epic itself was executed.

Recording the column at all matters more than the value in it. An artifact created outside the
exempt paths with no stated status is one someone will later assume either way.

## Running the checks

```bash
pnpm test:governance
```

Ten check groups run against the file tree. No database, no server, no fixtures — they read the
repository, which is what makes Constitution V satisfiable for an epic that produces documents
rather than application code.

| Check | Asserts | Severity |
|---|---|---|
| `G-01` | Every steering subject has a file | fails |
| `G-02` | Front matter is complete and owned by a programme role | fails |
| `G-03` | Standards are checkable, with a check and a rationale | fails |
| `G-04` | No steering file restates constitution or template text | **fails CI** |
| `G-04b` | No steering file claims precedence over the constitution | fails |
| `G-05` | Each artifact type has exactly one documented location | fails |
| `G-05b` | The index names every governance artifact | fails |
| `G-05d` | The layout records D-13 and pre-empts no path change | fails |
| `G-06` | Every template is measured; every absence is reasoned | fails |
| `G-06d` | `PMI-DOC-000` governs the templates, not the product structure | fails |
| `G-07` | Steering files record a review date | fails on absence, **reports** on staleness |
| `G-08` | Session labels match the branch convention in use | fails |
| `G-09` | The closing-report format states the honesty rule | fails |

**Why `G-04` is the one that fails CI.** The 2026-08-05 severity split reserved a hard CI failure
for the check whose failure is otherwise *silent*. Duplicated text reads correctly on the day it is
written and forks at the next amendment, leaving two sources of truth and no signal that they
disagree. Every other failure here is visible to a reader; that one is not.

**Why `G-07` reports rather than fails.** A blocking staleness check would halt unrelated work
across every held epic because a document turned 91 days old. That trains people to silence the
check rather than review the file, which costs the accuracy signal the check exists to provide.

## What is not governed here

- **Product capabilities** — every `specs/<epic>/`. This directory governs the repository, not the
  platform.
- **The product's Steering Engine** — [EPIC-019](../specs/019-steering-engine/). It shares a name
  with [`steering/`](./steering/) and nothing else: one is a multi-tenant product capability, the
  other is a set of files in this repository.
- **Architecture decisions** — [`../adr/`](../adr/README.md).
