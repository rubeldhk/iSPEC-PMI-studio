/**
 * T421 — the storage connections controller: an unreachable provider reports
 * `unavailable` and NEVER `healthy`.
 *
 * Written to FAIL before T423 exists (Constitution V).
 */
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { NotFoundError, UnauthenticatedError } from '../../../src/core/errors.js';
import { ConnectionsController } from '../../../src/modules/storage/connections.controller.js';
import { WS, USER, DESTINATION, storageHarness, connected } from './helpers.js';

const CTX = { workspaceId: WS, userId: USER };

describe('T421 · connections controller', () => {
  it('connects and lists — the body is the token-free view', async () => {
    const h = storageHarness();
    const c = new ConnectionsController(h.connectionService);
    const created = await c.connect(CTX, WS, {
      providerType: 'fixture',
      destination: DESTINATION,
      refreshToken: 'secret',
    });
    expect(created.providerName).toBe('fixture');
    expect('refreshTokenEncrypted' in created).toBe(false);

    const listed = await c.list(CTX, WS);
    expect(listed).toHaveLength(1);
  });

  it('an unreachable provider reports unavailable, NEVER healthy', async () => {
    const h = storageHarness();
    const { connectionId } = await connected(h);
    h.provider.failWith('provider_unavailable');
    const c = new ConnectionsController(h.connectionService);
    const health = await c.health(CTX, connectionId);
    expect(health.status).toBe('unavailable');
    expect(health.status).not.toBe('healthy');
  });

  it('a foreign workspace path is absent, never forbidden', async () => {
    const h = storageHarness();
    const c = new ConnectionsController(h.connectionService);
    await expect(c.list(CTX, 'ws_other')).rejects.toThrow(NotFoundError);
    await expect(
      c.connect(CTX, 'ws_other', { providerType: 'fixture', destination: 'x' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('disconnect answers the view of the disconnected connection', async () => {
    const h = storageHarness();
    const { connectionId } = await connected(h);
    const c = new ConnectionsController(h.connectionService);
    const view = await c.disconnect(CTX, connectionId);
    expect(view.disconnectedAt).not.toBeNull();
  });

  it('refuses an unauthenticated caller', async () => {
    const h = storageHarness();
    const c = new ConnectionsController(h.connectionService);
    await expect(c.list(undefined, WS)).rejects.toThrow(UnauthenticatedError);
  });
});
