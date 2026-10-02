/**
 * `T1560` (EPIC-044, `FR-EPB-006`, `FR-EPB-010`) — the contiguity rule, moved
 * verbatim in behaviour from `tests/governance/epic-stage/derive.ts` (T472 …
 * T476, DEF-026-007) and made pure over an evidence map so that the register
 * (file-tree evidence) and the product board (execution evidence) derive with
 * ONE function.
 *
 * The highest **contiguous** stage whose evidence is present, from 1. Evidence
 * above a gap does not raise the stage:
 *
 *     spec ✓  clarif ✓  checklist ✓  plan ✗  tasks ✓  →  Checklisted
 *                                                        finding: tasks.md without plan.md
 *
 * Counting it would report an Epic as `Tasked` when nobody had planned it — the
 * register would show progress past a step that never happened, which is the
 * one thing a stage register must never do.
 */
import type { StageDefinition } from './config.js';

export interface StageResult {
  /** The highest contiguous stage reached, or `null` for no evidence at all. */
  readonly stage: string | null;
  /** The command a reader is told to run next. */
  readonly next: string;
  /** Evidence present above a gap — recorded, never counted (`FR-ESK-006`). */
  readonly outOfOrder: string[];
}

/** DEF-026-007 — does this stage's next command reach an epic of this kind? */
export function nextReaches(stage: StageDefinition, kind: string | undefined): boolean {
  // Absence filters nothing, on BOTH sides: a stage without nextAppliesTo
  // addresses every kind, and a caller without a kind gets the old behaviour.
  return kind === undefined || !stage.nextAppliesTo || stage.nextAppliesTo.includes(kind);
}

/** The readiness verdict is layered on top of this result, never derived here. */
const READINESS_STAGE = 'Ready';

export function deriveStageFromEvidence(evidence: Record<string, boolean>, stages: readonly StageDefinition[], kind?: string): StageResult {
  const ordered = [...stages].sort((a, b) => a.order - b.order);

  let highest: StageDefinition | undefined;
  let broken = false;
  const outOfOrder: string[] = [];

  for (const stage of ordered) {
    if (stage.name === READINESS_STAGE) continue;

    const present = evidence[stage.name] === true;
    if (present && !broken) {
      highest = stage;
    } else if (!present) {
      broken = true;
    } else {
      outOfOrder.push(`${stage.name} evidence present without the stage before it`);
    }
  }

  if (!highest) {
    return { stage: null, next: ordered[0]?.next ?? '—', outOfOrder };
  }

  // A stage's own `next` field IS the command to run from that stage — the
  // config table reads "Specified → /speckit-clarify". Looking up the following
  // stage's `next` instead is an off-by-one that tells a reader to skip a step.
  return {
    stage: highest.name,
    next: nextReaches(highest, kind) ? highest.next : '—',
    outOfOrder,
  };
}
