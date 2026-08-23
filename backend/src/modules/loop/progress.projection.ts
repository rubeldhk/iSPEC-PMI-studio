/**
 * T973 — the projection a Room renders. `FR-GEL-050`, `FR-GEL-051`,
 * `FR-GEL-008`, `SC-GEL-007`.
 *
 * PC-1: framework-free.
 *
 * *"A Room can render loop progress without knowing how the loop works."*
 *
 * Which means the projection has to be **complete** and **uniform**: every
 * workflow type returns the same eight stages in the same order, so a Room
 * writes one renderer and not three. `packages/loop-contract`'s
 * `projectProgress` is the shape; this module is where an object's history
 * becomes its input.
 *
 * **`completedStages` is derived from the transitions, never stored.**
 * `FR-GEL-013` requires the history to be sufficient on its own, and a stored
 * "stages completed" column would be a second source that can disagree with it —
 * silently, and in the direction that makes a Room render a loop that never
 * happened.
 */

import { projectProgress, type LoopProgress, type LoopStage } from '@pmi/loop-contract';
import type { ResolvedLoopConfig } from './loop-config.loader.js';
import type { LoopObjectRow, LoopTransitionRow } from './loop.store.js';

export interface ProjectionInput {
  readonly object: Pick<LoopObjectRow, 'currentStage'>;
  readonly config: ResolvedLoopConfig;
  readonly history: readonly LoopTransitionRow[];
}

/**
 * Which stages this object has actually left.
 *
 * Read from the `fromStage` of ACCEPTED transitions. Not from `toStage`: the
 * stage an object moved *to* is where it is now or where it went next, and
 * counting it as completed would mark the current stage done.
 *
 * Refusals and conflicts are excluded — an attempt that did not move the object
 * did not complete a stage, and including them would let a rejected transition
 * paint a stage green.
 */
export function completedStagesOf(history: readonly LoopTransitionRow[]): readonly LoopStage[] {
  const seen = new Set<LoopStage>();
  for (const row of history) {
    if (row.outcome !== 'accepted') continue;
    if (row.fromStage !== null) seen.add(row.fromStage);
  }
  return [...seen];
}

/**
 * `FR-GEL-050`, `FR-GEL-051` — all eight stages, in model order, for every type.
 *
 * The completeness is the feature. A Room receiving five rows for a five-stage
 * workflow would have to know which three were missing and why, which is exactly
 * the knowledge `FR-GEL-051` exists to spare it.
 */
export function projectFor(input: ProjectionInput): readonly LoopProgress[] {
  return projectProgress({
    configuredStages: input.config.stages,
    currentStage: input.object.currentStage,
    completedStages: completedStagesOf(input.history),
  });
}
