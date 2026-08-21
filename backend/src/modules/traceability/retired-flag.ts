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

/**
 * T860 — the status source a running deployment uses (US7/AC4).
 *
 * `AllActiveRequirementStatusSource` answers `active` for every id it is given,
 * which made scenario 4 — "the link is still shown and marked as originating
 * from a retired requirement" — impossible in the composed application however
 * well the unit tests passed. This one asks the register.
 *
 * An id this workspace cannot see, or one that does not exist, is OMITTED from
 * the map rather than reported active. The two are the same answer to a caller
 * (FR-002), and neither is a claim about a requirement's status.
 */
export interface RequirementStatusLookup {
  findById(id: string): Promise<{ workspaceId: string; status: 'active' | 'retired' } | null>;
}

export class LookupRequirementStatusSource implements RequirementStatusSource {
  constructor(private readonly lookup: RequirementStatusLookup) {}

  async statusOf(
    workspaceId: string,
    requirementIds: string[],
  ): Promise<Map<string, 'active' | 'retired'>> {
    const statuses = new Map<string, 'active' | 'retired'>();
    if (requirementIds.length === 0) return statuses;

    const rows = await Promise.all(
      requirementIds.map(async (id) => [id, await this.lookup.findById(id)] as const),
    );
    for (const [id, row] of rows) {
      if (row && row.workspaceId === workspaceId) statuses.set(id, row.status);
    }
    return statuses;
  }
}
