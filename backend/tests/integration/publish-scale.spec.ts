/**
 * T820 — SC-017 (the publish half): a publish of 500 artifacts completes
 * without failure and without degrading the publish flow, against the
 * fixture provider. The counterpart of T810, which took the 200-question
 * review half.
 */
import { describe, expect, it } from 'vitest';
import { WS, USER, PROJECT, DESTINATION, storageHarness, artifact, connected } from '../unit/storage/helpers.js';

const ARTIFACTS = 500;
const BUDGET_MS = 30_000;

describe('T820 · SC-017 — a 500-artifact publish', () => {
  it('completes without failure, records every artifact, and stays fast', async () => {
    const started = performance.now();
    const h = storageHarness();
    await connected(h, 0);
    h.artifacts.set(
      PROJECT,
      Array.from({ length: ARTIFACTS }, (_, i) => artifact(`spec_${i + 1}`)),
    );

    const record = await h.publish.publish(WS, PROJECT, USER);

    expect(record.state).toBe('succeeded');
    expect(record.failureReason).toBeNull();
    expect(record.artifactsIncluded).toHaveLength(ARTIFACTS);
    expect(record.artifactsIncluded.every((a) => a.landed)).toBe(true);
    expect(record.destinationLocations).toHaveLength(ARTIFACTS);

    // Every file actually landed at the destination…
    expect(h.provider.destinationContents(DESTINATION).size).toBe(ARTIFACTS);
    // …every reference exists…
    expect((await h.store.listReferences(WS, record.connectionId)).length).toBe(ARTIFACTS);

    // …and the preview over the same 500 stays interactive too.
    const preview = await h.republish.preview(WS, PROJECT);
    expect(preview.unchanged).toHaveLength(ARTIFACTS);

    expect(performance.now() - started).toBeLessThan(BUDGET_MS);
  });
});
