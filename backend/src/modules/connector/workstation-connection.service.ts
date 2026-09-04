/**
 * `T1449` (EPIC-043, `FR-PIC-044`, `FR-PIC-046`, `FR-PIC-053`, `R-043-8`) —
 * `pmi.health`'s write and the screen's read.
 *
 * A health call confirms the credential opens the project (the guard already
 * did), answers the versions the platform speaks, and records the workstation
 * as connected — creating or touching one row per credential. The read joins
 * the credential's label and state, so a revoked credential's last connection
 * stays visible beside the fact of its revocation.
 */
import { randomUUID } from 'node:crypto';
import type { ConnectorCredentialStore } from './connector-credential.store.js';
import type { WorkstationConnectionStore } from './workstation-connection.store.js';
import type { ConnectorReadContext } from './project-context.service.js';

export interface HealthInput {
  readonly extensionVersion?: string | undefined;
  readonly toolkitVersion?: string | undefined;
  readonly serverVersion?: string | undefined;
}

export interface HealthView {
  readonly projectId: string;
  readonly contractVersion: string;
  readonly apiVersion: string;
  readonly serverVersion: string | null;
  readonly connectedAt: string;
}

export interface WorkstationConnectionView {
  readonly credentialId: string;
  readonly label: string;
  readonly credentialState: 'active' | 'revoked';
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly extensionVersion: string | null;
  readonly toolkitVersion: string | null;
  readonly contractVersion: string;
  readonly serverVersion: string | null;
}

export interface WorkstationConnectionDeps {
  readonly store: WorkstationConnectionStore;
  readonly credentials: Pick<ConnectorCredentialStore, 'find'>;
  readonly contractVersion: string;
  readonly apiVersion: string;
  readonly audit: { record(row: Record<string, unknown>): Promise<void> };
  readonly now?: () => Date;
  readonly newId?: () => string;
}

export class WorkstationConnectionService {
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(private readonly deps: WorkstationConnectionDeps) {
    this.now = deps.now ?? ((): Date => new Date());
    this.newId = deps.newId ?? ((): string => randomUUID());
  }

  async touch(ctx: ConnectorReadContext, input: HealthInput): Promise<HealthView> {
    const at = this.now();
    const row = await this.deps.store.touch({
      id: this.newId(),
      workspaceId: ctx.workspaceId,
      projectId: ctx.projectId,
      credentialId: ctx.credentialId,
      at,
      extensionVersion: input.extensionVersion,
      toolkitVersion: input.toolkitVersion,
      serverVersion: input.serverVersion,
      contractVersion: this.deps.contractVersion,
    });
    await this.deps.audit.record({
      workspaceId: ctx.workspaceId,
      actorId: ctx.principalId,
      action: 'update',
      targetType: 'project',
      targetId: ctx.projectId,
      outcome: 'success',
      detail: {
        kind: 'connector',
        operation: 'connector.health',
        projectId: ctx.projectId,
        credentialId: ctx.credentialId,
        ...(input.extensionVersion !== undefined ? { extensionVersion: input.extensionVersion } : {}),
        ...(input.toolkitVersion !== undefined ? { toolkitVersion: input.toolkitVersion } : {}),
        ...(input.serverVersion !== undefined ? { serverVersion: input.serverVersion } : {}),
      },
    });
    return {
      projectId: ctx.projectId,
      contractVersion: this.deps.contractVersion,
      apiVersion: this.deps.apiVersion,
      serverVersion: row.serverVersion,
      connectedAt: at.toISOString(),
    };
  }

  async listForProject(workspaceId: string, projectId: string): Promise<WorkstationConnectionView[]> {
    const rows = await this.deps.store.listForProject(workspaceId, projectId);
    const views: WorkstationConnectionView[] = [];
    for (const row of rows) {
      const credential = await this.deps.credentials.find(workspaceId, row.credentialId);
      views.push({
        credentialId: row.credentialId,
        label: credential?.label ?? '(unknown credential)',
        credentialState: credential?.revokedAt ? 'revoked' : 'active',
        firstSeenAt: row.firstSeenAt.toISOString(),
        lastSeenAt: row.lastSeenAt.toISOString(),
        extensionVersion: row.extensionVersion,
        toolkitVersion: row.toolkitVersion,
        contractVersion: row.contractVersion,
        serverVersion: row.serverVersion,
      });
    }
    return views;
  }
}
