/**
 * T395 + T821 — provider switching, disconnection, and external change
 * (FR-PUB-037, FR-PUB-038, SC-010, SC-012).
 *
 * Switching loses NO platform artifact and NO publish history: the old
 * connection is disconnected (token discarded, references marked no longer
 * tracked — never deleted), publish records stay where they are, and the
 * files already at the old provider are left untouched, because nothing in
 * the storage contract can delete them (S4).
 *
 * External change is one-way too: deletion or alteration of a published
 * file AT THE PROVIDER merely marks the reference stale. The platform never
 * reads back from the provider (SC-012).
 */
import type { ConnectionService, ConnectInput, ConnectionView } from './connection.service.js';
import type { PublishStore, PublishedReferenceRow } from './publish.service.js';

export interface SwitchResult {
  disconnected: ConnectionView;
  connected: ConnectionView;
}

export class ProviderSwitchService {
  constructor(
    private readonly connections: ConnectionService,
    private readonly store: PublishStore,
  ) {}

  /** FR-PUB-038 / SC-010 — disconnect old, connect new, delete nothing. */
  async switch(workspaceId: string, to: ConnectInput, at?: Date): Promise<SwitchResult> {
    const active = await this.connections.activeConnection(workspaceId);
    if (!active) {
      const connected = await this.connections.connect(workspaceId, to, at);
      return { disconnected: connected, connected };
    }
    const disconnected = await this.connections.disconnect(workspaceId, active.id, at);
    const connected = await this.connections.connect(workspaceId, to, at);
    return { disconnected, connected };
  }

  /**
   * T821 — SC-012: the provider-side file changed or vanished. The platform
   * artifact is untouched; the reference goes stale, and that is ALL.
   */
  async recordExternalChange(workspaceId: string, referenceId: string): Promise<PublishedReferenceRow> {
    return this.store.markReferenceStale(workspaceId, referenceId);
  }
}
