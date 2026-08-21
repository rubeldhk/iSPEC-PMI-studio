/**
 * T422 — contract tests for the connection endpoints against
 * `specs/002-team-review-access-storage/contracts/platform-api-epic-002.md`
 * (Storage connections · FR-PUB-029, FR-PUB-031, FR-PUB-037..039).
 */
import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../src/core/errors.js';
import { ConnectionsController } from '../../src/modules/storage/connections.controller.js';
import { WS, USER, DESTINATION, storageHarness, connected } from '../unit/storage/helpers.js';

const CTX = { workspaceId: WS, userId: USER };

function route(handler: string): { path: string; method: RequestMethod } {
  const fn = ConnectionsController.prototype[handler as keyof ConnectionsController] as object;
  return {
    path: Reflect.getMetadata('path', fn) as string,
    method: Reflect.getMetadata('method', fn) as RequestMethod,
  };
}

describe('contract · connection route surface', () => {
  it.each([
    ['list', 'workspaces/:id/storage-connections', RequestMethod.GET],
    ['connect', 'workspaces/:id/storage-connections', RequestMethod.POST],
    ['health', 'storage-connections/:id/health', RequestMethod.GET],
    ['disconnect', 'storage-connections/:id', RequestMethod.DELETE],
  ])('%s → %s', (handler, path, method) => {
    expect(route(handler)).toEqual({ path, method });
  });
});

describe('contract · POST requires providerType and destination (FR-PUB-029)', () => {
  it('providerType is required', async () => {
    const h = storageHarness();
    const c = new ConnectionsController(h.connectionService);
    await expect(c.connect(CTX, WS, { destination: DESTINATION })).rejects.toThrow(ValidationFailedError);
  });

  it('destination is required', async () => {
    const h = storageHarness();
    const c = new ConnectionsController(h.connectionService);
    await expect(c.connect(CTX, WS, { providerType: 'fixture' })).rejects.toThrow(ValidationFailedError);
  });

  it('a provider missing a capability is refused NAMING it (FR-PUB-039)', async () => {
    const h = storageHarness();
    const provider = h.provider;
    h.registry.register({
      descriptor: { ...provider.descriptor, name: 'thin', capabilities: ['connect', 'checkHealth'] },
      connect: provider.connect.bind(provider),
      checkHealth: provider.checkHealth.bind(provider),
      putFile: provider.putFile.bind(provider),
      listDestination: provider.listDestination.bind(provider),
    });
    const c = new ConnectionsController(h.connectionService);
    const attempt = c.connect(CTX, WS, { providerType: 'thin', destination: 'x' });
    await expect(attempt).rejects.toThrow(/putFile, listDestination/);
  });
});

describe('contract · health states (FR-PUB-031)', () => {
  it('answers healthy | needs_reauthorisation | unavailable distinctly', async () => {
    const h = storageHarness();
    const { connectionId } = await connected(h);
    const c = new ConnectionsController(h.connectionService);

    expect((await c.health(CTX, connectionId)).status).toBe('healthy');
    h.provider.failWith('authorisation_expired');
    expect((await c.health(CTX, connectionId)).status).toBe('needs_reauthorisation');
    h.provider.failWith('provider_unavailable');
    expect((await c.health(CTX, connectionId)).status).toBe('unavailable');
  });
});

describe('contract · DELETE disconnects without touching platform artifacts (FR-PUB-037/038)', () => {
  it('the connection is disconnected; publish history and references survive', async () => {
    const h = storageHarness();
    const { connectionId } = await connected(h, 2);
    await h.publish.publish(WS, 'proj_1', USER);
    const c = new ConnectionsController(h.connectionService);

    const view = await c.disconnect(CTX, connectionId);
    expect(view.disconnectedAt).not.toBeNull();
    expect(await h.publish.listRecords(WS, 'proj_1')).toHaveLength(1);
    expect(await h.store.listReferences(WS, connectionId)).toHaveLength(2);
  });
});
