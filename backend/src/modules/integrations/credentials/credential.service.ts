/**
 * `T2178` (EPIC-039, `FR-HUB-040`–`FR-HUB-047`) — per-project adapter
 * credentials: set by the owner, held encrypted, read back as status only.
 *
 * - **Owner grant** (`FR-HUB-041`): `OwnerGate.requireOwner`, `EPIC-042`'s
 *   reusable form of the `FR-LPW-027` rule — it audits `access_refused` before
 *   refusing. Not a third copy of the rule.
 * - **Write-only** (`FR-HUB-043`): `status()` returns state, kind, who and when.
 *   The value is never echoed — not in a response, an error, or an audit row,
 *   whose `detail` holds `{ before: { state, kind }, after: { state, kind } }`.
 * - **Never in clear**: with no keyring the write answers `503` naming
 *   `CredentialKeyring` and nothing is stored.
 * - **Seen within one check** (`SC-HUB-008`): setting a credential runs the
 *   pair's health check at once.
 */
import { ValidationFailedError } from '../../../core/errors.js';
import type { AdapterCatalog } from '../catalog.service.js';
import type { OwnerGatePort } from '../configuration.service.js';
import type { HealthService } from '../health/health.service.js';
import type { AuditPort, Clock } from '../integrations.tokens.js';
import type { IntegrationsStore } from '../integrations.store.js';
import type { CredentialVault } from './credential.vault.js';

export const MAX_CREDENTIAL_LENGTH = 16_384;

export interface CredentialStatusView {
  readonly entryId: string;
  readonly state: 'configured' | 'not-configured';
  readonly kind?: string;
  readonly setBy?: string;
  readonly setAt?: string;
}

export interface CredentialDeps {
  readonly store: IntegrationsStore;
  readonly catalog: AdapterCatalog;
  readonly vault: CredentialVault;
  readonly health: HealthService;
  readonly ownerGate: OwnerGatePort;
  readonly audit: AuditPort;
  readonly clock: Clock;
}

function refuse(message: string, field: string, reason: string): ValidationFailedError {
  return new ValidationFailedError(message, { fields: [{ field, reason }] });
}

export class CredentialService {
  constructor(private readonly deps: CredentialDeps) {}

  private async outbound(workspaceId: string, entryId: string) {
    const entry = await this.deps.store.findEntry(workspaceId, entryId);
    if (entry === null) throw refuse('No such registry entry in this workspace.', 'entryId', 'not listed');
    if (entry.direction !== 'outbound') throw refuse(`${entry.key} is an inbound connector; its credentials are the connector's own (EPIC-041), not set here.`, 'entryId', 'inbound');
    const descriptor = this.deps.catalog.descriptor(entry.key);
    if (descriptor === null) throw refuse(`${entry.key} is not present in this build.`, 'entryId', 'not in build');
    return { entry, descriptor };
  }

  async set(ctx: { workspaceId: string; userId: string }, projectId: string, entryId: string, body: { kind?: unknown; value?: unknown }): Promise<void> {
    await this.deps.ownerGate.requireOwner(ctx, projectId, 'set an integration credential');
    const { entry, descriptor } = await this.outbound(ctx.workspaceId, entryId);
    const kinds = descriptor.credentialKinds.map((k) => k.kind);
    if (typeof body.kind !== 'string' || !kinds.includes(body.kind)) {
      throw refuse(`${entry.key} accepts a credential of kind ${kinds.join(' or ') || '(none)'}.`, 'kind', 'not a kind the adapter declares');
    }
    if (typeof body.value !== 'string' || body.value.length === 0 || body.value.length > MAX_CREDENTIAL_LENGTH) {
      throw refuse(`A credential value is a non-empty string of at most ${MAX_CREDENTIAL_LENGTH} characters.`, 'value', 'required');
    }
    const before = await this.deps.store.credentialStatus(ctx.workspaceId, projectId, entryId);
    // Sealed with the active platform key; an unbound keyring throws 503 here, before anything is stored.
    const saved = await this.deps.vault.store({ workspaceId: ctx.workspaceId, projectId, registryEntryId: entryId }, body.kind, body.value, ctx.userId, this.deps.clock());
    await this.deps.audit.record({
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: 'update',
      targetType: 'integration-credential',
      targetId: saved.id,
      outcome: 'success',
      detail: {
        projectId,
        entryKey: entry.key,
        before: before === null ? { state: 'not-configured' } : { state: 'configured', kind: before.kind },
        after: { state: 'configured', kind: body.kind },
      },
    });
    // SC-HUB-008 — the owner sees the result within one check.
    await this.deps.health.checkNow(ctx.workspaceId, projectId, entry).catch(() => undefined);
  }

  async remove(ctx: { workspaceId: string; userId: string }, projectId: string, entryId: string): Promise<void> {
    await this.deps.ownerGate.requireOwner(ctx, projectId, 'remove an integration credential');
    const { entry } = await this.outbound(ctx.workspaceId, entryId);
    const before = await this.deps.store.credentialStatus(ctx.workspaceId, projectId, entryId);
    if (before === null) return; // idempotent
    await this.deps.vault.remove({ workspaceId: ctx.workspaceId, projectId, registryEntryId: entryId });
    await this.deps.audit.record({
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: 'update',
      targetType: 'integration-credential',
      targetId: before.id,
      outcome: 'success',
      detail: { projectId, entryKey: entry.key, before: { state: 'configured', kind: before.kind }, after: { state: 'not-configured' } },
    });
  }

  /** Status of every outbound adapter listed in the workspace, for this project. Never a value. */
  async status(workspaceId: string, projectId: string): Promise<CredentialStatusView[]> {
    const entries = (await this.deps.store.listEntries(workspaceId)).filter((e) => e.direction === 'outbound');
    const set = await this.deps.store.listCredentialStatus(workspaceId, projectId);
    return entries.map((e) => {
      const s = set.find((c) => c.registryEntryId === e.id);
      return s === undefined ? { entryId: e.id, state: 'not-configured' as const } : { entryId: e.id, state: 'configured' as const, kind: s.kind, setBy: s.setBy, setAt: s.setAt.toISOString() };
    });
  }
}
