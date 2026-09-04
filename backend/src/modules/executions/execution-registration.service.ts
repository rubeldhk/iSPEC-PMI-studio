/**
 * T1032, T1033, T1035, T1036, T1041 (EPIC-037 Band A) — registration and
 * completion.
 *
 * ## Phase-aware binding is the load-bearing idea
 *
 * At **registration** the execution must say what it is running *against*:
 * target, version, repository, branch, `commitBefore`. It must **not** be asked
 * for `commitAfter` — `AC-EXR-17b` records that requiring an output commit
 * before the work has run is itself a defect, not caution.
 *
 * At **successful completion** it must say what it *produced*. A failed,
 * cancelled or timed-out execution legitimately has none (`AC-EXR-17d`): there
 * is no resulting version because nothing resulted, and demanding one would
 * force connectors to invent it.
 *
 * ## Identity is referenced, never asserted
 *
 * Every call carries snapshot references minted server-side by EPIC-028. This
 * service resolves them and refuses if they do not belong to this workspace or
 * principal — a connector that could submit an arbitrary snapshot could claim
 * to be anyone who ever acted.
 *
 * The delegation is checked here too, not only at the boundary. A sponsoring
 * human's ownership does not reach the agents they sponsor (`C3B`), so an
 * execution against a specification needs `execution.register` explicitly.
 */
import { randomUUID } from 'node:crypto';
import {
  RegistryRefusedError,
  assuranceFor,
  type CompleteExecutionRequest,
  type ExecutionIdentityRefs,
  type ExecutionSnapshot,
  type RegisterExecutionRequest,
} from '@pmi/execution-registry-contract';
import { sanitiseArgs, CredentialDetectedError } from './sanitisation.js';
import type { ExecutionEventService } from './execution-event.service.js';

/** What the registry needs from EPIC-028, narrowed. */
export interface IdentityResolverPort {
  resolveSnapshot(snapshotId: string): Promise<{
    snapshotId: string;
    principalId: string;
    workspaceId: string;
    kind: string;
    sponsorUserId: string | null;
    identityVersion: number;
    connectorRegistrationId: string | null;
  } | null>;
  findConnector(
    workspaceId: string,
    connectorId: string,
  ): Promise<{ connectorId: string; state: string } | null>;
}

/** What the registry needs from EPIC-024, narrowed. */
export interface DelegationPort {
  requireDelegated(input: {
    workspaceId: string;
    principalId: string;
    artifact: { artifactType: string; artifactId: string };
    action: string;
  }): Promise<{ id: string; identityVersion: number }>;
}

export interface RegistrationDb {
  $transaction<T>(fn: (tx: RegistrationTx) => Promise<T>): Promise<T>;
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

export interface RegistrationTx {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

const SUPPORTED_CONTRACT_VERSIONS = Object.freeze(['1.0']);

export class ExecutionRegistrationService {
  constructor(
    private readonly db: RegistrationDb,
    private readonly events: ExecutionEventService,
    private readonly identity: IdentityResolverPort,
    private readonly delegations: DelegationPort,
  ) {}

  /**
   * Resolve every identity reference authoritatively.
   *
   * Returns the resolved agent snapshot so callers use what the registry
   * confirmed rather than what the request claimed.
   */
  private async resolveIdentity(
    workspaceId: string,
    refs: ExecutionIdentityRefs,
  ): Promise<{ agentSnapshot: NonNullable<Awaited<ReturnType<IdentityResolverPort['resolveSnapshot']>>> }> {
    const agentSnapshot = await this.identity.resolveSnapshot(refs.agentSnapshotId);
    if (agentSnapshot === null) {
      throw new RegistryRefusedError('identity_not_resolvable', 'Unknown agent identity snapshot.');
    }
    // A snapshot from another tenant is the substitution attack this check
    // exists for: it is a real, resolvable snapshot, just not one of ours.
    if (agentSnapshot.workspaceId !== workspaceId) {
      throw new RegistryRefusedError(
        'identity_not_resolvable',
        'That identity snapshot belongs to a different workspace.',
      );
    }
    if (agentSnapshot.principalId !== refs.authenticatedPrincipalId) {
      throw new RegistryRefusedError(
        'identity_not_resolvable',
        'The submitted snapshot describes a different principal than the authenticated one.',
      );
    }
    if (agentSnapshot.sponsorUserId !== refs.sponsorUserId) {
      throw new RegistryRefusedError(
        'identity_not_resolvable',
        'The submitted sponsor does not match the sponsor frozen into that snapshot.',
      );
    }

    const connector = await this.identity.findConnector(workspaceId, refs.connectorRegistrationId);
    if (connector === null || connector.state !== 'active') {
      throw new RegistryRefusedError(
        'identity_not_resolvable',
        'The originating connector is not an active registration in this workspace.',
      );
    }
    return { agentSnapshot };
  }

  async register(request: RegisterExecutionRequest): Promise<ExecutionSnapshot> {
    // FR-LPW-034 — assurance is derived from the surface by this registry and
    // never accepted from the caller. Refused by name, before anything else.
    if ('assurance' in (request as unknown as Record<string, unknown>)) {
      throw new RegistryRefusedError(
        'assurance_not_accepted',
        'The field "assurance" is derived by the registry from the surface and cannot be supplied.',
      );
    }
    if (!SUPPORTED_CONTRACT_VERSIONS.includes(request.contractVersion)) {
      throw new RegistryRefusedError(
        'unsupported_contract_version',
        `Contract version "${request.contractVersion}" is not supported.`,
      );
    }
    if (request.input.targetId === undefined || request.input.targetId === '') {
      throw new RegistryRefusedError(
        'input_binding_incomplete',
        'Registration requires the input identity this execution runs against.',
      );
    }
    // `AC-EXR-17b`. Asking for an output commit before the work has run is
    // itself the defect, so a request carrying one is refused rather than
    // quietly accepted.
    if ('commitAfter' in (request.input as unknown as Record<string, unknown>)) {
      throw new RegistryRefusedError(
        'output_binding_not_permitted',
        'commitAfter cannot be known at registration. Output identity binds at completion.',
      );
    }

    let argsSanitized: Record<string, unknown>;
    try {
      argsSanitized = sanitiseArgs(request.argsSanitized);
    } catch (error) {
      if (error instanceof CredentialDetectedError) {
        throw new RegistryRefusedError('credential_detected', error.message);
      }
      throw error;
    }

    const { agentSnapshot } = await this.resolveIdentity(request.workspaceId, request.identity);

    // EPIC-024. The sponsor's ownership does not reach this agent.
    const delegation = await this.delegations
      .requireDelegated({
        workspaceId: request.workspaceId,
        principalId: request.identity.authenticatedPrincipalId,
        artifact: { artifactType: request.input.targetType, artifactId: request.input.targetId },
        action: 'execution.register',
      })
      .catch((error: unknown) => {
        throw new RegistryRefusedError(
          'delegation_missing',
          error instanceof Error ? error.message : 'No delegation authorises registration.',
        );
      });

    const executionId = request.executionId ?? randomUUID();

    await this.db.$transaction(async (tx) => {
      // Replay: the unique index is the oracle, and a repeat returns the
      // original rather than a second execution.
      const existing = await tx.$queryRawUnsafe<{ id: string }[]>(
        `SELECT "id" FROM "executions" WHERE "workspaceId" = $1 AND "idempotencyKey" = $2`,
        request.workspaceId,
        request.idempotencyKey,
      );
      if (existing.length > 0) return;

      await tx.$executeRawUnsafe(
        `INSERT INTO "executions"
           ("id","correlationId","causationId","idempotencyKey","workspaceId","projectId","command",
            "argsSanitized","initiatorType","initiatorId","surface","environment",
            "governanceState","parentExecutionId","contractVersion","assurance")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,'governed',$13,$14,$15)`,
        executionId,
        request.correlationId,
        request.causationId ?? null,
        request.idempotencyKey,
        request.workspaceId,
        request.projectId ?? null,
        request.command,
        JSON.stringify(argsSanitized),
        agentSnapshot.kind,
        agentSnapshot.principalId,
        request.surface,
        request.environment ?? null,
        request.parentExecutionId ?? null,
        request.contractVersion,
        // T1366 (EPIC-041, FR-LPW-034): derived from the surface by the one
        // writer, never accepted from the request. NOT NULL by migration.
        assuranceFor(request.surface),
      );

      // The frozen agent identity. `descriptorRef` is a live reference; the
      // columns beside it are what history reads, so renaming a descriptor
      // later cannot rewrite the past (`AC-EXR-14`).
      await tx.$executeRawUnsafe(
        `INSERT INTO "agent_identity_snapshots"
           ("id","workspaceId","executionId","descriptorRef","principalSnapshotId",
            "provider","model","adapter","agentVersion","capabilities")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        randomUUID(),
        request.workspaceId,
        executionId,
        agentSnapshot.principalId,
        agentSnapshot.snapshotId,
        'frozen',
        'frozen',
        request.surface,
        String(agentSnapshot.identityVersion),
        [],
      );

      await tx.$executeRawUnsafe(
        `INSERT INTO "execution_target_bindings"
           ("id","workspaceId","executionId","phase","targetType","targetId","targetVersion",
            "baselineId","repositoryId","branch","worktree","commitSha","artifactDigest")
         VALUES ($1,$2,$3,'input',$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        randomUUID(),
        request.workspaceId,
        executionId,
        request.input.targetType,
        request.input.targetId,
        request.input.targetVersion ?? null,
        request.input.baselineId ?? null,
        request.input.repositoryId ?? null,
        request.input.branch ?? null,
        request.input.worktree ?? null,
        request.input.commitBefore ?? null,
        (request.input.inputArtifactDigests ?? []).join(',') || null,
      );

      await tx.$executeRawUnsafe(
        `INSERT INTO "execution_state"
           ("executionId","workspaceId","lifecycleState","governanceState","projectedThroughSequence")
         VALUES ($1,$2,'registered','governed',0)`,
        executionId,
        request.workspaceId,
      );
    });

    await this.events.append({
      workspaceId: request.workspaceId,
      executionId,
      type: 'registered',
      payload: {
        command: request.command,
        surface: request.surface,
        delegationId: delegation.id,
        delegationIdentityVersion: delegation.identityVersion,
      },
      occurredAt: new Date().toISOString(),
      emittedBy: request.identity.authenticatedPrincipalId,
      idempotencyKey: `${request.idempotencyKey}:registered`,
    });

    const snapshot = await this.snapshot(request.workspaceId, executionId);
    if (snapshot === null) {
      throw new RegistryRefusedError('identity_not_resolvable', 'Registration did not persist.');
    }
    return snapshot;
  }

  async complete(request: CompleteExecutionRequest): Promise<{ sequence: number }> {
    // `FR-EXR-013`. A completion with no comment is a run nobody explained.
    if (request.completionComment.trim() === '') {
      throw new RegistryRefusedError(
        'completion_comment_required',
        'A completion must carry a comment.',
      );
    }

    const succeeded = request.outcome === 'completed';
    if (succeeded && request.output === undefined) {
      throw new RegistryRefusedError(
        'output_binding_required',
        'A successful completion must bind the output identity it produced.',
      );
    }
    // A failure legitimately produced nothing. Accepting an output binding here
    // would let a failed run claim a resulting version (`AC-EXR-17d`).
    if (!succeeded && request.output !== undefined) {
      throw new RegistryRefusedError(
        'output_binding_not_permitted',
        `An execution that ${request.outcome} produced no output identity.`,
      );
    }

    await this.resolveIdentity(request.workspaceId, request.identity);

    if (succeeded && request.output !== undefined) {
      const output = request.output;
      await this.db.$transaction(async (tx) => {
        const already = await tx.$queryRawUnsafe<{ id: string }[]>(
          `SELECT "id" FROM "execution_target_bindings"
            WHERE "executionId" = $1 AND "phase" = 'output'`,
          request.executionId,
        );
        if (already.length > 0) return;
        await tx.$executeRawUnsafe(
          `INSERT INTO "execution_target_bindings"
             ("id","workspaceId","executionId","phase","targetType","targetId","targetVersion",
              "baselineId","commitSha","artifactDigest")
           VALUES ($1,$2,$3,'output','specification',$4,$5,$6,$7,$8)`,
          randomUUID(),
          request.workspaceId,
          request.executionId,
          request.executionId,
          output.resultingVersion ?? null,
          output.resultingBaselineId ?? null,
          output.commitAfter ?? null,
          (output.generatedArtifactDigests ?? []).join(',') || null,
        );
      });
    }

    const appended = await this.events.append({
      workspaceId: request.workspaceId,
      executionId: request.executionId,
      type: request.outcome,
      payload: { output: request.output ?? null, comment: request.completionComment },
      occurredAt: request.occurredAt,
      emittedBy: request.identity.authenticatedPrincipalId,
      idempotencyKey: request.idempotencyKey,
      ...(request.expectedSequence !== undefined
        ? { expectedSequence: request.expectedSequence }
        : {}),
    });
    return { sequence: appended.sequence };
  }

  async snapshot(workspaceId: string, executionId: string): Promise<ExecutionSnapshot | null> {
    const rows = await this.db.$queryRawUnsafe<
      {
        id: string;
        workspaceId: string;
        command: string;
        surface: string;
        assurance: string;
        governanceState: string;
        parentExecutionId: string | null;
        lifecycleState: string | null;
        projectedThroughSequence: number | null;
      }[]
    >(
      `SELECT e."id", e."workspaceId", e."command", e."surface", e."assurance", e."governanceState",
              e."parentExecutionId", s."lifecycleState", s."projectedThroughSequence"
         FROM "executions" e
         LEFT JOIN "execution_state" s ON s."executionId" = e."id"
        WHERE e."id" = $1 AND e."workspaceId" = $2`,
      executionId,
      workspaceId,
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      executionId: row.id,
      workspaceId: row.workspaceId,
      command: row.command as ExecutionSnapshot['command'],
      surface: row.surface as ExecutionSnapshot['surface'],
      assurance: row.assurance as ExecutionSnapshot['assurance'],
      lifecycleState: row.lifecycleState ?? 'registered',
      governanceState: row.governanceState as ExecutionSnapshot['governanceState'],
      projectedThroughSequence: row.projectedThroughSequence ?? 0,
      parentExecutionId: row.parentExecutionId,
    };
  }
}
