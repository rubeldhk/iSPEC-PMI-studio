/**
 * `T1922` (EPIC-047) — a contract version's status, read from `EPIC-031`.
 *
 * `R-047-5`, `FR-EXP-005`. The decision engine offers no callback, so anything
 * this module remembered about a decision could be stale. Status is therefore
 * never stored: it is read whenever it matters — at display, and again at every
 * dispatch. A draft has no decision and needs no engine to read.
 */
import type { ContractVersion, VersionStatus } from './expert.types.js';
import type { ContractApprovals } from './experts.tokens.js';

export async function statusOf(version: ContractVersion, approvals: ContractApprovals): Promise<VersionStatus> {
  if (version.decisionId === null) return 'draft';
  const resolution = await approvals.resolutionOf(version.workspaceId, version.decisionId);
  return resolution === 'pending' ? 'submitted' : resolution;
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
