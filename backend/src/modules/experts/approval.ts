/**
 * `T1922` (EPIC-047) — a contract version's status, read from `EPIC-031`.
 *
 * `R-047-5`, `FR-EXP-005`. The decision engine offers no callback, so anything
 * this module remembered about a decision could be stale. Status is therefore
 * never stored: it is read whenever it matters — at display, and again at every
 * dispatch. A draft has no decision and needs no engine to read.
 */
import { UNRECORDED_DECISION } from '../decision/evaluator.js';
import type { ContractVersion, VersionStatus } from './expert.types.js';
import type { ContractApprovals } from './experts.tokens.js';

/**
 * `T2575` — a version holding `EPIC-031`'s `'unrecorded'` (stored before
 * submission refused to keep one) was never decided: it is a draft.
 */
export function undecided(version: ContractVersion): boolean {
  return version.decisionId === null || version.decisionId === UNRECORDED_DECISION;
}

/** Read now. Throws when the decision cannot be read — dispatch refuses on it. */
export async function statusOf(version: ContractVersion, approvals: ContractApprovals): Promise<VersionStatus> {
  if (undecided(version)) return 'draft';
  const resolution = await approvals.resolutionOf(version.workspaceId, version.decisionId!);
  if (resolution === 'pending') return 'submitted';
  // A contract version stands on policy's approval as on a human's (`R-047-17`).
  return resolution === 'approved-unattended' ? 'approved' : resolution;
}

/**
 * `T2575` — for display: a decision that cannot be read shows as `unreadable`
 * rather than failing every Expert on the screen. Never used to dispatch.
 */
export async function displayedStatusOf(version: ContractVersion, approvals: ContractApprovals): Promise<VersionStatus> {
  try {
    return await statusOf(version, approvals);
  } catch {
    return 'unreadable';
  }
}

/** The highest **approved** version — not the newest. Null when none is approved. */
export async function effectiveVersion(
  versions: readonly ContractVersion[],
  approvals: ContractApprovals,
): Promise<ContractVersion | null> {
  const descending = [...versions].sort((a, b) => b.version - a.version);
  for (const v of descending) {
    if ((await statusOf(v, approvals)) === 'approved') return v;
  }
  return null;
}
