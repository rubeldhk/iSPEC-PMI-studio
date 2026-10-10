/**
 * `T2377` (EPIC-048, `FR-LRN-051`, `FR-LRN-053`, `R-048-13`) — ask `EPIC-038` to
 * reindex, and record what it said.
 *
 * Retrievability is **derived from the reindex outcome, never assumed**:
 * - `indexed` / `current` → `retrievable`;
 * - anything else — no embedding provider (`503`, the normal state in this
 *   programme until one exists), no `knowledge-entry` source class (`400`,
 *   `DEF-038-007`), the port unbound — → `not-yet-retrievable`, with the reason.
 *
 * A deprecation also asks: `EPIC-038` has no removal API, so the answer is
 * *does not resolve*, which is expected; admission is what guarantees a
 * deprecated version is never supplied (`R-048-11`, row `stale`).
 *
 * After every approval, supersession, deprecation and widening (the
 * materialiser's post-commit hook), and on the `learning.retrievability` sweep.
 *
 * Framework-free (PC-1).
 */
import { newLearningId, type LearningStore, type RetrievabilityRecord, type VersionRecord } from './learning.store.js';
import type { LearningPorts } from './learning.tokens.js';
import type { AfterMaterialise } from './materialiser.js';

export interface RetrievabilityDeps {
  readonly store: LearningStore;
  readonly ports: Pick<LearningPorts, 'index'>;
  readonly now?: () => Date;
}

export class RetrievabilityService {
  private readonly now: () => Date;

  constructor(private readonly deps: RetrievabilityDeps) {
    this.now = deps.now ?? ((): Date => new Date());
  }

  /** Reindex one version and append the outcome. Never throws into the caller. */
  async reindex(version: VersionRecord, options: { deprecated?: boolean } = {}): Promise<RetrievabilityRecord> {
    let outcome: RetrievabilityRecord['outcome'];
    let reason: string | null;
    try {
      const result = await this.deps.ports.index.reindex({ workspaceId: version.workspaceId, sourceType: 'knowledge-entry', entryId: version.entryId, versionId: version.id });
      if (options.deprecated) {
        outcome = 'not-yet-retrievable';
        reason = `deprecated — the index reports ${result.outcome}; admission excludes it as stale`;
      } else if (result.outcome === 'indexed' || result.outcome === 'current') {
        outcome = 'retrievable';
        reason = null;
      } else {
        outcome = 'not-yet-retrievable';
        reason = `the index reports ${result.outcome}`;
      }
    } catch (err) {
      outcome = 'not-yet-retrievable';
      reason = err instanceof Error && err.message.trim() !== '' ? err.message : 'the reindex failed';
    }
    const row: RetrievabilityRecord = { id: newLearningId('kr'), workspaceId: version.workspaceId, versionId: version.id, outcome, reason, attemptedAt: this.now() };
    await this.deps.store.transaction((tx) => tx.appendRetrievability(row));
    return row;
  }

  /** The materialiser's post-commit hook (`FR-LRN-051`). */
  afterMaterialise(): AfterMaterialise {
    return async ({ version, deprecated }) => {
      if (version !== null) await this.reindex(version);
      if (deprecated !== null) await this.reindex(deprecated, { deprecated: true });
    };
  }

  /** The sweep: current versions with no attempt, or whose latest attempt did not take. */
  async retryPending(workspaceId?: string): Promise<{ examined: number; nowRetrievable: number }> {
    let examined = 0;
    let nowRetrievable = 0;
    for (const version of await this.deps.store.currentVersions(workspaceId)) {
      const latest = await this.deps.store.latestRetrievability(version.workspaceId, version.id);
      if (latest?.outcome === 'retrievable') continue;
      examined += 1;
      if ((await this.reindex(version)).outcome === 'retrievable') nowRetrievable += 1;
    }
    return { examined, nowRetrievable };
  }
}
