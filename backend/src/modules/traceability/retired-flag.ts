/**
 * T131 — retired-requirement flagging on returned links (US7 scenario 4).
 *
 * Links to retired requirements are returned and FLAGGED, never omitted:
 * retirement is not deletion (FR-006), and a trace that silently dropped
 * retired sources would claim a derivation history that never happened.
 *
 * Statuses are looked up in ONE batched call — this decorates lists that can
 * reach register scale (SC-009).
 *
 * Framework-free (PC-1).
 */

export interface LinkTarget {
  targetType: 'requirement' | 'specification' | 'task';
  targetId: string;
}

export interface RequirementStatusSource {
  statusOf(workspaceId: string, requirementIds: string[]): Promise<Map<string, 'active' | 'retired'>>;
}

export type FlaggedLink<T extends LinkTarget> = T & { retired: boolean };

export async function flagRetiredLinks<T extends LinkTarget>(
  workspaceId: string,
  links: T[],
  requirements: RequirementStatusSource,
): Promise<FlaggedLink<T>[]> {
  const requirementIds = links
    .filter((l) => l.targetType === 'requirement')
    .map((l) => l.targetId);

  const statuses =
    requirementIds.length > 0
      ? await requirements.statusOf(workspaceId, requirementIds)
      : new Map<string, 'active' | 'retired'>();

  return links.map((link) => ({
    ...link,
    retired: link.targetType === 'requirement' && statuses.get(link.targetId) === 'retired',
  }));
}
