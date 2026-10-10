/**
 * `T1991` (EPIC-047) — who may author an Expert.
 *
 * `FR-EXP-009`, analysis finding U1. An Expert's contract states what an AI may
 * do in this workspace, and the platform has no administrator role
 * (`DEF-038-005`). So authoring — registering, versioning, submitting,
 * retiring, changing the delegation policy — needs an `EPIC-024` **edit** grant
 * on the workspace's `expert-registry` artifact, and reading needs **read**.
 * Assignment needs edit on the task itself.
 *
 * `EPIC-024` treats an artifact with no grants as readable by nobody, so a
 * workspace that has granted nothing has authorised nobody: the failure is
 * closed. A fault in the check propagates; it never reads as permission.
 */
import { ForbiddenError } from '../../core/errors.js';
import type { ActorAccess } from './experts.tokens.js';

export const REGISTRY_ARTIFACT = 'expert-registry';

const registry = (workspaceId: string): { artifactType: string; artifactId: string } => ({
  artifactType: REGISTRY_ARTIFACT,
  artifactId: workspaceId,
});

export class Authoring {
  constructor(private readonly access: ActorAccess) {}

  async requireAuthor(workspaceId: string, userId: string): Promise<void> {
    if (!(await this.access.mayEdit(workspaceId, userId, registry(workspaceId)))) {
      throw new ForbiddenError(
        `authoring an Engineering Expert needs an edit grant on this workspace's ${REGISTRY_ARTIFACT} (FR-EXP-009)`,
      );
    }
  }

  async requireReader(workspaceId: string, userId: string): Promise<void> {
    if (!(await this.access.mayRead(workspaceId, userId, registry(workspaceId)))) {
      throw new ForbiddenError(
        `reading the Engineering Experts registry needs a read grant on this workspace's ${REGISTRY_ARTIFACT} (FR-EXP-009)`,
      );
    }
  }

  async requireTaskEditor(workspaceId: string, userId: string, taskId: string): Promise<void> {
    if (!(await this.access.mayEdit(workspaceId, userId, { artifactType: 'task', artifactId: taskId }))) {
      throw new ForbiddenError(`assigning task ${taskId} needs an edit grant on that task (FR-EXP-009)`);
    }
  }

  async requireTaskReader(workspaceId: string, userId: string, taskId: string): Promise<void> {
    if (!(await this.access.mayRead(workspaceId, userId, { artifactType: 'task', artifactId: taskId }))) {
      throw new ForbiddenError(`reading the assignments of task ${taskId} needs a read grant on that task (FR-EXP-009)`);
    }
  }
}
