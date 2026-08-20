/**
 * T110 — append-only version creation on meaningful change (FR-013, SC-007).
 *
 * "Meaningful" = the raw content changed. Saving identical content appends
 * nothing: a no-op is not history — the same judgement the requirement
 * register made in EPIC-007. Raw engine output is stored verbatim alongside
 * the parsed structure so a parser fix can re-derive without re-running the
 * engine (R-007).
 *
 * Framework-free (PC-1). The database backs the append-only rule with the
 * `specification_versions_immutable` trigger (T459/T460).
 */
import { randomUUID } from 'node:crypto';

export interface SpecificationVersionRecord {
  id: string;
  workspaceId: string;
  specificationId: string;
  versionNumber: number;
  contentRaw: string;
  contentParsed: Record<string, unknown>;
  lifecycleStateAtCreation: string;
  authoredById: string;
  authoredAt: Date;
}

/** Append and read. Nothing else exists to call (SC-007). */
export interface SpecificationVersionStore {
  append(row: SpecificationVersionRecord): Promise<SpecificationVersionRecord>;
  latestFor(workspaceId: string, specificationId: string): Promise<SpecificationVersionRecord | null>;
  listFor(workspaceId: string, specificationId: string): Promise<SpecificationVersionRecord[]>;
}

export interface AppendVersionInput {
  workspaceId: string;
  specificationId: string;
  contentRaw: string;
  contentParsed: Record<string, unknown>;
  lifecycleState: string;
  authoredById: string;
}

export interface AppendOutcome {
  /** false when the content was identical and nothing was written. */
  appended: boolean;
  version: SpecificationVersionRecord;
}

export class SpecificationVersionService {
  constructor(private readonly store: SpecificationVersionStore) {}

  async appendIfChanged(input: AppendVersionInput): Promise<AppendOutcome> {
    const latest = await this.store.latestFor(input.workspaceId, input.specificationId);
    if (latest !== null && latest.contentRaw === input.contentRaw) {
      return { appended: false, version: latest };
    }
    const version = await this.store.append({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      specificationId: input.specificationId,
      versionNumber: (latest?.versionNumber ?? 0) + 1,
      contentRaw: input.contentRaw,
      contentParsed: input.contentParsed,
      lifecycleStateAtCreation: input.lifecycleState,
      authoredById: input.authoredById,
      authoredAt: new Date(),
    });
    return { appended: true, version };
  }

  /** History, newest first (FR-013: prior versions retrievable). */
  async listFor(workspaceId: string, specificationId: string): Promise<SpecificationVersionRecord[]> {
    return this.store.listFor(workspaceId, specificationId);
  }
}

/** In-memory store for tests and database-less runs. Rows are frozen. */
export class InMemorySpecificationVersionStore implements SpecificationVersionStore {
  private readonly rows: SpecificationVersionRecord[] = [];

  async append(row: SpecificationVersionRecord): Promise<SpecificationVersionRecord> {
    const frozen = Object.freeze({ ...row });
    this.rows.push(frozen as SpecificationVersionRecord);
    return frozen as SpecificationVersionRecord;
  }

  async latestFor(
    workspaceId: string,
    specificationId: string,
  ): Promise<SpecificationVersionRecord | null> {
    const mine = await this.listFor(workspaceId, specificationId);
    return mine[0] ?? null;
  }

  async listFor(workspaceId: string, specificationId: string): Promise<SpecificationVersionRecord[]> {
    return this.rows
      .filter((r) => r.workspaceId === workspaceId && r.specificationId === specificationId)
      .sort((a, b) => b.versionNumber - a.versionNumber);
  }
}
