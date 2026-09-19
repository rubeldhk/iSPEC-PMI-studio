# Register: Premises

**Epic**: `EPIC-027` | **Schema**: [../contracts/reconciliation-register.md](../contracts/reconciliation-register.md)

Every "existing capability" claim, verified against the corpus (`FR-AMD-006`).

The register records **the evidence, not the conclusion**. A claim that resizes a programme should be
checkable in ten seconds by anyone who doubts it, so `search_performed` carries the query as run.

> **Generated projection**: `register.json` is built from this file by `pnpm register:build`.
> Never hand-edit the projection — `G-27-11` compares its digest to this file and fails on drift.

## Finding A — the evidence

Eight capabilities the amendment refers to as **existing** return **zero** occurrences across all 27
other epic specifications. Two control terms in the same search return 27 and 2, which is what proves
the search works rather than the corpus being unreadable.

**Re-run 2026-08-17. Two verdicts changed since 2026-08-13**, and the change is worth reading:
`AgentGateway` (`PRE-006`) and `ProjectExecutionEnvironment` (`PRE-007`) are now **confirmed**. Not
because the amendment was right — it was wrong on 2026-08-13 — but because **EPIC-028 built them in
the four days between**. Copying the earlier result forward would have been recording a conclusion
instead of re-running the evidence, which is the failure `FR-AMD-006` exists to prevent.

`PRE-005` and `PRE-006` are deliberately separate rows. The amendment writes *Agent Gateway* with a
space; the built contract is `AgentGateway`. The spaced form still returns zero, and a premise check
that silently normalised the spelling would have hidden which of the two the corpus actually
contains.

## FR-AMD-007 — one name, two concepts

`PRE-002` and `PRE-017` are the same word and different things, and the register states both:

| | The product **Defect Room** | The Constitution VI **`defects/`** folder |
|---|---|---|
| What it is | A governed intelligence workflow with triage, reproduction, TDD remediation and evidence | A directory in `specs/<epic>/` holding defect records for THIS repository |
| Occurrences | **0** | **27** — every epic spec |
| Owner | none; a new held epic | Constitution VI |

The word *defect* appears in all 27 other specs, which is exactly why Finding A is easy to get
wrong: a careless search returns 27 hits and concludes the Defect Room exists. It does not. The two
are unrelated, and `FR-AMD-007` requires them distinguished wherever either is referenced.

## Finding B — EPIC-007 is a name collision

`PRE-018` is recorded as **partial** rather than confirmed or refuted, because both halves are true:

- **EPIC-007 exists** and is called *Requirement Intelligence*.
- **It is not the amendment's capability.** Its own spec states *"AI-assisted analysis (REG) is Phase
  2 and out of scope"* and it owns six CRUD requirements. The amendment's Requirement Intelligence
  Engine — ambiguity detection, options, trade-offs, MoSCoW/WSJF, a twelve-state machine, baselines
  and a Decision Room — is a different and far larger capability that happens to share a name.

Resolved by **`D-33`**: EPIC-007 keeps its identifier, its name and its current register-only scope;
the Engine becomes a new, held epic. Left unreconciled this produces the worst kind of drift — two
teams believing one epic covers both.

## Finding A — the evidence

Eight capabilities the amendment refers to as **existing** return **zero** occurrences across all 27
other epic specifications. Two control terms in the same search return 27 and 2, which is what proves
the search works rather than the corpus being unreadable.

**Re-run 2026-08-17. Two verdicts changed since 2026-08-13**, and the change is worth reading:
`AgentGateway` (`PRE-006`) and `ProjectExecutionEnvironment` (`PRE-007`) are now **confirmed**. Not
because the amendment was right — it was wrong on 2026-08-13 — but because **EPIC-028 built them in
the four days between**. Copying the earlier result forward would have been recording a conclusion
instead of re-running the evidence, which is the failure `FR-AMD-006` exists to prevent.

`PRE-005` and `PRE-006` are deliberately separate rows. The amendment writes *Agent Gateway* with a
space; the built contract is `AgentGateway`. The spaced form still returns zero, and a premise check
that silently normalised the spelling would have hidden which of the two the corpus actually
contains.

## FR-AMD-007 — one name, two concepts

`PRE-002` and `PRE-017` are the same word and different things, and the register states both:

| | The product **Defect Room** | The Constitution VI **`defects/`** folder |
|---|---|---|
| What it is | A governed intelligence workflow with triage, reproduction, TDD remediation and evidence | A directory in `specs/<epic>/` holding defect records for THIS repository |
| Occurrences | **0** | **27** — every epic spec |
| Owner | none; a new held epic | Constitution VI |

The word *defect* appears in all 27 other specs, which is exactly why Finding A is easy to get
wrong: a careless search returns 27 hits and concludes the Defect Room exists. It does not. The two
are unrelated, and `FR-AMD-007` requires them distinguished wherever either is referenced.

## Finding B — EPIC-007 is a name collision

`PRE-018` is recorded as **partial** rather than confirmed or refuted, because both halves are true:

- **EPIC-007 exists** and is called *Requirement Intelligence*.
- **It is not the amendment's capability.** Its own spec states *"AI-assisted analysis (REG) is Phase
  2 and out of scope"* and it owns six CRUD requirements. The amendment's Requirement Intelligence
  Engine — ambiguity detection, options, trade-offs, MoSCoW/WSJF, a twelve-state machine, baselines
  and a Decision Room — is a different and far larger capability that happens to share a name.

Resolved by **`D-33`**: EPIC-007 keeps its identifier, its name and its current register-only scope;
the Engine becomes a new, held epic. Left unreconciled this produces the worst kind of drift — two
teams believing one epic covers both.

## Register

| id | claimed_capability | claim_source | search_performed | occurrence_count | locations | verdict |
|---|---|---|---|---|---|---|
| PRE-001 | the existing Change Room | CLA-003 | grep -rli --include=spec.md --exclude-dir=027-ai-native-amendment "Change Room" specs/ | 0 | — | refuted |
| PRE-002 | the existing Defect Room (the PRODUCT capability) | CLA-003 | grep -rli --include=spec.md --exclude-dir=027-ai-native-amendment "Defect Room" specs/ | 0 | — | refuted |
| PRE-003 | the existing Requirement Room | CLA-003 | grep -rli --include=spec.md --exclude-dir=027-ai-native-amendment "Requirement Room" specs/ | 0 | — | refuted |
| PRE-004 | a Decision Room / Decision Center / Decision Intelligence capability | CLA-003 | grep -rli --include=spec.md --exclude-dir=027-ai-native-amendment "Decision Room" specs/ | 0 | — | refuted |
| PRE-005 | an Agent Gateway (as the amendment spells it, with a space) | CLA-200 | grep -rli --include=spec.md --exclude-dir=027-ai-native-amendment "Agent Gateway" specs/ | 0 | — | refuted |
| PRE-006 | an AgentGateway contract (the built spelling) | CLA-200 | grep -rli --include=spec.md --include=index.ts --exclude-dir=027-ai-native-amendment "AgentGateway" specs/ packages/ | 2 | specs/028-agent-execution-seam/spec.md ; packages/agent-contract/src/index.ts | confirmed |
| PRE-007 | a ProjectExecutionEnvironment abstraction | CLA-222 | grep -rli --include=spec.md --include=index.ts --exclude-dir=027-ai-native-amendment "ProjectExecutionEnvironment" specs/ packages/ | 2 | specs/028-agent-execution-seam/spec.md ; packages/execution-contract/src/index.ts | confirmed |
| PRE-008 | an Engineering Integration Hub | CLA-075 | grep -rli --include=spec.md --exclude-dir=027-ai-native-amendment "Integration Hub" specs/ | 0 | — | refuted |
| PRE-009 | a centralized Engineering Context Engine | CLA-127 | grep -rli --include=spec.md --exclude-dir=027-ai-native-amendment "Context Engine" specs/ | 0 | — | refuted |
| PRE-010 | an Engineering Evidence Package | CLA-135 | grep -rli --include=spec.md --exclude-dir=027-ai-native-amendment "Evidence Package" specs/ | 0 | — | refuted |
| PRE-011 | a change request concept anywhere in the corpus | CLA-003 | grep -rli --include=spec.md --exclude-dir=027-ai-native-amendment "change request" specs/ | 0 | — | refuted |
| PRE-012 | Governed Learning (Cosmos 3.4) | CLA-559 | grep -rli --include=spec.md --exclude-dir=027-ai-native-amendment "Governed Learning" specs/ | 0 | — | refuted |
| PRE-013 | a Specification Compliance Agent (Cosmos 3.5) | CLA-525 | grep -rli --include=spec.md --exclude-dir=027-ai-native-amendment "Specification Compliance" specs/ | 0 | — | refuted |
| PRE-014 | a Workspace Fabric (Cosmos 6) | CLA-535 | grep -rli --include=spec.md --exclude-dir=027-ai-native-amendment "Workspace Fabric" specs/ | 0 | — | refuted |
| PRE-015 | a Capability Resolver (Cosmos 5) | CLA-533 | grep -rli --include=spec.md --exclude-dir=027-ai-native-amendment "Capability Resolver" specs/ | 0 | — | refuted |
| PRE-016 | the existing Agent Registry, as an Engineering Expert model (Cosmos 3.3) | CLA-510 | grep -rli "AgentRegistry" worker/src specs/028-agent-execution-seam/spec.md | 2 | worker/src/agent-composition.ts ; specs/028-agent-execution-seam/spec.md | partial |
| PRE-017 | the Constitution VI defects/ CONVENTION — distinct from the product Defect Room | CLA-003 | grep -rli --include=spec.md --exclude-dir=027-ai-native-amendment "defect" specs/ | 27 | all 27 other epic spec.md files, always as the Constitution VI obligation that specs/<epic>/defects/ holds no open records | confirmed |
| PRE-018 | EPIC-007 Requirement Intelligence — the NAME, not the capability (Finding B) | CLA-380 | grep -l "AI-assisted analysis" specs/007-requirement-intelligence/spec.md | 1 | specs/007-requirement-intelligence/spec.md, which states AI-assisted analysis is Phase 2 and out of scope and owns six CRUD requirements FR-004 to FR-009 | partial |
| PRE-019 | CONTROL — a term that SHOULD be present, proving the search works | CLA-003 | grep -rli --include=spec.md --exclude-dir=027-ai-native-amendment "traceability" specs/ | 27 | all 27 other epic spec.md files | confirmed |
| PRE-020 | CONTROL — a narrower term that should be present in a few specs only | CLA-003 | grep -rli --include=spec.md --exclude-dir=027-ai-native-amendment "engine adapter" specs/ | 2 | specs/003-specification-engine/spec.md ; specs/013-engine-api-selection/spec.md | confirmed |
