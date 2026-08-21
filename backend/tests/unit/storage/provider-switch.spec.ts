/**
 * T387 — provider switching loses NO platform artifact and NO publish
 * history (FR-PUB-037, FR-PUB-038, SC-010).
 */
import { FixtureStorageProvider } from '@pmi/storage-adapter-fixture';
import { describe, expect, it } from 'vitest';
import { WS, USER, PROJECT, storageHarness, connected } from './helpers.js';

describe('T387 · provider switching without loss', () => {
  it('switches to a second provider; the publish history survives intact (SC-010)', async () => {
    const h = storageHarness();
    const { connectionId } = await connected(h, 2);
    await h.publish.publish(WS, PROJECT, USER);
    const historyBefore = await h.publish.listRecords(WS, PROJECT);
    expect(historyBefore).toHaveLength(1);

    const second = new FixtureStorageProvider();
    Object.assign(second.descriptor, { name: 'fixture-two' });
    h.registry.register(second);

    const result = await h.providerSwitch.switch(WS, {
      providerName: 'fixture-two',
      destination: 'new-folder',
      authorisedById: USER,
    });
    expect(result.disconnected.id).toBe(connectionId);
    expect(result.connected.providerName).toBe('fixture-two');

    // History retained — same records, still retrievable (SC-010).
    const historyAfter = await h.publish.listRecords(WS, PROJECT);
    expect(historyAfter.map((r) => r.id)).toEqual(historyBefore.map((r) => r.id));
  });

  it('platform artifacts are untouched by the switch', async () => {
    const h = storageHarness();
    await connected(h, 2);
    await h.publish.publish(WS, PROJECT, USER);
    const artifactsBefore = await h.artifacts.listForProject(WS, PROJECT);

    const second = new FixtureStorageProvider();
    Object.assign(second.descriptor, { name: 'fixture-two' });
    h.registry.register(second);
    await h.providerSwitch.switch(WS, { providerName: 'fixture-two', destination: 'f2', authorisedById: USER });

    expect(await h.artifacts.listForProject(WS, PROJECT)).toEqual(artifactsBefore);
  });

  it('published files stay at the OLD provider — nothing deletes them', async () => {
    const h = storageHarness();
    await connected(h, 2);
    await h.publish.publish(WS, PROJECT, USER);
    const filesAtOld = [...h.provider.destinationContents('team-folder').keys()];
    expect(filesAtOld.length).toBe(2);

    const second = new FixtureStorageProvider();
    Object.assign(second.descriptor, { name: 'fixture-two' });
    h.registry.register(second);
    await h.providerSwitch.switch(WS, { providerName: 'fixture-two', destination: 'f2', authorisedById: USER });

    expect([...h.provider.destinationContents('team-folder').keys()]).toEqual(filesAtOld);
  });

  it('file references survive the switch, marked no longer tracked — never deleted', async () => {
    const h = storageHarness();
    const { connectionId } = await connected(h, 2);
    await h.publish.publish(WS, PROJECT, USER);

    const second = new FixtureStorageProvider();
    Object.assign(second.descriptor, { name: 'fixture-two' });
    h.registry.register(second);
    await h.providerSwitch.switch(WS, { providerName: 'fixture-two', destination: 'f2', authorisedById: USER });

    const references = await h.store.listReferences(WS, connectionId);
    expect(references).toHaveLength(2);
    expect(references.every((r) => r.noLongerTracked)).toBe(true);
  });

  it('publishing after the switch lands at the NEW provider', async () => {
    const h = storageHarness();
    await connected(h, 1);
    const second = new FixtureStorageProvider();
    Object.assign(second.descriptor, { name: 'fixture-two' });
    h.registry.register(second);
    await h.providerSwitch.switch(WS, { providerName: 'fixture-two', destination: 'f2', authorisedById: USER, refreshToken: 'tok' });

    const record = await h.publish.publish(WS, PROJECT, USER);
    expect(record.state).toBe('succeeded');
    expect([...second.destinationContents('f2').keys()]).toHaveLength(1);
  });
});
