/**
 * T035 — per-project engine resolution (FR-018, FR-019).
 *
 * A project inherits the default engine unless it has selected another.
 *
 * The selection lookup is a narrow port rather than a Prisma call, for two
 * reasons: PC-1 keeps this testable without a database, and the Project stub
 * must not grow before EPIC-006 owns it — so the selection lives in its own
 * table, not as a column on `projects`.
 */
import type { SpecificationEngine } from '@pmi/engine-contract';
import { UnknownEngineError, type EngineRegistryService } from './engine-registry.service.js';

export interface ProjectEngineSelectionPort {
  /** The engine a project has explicitly selected, or null to inherit the default. */
  findEngineNameForProject(projectId: string): Promise<string | null>;
}

export class EngineSelectionUnavailableError extends Error {
  readonly code = 'engine_selection_unavailable' as const;
  constructor(
    readonly projectId: string,
    readonly selected: string,
    readonly registered: string[],
  ) {
    super(
      `Project "${projectId}" selected engine "${selected}", which is not registered. ` +
        `Registered: ${registered.length > 0 ? registered.join(', ') : 'none'}.`,
    );
    this.name = 'EngineSelectionUnavailableError';
  }
}

export class EngineResolverService {
  constructor(
    private readonly registry: EngineRegistryService,
    private readonly selections: ProjectEngineSelectionPort,
  ) {}

  /**
   * Resolve the engine for a project.
   *
   * A selection naming an unregistered engine FAILS rather than falling back to
   * the default. Silently substituting a different engine would change what the
   * project produces while FR-022 provenance recorded the run as ordinary — the
   * artifact would be attributed to an engine the project did not choose, and
   * nothing would say so.
   */
  async resolveForProject(projectId: string): Promise<SpecificationEngine> {
    const selected = await this.selections.findEngineNameForProject(projectId);

    if (selected === null || selected === '') {
      return this.registry.getDefault();
    }

    if (!this.registry.has(selected)) {
      throw new EngineSelectionUnavailableError(
        projectId,
        selected,
        this.registry.listRegistered().map((descriptor) => descriptor.name),
      );
    }

    try {
      return this.registry.get(selected);
    } catch (error) {
      /* c8 ignore next 3 — guarded by has() above; kept so a registry change cannot silently
         turn a missing engine into an unhandled throw at a call site. */
      if (error instanceof UnknownEngineError) {
        throw new EngineSelectionUnavailableError(projectId, selected, error.registered);
      }
      throw error;
    }
  }
}
