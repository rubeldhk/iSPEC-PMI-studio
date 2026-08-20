/**
 * T130 — forward and reverse traversal (FR-030).
 *
 * Forward: requirement → specifications generated from it → their tasks.
 * Reverse: task → its specifications → their originating requirements.
 * Both are first-class; the store indexes both directions (SC-009).
 *
 * Framework-free (PC-1). Wired in `traceability.module.ts`.
 */
import type { TraceabilityLinkStore } from './link-writer.service.js';

export interface ForwardTrace {
  requirementId: string;
  specifications: { specificationId: string; taskIds: string[] }[];
}

export interface ReverseTrace {
  taskId: string;
  specifications: { specificationId: string; requirementIds: string[] }[];
}

export interface SpecificationTrace {
  specificationId: string;
  /** Backward: what it was generated from. */
  requirementIds: string[];
  /** Forward: what was generated from it. */
  taskIds: string[];
}

export class TraceabilityService {
  constructor(private readonly store: TraceabilityLinkStore) {}

  /** FR-030 forward: everything derived from a requirement. */
  async forwardTrace(workspaceId: string, requirementId: string): Promise<ForwardTrace> {
    const specLinks = await this.store.byTarget(workspaceId, 'requirement', requirementId);
    const specifications = await Promise.all(
      specLinks
        .filter((l) => l.sourceType === 'specification')
        .map(async (l) => ({
          specificationId: l.sourceId,
          taskIds: (await this.store.byTarget(workspaceId, 'specification', l.sourceId))
            .filter((t) => t.sourceType === 'task')
            .map((t) => t.sourceId),
        })),
    );
    return { requirementId, specifications };
  }

  /** FR-030 reverse: a task back to its originating requirements. */
  async reverseTrace(workspaceId: string, taskId: string): Promise<ReverseTrace> {
    const specLinks = await this.store.bySource(workspaceId, 'task', taskId);
    const specifications = await Promise.all(
      specLinks
        .filter((l) => l.targetType === 'specification')
        .map(async (l) => ({
          specificationId: l.targetId,
          requirementIds: (await this.store.bySource(workspaceId, 'specification', l.targetId))
            .filter((r) => r.targetType === 'requirement')
            .map((r) => r.targetId),
        })),
    );
    return { taskId, specifications };
  }

  /** Both directions for one specification (contract: GET /specifications/{id}/trace). */
  async bothFor(workspaceId: string, specificationId: string): Promise<SpecificationTrace> {
    const [backward, forward] = await Promise.all([
      this.store.bySource(workspaceId, 'specification', specificationId),
      this.store.byTarget(workspaceId, 'specification', specificationId),
    ]);
    return {
      specificationId,
      requirementIds: backward.filter((l) => l.targetType === 'requirement').map((l) => l.targetId),
      taskIds: forward.filter((l) => l.sourceType === 'task').map((l) => l.sourceId),
    };
  }
}
