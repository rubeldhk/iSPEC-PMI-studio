# D-46 — identity for non-human principals is owned by EPIC-028, authorised by EPIC-024

**Status**: **DECIDED — authorised 2026-08-27 by the Project Owner (Step C3B)**
**Owner**: Project Owner (Product)
**Authorises**: `FR-AGT-014`–`FR-AGT-025` and `SC-AGT-009`–`SC-AGT-012`
([EPIC-028](../../028-agent-execution-seam/spec.md)); `FR-ACC-029`–`FR-ACC-034`, `SC-019`, `SC-020`
([EPIC-024](../../024-artifact-access-control/spec.md)); `FR-GEL-075`–`FR-GEL-078`, `SC-GEL-020`,
`SC-GEL-021` ([EPIC-030](../../030-governed-engineering-loop/spec.md))
**Discharges**: finding `Z1` — seventeen requirements implemented under a remediation instruction
with no governance record of their own
**Precedent**: `D-45`, which sourced EPIC-021's target-binding requirements the same way

## The question

`Y2` was that nothing in the platform could say who an agent **is**. `WorkspaceBoundaryService`
resolved actors only against `users`, so the only route past a tenant boundary was to register the
agent as a person. EPIC-037's Band A preflight found it by trying to use it and stopping.

C3B closed that by adding seventeen requirements across three epics. The behaviour is right and
tested. Its **provenance** was a prompt.

`Z1` recorded this and pointed at `D-45` as precedent. That was the correct shape and the wrong
document: `D-45` authorises **gate outcome target-binding and staleness**, which is a different
subject entirely. Citing it here would have made one decision record appear to authorise two
unrelated bodies of work, and a reader following the citation would find nothing about identity.

## The decision

**The C3B hybrid identity-ownership decision is the source of those seventeen requirements**, and
it is recorded here rather than borrowed from `D-45`.

The ownership split, as the Project Owner stated it:

| Concern | Owner |
|---|---|
| Registration and authoritative identity of agents, service principals and connectors — including workspace binding, sponsoring human and frozen snapshots | **EPIC-028** |
| Authorisation of both human and non-human principals, including scoped delegation and enforcement | **EPIC-024** |
| Consuming frozen identities; adjudication authority and separation of duties | **EPIC-030** |
| Consuming public identity/authorisation contracts and recording immutable references | **EPIC-037** |

And the two constraints that shaped the design more than anything else:

- **Human identity remains `User`.** `'human'` is absent from the `principals` vocabulary, so a
  second answer to "who is this person" cannot be written.
- **`AgentDescriptor` remains capability metadata** and *"must not become identity merely by adding
  a workspaceId"*. It has not. A descriptor says what a kind of agent can do; a principal says who a
  particular one is and who answers for it.

No new epic was created, as instructed.

## What this does NOT do

It does not make the requirements SRS-sourced. `PMI-DOC-004` has no `BR-` covering non-human
principal identity, and a decision record authorises a requirement rather than inventing a business
requirement.

**The back-fill obligation is preserved separately** and stated next to each requirement group in
the three specifications. It follows the standing `T149`/`F-11.3` pattern for SRS-unsourced
governance: proceed under a recorded owner authorisation, back-fill the `BR-` before the platform
release gate.

## The historical fact, preserved

These requirements were **implemented before they were normative** — C3B built the behaviour, its
own analysis raised `Z1`, and this decision sources it afterwards. The same order as `D-45`, and
recorded rather than tidied away.

## Consequences

- The seventeen requirements cite `D-46` as their current source.
- `Z1` is closed. The `BR-` back-fill remains tracked and is not a blocking finding.
- `D-45` is untouched and continues to authorise only EPIC-021's target-binding requirements.
