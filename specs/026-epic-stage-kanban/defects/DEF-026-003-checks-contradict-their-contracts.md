# DEF-026-003 — two checks forbid what their own contracts require

**Epic**: `EPIC-026` | **Raised**: 2026-08-18 | **Status**: **CLOSED — FIXED 2026-08-18**
**Originating tasks**: `T488` (`G-26-07`), `T515` (`G-26-10`) · found by `T532`, on the first register to carry a waiver
**Severity**: MEDIUM — both fired on correct content

## What it is

The first real waiver made two checks fail on content the contracts **require**:

**`G-26-07`** asserts the register carries no `\d{4}-\d{2}-\d{2}`, to enforce `RF-2`'s ban on
clock-derived content. But `RF-5` says: *"Every active waiver appears with its condition, owner,
reason and expiry."* An expiry **is** a date, and `sections.spec.ts` already documents why it is not
a breach: *"RF-2 forbids dates DERIVED FROM THE CLOCK, because they change on every run. A waiver's
expiry is input — it changes only when a person changes it, so it produces no spurious diff."*

The check enforced the letter of `RF-2` against the explicit text of `RF-5`.

**`G-26-10`** asserts the register names no `DEF-\d{3}-\d{3}`, to stop it restating defect state
(Constitution VI's territory). But the waiver's reason cites `DEF-026-001` as its justification, and
`FR-ESK-009` says: *"Where that state is relevant, the register MUST reference the existing
artifact."* **A citation is a reference, which is the thing the requirement asks for.**

## Why this is not the same as `DEF-026-001`

That defect was a check being broader than a *principle*, where narrowing it was a judgement call —
so it took a waiver and an owner. This one is a check contradicting a *written contract rule* in the
same repository. The correction is provable from `RF-5` and `FR-ESK-009` rather than argued, so it
is a fix rather than a decision.

## Resolution

- **`G-26-07`** now excludes the `## Active waivers` section from the date scan, and asserts
  separately that no date appears **outside** it. The clock ban still holds everywhere it was meant
  to; a declared expiry is permitted where `RF-5` requires it.
- **`G-26-10`** now distinguishes *restating* defect state from *referencing* a defect: a bare
  `DEF-nnn-nnn` in a Stage, Posture or Readiness cell is still refused by the render-time guard;
  a citation inside a waiver's reason is permitted, because that is `FR-ESK-009`'s second sentence.

Both narrowings are asserted by the mutation that a defect **status** — `"DEF-014-001 is open"` in a
finding — is still refused.
