/**
 * T385 — artifacts the publisher cannot access are EXCLUDED and the
 * exclusion REPORTED (FR-PUB-033).
 */
import { describe, expect, it } from 'vitest';
import { WS, USER, PROJECT, storageHarness, connected } from './helpers.js';

describe('T385 · access-aware exclusion during publish', () => {
  it('excludes what the publisher cannot read, reporting each exclusion', async () => {
    const h = storageHarness();
    const { artifacts } = await connected(h, 3);
    h.access.deny(artifacts[1]!.artifactId);

    const record = await h.publish.publish(WS, PROJECT, USER);

    expect(record.state).toBe('succeeded');
    expect(record.artifactsIncluded.map((a) => a.artifactId)).toEqual([
      artifacts[0]!.artifactId,
      artifacts[2]!.artifactId,
    ]);
    expect(record.artifactsExcluded).toHaveLength(1);
    expect(record.artifactsExcluded[0]).toMatchObject({
      artifactId: artifacts[1]!.artifactId,
      reason: expect.stringContaining('access'),
    });
  });

  it('the excluded artifact never reaches the provider', async () => {
    const h = storageHarness();
    const { artifacts } = await connected(h, 2);
    h.access.deny(artifacts[0]!.artifactId);
    await h.publish.publish(WS, PROJECT, USER);

    const names = [...h.provider.destinationContents('team-folder').keys()];
    expect(names.some((n) => n.includes(artifacts[0]!.artifactId))).toBe(false);
    expect(names.some((n) => n.includes(artifacts[1]!.artifactId))).toBe(true);
  });

  it('an exclusion is not a failure — the publish succeeds for the rest', async () => {
    const h = storageHarness();
    const { artifacts } = await connected(h, 2);
    h.access.deny(artifacts[0]!.artifactId);
    const record = await h.publish.publish(WS, PROJECT, USER);
    expect(record.state).toBe('succeeded');
    expect(record.failureReason).toBeNull();
  });
});
