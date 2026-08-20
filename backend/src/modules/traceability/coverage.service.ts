/**
 * T132 — coverage gap reporting (FR-031, SC-010).
 *
 * Gaps are derived from ABSENCE: requirements no specification traces to,
 * specifications no task traces to. The artifact lists come through a narrow
 * port rather than the other modules' services — coverage needs ids, not
 * behaviour, and a port cannot grow a dependency cycle.
 *
 * Framework-free (PC-1). Wired in `traceability.module.ts`.
 */
import type { TraceabilityLinkStore } from './link-writer.service.js';

export interface ArtifactIdSource {
  listRequirementIds(workspaceId: string, projectId: string): Promise<string[]>;
  listSpecificationIds(workspaceId: string, projectId: string): Promise<string[]>;
}

export interface CoverageReport {
  /** Requirements with no specification generated from them (FR-031). */
  uncoveredRequirementIds: string[];
  /** Specifications no task traces back to. */
  specificationsWithoutTasks: string[];
  requirementCount: number;
  specificationCount: number;
}

export class CoverageService {
  constructor(
    private readonly links: TraceabilityLinkStore,
    private readonly artifacts: ArtifactIdSource,
  ) {}

  async forProject(workspaceId: string, projectId: string): Promise<CoverageReport> {
    const [requirementIds, specificationIds] = await Promise.all([
      this.artifacts.listRequirementIds(workspaceId, projectId),
      this.artifacts.listSpecificationIds(workspaceId, projectId),
    ]);

    const uncoveredRequirementIds: string[] = [];
    for (const requirementId of requirementIds) {
      const incoming = await this.links.byTarget(workspaceId, 'requirement', requirementId);
      if (!incoming.some((l) => l.sourceType === 'specification')) {
        uncoveredRequirementIds.push(requirementId);
      }
    }

    const specificationsWithoutTasks: string[] = [];
    for (const specificationId of specificationIds) {
      const incoming = await this.links.byTarget(workspaceId, 'specification', specificationId);
      if (!incoming.some((l) => l.sourceType === 'task')) {
        specificationsWithoutTasks.push(specificationId);
      }
    }

    return {
      uncoveredRequirementIds,
      specificationsWithoutTasks,
      requirementCount: requirementIds.length,
      specificationCount: specificationIds.length,
    };
  }
}
