/**
 * T1108 (EPIC-021 C2C reopening) — the production gate capability.
 *
 * ## What `X7` actually was
 *
 * EPIC-021 had services and no **producer**: nothing composed them, nothing
 * wrote `ReviewGate` or `GateOutcome`, and they were exercised only by unit
 * tests. A table and a read service that nobody writes to answer nothing.
 *
 * This file supplies the three things that were missing — durable gate
 * configuration, an authoritative append-only decision, and a public query
 * EPIC-030 can consume — while leaving every existing EPIC-021 service exactly
 * as it is. Policy stays here; EPIC-030 reads the answer and never recomputes it.
 *
 * ## Why the gate SET is the configuration version
 *
 * `GateStore` is `append`-only by design. Configuring another gate for a
 * transition therefore does not mutate anything — it changes the *set* of gates
 * that apply. So the set's digest is the configuration version, and a decision
 * made when one gate applied is stale the moment a second is added. Nothing
 * needed a `version` column; the existing model already carried the fact.
 */
import { createHash } from 'node:crypto';
import type { GateStore, ReviewGateRecord } from './gate-config.service.js';

/** What EPIC-030 is told about the gates on a transition. */
export type GateDisposition = 'passed' | 'failed' | 'pending' | 'unavailable' | 'stale';

export interface GateDispositionResult {
  readonly disposition: GateDisposition;
  /** The deciding gate, or why no decision could be obtained. */
  readonly blocking: string | undefined;
  readonly gateSetVersion: string;
  /** The final outcomes consulted, for traceability. */
  readonly outcomeIds: readonly string[];
}

/** The immutable decision row. */
export interface GateFinalOutcomeRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly specificationId: string;
  readonly fromStatus: string;
  readonly toStatus: string;
  readonly targetVersionId: string | null;
  readonly gateSetVersion: string;
  readonly gateId: string;
  readonly disposition: 'passed' | 'failed';
  readonly reason: string;
  readonly decidedById: string | null;
  readonly decidedAt: Date | null;
  readonly createdAt: Date;
}

export interface GateFinalOutcomeStore {
  append(row: Record<string, unknown>): Promise<{ id: string }>;
  /** Every final outcome for this transition, newest first. */
  listFor(
    workspaceId: string,
    specificationId: string,
    fromStatus: string,
    toStatus: string,
  ): Promise<GateFinalOutcomeRecord[]>;
}

/**
 * The configuration version of an applicable-gate set.
 *
 * Order-independent, so the same gates configured in a different order produce
 * the same version — otherwise a harmless re-read would invalidate decisions.
 */
export function gateSetVersionOf(gates: readonly ReviewGateRecord[]): string {
  if (gates.length === 0) return 'none';
  const ids = gates.map((g) => g.id).sort();
  return createHash('sha256').update(ids.join('|')).digest('hex').slice(0, 16);
}

export class NoApplicableGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoApplicableGateError';
  }
}

/**
 * EPIC-021's public contract. **The only thing EPIC-030 consumes.**
 *
 * Every disposition below is decided here, in the Epic that owns gate policy.
 * EPIC-030 maps the answer onto a verdict and does not re-derive it.
 */
export class GateProductionService {
  constructor(
    private readonly gates: GateStore,
    private readonly outcomes: GateFinalOutcomeStore,
  ) {}

  /** The gates configured for this exact `from->to` transition. */
  async applicableGates(
    workspaceId: string,
    fromStatus: string,
    toStatus: string,
  ): Promise<ReviewGateRecord[]> {
    return this.gates.findForTransition(workspaceId, `${fromStatus}->${toStatus}`);
  }

  /**
   * Record an authoritative decision. Append-only: a correction supersedes.
   *
   * `FR-ENH-014` — a `passed` decision requires a human decider, enforced here
   * *and* by a CHECK constraint, because an automated verdict must never
   * advance a gated transition.
   */
  async recordDecision(input: {
    workspaceId: string;
    specificationId: string;
    fromStatus: string;
    toStatus: string;
    targetVersionId: string | null;
    gateId: string;
    gateSetVersion: string;
    disposition: 'passed' | 'failed';
    reason: string;
    evaluatorId: string;
    evaluatorSnapshotId?: string;
    decidedById?: string;
    decidedBySnapshotId?: string;
    evidenceRefs?: readonly string[];
    correlationId: string;
    causationId: string;
    supersedesId?: string;
  }): Promise<{ id: string }> {
    if (input.disposition === 'passed' && !input.decidedById) {
      throw new Error(
        'A gate cannot pass without a recorded human decision (FR-ENH-014). ' +
          'An automated verdict alone never advances a gated transition.',
      );
    }
    return this.outcomes.append({
      workspaceId: input.workspaceId,
      specificationId: input.specificationId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      targetVersionId: input.targetVersionId,
      gateSetVersion: input.gateSetVersion,
      gateId: input.gateId,
      disposition: input.disposition,
      reason: input.reason,
      evaluatorId: input.evaluatorId,
      evaluatorSnapshotId: input.evaluatorSnapshotId ?? null,
      decidedById: input.decidedById ?? null,
      decidedBySnapshotId: input.decidedBySnapshotId ?? null,
      decidedAt: input.decidedById ? new Date() : null,
      evidenceRefs: [...(input.evidenceRefs ?? [])],
      correlationId: input.correlationId,
      causationId: input.causationId,
      supersedesId: input.supersedesId ?? null,
    });
  }

  /**
   * The disposition of every applicable gate, bound to the evaluated target.
   *
   * `currentVersionId` is passed in rather than read here: EPIC-009 owns the
   * specification's version, and reading it from a second place would create a
   * second answer to the question of what "current" means.
   */
  async dispositionFor(
    workspaceId: string,
    specificationId: string,
    fromStatus: string,
    toStatus: string,
    currentVersionId: string | null,
  ): Promise<GateDispositionResult> {
    const gates = await this.applicableGates(workspaceId, fromStatus, toStatus);
    const gateSetVersion = gateSetVersionOf(gates);

    // No gates configured is NOT unavailability. `FR-ENH-012` makes gates
    // *configurable*, and `SC-ENH-004` scopes the human-decision rule to
    // *gated* transitions — so a transition nobody gated is simply ungated.
    // Treating it as unavailable would block every ungated transition in the
    // product; treating it as a failure would block them permanently.
    if (gates.length === 0) {
      return {
        disposition: 'passed',
        blocking: undefined,
        gateSetVersion,
        outcomeIds: [],
      };
    }

    const history = await this.outcomes.listFor(workspaceId, specificationId, fromStatus, toStatus);
    const consulted: string[] = [];

    for (const gate of gates) {
      if (!gate.blocking) continue;

      // Newest first; a superseding correction therefore wins without anything
      // being overwritten.
      const latest = history.find((o) => o.gateId === gate.id);

      if (!latest) {
        return {
          disposition: 'pending',
          blocking: gate.id,
          gateSetVersion,
          outcomeIds: consulted,
        };
      }

      // X11 — staleness. Any authoritative input that governed the decision no
      // longer matching makes it unable to authorise anything.
      if (latest.gateSetVersion !== gateSetVersion) {
        return {
          disposition: 'stale',
          blocking: `${gate.id}: the applicable gate set changed since this decision`,
          gateSetVersion,
          outcomeIds: consulted,
        };
      }
      if ((latest.targetVersionId ?? null) !== (currentVersionId ?? null)) {
        return {
          disposition: 'stale',
          blocking: `${gate.id}: decided against a different specification version`,
          gateSetVersion,
          outcomeIds: consulted,
        };
      }

      consulted.push(latest.id);

      if (latest.disposition === 'failed') {
        return {
          disposition: 'failed',
          blocking: gate.id,
          gateSetVersion,
          outcomeIds: consulted,
        };
      }
    }

    return { disposition: 'passed', blocking: undefined, gateSetVersion, outcomeIds: consulted };
  }
}
