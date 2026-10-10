# DEF-031-006 — two data-model rules, refined as built

**Epic**: `EPIC-031` | **Raised**: 2026-10-08 | **Status**: CLOSED 2026-10-08
**Originating task**: `T731`, `T751` · **Severity**: MEDIUM

1. **The high-band fence.** data-model §2 wrote it as `effectiveClass = 'high' ⇒ actorKind = 'human'`.
   Taken literally that makes an agent's **request** for a high-band action unrecordable — refused or
   pending — which `FR-DPE-016` and `FR-DPE-040` both forbid. Built as: a high-band row by automation
   may only be `pending` or `refused`. Automation may ask; it never takes. Asserted in
   `decision-constraints.spec.ts` from both sides.
2. **Approval.** "Immutable once written" and "a pending decision is later approved" cannot both hold
   for one row. Built as: an approval, or a re-decision under an exception, is a **new** decision row
   whose `resolvesDecisionId` names the one it resolves. The Inbox shows pending rows no row
   resolves; a decision resolves at most once.
