/**
 * T472 / T474 / T476 — deriving an Epic's position from the file tree.
 *
 * **Since `EPIC-044` (`T1561`, PMI-DOC-007 `R-06`) this file is a shim.** The
 * rule, the configuration and the file-tree evidence adapter live in
 * `@pmi/epic-stage`, which the product's Spec Journey Board imports too, so the
 * register and the board cannot disagree about what a stage means. Every export
 * this module ever had is still here with the same signature; the 32 specs that
 * import it are unchanged, and the register they regenerate is byte-identical
 * (`SC-EPB-002`).
 *
 * **The one structural idea (data-model §0):**
 *
 *     DERIVED (from the file tree)          DECLARED (by a person)
 *     ────────────────────────────          ───────────────────
 *     Stage        ─┐                    ┌─  Epic Kind
 *     DOR results  ─┤                    ├─  Posture
 *                   └──────► REGISTER ◄──┘   Waiver
 *
 * Nothing crosses that line. Everything here is on the derived side.
 *
 * Not a `.spec.ts`, so vitest never collects it — the `helpers.ts` convention.
 */
import { join } from 'node:path';
import {
  deriveStageFromEvidence,
  enumerateEpics as enumerateEpicsIn,
  evidenceFor,
  loadStageConfig as loadPackageConfig,
  type DorConditionDefinition,
  type EpicDirectory,
  type StageConfig,
  type StageDefinition,
  type StageResult,
} from '@pmi/epic-stage';
import { REPO_ROOT } from '../helpers';

export type { DorConditionDefinition, EpicDirectory, StageConfig, StageDefinition, StageResult };
export { checklistsResolved, evidenceFor, hasClarificationSession } from '@pmi/epic-stage';

export const SPECS_DIR = join(REPO_ROOT, 'specs');

/**
 * The stage model, read once. Configuration, never a literal in a check
 * (`FR-ESK-015`). Read from the package's canonical file;
 * `governance/epic-stage.config.json` is its byte-identical mirror (`G-44-01`).
 */
export function loadStageConfig(): StageConfig {
  return loadPackageConfig();
}

/**
 * Every Epic directory under `specs/`, in identifier order.
 *
 * `FR-ESK-008` — no registration step, and the exclusion is **by pattern**.
 */
export function enumerateEpics(specsDir: string = SPECS_DIR): EpicDirectory[] {
  return enumerateEpicsIn(specsDir, loadStageConfig());
}

/**
 * The highest **contiguous** stage whose evidence is present, from 1 — the
 * file-tree evidence handed to the shared rule (`FR-EPB-010`).
 */
export function deriveStage(epicPath: string, config: StageConfig = loadStageConfig(), kind?: string): StageResult {
  return deriveStageFromEvidence(evidenceFor(epicPath), config.stages, kind);
}
