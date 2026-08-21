/**
 * T451 — disconnection leaves already-published files UNTOUCHED at the
 * provider and marks their publish records no longer tracked — the platform
 * never deletes at the provider (FR-PUB-038).
 */
import { describe, expect, it } from 'vitest';
import { WS, USER, PROJECT, DESTINATION, storageHarness, connected } from './helpers.js';

describe('T451 · disconnection retention', () => {
  it('published files remain at the provider after disconnection', async () => {
    const h = storageHarness();
    const { connectionId } = await connected(h, 3);
    await h.publish.publish(WS, PROJECT, USER);
    const filesBefore = [...h.provider.destinationContents(DESTINATION).keys()].sort();
    expect(filesBefore).toHaveLength(3);

    await h.connectionService.disconnect(WS, connectionId);

    expect([...h.provider.destinationContents(DESTINATION).keys()].sort()).toEqual(filesBefore);
  });

  it('file references are marked no longer tracked — retained, never deleted', async () => {
    const h = storageHarness();
    const { connectionId } = await connected(h, 2);
    await h.publish.publish(WS, PROJECT, USER);

    await h.connectionService.disconnect(WS, connectionId);

    const references = await h.store.listReferences(WS, connectionId);
    expect(references).toHaveLength(2);
    expect(references.every((r) => r.noLongerTracked)).toBe(true);
    // Locations and versions intact — the record still says where things went.
    expect(references.every((r) => r.destinationLocation !== '')).toBe(true);
  });

  it('publish history is untouched by disconnection', async () => {
    const h = storageHarness();
    const { connectionId } = await connected(h, 1);
    await h.publish.publish(WS, PROJECT, USER);
    const before = await h.publish.listRecords(WS, PROJECT);

    await h.connectionService.disconnect(WS, connectionId);

    expect(await h.publish.listRecords(WS, PROJECT)).toEqual(before);
  });

  it('platform artifacts are untouched by disconnection', async () => {
    const h = storageHarness();
    const { connectionId } = await connected(h, 2);
    const before = await h.artifacts.listForProject(WS, PROJECT);
    await h.connectionService.disconnect(WS, connectionId);
    expect(await h.artifacts.listForProject(WS, PROJECT)).toEqual(before);
  });
});
