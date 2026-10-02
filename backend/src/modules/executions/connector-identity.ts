/**
 * `T1413` (EPIC-043, `R-043-3`, data-model.md §5) — `ExecutionIdentityRefs`
 * from what the guard put on the request and from server-side facts only.
 *
 * `DEF-037-001` recorded the mistake this file exists to prevent: every field of
 * `ExecutionIdentityRefs` used to arrive as JSON, and resolving a reference
 * authoritatively *felt* like authentication and was not. Here nothing is read
 * from a body — the signature admits none — and the registry then resolves the
 * snapshot and the delegation exactly as before, fed honestly.
 */
import { RegistryRefusedError, type ExecutionIdentityRefs } from '@pmi/execution-registry-contract';
import type { ConnectorRequestContext } from '../connector/connector-auth.guard.js';

export interface ConnectorIdentityLookups {
  /** The snapshot the credential carries, or null for a credential minted before EPIC-043. */
  snapshotOf(workspaceId: string, credentialId: string): Promise<string | null>;
  /** Completes the identity lazily (`ConnectorCredentialService.completeIdentity`). */
  completeIdentity(workspaceId: string, credentialId: string): Promise<{ snapshotId: string | null }>;
  /** The `execution.register` delegation on the credential's project. */
  delegationFor(workspaceId: string, principalId: string, projectId: string): Promise<{ id: string; identityVersion: number }>;
}

export async function identityFromConnector(
  ctx: ConnectorRequestContext,
  lookups: ConnectorIdentityLookups,
): Promise<ExecutionIdentityRefs> {
  const { principal } = ctx;
  if (principal.sponsorUserId === null || principal.connectorRegistrationId === null) {
    throw new RegistryRefusedError(
      'identity_not_resolvable',
      'The connector principal carries no sponsor or no registration; a connector always has both.',
    );
  }

  let snapshotId = await lookups.snapshotOf(ctx.workspaceId, ctx.credentialId);
  if (snapshotId === null) {
    ({ snapshotId } = await lookups.completeIdentity(ctx.workspaceId, ctx.credentialId));
  }
  if (snapshotId === null) {
    throw new RegistryRefusedError('identity_not_resolvable', 'The credential has no identity snapshot and none could be captured.');
  }

  const delegation = await lookups.delegationFor(ctx.workspaceId, principal.principalId, ctx.projectId);
  return {
    authenticatedPrincipalId: principal.principalId,
    agentSnapshotId: snapshotId,
    connectorRegistrationId: principal.connectorRegistrationId,
    sponsorUserId: principal.sponsorUserId,
    delegationId: delegation.id,
    delegationIdentityVersion: delegation.identityVersion,
  };
}
