# Contract — the shared stage derivation package `@pmi/epic-stage` (`EPIC-044`)

**Session**: 2026-09-05 · **Research**: [../research.md](../research.md) `R-044-1`, `R-044-2`, `R-044-4`

One package, two consumers, one rule (`R-06`, `FR-EPB-010`). The package has **no runtime
dependency** and imports nothing from the platform, the tests or any adapter (`FR-EPB-014`).

## 1. Layout

```text
packages/epic-stage/
├── package.json                  @pmi/epic-stage 0.1.0 · private · "main": ./src/index.ts
├── epic-stage.config.json        the CANONICAL stage configuration (mirrored under governance/)
├── src/
│   ├── index.ts                  the exports below
│   ├── config.ts                 loadStageConfig(path?) · productProfile(config) · packageVersion()
│   ├── derive.ts                 deriveStageFromEvidence · nextReaches
│   ├── readiness.ts              resolveReadiness · validateWaiver (moved from tests/governance/epic-stage/dor.ts)
│   ├── evidence-files.ts         enumerateEpics · evidenceFor · hasClarificationSession · checklistsResolved (moved from derive.ts)
│   └── evidence-executions.ts    evidenceFromExecutions · bindExecutions
└── tests/
    ├── config.spec.ts            seven stages + two product stages; reachedBy present; mirror identical (G-44-01 lives in tests/governance)
    ├── derive.spec.ts            the contiguity rule over hand-built evidence maps; gaps named
    ├── evidence-executions.spec.ts   every rule of data-model §4, mutation targets marked
    └── readiness.spec.ts         empty condition set → Ready with note; the repository cases unchanged
```

## 2. Exports

```text
loadStageConfig(path?: string): StageConfig            — default: the package's own file
productProfile(config): StageDefinition[]              — stages ++ productStages, by order
packageVersion(): string                               — from package.json

deriveStageFromEvidence(evidence: Record<string, boolean>, stages: StageDefinition[], kind?: string): StageResult
  StageResult { stage: string | null; next: string; outOfOrder: string[] }   — unchanged shape from tests/governance/epic-stage/derive.ts

evidenceFor(epicPath): Record<string, boolean>         — the file-tree adapter (register)
enumerateEpics(specsDir, config?): EpicDirectory[]
hasClarificationSession(text): boolean · checklistsResolved(epicPath): boolean

evidenceFromExecutions(rows: ExecutionRow[], stages: StageDefinition[]): ExecutionEvidence
  ExecutionRow { executionId, command, state, registeredAt, completedAt?, completionComment? }
  ExecutionEvidence { evidence: Record<string, boolean>; last: ExecutionRow | null; running: ExecutionRow | null }
bindExecutions(rows: (ExecutionRow & { targetId: string })[], epics: { id, number, parentNumber?, splitSuffix? }[]): { byEpic: Map<id, ExecutionRow[]>; unbound: ExecutionRow[] }

resolveReadiness(input): ReadinessResult               — unchanged from dor.ts
validateWaiver(waiver, ctx): WaiverValidation          — unchanged from dor.ts
```

## 3. The governance shims

`tests/governance/epic-stage/derive.ts` becomes:

```text
export { loadStageConfig, enumerateEpics, evidenceFor, hasClarificationSession, checklistsResolved, SPECS_DIR } …
export function deriveStage(epicPath, config = loadStageConfig(), kind?) {
  return deriveStageFromEvidence(evidenceFor(epicPath), config.stages, kind);
}
```

with `SPECS_DIR` still `join(REPO_ROOT, 'specs')` and `loadStageConfig` reading the **package**
file (the mirror under `governance/` is asserted identical by `G-44-01`). `dor.ts` keeps the twelve
conditions and re-exports `resolveReadiness`, `validateWaiver` and their types from the package.
Every other governance module and all 32 importing specs are untouched.

## 4. Conformance

- **Byte identity** (`SC-EPB-002`): `tests/governance/epic-stage/register.spec.ts` regenerates the
  register; the committed `governance/epic-stage-register.md` is unchanged by the extraction (the
  drift check `compareRegister` is the assertion).
- **Mirror** (`G-44-01`, new `tests/governance/epic-stage-config-mirror.spec.ts`): the two JSON
  files are byte-identical.
- **Rule mutation** (`SC-EPB-001`): in `evidence-executions.spec.ts`, letting a `failed` execution
  count as evidence, and letting `plan` count without `specify`, are each observed red.
- **No platform import** (`architecture`): `packages/epic-stage/src` imports only `node:` modules;
  `backend/src` names no toolkit (the existing `engine-independence` scan; the command names
  `specify`, `plan` … are read from the configuration, never written in `backend/src`).
