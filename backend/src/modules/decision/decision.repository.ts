/**
 * `EPIC-031` — persistence for decisions, explanations, exceptions and tenant
 * policies. **Append-only, all four** (the migration's triggers refuse `UPDATE`
 * and `DELETE`). Resolving a pending decision is a new row that points at it.
 *
 * Every read is workspace-scoped in the query. Two implementations: in-memory
 * for unit tests and deployments without `DATABASE_URL`, Prisma otherwise.
 */
import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { ClosureKind, DecisionOutcome, Explanation, GateOutcome, RiskBand } from '@pmi/decision-contract';
import type { TenantPolicyDocument } from './policy.loader.js';

export interface DecisionRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly actionType: string;
  readonly target: { readonly type: string; readonly id: string };
  readonly effectiveClass: RiskBand;
  readonly proposedClass: RiskBand | null;
  readonly outcome: DecisionOutcome;
  readonly decidedBy: string | null;
  readonly authorityBasis: string;
  readonly objectVersion: string;
  readonly decidedAt: Date | null;
  readonly actorKind: 'human' | 'automation';
  readonly actorId: string;
  readonly requestedBy: string | null;
  readonly steeringVersions: Readonly<Record<string, number>>;
  readonly policyVersion: number;
  readonly requiredGates: readonly string[];
  readonly gateOutcomes: readonly GateOutcome[];
  readonly resolvesDecisionId: string | null;
  readonly explanation: Explanation & { readonly id: string };
  readonly createdAt: Date;
}

export type NewDecision = Omit<DecisionRecord, 'id' | 'createdAt' | 'explanation'> & {
  readonly explanation: Explanation;
};

export interface GateExceptionRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly decisionId: string;
  readonly gateId: string;
  readonly authorizedBy: string;
  readonly reason: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export interface DecisionRepository {
  /** Explanation and decision together — a decision is never written without one (`FR-DPE-040`). */
  append(input: NewDecision): Promise<DecisionRecord>;
  get(workspaceId: string, id: string): Promise<DecisionRecord | null>;
  /** Every decision in a workspace, oldest first. */
  list(workspaceId: string): Promise<DecisionRecord[]>;
  /** The decision that resolved this one, if any. */
  resolutionOf(workspaceId: string, id: string): Promise<DecisionRecord | null>;
  appendException(input: Omit<GateExceptionRecord, 'id' | 'createdAt'>): Promise<GateExceptionRecord>;
  exceptionsFor(workspaceId: string, decisionId: string): Promise<GateExceptionRecord[]>;
  appendPolicy(workspaceId: string, policy: TenantPolicyDocument, approvedAt: Date): Promise<void>;
  /** The highest-versioned policy a workspace issued, or `null` — the platform default then applies. */
  latestPolicy(workspaceId: string): Promise<TenantPolicyDocument | null>;
}

// ─────────────────────────────────────────────────────────────── in-memory

export class InMemoryDecisionRepository implements DecisionRepository {
  private readonly decisions: DecisionRecord[] = [];
  private readonly exceptions: GateExceptionRecord[] = [];
  private readonly policies: Array<{ workspaceId: string; policy: TenantPolicyDocument }> = [];

  async append(input: NewDecision): Promise<DecisionRecord> {
    if (input.outcome !== 'pending' && (input.decidedBy === null || input.decidedBy.trim() === '')) {
      throw new Error('a decision that is not pending names who took it');
    }
    if (input.effectiveClass === 'high' && input.actorKind !== 'human' && !['pending', 'refused'].includes(input.outcome)) {
      // The in-memory twin of policy_decisions_high_band_is_human.
      throw new Error('automation cannot take a high-band decision (FR-DPE-012)');
    }
    if (input.resolvesDecisionId !== null && (await this.resolutionOf(input.workspaceId, input.resolvesDecisionId))) {
      throw new Error(`decision ${input.resolvesDecisionId} is already resolved`);
    }
    const row: DecisionRecord = {
      ...input,
      id: randomUUID(),
      createdAt: new Date(),
      explanation: { ...input.explanation, id: randomUUID() },
    };
    this.decisions.push(row);
    return row;
  }

  async get(workspaceId: string, id: string): Promise<DecisionRecord | null> {
    return this.decisions.find((d) => d.workspaceId === workspaceId && d.id === id) ?? null;
  }

  async list(workspaceId: string): Promise<DecisionRecord[]> {
    return this.decisions.filter((d) => d.workspaceId === workspaceId);
  }

  async resolutionOf(workspaceId: string, id: string): Promise<DecisionRecord | null> {
    return this.decisions.find((d) => d.workspaceId === workspaceId && d.resolvesDecisionId === id) ?? null;
  }

  async appendException(input: Omit<GateExceptionRecord, 'id' | 'createdAt'>): Promise<GateExceptionRecord> {
    const row = { ...input, id: randomUUID(), createdAt: new Date() };
    this.exceptions.push(row);
    return row;
  }

  async exceptionsFor(workspaceId: string, decisionId: string): Promise<GateExceptionRecord[]> {
    return this.exceptions.filter((e) => e.workspaceId === workspaceId && e.decisionId === decisionId);
  }

  async appendPolicy(workspaceId: string, policy: TenantPolicyDocument): Promise<void> {
    if (this.policies.some((p) => p.workspaceId === workspaceId && p.policy.version === policy.version)) {
      throw new Error(`policy version ${policy.version} is already issued; versions are never reused`);
    }
    this.policies.push({ workspaceId, policy });
  }

  async latestPolicy(workspaceId: string): Promise<TenantPolicyDocument | null> {
    const mine = this.policies.filter((p) => p.workspaceId === workspaceId);
    return mine.sort((a, b) => b.policy.version - a.policy.version)[0]?.policy ?? null;
  }
}

// ─────────────────────────────────────────────────────────────── Prisma

type Row = Record<string, unknown> & { explanation: Record<string, unknown> };

function toExplanation(row: Record<string, unknown>): Explanation & { id: string } {
  const optional = (key: string) => (row[key] === null || row[key] === undefined ? {} : { [key]: row[key] as string });
  return {
    id: row['id'] as string,
    policyVersion: row['policyVersion'] as string,
    matchedRule: (row['matchedRule'] as Explanation['matchedRule']) ?? null,
    riskClass: row['riskClass'] as RiskBand,
    authorityApplied: row['authorityApplied'] as string,
    ...optional('precedenceResolution'),
    ...optional('constraintCited'),
    ...optional('proposalDisagreement'),
    ...optional('triggerRule'),
    // `FR-DPE-017` — the database holds both or neither.
    ...(typeof row['closureKind'] === 'string'
      ? { closure: { kind: row['closureKind'] as ClosureKind, reason: row['closureReason'] as string } }
      : {}),
  } as Explanation & { id: string };
}

function toDecision(row: Row): DecisionRecord {
  return {
    id: row['id'] as string,
    workspaceId: row['workspaceId'] as string,
    projectId: row['projectId'] as string,
    actionType: row['actionType'] as string,
    target: { type: row['targetType'] as string, id: row['targetId'] as string },
    effectiveClass: row['effectiveClass'] as RiskBand,
    proposedClass: (row['proposedClass'] as RiskBand | null) ?? null,
    outcome: row['outcome'] as DecisionOutcome,
    decidedBy: (row['decidedBy'] as string | null) ?? null,
    authorityBasis: row['authorityBasis'] as string,
    objectVersion: row['objectVersion'] as string,
    decidedAt: (row['decidedAt'] as Date | null) ?? null,
    actorKind: row['actorKind'] === 'automation' ? 'automation' : 'human',
    actorId: row['actorId'] as string,
    requestedBy: (row['requestedBy'] as string | null) ?? null,
    steeringVersions: row['steeringVersions'] as Record<string, number>,
    policyVersion: row['policyVersion'] as number,
    requiredGates: row['requiredGates'] as string[],
    gateOutcomes: row['gateOutcomes'] as GateOutcome[],
    resolvesDecisionId: (row['resolvesDecisionId'] as string | null) ?? null,
    explanation: toExplanation(row.explanation),
    createdAt: row['createdAt'] as Date,
  };
}

export class PrismaDecisionRepository implements DecisionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async append(input: NewDecision): Promise<DecisionRecord> {
    const e = input.explanation;
    const row = await this.prisma.$transaction(async (tx) => {
      const explanation = await tx.decisionExplanation.create({
        data: {
          workspaceId: input.workspaceId,
          policyVersion: e.policyVersion,
          matchedRule: e.matchedRule === null ? Prisma.DbNull : (e.matchedRule as unknown as Prisma.InputJsonValue),
          riskClass: e.riskClass,
          authorityApplied: e.authorityApplied,
          precedenceResolution: e.precedenceResolution ?? null,
          constraintCited: e.constraintCited ?? null,
          proposalDisagreement: e.proposalDisagreement ?? null,
          triggerRule: e.triggerRule ?? null,
          closureKind: e.closure?.kind ?? null,
          closureReason: e.closure?.reason ?? null,
        },
      });
      return tx.policyDecision.create({
        data: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          actionType: input.actionType,
          targetType: input.target.type,
          targetId: input.target.id,
          effectiveClass: input.effectiveClass,
          proposedClass: input.proposedClass,
          outcome: input.outcome,
          decidedBy: input.decidedBy,
          authorityBasis: input.authorityBasis,
          objectVersion: input.objectVersion,
          decidedAt: input.decidedAt,
          actorKind: input.actorKind,
          actorId: input.actorId,
          requestedBy: input.requestedBy,
          steeringVersions: input.steeringVersions as Prisma.InputJsonValue,
          policyVersion: input.policyVersion,
          requiredGates: input.requiredGates as unknown as Prisma.InputJsonValue,
          gateOutcomes: input.gateOutcomes as unknown as Prisma.InputJsonValue,
          resolvesDecisionId: input.resolvesDecisionId,
          explanationId: explanation.id,
        },
        include: { explanation: true },
      });
    });
    return toDecision(row as unknown as Row);
  }

  async get(workspaceId: string, id: string): Promise<DecisionRecord | null> {
    const row = await this.prisma.policyDecision.findFirst({ where: { workspaceId, id }, include: { explanation: true } });
    return row === null ? null : toDecision(row as unknown as Row);
  }

  async list(workspaceId: string): Promise<DecisionRecord[]> {
    const rows = await this.prisma.policyDecision.findMany({
      where: { workspaceId },
      include: { explanation: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return (rows as unknown as Row[]).map(toDecision);
  }

  async resolutionOf(workspaceId: string, id: string): Promise<DecisionRecord | null> {
    const row = await this.prisma.policyDecision.findFirst({
      where: { workspaceId, resolvesDecisionId: id },
      include: { explanation: true },
    });
    return row === null ? null : toDecision(row as unknown as Row);
  }

  async appendException(input: Omit<GateExceptionRecord, 'id' | 'createdAt'>): Promise<GateExceptionRecord> {
    return (await this.prisma.decisionGateException.create({ data: input })) as GateExceptionRecord;
  }

  async exceptionsFor(workspaceId: string, decisionId: string): Promise<GateExceptionRecord[]> {
    return (await this.prisma.decisionGateException.findMany({
      where: { workspaceId, decisionId },
      orderBy: { createdAt: 'asc' },
    })) as GateExceptionRecord[];
  }

  async appendPolicy(workspaceId: string, policy: TenantPolicyDocument, approvedAt: Date): Promise<void> {
    await this.prisma.tenantPolicy.create({
      data: {
        workspaceId,
        version: policy.version,
        bandTreatment: policy.bandTreatment as unknown as Prisma.InputJsonValue,
        selfApprovalAllowed: policy.selfApprovalAllowed as unknown as Prisma.InputJsonValue,
        automatedActions: policy.automatedActions as unknown as Prisma.InputJsonValue,
        approvedBy: policy.approvedBy,
        approvedAt,
      },
    });
  }

  async latestPolicy(workspaceId: string): Promise<TenantPolicyDocument | null> {
    const row = await this.prisma.tenantPolicy.findFirst({ where: { workspaceId }, orderBy: { version: 'desc' } });
    if (row === null) return null;
    return {
      version: row.version,
      bandTreatment: row.bandTreatment as unknown as TenantPolicyDocument['bandTreatment'],
      selfApprovalAllowed: row.selfApprovalAllowed as unknown as string[],
      automatedActions: row.automatedActions as unknown as TenantPolicyDocument['automatedActions'],
      approvedBy: row.approvedBy,
    };
  }
}
