# Quickstart: Repository Governance Process

**Epic**: `EPIC-018` | **Date**: 2026-08-04 | **Plan**: [plan.md](./plan.md)

Six validation scenarios. Four are automated checks; **two require a person**, and say so rather than
pretending a script can answer them.

## Prerequisites

None beyond the existing toolchain. This epic ships no runtime.

```bash
pnpm install
pnpm test:governance      # the checks introduced by this epic
```

---

## V18-1 · Every steering subject is covered — *automated*

**Proves**: FR-RGP-001 · SC-RGP-002 · check G-01

```bash
pnpm test:governance -t "subject coverage"
```

**Expected**: all ten subjects have an active steering file, or an absence is recorded with a stated
reason. A missing subject with no reason **fails**.

---

## V18-2 · Standards are checkable, not aspirational — *automated*

**Proves**: FR-RGP-002 · checks G-02, G-03

```bash
pnpm test:governance -t "standard structure"
```

**Expected**: every standard has a stable identifier, a stated check, and a rationale.

**Then**: add a standard reading "write clean code", with no check. **Expected**: the check **fails**.
This scenario is only meaningful if you confirm it fails — a conformance check that cannot fail is
decoration.

---

## V18-3 · No duplication with the constitution — *automated*

**Proves**: FR-RGP-004 · SC-RGP-003 · check G-04

```bash
pnpm test:governance -t "no duplication"
```

**Expected**: zero substantial verbatim overlap between any steering file and the constitution or a
template.

**Then**: copy a paragraph from `.specify/memory/constitution.md` into a steering file.
**Expected**: **fails**, naming both the steering file and the source it duplicates.

⚠️ **This is the most important scenario in the epic.** It is the only one guarding PP-002 against the
failure this epic is most likely to cause: two sources of truth that agree today and drift quietly.

---

## V18-4 · Every artifact type has exactly one home — *automated*

**Proves**: FR-RGP-006, FR-RGP-007 · SC-RGP-004, SC-RGP-005

```bash
pnpm test:governance -t "layout"
```

**Expected**: every artifact type present in the repository maps to exactly one location; zero types
undefined; every planned migration recorded **before** execution.

**Then**: confirm no existing path is broken — every cross-reference from `specs/README.md`,
`specs/_shared/`, and the 18 epic documents still resolves. **Expected**: zero broken references.

---

## V18-5 · Templates are checked against PMI-DOC-000 — *human*

**Proves**: FR-RGP-010, FR-RGP-011 · SC-RGP-006

**Not automatable**, because judging whether a deviation's stated reason is *good* requires judgement.
The mechanical part — is every template checked and is every deviation reasoned — is automated; the
reading is not.

1. Open the conformance record for each of `spec-template.md`, `plan-template.md`, `tasks-template.md`.
2. Confirm every `PMI-DOC-000` §4 required section is either present or recorded as a deviation with a
   reason.
3. Read the reasons.

**Expected**: zero unexamined templates; zero deviations without a reason.

⚠️ **This output is the evidence for decision D-4** — whether repository templates adopt
`PMI-DOC-000`'s thirteen sections. This epic deliberately does not settle it (R-018-5). If the record
does not make D-4 answerable, the record is incomplete.

---

## V18-6 · A newcomer can find the standards — *human*

**Proves**: FR-RGP-009 · SC-RGP-001, SC-RGP-007

**Not automatable.** "Can someone new find this?" is answered by someone new, not by a script.

1. Give someone unfamiliar with the programme the repository root and nothing else.
2. Ask them to name the coding, security, and architecture standards.
3. Ask them what governs this repository.

**Expected**: each answered from a single named file, without asking anyone, using only the governance
index as an entry point.

**Failure signal**: if they navigate by searching the file tree rather than by following the index,
the index has failed even if it is complete.

---

## Not covered here

- **Steering file rot.** Nothing here detects a standard that is current in form but stale in fact.
  The governance index makes versions visible; it does not force a review cadence. Recorded as an
  accepted risk in [plan.md](./plan.md) rather than pretended away.
- **Whether the standards are the right standards.** These scenarios validate that standards are
  present, checkable, and non-duplicative. Whether "explicit return types" is the right rule is a
  question for the owner of the file, not for this epic.
