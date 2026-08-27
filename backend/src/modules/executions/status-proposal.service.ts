/**
 * T1056, T1058, T1059 (EPIC-037 Band A) — proposing, and consuming a verdict.
 *
 * ## What this Epic decides: nothing
 *
 * A connector proposes; EPIC-030 adjudicates; EPIC-009 applies. This service
 * records the proposal, hands it to `PROPOSAL_ADJUDICATOR`, and writes the
 * verdict back as **events**. It does not evaluate a gate, read a policy, or
 * decide anything about the transition.
 *
 * `PROPOSAL_ADJUDICATOR` is the **only** EPIC-030 token reachable from here.
 * The individual ports — gates, authority policy, lifecycle validation and
 * application, records — are deliberately unexported by `LoopModule`: a
 * consumer that could reach them could assemble its own adjudicator over its
 * own gate provider, which is the bypass `FR-GEL-073` forbids.
 *
 * ## Why the proposal table has no verdict column
 *
 * `R-037-5`. A mutable `adjudication` field would become the audit authority
 * the first time somebody read it instead of the event stream, and it could
 * then disagree with EPIC-030's own record. The proposal is the immutable
 * *request*; the verdict is an event and a projection.
 */
import { randomUUID } from 'node:crypto';
import {
  RegistryRefusedError,
  type ExecutionEventType,
  type ProposeTransitionRequest,
} from '@pmi/execution-registry-contract';
import type { AdjudicationVerdict, ProposalAdjudicator } from '@pmi/loop-contract';
import { refusalEventFor } from '@pmi/loop-contract';
import type { ExecutionEventService } from './execution-event.service.js';
import type { ExecutionProjectionService } from './execution-projection.service.js';
import type { DelegationPort, IdentityResolverPort } from './execution-registration.service.js';

export interface ProposalDb {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

/**
 * Verdict → the event this Epic records.
 *
 * `refused` reads the **stage**, never the prose (`X1`). The other five map
 * directly. Reconciliation is one event whatever the cause, because the cause
 * is structured data on the payload rather than a name to invent an event for.
 */
export function eventForVerdict(verdict: AdjudicationVerdict): ExecutionEventType {
  switch (verdict.verdict) {
    case 'validated':
      return 'validation-passed';
    case 'applied':
      return 'transition-applied';
    case 'approval_required':
      return 'approval-requested';
    case 'inconsistent':
      return 'transition-inconsistent';
    case 'reconciliation_required':
      return 'transition-reconciliation-requested';
    case 'refused':
      return refusalEventFor(verdict.refusalStage) as ExecutionEventType;
  }
}

/** Verdict → the projected proposal state. */
export function stateForVerdict(verdict: AdjudicationVerdict): string {
  switch (verdict.verdict) {
    case 'validated':
      return 'validating';
    case 'applied':
      return 'applied';
    case 'approval_required':
      return 'approval_required';
    case 'refused':
      return 'refused';
    case 'inconsistent':
      return 'inconsistent';
    case 'reconciliation_required':
      return 'reconciliation_required';
  }
}

export class StatusProposalService {
  constructor(
    private readonly db: ProposalDb,
    private readonly events: ExecutionEventService,
    private readonly projections: ExecutionProjectionService,
    private readonly adjudicator: ProposalAdjudicator,
    private readonly identity: IdentityResolverPort,
    private readonly delegations: DelegationPort,
  ) {}

  async propose(request: ProposeTransitionRequest): Promise<{
    proposalId: string;
    verdict: AdjudicationVerdict;
    eventType: ExecutionEventType;
  }> {
    const snapshot = await this.identity.resolveSnapshot(request.identity.agentSnapshotId);
    if (snapshot === null || snapshot.workspaceId !== request.workspaceId) {
      throw new RegistryRefusedError(
        'identity_not_resolvable',
        'The proposer identity does not resolve in this workspace.',
      );
    }

    await this.delegations
      .requireDelegated({
        workspaceId: request.workspaceId,
        principalId: request.identity.authenticatedPrincipalId,
        artifact: { artifactType: 'specification', artifactId: request.targetRef },
        action: 'transition.propose',
      })
      .catch((error: unknown) => {
        throw new RegistryRefusedError(
          'delegation_missing',
          error instanceof Error ? error.message : 'No delegation authorises proposing.',
        );
      });

    const proposalId = randomUUID();
    const existing = await this.db.$queryRawUnsafe<{ id: string }[]>(
      `SELECT "id" FROM "status_transition_proposals"
        WHERE "workspaceId" = $1 AND "idempotencyKey" = $2`,
      request.workspaceId,
      request.idempotencyKey,
    );
    const id = existing[0]?.id ?? proposalId;

    if (existing.length === 0) {
      await this.db.$executeRawUnsafe(
        `INSERT INTO "status_transition_proposals"
           ("id","workspaceId","executionId","targetRef","targetVersion","expectedCurrentStatus",
            "proposedState","rationale","proposedBy","proposerSnapshotId","correlationId","idempotencyKey")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        id,
        request.workspaceId,
        request.executionId,
        request.targetRef,
        request.targetVersion,
        request.expectedCurrentStatus,
        request.proposedState,
        request.rationale,
        request.identity.authenticatedPrincipalId,
        snapshot.snapshotId,
        request.correlationId,
        request.idempotencyKey,
      );
      await this.events.append({
        workspaceId: request.workspaceId,
        executionId: request.executionId,
        type: 'status-transition-proposed',
        payload: { proposalId: id, targetRef: request.targetRef, proposedState: request.proposedState },
        occurredAt: new Date().toISOString(),
        emittedBy: request.identity.authenticatedPrincipalId,
        idempotencyKey: `${request.idempotencyKey}:proposed`,
      });
    }

    // EPIC-030 decides. This Epic records what came back.
    const verdict = await this.adjudicator.adjudicate({
      proposalId: id,
      executionId: request.executionId,
      workspaceId: request.workspaceId,
      specificationId: request.targetRef,
      expectedCurrentStatus: request.expectedCurrentStatus,
      requestedStatus: request.proposedState,
      targetVersion: request.targetVersion,
      proposerId: request.identity.authenticatedPrincipalId,
      proposerType: snapshot.kind === 'human' ? 'human' : (snapshot.kind as 'agent' | 'service'),
      proposerIdentitySnapshotId: snapshot.snapshotId,
      originatingConnector: request.identity.connectorRegistrationId,
      evidenceRefs: [],
      reason: request.rationale,
      correlationId: request.correlationId,
      causationId: request.executionId,
      idempotencyKey: request.idempotencyKey,
      proposedAt: new Date().toISOString(),
    });

    const eventType = eventForVerdict(verdict);
    const appended = await this.events.append({
      workspaceId: request.workspaceId,
      executionId: request.executionId,
      type: eventType,
      payload: {
        proposalId: id,
        verdict: verdict.verdict,
        reason: verdict.reason,
        adjudicationRecordId: verdict.adjudicationRecordId ?? null,
        ...(verdict.verdict === 'refused'
          ? { refusalStage: verdict.refusalStage, refusalReasonCode: verdict.refusalReasonCode }
          : {}),
        ...(verdict.verdict === 'applied' ? { transitionId: verdict.appliedTransitionId } : {}),
        ...(verdict.verdict === 'reconciliation_required'
          ? { reconciliation: verdict.reconciliation }
          : {}),
      },
      occurredAt: new Date().toISOString(),
      emittedBy: 'platform',
      idempotencyKey: `${request.idempotencyKey}:verdict`,
    });

    await this.projections.projectProposal(
      request.workspaceId,
      id,
      stateForVerdict(verdict),
      appended.sequence,
    );

    return { proposalId: id, verdict, eventType };
  }

  /**
   * T1059 — a connector attempting to apply a transition directly.
   *
   * There is no code path that would let it: the contract exposes no
   * `applyTransition`, and EPIC-009 is unreachable from here. This exists so
   * the **refusal is recorded** rather than the attempt merely failing to
   * compile — an attempt is evidence about a connector's behaviour, and a
   * governed registry should keep it.
   */
  async refuseDirectApplication(input: {
    workspaceId: string;
    executionId: string;
    attemptedBy: string;
    targetRef: string;
  }): Promise<void> {
    await this.events.append({
      workspaceId: input.workspaceId,
      executionId: input.executionId,
      type: 'transition-refused',
      payload: {
        targetRef: input.targetRef,
        refusalStage: 'transition',
        refusalReasonCode: 'unauthorized_actor',
        reason:
          'A connector may not apply a lifecycle transition. It reports and proposes; ' +
          'EPIC-030 adjudicates and EPIC-009 applies.',
      },
      occurredAt: new Date().toISOString(),
      emittedBy: input.attemptedBy,
      idempotencyKey: `${input.executionId}:direct-apply-refused:${randomUUID()}`,
    });
  }
}
