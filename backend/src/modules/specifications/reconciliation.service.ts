/**
 * T267 — reconciliation (FR-ENH-007), preserving baseline immutability
 * (FR-011a).
 *
 * Clearing the mark records WHO and WHEN. A baselined specification is
 * reconciled through the fork seam EPIC-009 built — the baseline row is
 * never altered, and its staleness record stays as history; the fork is the
 * reconciled line.
 */
import { NotFoundError, ValidationFailedError } from '../../core/errors.js';
import type { CurrencyStore } from './currency.service.js';

const OPAQUE = 'Not found.';

export interface ForkPort {
  (workspaceId: string, specificationId: string, byId: string): Promise<{ id: string }>;
}

export interface ReconcileOutcome {
  forked: boolean;
  forkedSpecificationId?: string;
}

export class ReconciliationService {
  constructor(
    private readonly store: CurrencyStore,
    private readonly options: { fork: ForkPort; now?: () => Date },
  ) {}

  async reconcile(
    workspaceId: string,
    specificationId: string,
    byId: string,
    at?: Date,
  ): Promise<ReconcileOutcome> {
    const state = await this.store.find(workspaceId, specificationId);
    if (!state) throw new NotFoundError(OPAQUE);
    if (state.currencyStatus !== 'stale') {
      throw new ValidationFailedError('This specification is current — there is nothing to reconcile.');
    }

    if (state.lifecycleState === 'baselined') {
      // FR-011a: never altered. The fork starts the reconciled line.
      const fork = await this.options.fork(workspaceId, specificationId, byId);
      return { forked: true, forkedSpecificationId: fork.id };
    }

    await this.store.clear(
      workspaceId,
      specificationId,
      byId,
      at ?? (this.options.now ?? (() => new Date()))(),
    );
    return { forked: false };
  }
}
