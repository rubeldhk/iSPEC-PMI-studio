/**
 * T449 — a stored refresh token NEVER appears in any endpoint response, log
 * entry, or error message; no provider account password is ever accepted;
 * the token is discarded on disconnection (FR-PUB-029b, SC-014).
 */
import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../../src/core/errors.js';
import { ConnectionsController } from '../../../src/modules/storage/connections.controller.js';
import { toConnectionView } from '../../../src/modules/storage/connection.service.js';
import { WS, USER, DESTINATION, storageHarness, connected } from './helpers.js';

const SECRET = 'refresh-secret-token';

describe('T449 · the refresh token never escapes', () => {
  it('no endpoint response carries the token — the view shape has no field for it', async () => {
    const h = storageHarness();
    await connected(h);
    const controller = new ConnectionsController(h.connectionService);
    const ctx = { workspaceId: WS, userId: USER };

    const listed = await controller.list(ctx, WS);
    expect(JSON.stringify(listed)).not.toContain(SECRET);
    expect(JSON.stringify(listed)).not.toContain('enc:');
    expect(Object.keys(listed[0]!)).not.toContain('refreshTokenEncrypted');

    const health = await controller.health(ctx, listed[0]!.id);
    expect(JSON.stringify(health)).not.toContain(SECRET);
  });

  it('errors from the connection paths never carry the token', async () => {
    const h = storageHarness();
    await connected(h);
    h.provider.failWith('destination_missing');
    const err = await h.connectionService
      .connect(WS, {
        providerName: 'fixture',
        destination: 'gone',
        authorisedById: USER,
        refreshToken: SECRET,
      })
      .catch((e: Error) => e);
    expect(JSON.stringify({ message: (err as Error).message, ...(err as object) })).not.toContain(SECRET);
  });

  it('at rest the token is encrypted — the stored form is not the plaintext', async () => {
    const h = storageHarness();
    const { connectionId } = await connected(h);
    const stored = await h.connectionService.get(WS, connectionId);
    expect(stored.refreshTokenEncrypted).not.toBeNull();
    expect(stored.refreshTokenEncrypted).not.toContain(SECRET);
    expect(h.cipher.decrypt(stored.refreshTokenEncrypted as string)).toBe(SECRET);
  });

  it('no provider account password is EVER accepted', async () => {
    const h = storageHarness();
    await expect(
      h.connectionService.connect(WS, {
        providerName: 'fixture',
        destination: DESTINATION,
        authorisedById: USER,
        password: 'hunter2',
      }),
    ).rejects.toThrow(ValidationFailedError);
  });

  it('the token is DISCARDED on disconnection (SC-014)', async () => {
    const h = storageHarness();
    const { connectionId } = await connected(h);
    await h.connectionService.disconnect(WS, connectionId);
    const stored = await h.connectionService.get(WS, connectionId);
    expect(stored.refreshTokenEncrypted).toBeNull();
    // Even the view of a disconnected connection carries nothing.
    expect(JSON.stringify(toConnectionView(stored))).not.toContain('enc:');
  });
});
