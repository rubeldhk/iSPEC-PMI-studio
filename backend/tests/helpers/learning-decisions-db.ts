/**
 * EPIC-048 `T2393` — `EPIC-031` decision rows, written straight into
 * `policy_decisions` for tests that write knowledge versions.
 *
 * Since `T2393`, `knowledge_entry_versions.decisionId` is a foreign key to
 * `policy_decisions` and the `knowledge_versions_require_decision` trigger
 * reads the decision back: same workspace, targeting the candidate, resolved
 * `approved` / `auto-executed`, and `approved` by a human for a human version.
 * A test that fabricates a version therefore fabricates the decision first —
 * with the same SQL any other caller would need, so the fence is exercised and
 * never bypassed.
 *
 * `DbDecisionRecorder` is the `DecisionRecorder` for the composed application:
 * every decision it answers is also written, so the versions the materialiser
 * writes from its answers satisfy the trigger. The test still chooses every
 * outcome, visibly (`R-048-20`).
 *
 * Not a `.spec.` file, so vitest never collects it.
 */
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import type { LearningDecisionRequest, ResolutionView } from '../../src/modules/learning/learning.tokens.js';
import { DecisionRecorder } from './learning-ports.js';

export interface DecisionRow {
  readonly id?: string;
  readonly workspaceId: string;
  readonly projectId?: string;
  readonly candidateId: string;
  readonly outcome: 'pending' | 'approved' | 'auto-executed' | 'refused' | 'exception';
  readonly actorKind?: 'human' | 'automation';
  readonly actorId?: string;
  readonly decidedBy?: string | null;
  readonly effectiveClass?: 'low' | 'medium' | 'high';
  readonly actionType?: string;
  readonly requestedBy?: string | null;
  readonly resolves?: string | null;
  readonly targetType?: string;
}

/** One decision with its explanation; returns its id. */
export async function insertDecision(db: Client, row: DecisionRow): Promise<string> {
  const id = row.id ?? `dec_${randomUUID()}`;
  const explanationId = `dex_${id}`;
  const actorKind = row.actorKind ?? (row.outcome === 'auto-executed' || row.outcome === 'pending' ? 'automation' : 'human');
  const actorId = row.actorId ?? (actorKind === 'human' ? 'u_h' : 'learning-intake');
  const effectiveClass = row.effectiveClass ?? (row.outcome === 'auto-executed' ? 'low' : 'high');
  await db.query(
    `INSERT INTO decision_explanations (id,"workspaceId","policyVersion","riskClass","authorityApplied") VALUES ($1,$2,'1',$3,'test fixture')`,
    [explanationId, row.workspaceId, effectiveClass],
  );
  await db.query(
    `INSERT INTO policy_decisions (id,"workspaceId","projectId","actionType","targetType","targetId","effectiveClass",outcome,"decidedBy","authorityBasis","objectVersion","decidedAt","actorKind","actorId","requestedBy","steeringVersions","policyVersion","requiredGates","gateOutcomes","resolvesDecisionId","explanationId")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'test fixture','1',$10,$11,$12,$13,'{}',1,'[]','[]',$14,$15)`,
    [
      id,
      row.workspaceId,
      row.projectId ?? 'p_1',
      row.actionType ?? 'learning.review.new',
      row.targetType ?? 'learning-candidate',
      row.candidateId,
      effectiveClass,
      row.outcome,
      row.outcome === 'pending' ? null : (row.decidedBy ?? actorId),
      row.outcome === 'pending' ? null : new Date(),
      actorKind,
      actorId,
      row.requestedBy ?? null,
      row.resolves ?? null,
      explanationId,
    ],
  );
  return id;
}

/** A pending request and the human approval that resolves it; returns both ids. */
export async function approvedByHuman(
  db: Client,
  workspaceId: string,
  candidateId: string,
  approver = 'u_h',
): Promise<{ decisionId: string; resolvingDecisionId: string }> {
  const decisionId = await insertDecision(db, { workspaceId, candidateId, outcome: 'pending' });
  const resolvingDecisionId = await insertDecision(db, { workspaceId, candidateId, outcome: 'approved', actorKind: 'human', actorId: approver, resolves: decisionId });
  return { decisionId, resolvingDecisionId };
}

/**
 * The in-test decision engine of `learning-ports.ts`, writing every decision it
 * answers into `policy_decisions` so versions written from its answers satisfy
 * the T2393 trigger. Reads wait for the writes, so a synchronous `resolveAs`
 * is on disk before anything reads it.
 */
export class DbDecisionRecorder extends DecisionRecorder {
  private writes: Promise<unknown>[] = [];
  private readonly candidates = new Map<string, { candidateId: string; projectId: string }>();

  constructor(private readonly db: Client, private readonly workspaceId: string) {
    super();
    this.idPrefix = `dec_${randomUUID().slice(0, 8)}`;
  }

  private async settled(): Promise<void> {
    const pending = this.writes;
    this.writes = [];
    await Promise.all(pending);
  }

  override async decide(request: LearningDecisionRequest) {
    const view = await super.decide(request);
    this.candidates.set(view.decisionId, { candidateId: request.target.id, projectId: request.projectId });
    await insertDecision(this.db, {
      id: view.decisionId,
      workspaceId: request.workspaceId,
      projectId: request.projectId,
      candidateId: request.target.id,
      outcome: view.outcome,
      actionType: request.actionType,
      requestedBy: request.requestedBy,
      effectiveClass: view.effectiveClass,
      actorKind: 'automation',
      actorId: 'learning-intake',
    });
    return view;
  }

  override resolveAs(decisionId: string, over: Partial<ResolutionView> & Pick<ResolutionView, 'outcome' | 'actorKind' | 'decidedBy'>): ResolutionView {
    const view = super.resolveAs(decisionId, over);
    const asked = this.candidates.get(decisionId);
    if (asked !== undefined && view.resolvingDecisionId !== null) {
      this.writes.push(
        insertDecision(this.db, {
          id: view.resolvingDecisionId,
          workspaceId: this.workspaceId,
          projectId: asked.projectId,
          candidateId: asked.candidateId,
          outcome: view.outcome,
          actorKind: view.actorKind,
          actorId: view.decidedBy,
          effectiveClass: view.effectiveClass,
          actionType: view.actionType,
          resolves: decisionId,
        }),
      );
    }
    return view;
  }

  override async approve(input: Parameters<DecisionRecorder['approve']>[0]) {
    const view = await super.approve(input);
    await this.settled();
    return view;
  }

  override async refuse(input: Parameters<DecisionRecorder['refuse']>[0]) {
    const view = await super.refuse(input);
    await this.settled();
    return view;
  }

  override async resolutionOf(workspaceId: string, decisionId: string) {
    await this.settled();
    return super.resolutionOf(workspaceId, decisionId);
  }
}
