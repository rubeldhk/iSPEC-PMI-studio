# DEF-031-002 — "authorized human" means any other human in the workspace

**Epic**: `EPIC-031` | **Raised**: 2026-10-08 | **Status**: DEFERRED to `U-02` (stakeholder access & decision authority — no Epic declared yet)
**Originating task**: `T751`, `T753` · **Severity**: HIGH

## Finding

`FR-DPE-010` requires *authorized* human approval for the high band. There is no per-action authority
model to consult: `EPIC-024`'s grants are `read | edit` on artifacts, and decision authority is
`U-02`, unowned. So, as the scoped slice already stated, an authorized approver is **an authenticated
human in the workspace other than the requester** (or the requester, where policy permits
self-approval for the class). The Inbox's visibility follows the same rule, and every approval's
explanation says so (*"the authority model available until U-02"*).

The Inbox kinds `review` and `escalation` are in the contract and produced by nothing: review
requests are `EPIC-021`'s, and escalation needs the authority model this lacks.

## Why deferred

`DecisionAuthorityRecord` is published in `packages/decision-contract` for `U-02` to adopt unchanged
(`FR-DPE-014`, `T794`). When `U-02` is declared, the approver check in `evaluator.ts` `approve()` and
the Inbox's `mayApprove` become calls to it — two places, both commented.
