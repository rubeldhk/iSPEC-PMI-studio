/**
 * `T1182` (EPIC-033) — the Requirement Room, in PostgreSQL.
 *
 * Its own file, following `reviews/gate.store.prisma.ts`: the in-memory store
 * is what unit tests load, and keeping the adapter beside it would pull the
 * generated client into their graph.
 *
 * Written after a human opened the application and found that a Room did not
 * survive a restart. `REQUIREMENT_ROOM_STORE` has defaulted to in-memory since
 * `T338b`, and the store's header explains that default honestly — what nobody
 * checked is that nothing ever replaced it. A **baseline** is the artifact
 * `RULE-02` exists to make immutable, and until now it lived in the process
 * that created it.
 *
 * **The two methods with real logic are `nextBaselineVersion` and `supersede`,
 * and both are written against a specific trap.** `nextBaselineVersion` reads
 * the highest version rather than counting rows: the moment one version is
 * missing, a count hands out a number that has already been used, and baselines
 * are cited by version. `supersede` **updates** rather than deletes, because
 * `FR-RQR-052` keeps a superseded baseline readable and `SC-RQR-006`'s trace
 * runs through it in both directions.
 */
import type {
  BaselineExceptionRow,
  BaselineRow,
  CandidateRow,
  ClarificationRow,
  DecisionRow,
  HandoffRow,
  RequirementRoomStore,
} from './requirement-room.store.js';

/** The Prisma surface this store uses, named rather than imported (PC-1). */
interface Delegate {
  create(args: unknown): Promise<unknown>;
  findUnique(args: unknown): Promise<unknown>;
  findFirst(args: unknown): Promise<unknown>;
  findMany(args: unknown): Promise<unknown[]>;
  update(args: unknown): Promise<unknown>;
}

export interface RoomPrismaClient {
  readonly requirementCandidate: Delegate;
  readonly clarification: Delegate;
  readonly baseline: Delegate;
  readonly baselineException: Delegate;
  readonly requirementDecision: Delegate;
  readonly handoff: Delegate;
}

export class PrismaRequirementRoomStore implements RequirementRoomStore {
  constructor(private readonly prisma: RoomPrismaClient) {}

  /**
   * One `create` per row rather than `createMany`.
   *
   * `createMany` does not return the created rows in PostgreSQL, and this
   * contract returns them — callers read back the ids they were given.
   */
  async createCandidates(rows: readonly CandidateRow[]): Promise<CandidateRow[]> {
    const created: CandidateRow[] = [];
    for (const row of rows) {
      created.push((await this.prisma.requirementCandidate.create({ data: row })) as CandidateRow);
    }
    return created;
  }

  async findCandidateById(id: string): Promise<CandidateRow | null> {
    return (await this.prisma.requirementCandidate.findUnique({
      where: { id },
    })) as CandidateRow | null;
  }

  async listCandidates(workspaceId: string, roomObjectId: string): Promise<CandidateRow[]> {
    return (await this.prisma.requirementCandidate.findMany({
      where: { workspaceId, roomObjectId },
      orderBy: { createdAt: 'asc' },
    })) as CandidateRow[];
  }

  async markPromoted(id: string, requirementId: string): Promise<CandidateRow> {
    // A reference, never a copy — `FR-RQR-002`, `D-33`.
    return (await this.prisma.requirementCandidate.update({
      where: { id },
      data: { promotedTo: requirementId },
    })) as CandidateRow;
  }

  async setCandidateCriteria(
    id: string,
    criteria: {
      acceptanceCriteria: readonly string[] | null;
      intendedForImplementation: boolean;
    },
  ): Promise<CandidateRow> {
    return (await this.prisma.requirementCandidate.update({
      where: { id },
      data: {
        acceptanceCriteria: criteria.acceptanceCriteria ?? null,
        intendedForImplementation: criteria.intendedForImplementation,
      },
    })) as CandidateRow;
  }

  async createClarifications(rows: readonly ClarificationRow[]): Promise<ClarificationRow[]> {
    const created: ClarificationRow[] = [];
    for (const row of rows) {
      created.push((await this.prisma.clarification.create({ data: row })) as ClarificationRow);
    }
    return created;
  }

  async findClarificationById(id: string): Promise<ClarificationRow | null> {
    return (await this.prisma.clarification.findUnique({
      where: { id },
    })) as ClarificationRow | null;
  }

  async listClarifications(workspaceId: string, roomObjectId: string): Promise<ClarificationRow[]> {
    return (await this.prisma.clarification.findMany({
      where: { workspaceId, roomObjectId },
      orderBy: { createdAt: 'asc' },
    })) as ClarificationRow[];
  }

  async answerClarification(
    id: string,
    answer: { answer: string; answeredBy: string; answeredAt: Date },
  ): Promise<ClarificationRow> {
    // `FR-RQR-013` — the answer is retained, not discarded once resolved, so
    // this writes the answer beside the question rather than clearing it.
    return (await this.prisma.clarification.update({
      where: { id },
      data: answer,
    })) as ClarificationRow;
  }

  async createBaseline(row: BaselineRow): Promise<BaselineRow> {
    return (await this.prisma.baseline.create({ data: row })) as BaselineRow;
  }

  async findBaselineById(id: string): Promise<BaselineRow | null> {
    return (await this.prisma.baseline.findUnique({ where: { id } })) as BaselineRow | null;
  }

  async findBaselineByVersion(projectId: string, version: number): Promise<BaselineRow | null> {
    return (await this.prisma.baseline.findFirst({
      where: { projectId, version },
    })) as BaselineRow | null;
  }

  async listBaselines(workspaceId: string, projectId: string): Promise<BaselineRow[]> {
    // Superseded ones included: `FR-RQR-052` keeps them readable, and
    // `assertEditable` filters to the current set itself rather than relying on
    // the store to hide history.
    return (await this.prisma.baseline.findMany({
      where: { workspaceId, projectId },
      orderBy: { version: 'asc' },
    })) as BaselineRow[];
  }

  async nextBaselineVersion(projectId: string): Promise<number> {
    const [highest] = (await this.prisma.baseline.findMany({
      where: { projectId },
      orderBy: { version: 'desc' },
      take: 1,
    })) as BaselineRow[];
    return (highest?.version ?? 0) + 1;
  }

  async supersede(id: string, byVersion: number): Promise<BaselineRow> {
    return (await this.prisma.baseline.update({
      where: { id },
      data: { supersededBy: byVersion },
    })) as BaselineRow;
  }

  async createDecision(row: DecisionRow): Promise<DecisionRow> {
    return (await this.prisma.requirementDecision.create({ data: row })) as DecisionRow;
  }

  async listDecisions(workspaceId: string, roomObjectId: string): Promise<DecisionRow[]> {
    return (await this.prisma.requirementDecision.findMany({
      where: { workspaceId, roomObjectId },
      orderBy: { decidedAt: 'asc' },
    })) as DecisionRow[];
  }

  async createHandoff(row: HandoffRow): Promise<HandoffRow> {
    return (await this.prisma.handoff.create({ data: row })) as HandoffRow;
  }

  async listHandoffsForBaseline(workspaceId: string, baselineId: string): Promise<HandoffRow[]> {
    return (await this.prisma.handoff.findMany({
      where: { workspaceId, baselineId },
      orderBy: { selectedAt: 'asc' },
    })) as HandoffRow[];
  }

  async listHandoffsForWorkflow(
    workspaceId: string,
    specificationWorkflowRef: string,
  ): Promise<HandoffRow[]> {
    // The other direction of `SC-RQR-006`: given a specification workflow,
    // which baseline was handed to it.
    return (await this.prisma.handoff.findMany({
      where: { workspaceId, specificationWorkflowRef },
      orderBy: { selectedAt: 'asc' },
    })) as HandoffRow[];
  }

  async createBaselineExceptions(
    rows: readonly BaselineExceptionRow[],
  ): Promise<BaselineExceptionRow[]> {
    const created: BaselineExceptionRow[] = [];
    for (const row of rows) {
      created.push(
        (await this.prisma.baselineException.create({ data: row })) as BaselineExceptionRow,
      );
    }
    return created;
  }

  async listBaselineExceptions(
    workspaceId: string,
    baselineId: string,
  ): Promise<BaselineExceptionRow[]> {
    // `FR-RQR-033` — enumerable without opening each requirement.
    return (await this.prisma.baselineException.findMany({
      where: { workspaceId, baselineId },
      orderBy: { createdAt: 'asc' },
    })) as BaselineExceptionRow[];
  }
}
