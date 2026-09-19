# D-44 — PMI-DOC-006 is approved, with two corrections made at the signature

**Status**: **DECIDED — approved 2026-08-24 by the Project Owner**
**Owner**: Project Owner (Product)
**Authorises**: [PMI-DOC-006 v1.0](../../../SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md)
**Discharges**: decision 6 of [`brs-v2-reconciliation.md`](../../brs-v2-reconciliation.md) §7 —
*"the document's own v1.0 status is still PROPOSED and needs a separate signature"*
**Precedent**: `D-41`, which authorised PMI-DOC-005 the same way

## The question

PMI-DOC-006 was created under PMI-DOC-004A Amendment G / `G-30` and has stood at **PROPOSED —
REQUIRES PROJECT OWNER APPROVAL** since 2026-08-21. It is the only document in `SRS/` not approved,
and three things wait on it:

- `EPIC-033`'s specification calls it *"the strongest SRS dependency of the three Rooms"* and says
  it *"should be discharged before `EPIC-034` plans against the same pattern"*. `EPIC-034` and
  `EPIC-035` are specified and unbuilt, so the window is open;
- `BR-0191` — the Room interaction pattern — is *SHOULD* in PMI-DOC-004, so the pattern's binding
  force comes largely from this document;
- the application shell has no owning Epic, and this is the document that would give one its
  requirements (`U-20`, *Application shell & Room pattern*).

## Why it was not signed as it stood

Two defects, both found by reading it against its own artifacts before signature. Neither is
serious; both would have been signed *into* an approved document.

### 1. The area count was stale — seventeen against a table of eighteen

§3 and §4.1 said **seventeen** navigation areas three times. §4.1's table lists **eighteen**.

The prototype has seventeen, and the count was inherited from it. The difference is
**Workspace & Administration**, which the prototype does not have and this document adds, mapped to
`BR-0001`–`BR-0005`. Two other areas were renamed from the prototype (*Architecture & ADR* →
*Architecture & Decisions*, *Agent Runs* → *Runs*) without changing the count.

So the table is right and the prose was stale. Corrected to eighteen.

*(`specs/029-design-system/contracts/prototype-parity.md` also says "seventeen navigation areas" and
is **not** corrected: it describes the prototype, where seventeen is accurate.)*

### 2. `UX-0003` and `UX-0060` could not both hold

| | As first written |
|---|---|
| `UX-0003` | Every area listed in §4.1 **MUST be reachable** from primary navigation |
| `UX-0060` | An area in the unowned rows **MUST NOT be implemented** before its Epic is declared |
| §9 | **Nine of the eighteen areas are unowned** — Decision Inbox, Requirement Room, Change Room, Defect Room, Engineering Experts, Context, Evidence & Compliance, Integrations, Reports |

`UX-0003` required reachability for nine areas `UX-0060` forbade building, and `G-UX-01` — its
automated form, explicitly *"in the built application"* — could therefore never pass. §9's preamble
explains the intent (*navigation must be designed as a whole even when delivered in slices*) but
the normative text was not scoped to match.

**Decided: scope `UX-0003` and `G-UX-01` to areas whose Epic is declared.** Navigation is still
designed as a whole; what is *required to be reachable* grows as Epics are declared. Nine areas are
in scope today, eighteen at R2+.

**The alternative considered and rejected**: keep `UX-0003` unscoped and render unowned areas as
visibly disabled entries, reusing the pattern `UX-0002` defines for role-gating. It shows the whole
product shape from day one, and it makes the shell Epic build nine placeholder destinations before
any of them has requirements — which is `UX-0060`'s prohibition arriving through the back door.

## What this does not decide

**It does not declare the shell Epic.** `U-20` still has no Epic; this document now gives one its
requirements, which is a different thing from creating it. The sidebar, the dashboard and the
workspace/project switcher `EPIC-004` forbids the shell inventing all remain unbuilt and unowned.

**It does not put `G-UX-01`, `G-UX-02` or `G-UX-03` in CI.** §10 records them as required and says
*"None runs in CI yet."* That is still true, with one partial exception now named in §10:
`frontend/tests/unit/design/page-reachability.spec.ts` (`EPIC-010` `T200a`, 2026-08-23) is
`G-UX-01`'s **module-level** half — it asserts every delivered page is imported and rendered from
the application root, which is what caught `DEF-010-001`. The **navigation** half waits on the shell
Epic, because there is no primary navigation to check against yet.

Approving a specification and implementing its checks are different claims, and PMI-DOC-005 set the
precedent: approved 2026-08-20, its checks delivered by `EPIC-029` afterwards.

## Consequences

- PMI-DOC-006 v1.0 is **APPROVED**; every document in `SRS/` now is.
- `brs-v2-reconciliation.md` §7 decision 6 is discharged.
- `EPIC-034` may plan against the Room pattern with an approved document behind it.
- The shell Epic, when declared, inherits §4 (navigation), §6 (the Room pattern), §7 (shell layout
  and the 360px floor) and §8 (screen-level state requirements) as requirements rather than as a
  proposal.
