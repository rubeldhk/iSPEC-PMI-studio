/**
 * T346 — provisional marking and its clearing rule (FR-RUN-005, FR-RUN-017,
 * SC-004).
 *
 * A marking is a LINK, not a flag (R-002-5): it joins an artifact to the
 * SPECIFIC question governing it. That is what lets markings clear
 * SELECTIVELY when one question is answered — a boolean would clear
 * everything or nothing. An artifact generated with no provisional answer
 * carries no marking at all, which is what makes "everything derived from a
 * provisional answer is marked" checkable rather than universal.
 */

export interface ArtifactRef {
  artifactType: string;
  artifactId: string;
}

export interface ProvisionalMarkingRecord extends ArtifactRef {
  id: string;
  workspaceId: string;
  /** WHICH question made it provisional — the clearing key. */
  questionId: string;
  clearedAt: Date | null;
  createdAt: Date;
}

export interface MarkingStore {
  create(marking: Omit<ProvisionalMarkingRecord, 'id'>): Promise<ProvisionalMarkingRecord>;
  listForArtifact(workspaceId: string, artifact: ArtifactRef): Promise<ProvisionalMarkingRecord[]>;
  listForQuestion(workspaceId: string, questionId: string): Promise<ProvisionalMarkingRecord[]>;
  clear(workspaceId: string, markingId: string, at: Date): Promise<ProvisionalMarkingRecord>;
}

export class ProvisionalService {
  constructor(private readonly markings: MarkingStore) {}

  /** FR-RUN-005 — every artifact derived from a provisional answer is marked. */
  async mark(
    workspaceId: string,
    artifact: ArtifactRef,
    questionId: string,
    at?: Date,
  ): Promise<ProvisionalMarkingRecord> {
    return this.markings.create({
      workspaceId,
      artifactType: artifact.artifactType,
      artifactId: artifact.artifactId,
      questionId,
      clearedAt: null,
      createdAt: at ?? new Date(),
    });
  }

  /**
   * FR-RUN-017 / SC-004 — answering ONE question clears ONLY its markings.
   * Markings for other questions on the same artifact stay; the artifact stops
   * being provisional only when ALL of them clear.
   */
  async clearForQuestion(workspaceId: string, questionId: string, at?: Date): Promise<number> {
    const rows = await this.markings.listForQuestion(workspaceId, questionId);
    const uncleared = rows.filter((m) => m.clearedAt === null);
    const when = at ?? new Date();
    for (const marking of uncleared) {
      await this.markings.clear(workspaceId, marking.id, when);
    }
    return uncleared.length;
  }

  /** Provisional while ANY marking on the artifact is uncleared. */
  async isProvisional(workspaceId: string, artifact: ArtifactRef): Promise<boolean> {
    const rows = await this.markings.listForArtifact(workspaceId, artifact);
    return rows.some((m) => m.clearedAt === null);
  }

  /** The markings with their governing questions — names WHY it is provisional. */
  async markingsFor(workspaceId: string, artifact: ArtifactRef): Promise<ProvisionalMarkingRecord[]> {
    return this.markings.listForArtifact(workspaceId, artifact);
  }
}

// ------------------------------------------------------------- in-memory

export class InMemoryMarkingStore implements MarkingStore {
  private readonly rows = new Map<string, ProvisionalMarkingRecord>();
  private seq = 0;

  async create(marking: Omit<ProvisionalMarkingRecord, 'id'>): Promise<ProvisionalMarkingRecord> {
    const row: ProvisionalMarkingRecord = { id: `mark_${++this.seq}`, ...marking };
    this.rows.set(row.id, row);
    return { ...row };
  }

  async listForArtifact(
    workspaceId: string,
    artifact: ArtifactRef,
  ): Promise<ProvisionalMarkingRecord[]> {
    return [...this.rows.values()]
      .filter(
        (m) =>
          m.workspaceId === workspaceId &&
          m.artifactType === artifact.artifactType &&
          m.artifactId === artifact.artifactId,
      )
      .map((m) => ({ ...m }));
  }

  async listForQuestion(workspaceId: string, questionId: string): Promise<ProvisionalMarkingRecord[]> {
    return [...this.rows.values()]
      .filter((m) => m.workspaceId === workspaceId && m.questionId === questionId)
      .map((m) => ({ ...m }));
  }

  async clear(workspaceId: string, markingId: string, at: Date): Promise<ProvisionalMarkingRecord> {
    const row = this.rows.get(markingId);
    if (!row || row.workspaceId !== workspaceId) throw new Error('No such marking.');
    const next = { ...row, clearedAt: at };
    this.rows.set(markingId, next);
    return { ...next };
  }
}
