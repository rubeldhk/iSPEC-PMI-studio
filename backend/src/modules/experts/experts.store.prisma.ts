/**
 * `T1912` (EPIC-047) — the PostgreSQL experts store.
 *
 * Every read is `findFirst`/`findMany` with the workspace in the predicate,
 * never `findUnique` on an id alone: an Expert in another workspace must be
 * indistinguishable from one that does not exist (`FR-EXP-008`).
 *
 * The two write-once rules are enforced twice — here, with a conditional
 * `updateMany` whose count says whether the row was still unwritten, and in the
 * database by trigger (`R-047-14`). This store turns a lost race into a
 * `ConflictError`; the trigger is what holds if a later caller bypasses it.
 */
import { ConflictError } from '../../core/errors.js';
import type {
  Assignment,
  ContractVersion,
  DelegationPolicy,
  EngineeringExpert,
  ExpertContract,
  ExpertSession,
  SessionLimit,
} from './expert.types.js';
import type { ExpertsStore } from './experts.store.js';

/** The Prisma surface this store uses, named rather than imported (PC-1). */
interface Delegate {
  create(args: unknown): Promise<unknown>;
  findFirst(args: unknown): Promise<unknown>;
  findMany(args: unknown): Promise<unknown[]>;
  updateMany(args: unknown): Promise<{ count: number }>;
  upsert(args: unknown): Promise<unknown>;
}

export interface ExpertsPrismaClient {
  readonly engineeringExpert: Delegate;
  readonly expertContractVersion: Delegate;
  readonly expertDelegationPolicy: Delegate;
  readonly expertSession: Delegate;
  readonly expertSessionLimit: Delegate;
  readonly taskAssignment: Delegate;
}

type Row = Record<string, unknown>;

const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v));
const isoOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : iso(v));
const num = (v: unknown): number => Number(v);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

/** Prisma raises P2002 on a unique violation; callers should see a conflict, not a driver code. */
function isUnique(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'P2002';
}

function toExpert(r: Row): EngineeringExpert {
  return {
    id: String(r['id']),
    workspaceId: String(r['workspaceId']),
    key: String(r['key']),
    name: String(r['name']),
    status: r['status'] as EngineeringExpert['status'],
    registeredBy: String(r['registeredBy']),
    registeredAt: iso(r['registeredAt']),
    retiredBy: (r['retiredBy'] as string | null) ?? null,
    retiredAt: isoOrNull(r['retiredAt']),
  };
}

function toVersion(r: Row): ContractVersion {
  return {
    id: String(r['id']),
    workspaceId: String(r['workspaceId']),
    expertId: String(r['expertId']),
    version: num(r['version']),
    contract: r['contract'] as ExpertContract,
    decisionId: (r['decisionId'] as string | null) ?? null,
    createdBy: String(r['createdBy']),
    createdAt: iso(r['createdAt']),
  };
}

function toPolicy(r: Row): DelegationPolicy {
  return {
    workspaceId: String(r['workspaceId']),
    maxDepth: num(r['maxDepth']),
    maxFanOut: num(r['maxFanOut']),
    allowedPairs: r['allowedPairs'] as DelegationPolicy['allowedPairs'],
    maxUnattendedBand: r['maxUnattendedBand'] as DelegationPolicy['maxUnattendedBand'],
    updatedBy: String(r['updatedBy']),
    updatedAt: iso(r['updatedAt']),
  };
}

function toSession(r: Row): ExpertSession {
  return {
    executionId: String(r['executionId']),
    workspaceId: String(r['workspaceId']),
    expertId: String(r['expertId']),
    contractVersionId: String(r['contractVersionId']),
    delegatedFromExecutionId: (r['delegatedFromExecutionId'] as string | null) ?? null,
    depth: num(r['depth']),
    model: String(r['model']),
    usedFallback: Boolean(r['usedFallback']),
    fallbackReason: (r['fallbackReason'] as string | null) ?? null,
    effectiveAuthority: r['effectiveAuthority'] as ExpertSession['effectiveAuthority'],
    toolObservation: r['toolObservation'] as ExpertSession['toolObservation'],
    unattended: Boolean(r['unattended']),
    reviewRequired: Boolean(r['reviewRequired']),
    outcome: (r['outcome'] as ExpertSession['outcome']) ?? null,
    startedAt: iso(r['startedAt']),
    endedAt: isoOrNull(r['endedAt']),
  };
}

function toLimit(r: Row): SessionLimit {
  return {
    executionId: String(r['executionId']),
    limit: r['limit'] as SessionLimit['limit'],
    value: num(r['value']),
    requested: numOrNull(r['requested']),
    enforcement: r['enforcement'] as SessionLimit['enforcement'],
    consumed: numOrNull(r['consumed']),
    consumedReason: (r['consumedReason'] as string | null) ?? null,
    reached: r['reached'] as SessionLimit['reached'],
    detectedAt: isoOrNull(r['detectedAt']),
  };
}

function toAssignment(r: Row): Assignment {
  return {
    id: String(r['id']),
    workspaceId: String(r['workspaceId']),
    taskId: String(r['taskId']),
    assigneeKind: r['assigneeKind'] as Assignment['assigneeKind'],
    assigneeId: String(r['assigneeId']),
    rule: String(r['rule']),
    state: r['state'] as Assignment['state'],
    decisionId: (r['decisionId'] as string | null) ?? null,
    assignedBy: String(r['assignedBy']),
    assignedAt: iso(r['assignedAt']),
    supersededAt: isoOrNull(r['supersededAt']),
    supersededBy: (r['supersededBy'] as string | null) ?? null,
  };
}

export class PrismaExpertsStore implements ExpertsStore {
  constructor(private readonly prisma: ExpertsPrismaClient) {}

  async addExpert(row: EngineeringExpert): Promise<EngineeringExpert> {
    try {
      return toExpert(
        (await this.prisma.engineeringExpert.create({
          data: { ...row, registeredAt: new Date(row.registeredAt), retiredAt: row.retiredAt ? new Date(row.retiredAt) : null },
        })) as Row,
      );
    } catch (error) {
      if (isUnique(error)) {
        throw new ConflictError(`an Expert with the key '${row.key}' is already registered in this workspace`);
      }
      throw error;
    }
  }

  async findExpert(workspaceId: string, id: string): Promise<EngineeringExpert | null> {
    const r = (await this.prisma.engineeringExpert.findFirst({ where: { id, workspaceId } })) as Row | null;
    return r ? toExpert(r) : null;
  }

  async findExpertByKey(workspaceId: string, key: string): Promise<EngineeringExpert | null> {
    const r = (await this.prisma.engineeringExpert.findFirst({ where: { key, workspaceId } })) as Row | null;
    return r ? toExpert(r) : null;
  }

  async listExperts(workspaceId: string): Promise<EngineeringExpert[]> {
    return ((await this.prisma.engineeringExpert.findMany({ where: { workspaceId }, orderBy: { key: 'asc' } })) as Row[]).map(
      toExpert,
    );
  }

  async retireExpert(workspaceId: string, id: string, by: string, at: string): Promise<void> {
    // Conditional on still being active, so a second retirement keeps the first's actor and instant.
    await this.prisma.engineeringExpert.updateMany({
      where: { id, workspaceId, status: 'active' },
      data: { status: 'retired', retiredBy: by, retiredAt: new Date(at) },
    });
  }

  async addVersion(row: ContractVersion): Promise<ContractVersion> {
    try {
      return toVersion(
        (await this.prisma.expertContractVersion.create({
          data: { ...row, contract: row.contract as unknown as object, createdAt: new Date(row.createdAt) },
        })) as Row,
      );
    } catch (error) {
      if (isUnique(error)) throw new ConflictError(`version ${row.version} of this Expert already exists`);
      throw error;
    }
  }

  async versionsFor(workspaceId: string, expertId: string): Promise<ContractVersion[]> {
    return (
      (await this.prisma.expertContractVersion.findMany({
        where: { workspaceId, expertId },
        orderBy: { version: 'asc' },
      })) as Row[]
    ).map(toVersion);
  }

  async recordDecision(workspaceId: string, versionId: string, decisionId: string): Promise<void> {
    const { count } = await this.prisma.expertContractVersion.updateMany({
      where: { id: versionId, workspaceId, decisionId: null },
      data: { decisionId },
    });
    if (count === 0) throw new ConflictError('this contract version was already submitted, or does not exist');
  }

  async policyFor(workspaceId: string): Promise<DelegationPolicy | null> {
    const r = (await this.prisma.expertDelegationPolicy.findFirst({ where: { workspaceId } })) as Row | null;
    return r ? toPolicy(r) : null;
  }

  async putPolicy(row: DelegationPolicy): Promise<DelegationPolicy> {
    const data = {
      maxDepth: row.maxDepth,
      maxFanOut: row.maxFanOut,
      allowedPairs: row.allowedPairs as unknown as object,
      maxUnattendedBand: row.maxUnattendedBand,
      updatedBy: row.updatedBy,
      updatedAt: new Date(row.updatedAt),
    };
    return toPolicy(
      (await this.prisma.expertDelegationPolicy.upsert({
        where: { workspaceId: row.workspaceId },
        create: { workspaceId: row.workspaceId, ...data },
        update: data,
      })) as Row,
    );
  }

  async addSession(row: ExpertSession): Promise<ExpertSession> {
    try {
      return toSession(
        (await this.prisma.expertSession.create({
          data: {
            ...row,
            effectiveAuthority: row.effectiveAuthority as unknown as object,
            startedAt: new Date(row.startedAt),
            endedAt: row.endedAt ? new Date(row.endedAt) : null,
          },
        })) as Row,
      );
    } catch (error) {
      if (isUnique(error)) throw new ConflictError(`session ${row.executionId} already exists`);
      throw error;
    }
  }

  async findSession(workspaceId: string, executionId: string): Promise<ExpertSession | null> {
    const r = (await this.prisma.expertSession.findFirst({ where: { executionId, workspaceId } })) as Row | null;
    return r ? toSession(r) : null;
  }

  async sessionsForExpert(workspaceId: string, expertId: string, limit: number): Promise<ExpertSession[]> {
    return (
      (await this.prisma.expertSession.findMany({
        where: { workspaceId, expertId },
        orderBy: { startedAt: 'desc' },
        take: limit,
      })) as Row[]
    ).map(toSession);
  }

  async childrenOf(workspaceId: string, executionId: string): Promise<ExpertSession[]> {
    return (
      (await this.prisma.expertSession.findMany({
        where: { workspaceId, delegatedFromExecutionId: executionId },
        orderBy: { startedAt: 'asc' },
      })) as Row[]
    ).map(toSession);
  }

  async endSession(
    workspaceId: string,
    executionId: string,
    end: { outcome: NonNullable<ExpertSession['outcome']>; endedAt: string; toolObservation?: ExpertSession['toolObservation'] },
  ): Promise<void> {
    await this.prisma.expertSession.updateMany({
      where: { executionId, workspaceId, outcome: null },
      data: {
        outcome: end.outcome,
        endedAt: new Date(end.endedAt),
        ...(end.toolObservation ? { toolObservation: end.toolObservation } : {}),
      },
    });
  }

  async putLimit(row: SessionLimit): Promise<SessionLimit> {
    const session = (await this.prisma.expertSession.findFirst({ where: { executionId: row.executionId } })) as Row | null;
    const workspaceId = String(session?.['workspaceId'] ?? '');
    const data = {
      value: row.value,
      requested: row.requested,
      enforcement: row.enforcement,
      consumed: row.consumed,
      consumedReason: row.consumedReason,
      reached: row.reached,
      detectedAt: row.detectedAt ? new Date(row.detectedAt) : null,
    };
    return toLimit(
      (await this.prisma.expertSessionLimit.upsert({
        where: { executionId_limit: { executionId: row.executionId, limit: row.limit } },
        create: { executionId: row.executionId, limit: row.limit, workspaceId, ...data },
        update: data,
      })) as Row,
    );
  }

  async limitsFor(workspaceId: string, executionId: string): Promise<SessionLimit[]> {
    return ((await this.prisma.expertSessionLimit.findMany({ where: { workspaceId, executionId } })) as Row[]).map(toLimit);
  }

  async addAssignment(row: Assignment): Promise<Assignment> {
    return toAssignment(
      (await this.prisma.taskAssignment.create({
        data: {
          ...row,
          assignedAt: new Date(row.assignedAt),
          supersededAt: row.supersededAt ? new Date(row.supersededAt) : null,
        },
      })) as Row,
    );
  }

  async assignmentsFor(workspaceId: string, taskId: string): Promise<Assignment[]> {
    return (
      (await this.prisma.taskAssignment.findMany({
        where: { workspaceId, taskId },
        orderBy: { assignedAt: 'desc' },
      })) as Row[]
    ).map(toAssignment);
  }

  async supersedeAssignment(workspaceId: string, id: string, by: string, at: string): Promise<void> {
    const { count } = await this.prisma.taskAssignment.updateMany({
      where: { id, workspaceId, supersededAt: null },
      data: { supersededAt: new Date(at), supersededBy: by },
    });
    if (count === 0) throw new ConflictError(`assignment ${id} was already superseded, or does not exist`);
  }
}
