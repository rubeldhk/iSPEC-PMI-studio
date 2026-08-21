/**
 * T817 — each publish writes a record naming WHAT was published, WHEN, BY
 * WHOM, and WHERE it landed — and the record survives a failed publish
 * stating what did and did not land (FR-PUB-034).
 */
import { describe, expect, it } from 'vitest';
import { WS, USER, PROJECT, storageHarness, connected } from './helpers.js';

describe('T817 · the publish record', () => {
  it('names what, when, by whom, and where', async () => {
    const h = storageHarness();
    const { artifacts } = await connected(h, 2);
    const when = new Date('2026-08-21T15:00:00Z');
    const record = await h.publish.publish(WS, PROJECT, USER, when);

    expect(record.initiatedById).toBe(USER);
    expect(record.publishedAt).toEqual(when);
    expect(record.projectId).toBe(PROJECT);
    expect(record.artifactsIncluded.map((a) => a.artifactId).sort()).toEqual(
      artifacts.map((a) => a.artifactId).sort(),
    );
    // WHERE: per-project organisation at the destination (FR-PUB-034).
    expect(record.destinationLocations).toHaveLength(2);
    for (const location of record.destinationLocations) {
      expect(location).toContain(PROJECT);
    }
  });

  it('the record survives a MID-PUBLISH failure, stating what did and did not land', async () => {
    const h = storageHarness();
    await connected(h, 3);
    // Authorisation survives exactly one write, then expires.
    h.provider.expireAuthorisationAfter(1);

    const record = await h.publish.publish(WS, PROJECT, USER);

    expect(record.state).toBe('partial');
    expect(record.failureReason).toBe('authorisation_expired');
    const landed = record.artifactsIncluded.filter((a) => a.landed);
    const notLanded = record.artifactsIncluded.filter((a) => !a.landed);
    expect(landed).toHaveLength(1);
    expect(notLanded).toHaveLength(2);
    expect(landed[0]!.destinationLocation).not.toBeNull();
    expect(notLanded.every((a) => a.destinationLocation === null)).toBe(true);
  });

  it('a publish that cannot start (no valid authorisation) still writes its record', async () => {
    const h = storageHarness();
    await connected(h, 2);
    h.broker.failRefresh();
    const record = await h.publish.publish(WS, PROJECT, USER);
    expect(record.state).toBe('failed');
    expect(record.failureReason).toBe('authorisation_expired');
    expect(record.artifactsIncluded.every((a) => !a.landed)).toBe(true);
    // Retrievable afterwards — the record is history, not a response body.
    expect(await h.publish.getRecord(WS, record.id)).toMatchObject({ id: record.id, state: 'failed' });
  });

  it('every publish appends its own record — history accumulates', async () => {
    const h = storageHarness();
    await connected(h, 1);
    await h.publish.publish(WS, PROJECT, USER);
    await h.publish.publish(WS, PROJECT, USER);
    expect(await h.publish.listRecords(WS, PROJECT)).toHaveLength(2);
  });
});
