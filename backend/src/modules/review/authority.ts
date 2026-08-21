/**
 * FR-RUN-015a + FR-RUN-013a — the two roles the epic trusts with committing
 * and with settling disagreement: the PROJECT OWNER and the RUN'S INITIATOR.
 *
 * Answering and noting stay open to every user with access — the restriction
 * is on committing the batch and on choosing between colleagues' answers,
 * never on participating.
 */
import type { RunRecord } from '../runs/run-mode.service.js';

export interface ProjectOwnerLookup {
  ownerOf(workspaceId: string, projectId: string): Promise<string | null>;
}

export async function isOwnerOrInitiator(
  owners: ProjectOwnerLookup,
  run: RunRecord,
  userId: string,
): Promise<boolean> {
  if (run.initiatedById === userId) return true;
  const owner = await owners.ownerOf(run.workspaceId, run.projectId);
  return owner !== null && owner === userId;
}

// ------------------------------------------------------------- in-memory

export class InMemoryProjectOwners implements ProjectOwnerLookup {
  private readonly owners = new Map<string, string>();

  setOwner(projectId: string, userId: string): void {
    this.owners.set(projectId, userId);
  }

  async ownerOf(_workspaceId: string, projectId: string): Promise<string | null> {
    return this.owners.get(projectId) ?? null;
  }
}
