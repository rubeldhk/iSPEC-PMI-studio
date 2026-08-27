/**
 * T1109 (EPIC-021 C2C reopening) — durable gate configuration and decisions.
 *
 * `X7`'s producer half. Written against **narrow delegates** rather than
 * importing `PrismaClient`, following `job.store.ts`: the real delegate drops
 * onto these shapes unchanged, and this file stays out of the composition root's
 * business.
 */
import type { GateStore, ReviewGateRecord } from './gate-config.service.js';
import type {
  GateFinalOutcomeRecord,
  GateFinalOutcomeStore,
} from './gate-production.service.js';

/** Narrow view of `PrismaClient.reviewGate`. */
export interface ReviewGateDelegate {
  create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  findMany(args: {
    where: { workspaceId: string; transition: string };
  }): Promise<Record<string, unknown>[]>;
}

/** Narrow view of `PrismaClient.gateFinalOutcome`. */
export interface GateFinalOutcomeDelegate {
  create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy: { createdAt: 'desc' };
  }): Promise<Record<string, unknown>[]>;
}

function gateFromRow(row: Record<string, unknown>): ReviewGateRecord {
  return {
    id: String(row['id']),
    workspaceId: String(row['workspaceId']),
    transition: String(row['transition']),
    requiredRoles: (row['requiredRoles'] as string[]) ?? [],
    blocking: Boolean(row['blocking']),
  };
}

/**
 * Gate configuration, persisted.
 *
 * `append`, never upsert — the interface was always append-only, and that is
 * what makes the applicable-gate *set* a meaningful configuration version.
 */
export class PrismaGateStore implements GateStore {
  constructor(private readonly delegate: ReviewGateDelegate) {}

  async append(gate: ReviewGateRecord): Promise<ReviewGateRecord> {
    const row = await this.delegate.create({
      data: {
        id: gate.id,
        workspaceId: gate.workspaceId,
        transition: gate.transition,
        requiredRoles: [...gate.requiredRoles],
        blocking: gate.blocking,
      },
    });
    return gateFromRow(row);
  }

  async findForTransition(workspaceId: string, transition: string): Promise<ReviewGateRecord[]> {
    const rows = await this.delegate.findMany({ where: { workspaceId, transition } });
    return rows.map(gateFromRow);
  }
}

/**
 * The append-only decision store.
 *
 * There is deliberately no `update`. A correction is appended with
 * `supersedesId`, and `listFor` returns newest first so the correction wins
 * without anything being overwritten — which is also what the database's
 * `gate_final_outcomes_immutable` trigger enforces regardless of this class.
 */
export class PrismaGateFinalOutcomeStore implements GateFinalOutcomeStore {
  constructor(private readonly delegate: GateFinalOutcomeDelegate) {}

  async append(row: Record<string, unknown>): Promise<{ id: string }> {
    return this.delegate.create({ data: row });
  }

  async listFor(
    workspaceId: string,
    specificationId: string,
    fromStatus: string,
    toStatus: string,
  ): Promise<GateFinalOutcomeRecord[]> {
    const rows = await this.delegate.findMany({
      where: { workspaceId, specificationId, fromStatus, toStatus },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: String(r['id']),
      workspaceId: String(r['workspaceId']),
      specificationId: String(r['specificationId']),
      fromStatus: String(r['fromStatus']),
      toStatus: String(r['toStatus']),
      targetVersionId: (r['targetVersionId'] as string | null) ?? null,
      gateSetVersion: String(r['gateSetVersion']),
      gateId: String(r['gateId']),
      disposition: r['disposition'] === 'failed' ? 'failed' : 'passed',
      reason: String(r['reason']),
      decidedById: (r['decidedById'] as string | null) ?? null,
      decidedAt: (r['decidedAt'] as Date | null) ?? null,
      createdAt: r['createdAt'] as Date,
    }));
  }
}
