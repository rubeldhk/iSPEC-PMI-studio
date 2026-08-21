/**
 * T424 — the publish controller: the republish preview is computed BEFORE
 * any write, and a second concurrent publish returns 409.
 *
 * Written to FAIL before T426 exists (Constitution V).
 */
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ConflictError, toHttpStatus } from '../../../src/core/errors.js';
import { PublishController } from '../../../src/modules/storage/publish.controller.js';
import { WS, USER, PROJECT, DESTINATION, storageHarness, connected } from './helpers.js';

const CTX = { workspaceId: WS, userId: USER };

describe('T424 · publish controller', () => {
  it('publishes and answers the record body', async () => {
    const h = storageHarness();
    await connected(h, 2);
    const c = new PublishController(h.publish, h.republish);
    const body = await c.publish(CTX, PROJECT, {});
    expect(body.state).toBe('succeeded');
    expect(body.destinationLocations).toHaveLength(2);
  });

  it('the preview is computed BEFORE any write — previewing changes nothing', async () => {
    const h = storageHarness();
    await connected(h, 2);
    const c = new PublishController(h.publish, h.republish);

    const preview = await c.preview(CTX, PROJECT);
    expect(preview.added).toHaveLength(2);

    // No write happened: the destination is empty and no record exists.
    expect(h.provider.destinationContents(DESTINATION).size).toBe(0);
    expect(await c.list(CTX, PROJECT)).toHaveLength(0);
  });

  it('a second CONCURRENT publish returns 409 — prevented, not queued', async () => {
    const h = storageHarness({ putDelayMs: 30 });
    await connected(h, 3);
    const c = new PublishController(h.publish, h.republish);

    const [first, second] = await Promise.allSettled([
      c.publish(CTX, PROJECT, {}),
      c.publish(CTX, PROJECT, {}),
    ]);
    const statuses = [first, second].map((r) => r!.status).sort();
    expect(statuses).toEqual(['fulfilled', 'rejected']);
    const rejected = [first, second].find((r) => r!.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConflictError);
    expect(toHttpStatus(rejected.reason)).toBe(409);
  });

  it('a SEQUENTIAL second publish is fine — only concurrency is refused', async () => {
    const h = storageHarness();
    await connected(h, 1);
    const c = new PublishController(h.publish, h.republish);
    await c.publish(CTX, PROJECT, {});
    const again = await c.publish(CTX, PROJECT, {});
    expect(again.state).toBe('succeeded');
  });

  it('GET publishes/:id answers included, excluded-with-reason, destinations', async () => {
    const h = storageHarness();
    const { artifacts } = await connected(h, 2);
    h.access.deny(artifacts[0]!.artifactId);
    const c = new PublishController(h.publish, h.republish);
    const record = await c.publish(CTX, PROJECT, {});
    const body = await c.get(CTX, record.id);
    expect(body.artifactsIncluded).toHaveLength(1);
    expect(body.artifactsExcluded).toHaveLength(1);
    expect(body.artifactsExcluded[0]!.reason).toContain('access');
  });
});
