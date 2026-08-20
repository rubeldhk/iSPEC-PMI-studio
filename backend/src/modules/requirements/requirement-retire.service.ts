/**
 * T068 — retirement preserving traceability (FR-006).
 *
 * Retire MARKS; it never deletes. Anything already generated from a
 * requirement keeps a resolvable target, which is what makes EPIC-011's
 * retired-link flagging (T127) meaningful. The store port exposes no
 * destructive operation, so the stronger claim holds by construction.
 *
 * Framework-free (PC-1). Wired in `requirements.module.ts`.
 */
import { assertSameWorkspace, type RefusalRecord } from '../../core/workspace.guard.js';
import type { RequirementRecord, RequirementStore } from './requirements.service.js';

export interface RetireOptions {
  now?: () => Date;
  /** Refusal hook (FR-033): wired to the audit service at the composition root. */
  onRefused?: (record: RefusalRecord) => void;
}

export class RequirementRetireService {
  private readonly now: () => Date;
  private readonly onRefused: ((record: RefusalRecord) => void) | undefined;

  constructor(
    private readonly store: RequirementStore,
    options: RetireOptions = {},
  ) {
    this.now = options.now ?? ((): Date => new Date());
    this.onRefused = options.onRefused;
  }

  /** Idempotent: retiring a retired requirement keeps the first timestamp. */
  async retire(workspaceId: string, id: string): Promise<RequirementRecord> {
    const found = await this.store.findById(id);
    // The tenancy guard (T016, per EPIC-004 convergence F2).
    assertSameWorkspace(workspaceId, found, {
      targetType: 'requirement',
      ...(this.onRefused ? { onRefused: this.onRefused } : {}),
    });
    const existing = found as RequirementRecord;
    if (existing.status === 'retired') return existing;
    return this.store.update(workspaceId, id, {
      status: 'retired',
      retiredAt: this.now(),
    });
  }
}
