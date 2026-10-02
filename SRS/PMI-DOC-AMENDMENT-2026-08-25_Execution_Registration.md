# Amendment Record — Governed Execution Registration

**Date**: 2026-08-25 · **Authority**: project owner's authoritative product decision
**Ratified as**: Constitution **Principle XII — Execution Registration (NON-NEGOTIABLE)**, v1.6.0
**Requirements added**: `BR-0196`–`BR-0203` (PMI-DOC-004 v2.0 §6.22)

---

## Status: APPLIED — this file is a RECORD, not a substitute

**Both `.docx` documents were amended in place on 2026-08-25.** The clarifications below are no
longer pending; they are transcribed here as the amendment record, and the authoritative text now
lives in the documents themselves. **There is one source of truth per document, not two.**

| Document | Applied | Verification |
|---|---|---|
| `PMI-DOC-001_Executive_Product_Vision.docx` | ✅ 1 paragraph inserted after the Scope clause | 62 → 63 paragraphs, **0 original paragraphs lost**, 17 zip entries unchanged, archive integrity OK |
| `Native Spec-Kit Execution Environment & AI Agent Integration Architecture.docx` | ✅ 2 paragraphs inserted (§1 separability; the optional-IDE prose) | 574 → 576 paragraphs, **0 original paragraphs lost**, 12 zip entries unchanged, archive integrity OK |

Formatting was preserved by **cloning the paragraph containing each target clause** and replacing
only its text, so each clarification inherits the style and run properties of the clause it
clarifies. `w14:paraId` and `w14:textId` were stripped from the clones because those must be unique
per paragraph. Every other archive entry was copied through byte-for-byte in its original order and
compression.

**No original clause was altered, reworded or removed.** Each prohibition stands verbatim; the
clarifications sit beside them.

## Why this file was created

Two documents this amendment clarifies are held as **`.docx` binaries**. They were initially
assumed to be un-amendable by an implementation session; that assumption was wrong, and both have
now been amended in place:

| Document | Format | Status |
|---|---|---|
| `PMI-DOC-001_Executive_Product_Vision.docx` | `.docx` | ✅ **Applied 2026-08-25** |
| `SRS/August112026/Native Spec-Kit Execution Environment & AI Agent Integration Architecture.docx` | `.docx` | ✅ **Applied 2026-08-25** |

This file was created when the `.docx` binaries were believed to require manual transcription. They
did not: a `.docx` is a zip containing `word/document.xml`, and a paragraph can be inserted without
disturbing the rest of the archive. The transcription was performed and verified the same day.

**Constitution II is satisfied**: the SRS documents carry the authoritative wording, and this file
records what was applied, when, and how it was verified. Should this record and a document ever
disagree, **the document wins**.

Documents amended directly, requiring no action here:

- `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` — `BR-0132` MAY→SHALL with owner,
  `BR-0133` MAY→SHALL with owner, `BR-0101`/`BR-0105` owners assigned, `BR-0061` cross-link
  recorded, new §6.22 (`BR-0196`–`BR-0203`)
- `SRS/August112026/PMI Studio Plan Amendment — Integrated AI-Native Engineering Operating System.md`
  — §14 clarification appended
- `.specify/memory/constitution.md` — Principle XII added; II and VII extended; v1.5.0 → v1.6.0

---

## 1. PMI-DOC-001 Executive Product Vision — clarification APPLIED

The existing clause is **unchanged**:

> Out of Scope: Source-code IDE replacement and low-level code editing.

Applied immediately after it:

> **Clarification — 2026-08-25 (Constitution XII, BRS §6.22).** This exclusion stands. PMI Studio
> does not edit code and does not replace an IDE. It does **not** exclude PMI Studio from being the
> authoritative record of governed Spec Kit executions that originate in an IDE, a terminal, a CI
> pipeline or any other approved surface. Recording what an execution did, to which specification
> version, under whose authority, with what evidence, is control-plane functionality — the product's
> centre, not an expansion of its scope.

## 2. Native Spec-Kit Execution Environment & AI Agent Integration Architecture — clarifications APPLIED

### 2a. §1, on separability

The existing clause is **unchanged**:

> No individual AI provider, coding agent, IDE, or Spec-Kit implementation may become inseparable
> from the PMI Studio application layer.

Applied immediately after it:

> **Clarification — 2026-08-25.** Separability is a requirement on **adapters**, not a licence for
> untracked execution. The **registration contract itself is not optional**: an adapter that cannot
> register a governed execution is not an approved integration, and no execution surface is
> privileged over another. Neutrality about *where* a command runs is absolute; so is the
> requirement *that it is recorded* (`BR-0196`).

### 2b. Elevate the optional-IDE prose to a numbered requirement

The document already states, in prose:

> The architecture must support developers optionally using their preferred IDE while PMI Studio
> retains server-side governance.

This is the model the product decision confirms. It is elevated to a testable requirement as
`BR-0132` (PMI-DOC-004 v2.0, MAY→SHALL, owner **EPIC-037**), which additionally requires that the
connector register every governed execution and never permit a governed command to complete
unregistered except under the provisional-offline provisions.

---

## 3. Ownership changes recorded by this amendment

| Requirement | Before | After |
|---|---|---|
| `BR-0132` Controlled local connector | MAY · no owner | **SHALL** · **EPIC-037** |
| `BR-0133` Uniform governance | MAY · no owner | **SHALL** · **EPIC-037** |
| `BR-0101` Expert registry | no owner | **EPIC-028** |
| `BR-0105` Delegation | no owner | **EPIC-028** |
| `BR-0061` Unattended execution | EPIC-023 | **EPIC-023** *(unchanged; cross-link from Engineering Experts recorded)* |
| `BR-0196`–`BR-0203` | — | **new** · EPIC-037 (six) · EPIC-030 (two) |

## 4. Identifier allocation note

`BR-0196`–`BR-0203` were allocated above the corpus ceiling of `BR-0195`. The obvious-looking block
`BR-0134`–`BR-0141` was **rejected**: those identifiers are already in use for network and resource
policy, credential isolation, evidence types and evidence provenance. Reusing them would have
breached `RULE-16` — *identifiers are corpus-wide and never re-mean* — and produced eight
identifiers with two meanings each.
