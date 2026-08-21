/**
 * T265 — currency detection driven by the dependency graph (FR-ENH-006).
 *
 * ONE field, wider trigger: FR-032's requirement-change flag flows through
 * the SAME `currency_status` path as any other upstream change — two
 * independent staleness flags would disagree. Marking is never a
 * regeneration; a human reconciles (T267).
 *
 * Framework-free (PC-1).
 */
import { NotFoundError } from '../../core/errors.js';
import type { ArtifactRef } from '../dependencies/dependencies.service.js';

const OPAQUE = 'Not found.';

export interface CurrencyState {
  currencyStatus: 'current' | 'stale';
  staleReason: string | null;
  reconciledAt?: Date;
  reconciledById?: string;
  lifecycleState?: string;
}

/** The write half — in production the Specification row; in tests in-memory. */
export interface CurrencyStore {
  markStale(workspaceId: string, specificationId: string, reason: string): Promise<void>;
  clear(workspaceId: string, specificationId: string, byId: string, at: Date): Promise<void>;
  find(workspaceId: string, specificationId: string): Promise<CurrencyState | null>;
}

export interface CurrencySources {
  /** One hop of the dependency graph: who depends on the changed artifact. */
  dependents(workspaceId: string, ref: ArtifactRef): Promise<ArtifactRef[]>;
  /** FR-032's original trigger: specifications DERIVED from a requirement. */
  derivedSpecificationIds(workspaceId: string, requirementId: string): Promise<string[]>;
}

export class CurrencyService {
  constructor(
    private readonly store: CurrencyStore,
    private readonly sources: CurrencySources,
  ) {}

  /**
   * An upstream artifact changed. Every specification that depends on it —
   * through the graph, or through derivation when the artifact is a
   * requirement — is marked stale with the change NAMED. Returns the marked
   * specification ids.
   */
  async artifactChanged(workspaceId: string, changed: ArtifactRef): Promise<string[]> {
    const reason = `${changed.artifactType} ${changed.artifactId} changed`;

    const marked = new Set<string>();
    for (const dependent of await this.sources.dependents(workspaceId, changed)) {
      if (dependent.artifactType === 'specification') marked.add(dependent.artifactId);
    }
    if (changed.artifactType === 'requirement') {
      for (const id of await this.sources.derivedSpecificationIds(
        workspaceId,
        changed.artifactId,
      )) {
        marked.add(id);
      }
    }

    for (const specificationId of marked) {
      await this.store.markStale(workspaceId, specificationId, reason);
    }
    return [...marked];
  }
}

// ------------------------------------------------------------- in-memory

export class InMemoryCurrencyStore implements CurrencyStore {
  private readonly rows = new Map<string, CurrencyState & { workspaceId: string }>();

  seed(
    specificationId: string,
    state: Partial<CurrencyState> & { workspaceId?: string } = {},
  ): void {
    this.rows.set(specificationId, {
      workspaceId: state.workspaceId ?? 'ws_a',
      currencyStatus: state.currencyStatus ?? 'current',
      staleReason: state.staleReason ?? null,
      ...(state.reconciledAt ? { reconciledAt: state.reconciledAt } : {}),
      ...(state.reconciledById ? { reconciledById: state.reconciledById } : {}),
      ...(state.lifecycleState ? { lifecycleState: state.lifecycleState } : {}),
    });
  }

  stateOf(specificationId: string): CurrencyState | undefined {
    const row = this.rows.get(specificationId);
    if (!row) return undefined;
    const { workspaceId: _ws, ...state } = row;
    return state;
  }

  async markStale(workspaceId: string, specificationId: string, reason: string): Promise<void> {
    const row = this.rows.get(specificationId);
    if (row && row.workspaceId !== workspaceId) return;
    this.rows.set(specificationId, {
      workspaceId,
      lifecycleState: row?.lifecycleState ?? 'draft',
      currencyStatus: 'stale',
      staleReason: reason,
    });
  }

  async clear(
    workspaceId: string,
    specificationId: string,
    byId: string,
    at: Date,
  ): Promise<void> {
    const row = this.rows.get(specificationId);
    if (!row || row.workspaceId !== workspaceId) throw new NotFoundError(OPAQUE);
    this.rows.set(specificationId, {
      ...row,
      currencyStatus: 'current',
      staleReason: null,
      reconciledAt: at,
      reconciledById: byId,
    });
  }

  async find(workspaceId: string, specificationId: string): Promise<CurrencyState | null> {
    const row = this.rows.get(specificationId);
    if (!row || row.workspaceId !== workspaceId) return null;
    const { workspaceId: _ws, ...state } = row;
    return state;
  }
}
