# Steering Files

**Epic**: [`EPIC-018`](../../specs/018-repository-governance/) · **Requirements**: `FR-RGP-001` to
`FR-RGP-005`, `FR-RGP-016` · **Format**: [contracts/steering-file-format.md](../../specs/018-repository-governance/contracts/steering-file-format.md)

A steering file states the standards that apply to work in this repository, on one subject, in a
form an artifact can be **held against**. These files are read by people and loaded as context by
agent sessions — which is why an inaccurate one is worse than a missing one.

## The register

| Subject | File | Owner | What it governs |
|---|---|---|---|
| Organization | [`organization.md`](./organization.md) | project-owner | Roles, decision rights, where decisions are recorded |
| Workspace | [`workspace.md`](./workspace.md) | tech-lead | How a working copy is set up, isolated and synchronised |
| Product | [`product.md`](./product.md) | product-owner | What PMI Studio is, and what claims about it must be sourced |
| Architecture | [`architecture.md`](./architecture.md) | tech-lead | Boundaries that must hold; where the design lives |
| Technology stack | [`technology-stack.md`](./technology-stack.md) | tech-lead | Which technologies are chosen and how one is added |
| Coding standards | [`coding-standards.md`](./coding-standards.md) | tech-lead | How code in this repository is written |
| UI standards | [`ui-standards.md`](./ui-standards.md) | product-owner | Interface standards, pending SRS Volume 8 |
| Security | [`security.md`](./security.md) | tech-lead | Non-negotiable controls on secrets, egress and audit |
| Business rules | [`business-rules.md`](./business-rules.md) | product-owner | ⏸ Awaiting `PMI-DOC-004` |
| AI governance | [`ai-governance.md`](./ai-governance.md) | project-owner | How generated output is treated and reviewed |

## Authoring convention

Every file follows
[contracts/steering-file-format.md](../../specs/018-repository-governance/contracts/steering-file-format.md):
structured front matter an agent can parse, then a prose body a person will actually read.

- **Standards carry stable identifiers** — `CS-001`, `SEC-003`. "The third bullet under security"
  is not a citation. Identifiers are unique across the whole register, not merely within a file.
- **A standard states a condition, a check and a rationale.** All three. A standard with no check
  is a preference; a standard with no rationale cannot be correctly relaxed, so it will either be
  followed superstitiously or dropped the first time it is inconvenient.
- **Reference, never restate.** Where the constitution, a template or the SRS already says
  something, link to it. This is enforced mechanically by check `G-04`, and it is the one
  governance check that fails CI — because the failure it prevents is silent. A duplicated
  paragraph reads correctly today and forks at the next amendment, leaving two sources of truth
  and no signal that they disagree.
- **Quote in a blockquote when you must quote.** `G-04` excludes blockquoted text, so an
  attributed quotation is permitted and an unattributed restatement is not.

## Precedence — the constitution wins

Where a steering file conflicts with [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md),
**the constitution wins and the steering file is corrected.** There is no override direction, and no
steering file may claim one. Check `G-04b` fails on any file asserting precedence over the
constitution.

If a standard here is *right* and the constitution is *wrong*, that is a constitution amendment —
raised explicitly, versioned, with the propagation the amendment procedure requires. It is never
resolved by leaving the contradiction in place and preferring the more convenient document.

## Review currency

`last_reviewed` is **required front matter** on every file. Check `G-07` enforces its presence and
its ISO format.

The review interval lives in [`../governance.config.json`](../governance.config.json)
(`steeringReviewIntervalDays`, currently 90). It is **configuration, not a principle** — changing it
is an ordinary edit, not a governance amendment, and the check reads it from there rather than
hard-coding it.

**A stale file is reported, never a build failure.** A blocking staleness check would halt unrelated
work across every held epic because a document turned 91 days old — which trains people to silence
the check rather than review the file. `G-07` prints what is overdue and exits green.

## Versioning and change history

**Git retains the change history.** These files are versioned with the repository, so authorship and
every prior revision are recoverable with `git log -p governance/steering/<subject>.md`. No
hand-maintained revision table is kept here — a maintained table in a versioned file is a second
source of truth that drifts from the real one, which is the same reason the templates omit a
Revision History section (see [`../template-conformance.md`](../template-conformance.md)).

The `version` field is not a duplicate of that history. It is the number a **citation** refers to:
"`CS-004` as of version 2". Because of that it must move when the content moves — check `G-02b`
compares each file against its last committed state and fails when the body changed and `version`
did not. Editing a standard in place while leaving `version: 1` would silently invalidate every
citation of it.

## Lifecycle

`active → superseded`. A superseded file is **retained**, with `supersedes` pointing at its
successor, so a decision's history stays readable. Deleting it would leave every citation of its
standards dangling.

## Deliberately not covered here

- **How we work** — governed by [the constitution](../../.specify/memory/constitution.md).
- **What shape a document takes** — governed by [`../template-conformance.md`](../template-conformance.md)
  and [`../document-structure.md`](../document-structure.md).
- **Where an artifact lives** — governed by [`../repository-layout.md`](../repository-layout.md).
- **The product's own Steering Engine** — a multi-tenant product capability, specified in
  [EPIC-019](../../specs/019-steering-engine/). It shares a name with these files and nothing else.
