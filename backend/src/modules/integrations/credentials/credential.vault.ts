/**
 * `T2175` (EPIC-039, `FR-HUB-042`, `FR-HUB-044`, `ADR-0012`) — the only reader
 * of `ciphertext`.
 *
 * Inside the platform a credential travels as a reference — the
 * `integration_credentials.id` and a `CredentialHandle` — never a value. The
 * vault opens a row only for the project and adapter the resolver resolved,
 * and only inside `withCredential(scope, fn)`: the handle it yields releases the
 * plaintext through `use(fn)` for one provider call. No other file names the
 * column (`integrations-credentials-boundary.spec.ts`).
 */
import { createCredentialHandle, type CredentialHandle } from '@pmi/capability-contract';
import type { CredentialStatusRecord, CredentialVaultPort } from '../integrations.store.js';
import { CredentialCipher, type CredentialScope } from './credential.cipher.js';

export interface VaultScope {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly registryEntryId: string;
}

export class CredentialVault {
  constructor(
    private readonly port: CredentialVaultPort,
    private readonly cipher: CredentialCipher,
  ) {}

  /** Encrypt and store; returns the status view, never the value. */
  async store(scope: VaultScope, kind: string, plaintext: string, setBy: string, setAt: Date): Promise<CredentialStatusRecord> {
    const sealed = this.cipher.seal(plaintext, { ...scope, kind });
    return this.port.putCredentialRow({ ...scope, kind, ...sealed, setBy, setAt });
  }

  async remove(scope: VaultScope): Promise<boolean> {
    return this.port.deleteCredentialRow(scope.workspaceId, scope.projectId, scope.registryEntryId);
  }

  /**
   * Yield a handle for exactly this project and adapter, or `null` when none is
   * set. A row that fails to decrypt (another project's AAD, a retired key) is
   * treated as absent, never as present.
   */
  async withCredential<T>(scope: VaultScope, fn: (handle: CredentialHandle | null) => Promise<T>): Promise<T> {
    const row = await this.port.readCredentialRow(scope.workspaceId, scope.projectId, scope.registryEntryId);
    if (row === null || row.projectId !== scope.projectId || row.registryEntryId !== scope.registryEntryId) return fn(null);
    let plaintext: string;
    try {
      const aad: CredentialScope = { workspaceId: scope.workspaceId, projectId: scope.projectId, registryEntryId: scope.registryEntryId, kind: row.kind };
      plaintext = this.cipher.open(row, aad);
    } catch {
      return fn(null);
    }
    return fn(createCredentialHandle(plaintext, row.kind));
  }
}
