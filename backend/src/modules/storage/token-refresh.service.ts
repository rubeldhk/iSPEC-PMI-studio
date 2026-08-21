/**
 * T448 — token refresh and re-authorisation reporting (FR-PUB-029a,
 * FR-PUB-031).
 *
 * An expired access token is refreshed WITHOUT user interaction where the
 * provider permits it: the encrypted refresh token is decrypted here — and
 * only here — exchanged for a short-lived access token, and the access
 * token is handed to the adapter per call, never stored. A connection whose
 * refresh fails reports `needs_reauthorisation`, not `unavailable`: the
 * provider is fine; the authorisation is not.
 */
import type { ConnectionService, TokenCipher } from './connection.service.js';

/** The provider's token endpoint, behind a seam (S7 — no SDK in backend). */
export interface AuthorizationBroker {
  refresh(refreshToken: string): Promise<{ ok: true; accessToken: string } | { ok: false }>;
}

export type AccessTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; status: 'needs_reauthorisation'; reason: string };

export class TokenRefreshService {
  constructor(
    private readonly connections: ConnectionService,
    private readonly cipher: TokenCipher,
    private readonly broker: AuthorizationBroker,
  ) {}

  async accessTokenFor(workspaceId: string, connectionId: string): Promise<AccessTokenResult> {
    const connection = await this.connections.get(workspaceId, connectionId);
    if (connection.refreshTokenEncrypted === null) {
      await this.connections.markNeedsReauthorisation(workspaceId, connectionId);
      return {
        ok: false,
        status: 'needs_reauthorisation',
        reason: 'No authorisation is stored for this connection — authorise it again.',
      };
    }
    const refreshed = await this.broker.refresh(this.cipher.decrypt(connection.refreshTokenEncrypted));
    if (!refreshed.ok) {
      // NOT unavailable: the provider answered; the authorisation lapsed.
      await this.connections.markNeedsReauthorisation(workspaceId, connectionId);
      return {
        ok: false,
        status: 'needs_reauthorisation',
        reason: 'The provider refused the refresh token — re-authorise the connection.',
      };
    }
    return { ok: true, accessToken: refreshed.accessToken };
  }
}

// ------------------------------------------------------------- in-memory

export class InMemoryAuthorizationBroker implements AuthorizationBroker {
  private failing = false;
  refreshCalls = 0;

  failRefresh(): void {
    this.failing = true;
  }

  restore(): void {
    this.failing = false;
  }

  async refresh(refreshToken: string): Promise<{ ok: true; accessToken: string } | { ok: false }> {
    this.refreshCalls += 1;
    if (this.failing) return { ok: false };
    return { ok: true, accessToken: `short-lived:${refreshToken.length}:${this.refreshCalls}` };
  }
}
