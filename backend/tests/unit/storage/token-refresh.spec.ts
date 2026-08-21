/**
 * T447 — an expired access token is refreshed WITHOUT user interaction where
 * the provider permits it; a connection whose refresh fails reports
 * `needs_reauthorisation` rather than `unavailable` (FR-PUB-029a, FR-PUB-031).
 */
import { describe, expect, it } from 'vitest';
import { WS, storageHarness, connected } from './helpers.js';

describe('T447 · token refresh', () => {
  it('mints a short-lived access token from the stored refresh token — no user involved', async () => {
    const h = storageHarness();
    const { connectionId } = await connected(h);
    const result = await h.tokenRefresh.accessTokenFor(WS, connectionId);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.accessToken).toContain('short-lived');
    expect(h.broker.refreshCalls).toBe(1);
  });

  it('a failed refresh reports needs_reauthorisation — the provider is fine, the authorisation is not', async () => {
    const h = storageHarness();
    const { connectionId } = await connected(h);
    h.broker.failRefresh();

    const result = await h.tokenRefresh.accessTokenFor(WS, connectionId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe('needs_reauthorisation');

    const stored = await h.connectionService.get(WS, connectionId);
    expect(stored.status).toBe('needs_reauthorisation');
    expect(stored.status).not.toBe('unavailable');
  });

  it('a connection with no stored authorisation reports needs_reauthorisation too', async () => {
    const h = storageHarness();
    const view = await h.connectionService.connect(WS, {
      providerName: 'fixture',
      destination: 'folder',
      authorisedById: 'u',
      // no refreshToken
    });
    const result = await h.tokenRefresh.accessTokenFor(WS, view.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe('needs_reauthorisation');
  });

  it('the access token is never stored — a second call mints a fresh one', async () => {
    const h = storageHarness();
    const { connectionId } = await connected(h);
    const first = await h.tokenRefresh.accessTokenFor(WS, connectionId);
    const second = await h.tokenRefresh.accessTokenFor(WS, connectionId);
    expect(first.ok && second.ok && first.accessToken !== second.accessToken).toBe(true);
    expect(h.broker.refreshCalls).toBe(2);
  });
});
