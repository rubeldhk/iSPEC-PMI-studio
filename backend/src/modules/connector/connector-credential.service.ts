/**
 * `T1358` (EPIC-041) — minting, listing and revoking connector credentials
 * (`FR-LPW-020`–`FR-LPW-023`, `FR-LPW-027`).
 *
 * A credential owns a `Principal` of kind `connector`, registered through
 * `EPIC-028`'s registry with the minting owner as sponsor (`R-041-3`), so the
 * guard can produce a `TrustedPrincipalContext` for it the way a session does
 * for a human. The value is returned exactly once and never stored
 * (`FR-LPW-021`); every attempt — minted, refused, revoked — is audited.
 *
 * **The owner grant** (`FR-LPW-027`, EPIC-024): the project's owner, or a
 * holder of an active `edit` grant on the project artifact. Read through a
 * narrow port; this module never mutates a grant
 * (`tests/architecture/connector-boundary.spec.ts`).
 *
 * PC-1: framework-free. Nest wires it in `connector.module.ts`.
 */
import { randomUUID } from 'node:crypto';
import { ForbiddenError, NotFoundError, ValidationFailedError } from '../../core/errors.js';
import type { AuditService } from '../audit/audit.service.js';
import type { ProjectRecord, ProjectsService } from '../projects/projects.service.js';
import type { ConnectorCredentialRecord, ConnectorCredentialStore, CredentialListFilter } from './connector-credential.store.js';
import { mintToken } from './credential-token.js';

export interface ActingContext {
  readonly workspaceId: string;
  readonly userId: string;
}

/** `PrincipalRegistryService.register`, by shape. */
export interface CredentialPrincipalPort {
  register(input: {
    workspaceId: string;
    kind: 'connector';
    descriptorRef: string;
    sponsorUserId: string;
    registeredByUserId: string;
    correlationId: string;
    causationId: string;
  }): Promise<{ principalId: string }>;
}

/** The read side of EPIC-024's grants — enough to answer "does this user hold the owner grant". */
export interface OwnerGrantPort {
  activeForArtifact(
    workspaceId: string,
    artifact: { artifactType: string; artifactId: string },
  ): Promise<ReadonlyArray<{ userId: string; level: string }>>;
}

/** What leaves the service: the record without its digest (`FR-LPW-053`). */
export type PublicCredential = Omit<ConnectorCredentialRecord, 'tokenHash'>;

export interface MintedCredential {
  readonly record: PublicCredential;
  /** Shown once. The caller returns it and forgets it. */
  readonly value: string;
}

/**
 * EPIC-043 T1411 (`R-043-3`) — what completes the registry's identity for a
 * credential: a snapshot of its principal, a connector registration per
 * workspace per surface kind, and the delegable actions on the project.
 * `EPIC-028`'s services, by shape.
 */
export interface ConnectorIdentityPort {
  captureSnapshot(workspaceId: string, principalId: string): Promise<{ snapshotId: string; identityVersion: number }>;
  ensureRegistration(workspaceId: string, kind: 'mcp-client' | 'local-cli', registeredByUserId: string): Promise<{ registrationId: string }>;
  attachRegistration(input: { workspaceId: string; principalId: string; registrationId: string }): Promise<void>;
  delegate(input: {
    workspaceId: string;
    principalId: string;
    sponsorUserId: string;
    artifact: { artifactType: 'project'; artifactId: string };
    actions: readonly string[];
    identityVersion: number;
    correlationId: string;
  }): Promise<{ id: string }>;
  revokeDelegations(input: {
    workspaceId: string;
    principalId: string;
    artifact: { artifactType: 'project'; artifactId: string };
    revokedById: string;
  }): Promise<number>;
}

/** The four actions a connector may be delegated (`PrincipalDelegationService.DELEGABLE_ACTIONS`); never approval or application. */
export const CONNECTOR_DELEGATED_ACTIONS = Object.freeze([
  'execution.register',
  'execution.report',
  'execution.attach-evidence',
  'transition.propose',
] as const);

export interface ConnectorCredentialServiceDeps {
  readonly credentials: ConnectorCredentialStore;
  readonly projects: Pick<ProjectsService, 'get'>;
  readonly principals: CredentialPrincipalPort;
  readonly grants: OwnerGrantPort | null;
  readonly audit: AuditService;
  /** Absent only in EPIC-041's own unit tests; the composition root always supplies it. */
  readonly identity?: ConnectorIdentityPort;
  readonly now?: () => Date;
  readonly random?: () => Buffer;
  readonly newId?: () => string;
}

const LABEL_MAX = 120;

export function publicView(record: ConnectorCredentialRecord): PublicCredential {
  const { tokenHash: _digest, ...safe } = record;
  return safe;
}

export class ConnectorCredentialService {
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(private readonly deps: ConnectorCredentialServiceDeps) {
    this.now = deps.now ?? ((): Date => new Date());
    this.newId = deps.newId ?? ((): string => randomUUID());
  }

  /** `POST /projects/:id/connector-credentials` — and the mint at provisioning (`FR-LPW-020`). */
  async mint(ctx: ActingContext, projectId: string, input: { label: string }): Promise<MintedCredential> {
    const project = await this.deps.projects.get(ctx.workspaceId, projectId);
    await this.requireOwnerGrant(ctx, project, { kind: 'mint', targetType: 'project', targetId: project.id });

    const label = (input.label ?? '').trim();
    if (label === '' || label.length > LABEL_MAX) {
      throw new ValidationFailedError('A credential needs a label.', { fields: { label: `1–${LABEL_MAX} characters` } });
    }
    if (project.provisioningState === 'not_provisioned') {
      throw new ValidationFailedError('The project has no directory yet; a credential for it would authorise nothing.', {
        fields: { projectId: 'not provisioned' },
      });
    }

    const id = this.newId();
    const minted = mintToken(this.deps.random);
    const correlationId = randomUUID();
    const principal = await this.deps.principals.register({
      workspaceId: ctx.workspaceId,
      kind: 'connector',
      descriptorRef: `connector-credential:${id}`,
      sponsorUserId: ctx.userId,
      registeredByUserId: ctx.userId,
      correlationId,
      causationId: correlationId,
    });
    const record = await this.deps.credentials.create({
      id,
      workspaceId: ctx.workspaceId,
      projectId: project.id,
      principalId: principal.principalId,
      tokenPrefix: minted.tokenPrefix,
      tokenHash: minted.tokenHash,
      label,
      createdById: ctx.userId,
      createdAt: this.now(),
      lastUsedAt: null,
      revokedAt: null,
      revokedById: null,
      snapshotId: null,
    });
    // EPIC-043 T1411 — the identity the registry will resolve, completed now.
    const completed = await this.establishIdentity(record, correlationId);
    await this.deps.audit.record({
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: 'create',
      targetType: 'connector_credential',
      targetId: id,
      outcome: 'success',
      detail: { projectId: project.id, label, tokenPrefix: minted.tokenPrefix, principalId: principal.principalId },
    });
    return { record: publicView(completed), value: minted.value };
  }

  /**
   * EPIC-043 T1411 (`R-043-3`) — complete a credential's identity: snapshot,
   * registrations, delegations. Idempotent by construction — a credential that
   * already carries a snapshot is returned as is — so a credential minted before
   * this Epic is completed on its first guarded call and never again.
   */
  async completeIdentity(workspaceId: string, credentialId: string): Promise<{ snapshotId: string | null }> {
    const existing = await this.deps.credentials.find(workspaceId, credentialId);
    if (existing === null) throw new NotFoundError('Not found.');
    if (existing.snapshotId) return { snapshotId: existing.snapshotId };
    const completed = await this.establishIdentity(existing, randomUUID());
    return { snapshotId: completed.snapshotId ?? null };
  }

  private async establishIdentity(record: ConnectorCredentialRecord, correlationId: string): Promise<ConnectorCredentialRecord> {
    const identity = this.deps.identity;
    if (identity === undefined) return record;
    const { registrationId } = await identity.ensureRegistration(record.workspaceId, 'mcp-client', record.createdById);
    await identity.ensureRegistration(record.workspaceId, 'local-cli', record.createdById);
    await identity.attachRegistration({ workspaceId: record.workspaceId, principalId: record.principalId, registrationId });
    const snapshot = await identity.captureSnapshot(record.workspaceId, record.principalId);
    await identity.delegate({
      workspaceId: record.workspaceId,
      principalId: record.principalId,
      sponsorUserId: record.createdById,
      artifact: { artifactType: 'project', artifactId: record.projectId },
      actions: CONNECTOR_DELEGATED_ACTIONS,
      identityVersion: snapshot.identityVersion,
      correlationId,
    });
    return this.deps.credentials.setSnapshot(record.id, snapshot.snapshotId);
  }

  /** `GET /projects/:id/connector-credentials` — never the digest (`FR-LPW-053`). */
  async list(workspaceId: string, projectId: string, filter: CredentialListFilter = {}): Promise<PublicCredential[]> {
    const rows = await this.deps.credentials.listForProject(workspaceId, projectId, filter);
    return rows.map(publicView);
  }

  /** `POST /connector-credentials/:id/revoke` — immediate, audited once, idempotent (`FR-LPW-023`). */
  async revoke(ctx: ActingContext, credentialId: string): Promise<{ record: PublicCredential; changed: boolean }> {
    const existing = await this.deps.credentials.find(ctx.workspaceId, credentialId);
    if (existing === null) throw new NotFoundError('Not found.');
    const project = await this.deps.projects.get(ctx.workspaceId, existing.projectId);
    await this.requireOwnerGrant(ctx, project, { kind: 'revoke', targetType: 'connector_credential', targetId: credentialId });

    if (existing.revokedAt !== null) return { record: publicView(existing), changed: false };

    const revoked = await this.deps.credentials.revoke(ctx.workspaceId, credentialId, ctx.userId, this.now());
    // EPIC-043 T1411 — a revoked credential fails the registry's own delegation
    // check too, should anything ever bypass the guard.
    await this.deps.identity?.revokeDelegations({
      workspaceId: ctx.workspaceId,
      principalId: existing.principalId,
      artifact: { artifactType: 'project', artifactId: existing.projectId },
      revokedById: ctx.userId,
    });
    await this.deps.audit.record({
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: 'update',
      targetType: 'connector_credential',
      targetId: credentialId,
      outcome: 'success',
      detail: { kind: 'revoke', projectId: existing.projectId },
    });
    return { record: publicView(revoked), changed: true };
  }

  private async holdsOwnerGrant(ctx: ActingContext, project: ProjectRecord): Promise<boolean> {
    if (project.ownerUserId === ctx.userId) return true;
    if (this.deps.grants === null) return false;
    const active = await this.deps.grants.activeForArtifact(ctx.workspaceId, { artifactType: 'project', artifactId: project.id });
    return active.some((g) => g.userId === ctx.userId && g.level === 'edit');
  }

  private async requireOwnerGrant(
    ctx: ActingContext,
    project: ProjectRecord,
    refusal: { kind: 'mint' | 'revoke'; targetType: string; targetId: string },
  ): Promise<void> {
    if (await this.holdsOwnerGrant(ctx, project)) return;
    await this.deps.audit.record({
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: 'access_refused',
      targetType: refusal.targetType,
      targetId: refusal.targetId,
      outcome: 'refused',
      detail: { kind: refusal.kind, projectId: project.id, reason: 'owner_grant_missing' },
    });
    throw new ForbiddenError(`Only the project's owner may ${refusal.kind} a connector credential.`);
  }
}
