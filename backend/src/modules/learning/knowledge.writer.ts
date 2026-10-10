/**
 * `T2314` (EPIC-048) — the one insert into knowledge (`R-048-4` fence 1).
 *
 * `KnowledgeWriter.insertVersion` writes, in **one** transaction:
 * - the new entry, when the candidate creates one;
 * - the new version (or none, for a deprecation);
 * - every status event (the new version `current`; a superseded predecessor
 *   `superseded` naming its successor; a deprecated version `deprecated`);
 * - the candidate's `approved` transition;
 * - the `EPIC-004` audit entries (`FR-LRN-062`).
 *
 * The composition root hands a writer to `materialiser.ts` and nothing else.
 * `T2332` asserts who imports this file; `MP-1a` adds a caller and observes the
 * suite fail. Below that fence sits the database's: `learning_transitions_guard`
 * refuses `approved` without the version, and (after `EPIC-031` merges) the
 * insert trigger refuses a version no resolved decision stands behind.
 */
import { ConflictError } from '../../core/errors.js';
import {
  isTerminal,
  newLearningId,
  WRITER_ACCESS,
  type EntryRecord,
  type InMemoryLearningStore,
  type StatusEventRecord,
  type TransitionRecord,
  type VersionRecord,
} from './learning.store.js';
import type { AuditEntry, AuditPort } from './learning.tokens.js';

export interface Materialisation {
  readonly workspaceId: string;
  readonly candidateId: string;
  /** A new entry, when the candidate creates one; `null` when it acts on an existing entry. */
  readonly entry: EntryRecord | null;
  /** The new version; `null` only for a deprecation (`FR-LRN-033`). */
  readonly version: VersionRecord | null;
  readonly statusEvents: readonly StatusEventRecord[];
  /** The candidate's `approved` transition. */
  readonly transition: {
    readonly decisionId: string;
    readonly actorKind: 'human' | 'policy';
    readonly actorId: string;
    readonly reason: string | null;
    readonly at: Date;
  };
  /** Committed with the action or not at all (`FR-033`, `FR-LRN-062`). */
  readonly audit: readonly AuditEntry[];
}

/** `written`, or `already-terminal` when another path decided the candidate first. */
export type WriteOutcome = 'written' | 'already-terminal';

export interface KnowledgeWriter {
  insertVersion(m: Materialisation): Promise<WriteOutcome>;
}

/** Checks both writers make before anything is written. */
export function assertMaterialisable(m: Materialisation, predecessorStatuses: ReadonlyMap<string, StatusEventRecord | null>): void {
  if (m.version === null && !m.statusEvents.some((s) => s.status === 'deprecated')) {
    throw new ConflictError('A materialisation without a version must deprecate one (FR-LRN-033).');
  }
  for (const event of m.statusEvents) {
    if (event.status === 'current') continue;
    const before = predecessorStatuses.get(event.versionId);
    if (before?.status !== 'current') {
      throw new ConflictError(
        `Version ${event.versionId} is ${before?.status ?? 'unknown'}, not current; only the current version can be ${event.status} (FR-LRN-032).`,
      );
    }
  }
}

/** Unit tests only — over `InMemoryLearningStore`'s tables. */
export class InMemoryKnowledgeWriter implements KnowledgeWriter {
  constructor(
    private readonly store: InMemoryLearningStore,
    private readonly audit: AuditPort,
  ) {}

  async insertVersion(m: Materialisation): Promise<WriteOutcome> {
    const access = this.store[WRITER_ACCESS]();
    return access.exclusive(async () => {
      const t = access.tables;
      const rows = t.transitions.filter((r) => r.workspaceId === m.workspaceId && r.candidateId === m.candidateId);
      const current = rows.reduce<TransitionRecord | null>((acc, r) => (acc === null || r.seq > acc.seq ? r : acc), null);
      if (current === null) throw new ConflictError(`No candidate ${m.candidateId} in this workspace.`);
      if (isTerminal(current.state)) return 'already-terminal';

      const statuses = new Map<string, StatusEventRecord | null>();
      for (const e of m.statusEvents) {
        const prior = t.statusEvents.filter((s) => s.workspaceId === m.workspaceId && s.versionId === e.versionId);
        statuses.set(e.versionId, prior.length === 0 ? null : prior[prior.length - 1]!);
      }
      assertMaterialisable(m, statuses);
      if (m.version !== null && t.versions.some((v) => v.candidateId === m.candidateId)) {
        throw new ConflictError('This candidate already has a knowledge version (unique candidateId).');
      }
      if (m.version !== null && t.versions.some((v) => v.entryId === m.version!.entryId && v.version === m.version!.version)) {
        throw new ConflictError(`Entry ${m.version.entryId} already has version ${m.version.version}.`);
      }

      // Audit first: an action whose audit cannot be written is not taken.
      for (const entry of m.audit) await this.audit.record(entry);

      if (m.entry !== null) t.entries.push(m.entry);
      if (m.version !== null) t.versions.push(m.version);
      t.statusEvents.push(...m.statusEvents);
      t.transitions.push({
        id: newLearningId('lct'),
        workspaceId: m.workspaceId,
        candidateId: m.candidateId,
        seq: current.seq + 1,
        state: 'approved',
        reason: m.transition.reason,
        decisionId: m.transition.decisionId,
        actorKind: m.transition.actorKind,
        actorId: m.transition.actorId,
        at: m.transition.at,
      });
      return 'written';
    });
  }
}
