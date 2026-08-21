/**
 * T821 — deletion or alteration of a published file AT THE PROVIDER leaves
 * the platform artifact intact and merely marks its `PublishedFileReference`
 * stale — the platform never reads back from the provider (SC-012,
 * FR-PUB-037).
 */
import { describe, expect, it } from 'vitest';
import { WS, USER, PROJECT, storageHarness, connected } from './helpers.js';

describe('T821 · external deletion or alteration', () => {
  it('marks the reference stale and nothing else', async () => {
    const h = storageHarness();
    const { connectionId } = await connected(h, 2);
    await h.publish.publish(WS, PROJECT, USER);
    const [reference] = await h.store.listReferences(WS, connectionId);

    const updated = await h.providerSwitch.recordExternalChange(WS, reference!.id);

    expect(updated.stale).toBe(true);
    // Still tracked, still holding its location and version — merely stale.
    expect(updated.noLongerTracked).toBe(false);
    expect(updated.destinationLocation).toBe(reference!.destinationLocation);
  });

  it('the platform artifact is untouched', async () => {
    const h = storageHarness();
    const { connectionId } = await connected(h, 1);
    await h.publish.publish(WS, PROJECT, USER);
    const before = await h.artifacts.listForProject(WS, PROJECT);

    const [reference] = await h.store.listReferences(WS, connectionId);
    await h.providerSwitch.recordExternalChange(WS, reference!.id);

    expect(await h.artifacts.listForProject(WS, PROJECT)).toEqual(before);
  });

  it('other references are untouched — staleness is per file', async () => {
    const h = storageHarness();
    const { connectionId } = await connected(h, 3);
    await h.publish.publish(WS, PROJECT, USER);
    const references = await h.store.listReferences(WS, connectionId);
    await h.providerSwitch.recordExternalChange(WS, references[1]!.id);

    const after = await h.store.listReferences(WS, connectionId);
    expect(after.filter((r) => r.stale)).toHaveLength(1);
    expect(after.find((r) => r.id === references[1]!.id)!.stale).toBe(true);
  });

  it('a republish repairs the stale reference — the next upsert clears it', async () => {
    const h = storageHarness();
    const { connectionId } = await connected(h, 1);
    await h.publish.publish(WS, PROJECT, USER);
    const [reference] = await h.store.listReferences(WS, connectionId);
    await h.providerSwitch.recordExternalChange(WS, reference!.id);

    await h.publish.publish(WS, PROJECT, USER);
    const after = await h.store.listReferences(WS, connectionId);
    expect(after).toHaveLength(1);
    expect(after[0]!.stale).toBe(false);
  });
});
