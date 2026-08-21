/**
 * T386 — republish states what will be added, replaced or left alone BEFORE
 * changing anything (FR-PUB-036).
 */
import { describe, expect, it } from 'vitest';
import { WS, USER, PROJECT, storageHarness, connected, artifact } from './helpers.js';

describe('T386 · the republish preview', () => {
  it('everything is "added" before the first publish', async () => {
    const h = storageHarness();
    await connected(h, 2);
    const preview = await h.republish.preview(WS, PROJECT);
    expect(preview.added.sort()).toEqual(['spec_1.md', 'spec_2.md']);
    expect(preview.replaced).toEqual([]);
    expect(preview.unchanged).toEqual([]);
  });

  it('after a publish: unchanged for same versions, replaced for new ones, added for new files', async () => {
    const h = storageHarness();
    await connected(h, 2);
    await h.publish.publish(WS, PROJECT, USER);

    // spec_1 unchanged; spec_2 revised; spec_3 brand new.
    h.artifacts.set(PROJECT, [artifact('spec_1', 'v1'), artifact('spec_2', 'v9'), artifact('spec_3')]);

    const preview = await h.republish.preview(WS, PROJECT);
    expect(preview.unchanged).toEqual(['spec_1.md']);
    expect(preview.replaced).toEqual(['spec_2.md']);
    expect(preview.added).toEqual(['spec_3.md']);
  });

  it('the preview changes NOTHING — destination and records identical before and after', async () => {
    const h = storageHarness();
    await connected(h, 2);
    await h.publish.publish(WS, PROJECT, USER);

    const destinationBefore = [...h.provider.destinationContents('team-folder').keys()].sort();
    const recordsBefore = (await h.publish.listRecords(WS, PROJECT)).length;

    await h.republish.preview(WS, PROJECT);

    expect([...h.provider.destinationContents('team-folder').keys()].sort()).toEqual(destinationBefore);
    expect((await h.publish.listRecords(WS, PROJECT)).length).toBe(recordsBefore);
  });
});
