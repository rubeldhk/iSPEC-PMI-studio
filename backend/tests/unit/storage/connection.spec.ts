/**
 * T382 — a workspace connects to a provider WITH a destination selected
 * within it (FR-PUB-029), and the connection reports healthy,
 * needs-reauthorisation and unavailable as DISTINCT states (FR-PUB-031).
 */
import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../../src/core/errors.js';
import { WS, USER, DESTINATION, storageHarness } from './helpers.js';

describe('T382 · connection lifecycle and health', () => {
  it('connects with a provider and a destination selected within it', async () => {
    const h = storageHarness();
    const view = await h.connectionService.connect(WS, {
      providerName: 'fixture',
      destination: DESTINATION,
      authorisedById: USER,
    });
    expect(view.providerName).toBe('fixture');
    expect(view.destination).toBe(DESTINATION);
    expect(view.status).toBe('healthy');
  });

  it('refuses a connection without a destination, naming the field (FR-PUB-029)', async () => {
    const h = storageHarness();
    await expect(
      h.connectionService.connect(WS, { providerName: 'fixture', destination: ' ', authorisedById: USER }),
    ).rejects.toThrow(ValidationFailedError);
  });

  it('refuses an unknown provider, naming it', async () => {
    const h = storageHarness();
    await expect(
      h.connectionService.connect(WS, { providerName: 'no-such', destination: 'x', authorisedById: USER }),
    ).rejects.toThrow(/no-such/);
  });

  it('reports the three health states DISTINCTLY (FR-PUB-031)', async () => {
    const h = storageHarness();
    const view = await h.connectionService.connect(WS, {
      providerName: 'fixture',
      destination: DESTINATION,
      authorisedById: USER,
    });

    expect(await h.connectionService.health(WS, view.id)).toBe('healthy');

    h.provider.failWith('authorisation_expired');
    expect(await h.connectionService.health(WS, view.id)).toBe('needs_reauthorisation');

    h.provider.failWith('provider_unavailable');
    expect(await h.connectionService.health(WS, view.id)).toBe('unavailable');
  });

  it('an unreachable provider is NEVER reported healthy', async () => {
    const h = storageHarness();
    const view = await h.connectionService.connect(WS, {
      providerName: 'fixture',
      destination: DESTINATION,
      authorisedById: USER,
    });
    h.provider.failWith('provider_unavailable');
    const status = await h.connectionService.health(WS, view.id);
    expect(status).not.toBe('healthy');
    expect(status).toBe('unavailable');
  });

  it('the health check stamps status and time onto the connection', async () => {
    const h = storageHarness();
    const view = await h.connectionService.connect(WS, {
      providerName: 'fixture',
      destination: DESTINATION,
      authorisedById: USER,
    });
    h.provider.failWith('provider_unavailable');
    await h.connectionService.health(WS, view.id);
    const stored = await h.connectionService.get(WS, view.id);
    expect(stored.status).toBe('unavailable');
    expect(stored.lastCheckedAt).not.toBeNull();
  });
});
