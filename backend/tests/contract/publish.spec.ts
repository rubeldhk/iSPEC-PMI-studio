/**
 * T425 — contract tests for publish and preview endpoints against
 * `specs/002-team-review-access-storage/contracts/platform-api-epic-002.md`
 * (Publishing · FR-PUB-032 to FR-PUB-036, FR-PUB-040).
 *
 * Every failure carries a reason from the CLOSED taxonomy with no `unknown`
 * member, and the publish endpoint accepts NO artifact-subset parameter.
 */
import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { STORAGE_FAILURE_REASONS } from '@pmi/storage-contract';
import { ConflictError, ProviderUnavailableError, toErrorBody, toHttpStatus } from '../../src/core/errors.js';
import { PublishController } from '../../src/modules/storage/publish.controller.js';
import { WS, USER, PROJECT, storageHarness, connected } from '../unit/storage/helpers.js';

const CTX = { workspaceId: WS, userId: USER };

function route(handler: string): { path: string; method: RequestMethod } {
  const fn = PublishController.prototype[handler as keyof PublishController] as object;
  return {
    path: Reflect.getMetadata('path', fn) as string,
    method: Reflect.getMetadata('method', fn) as RequestMethod,
  };
}

describe('contract · publish route surface', () => {
  it.each([
    ['publish', 'projects/:projectId/publishes', RequestMethod.POST],
    ['list', 'projects/:projectId/publishes', RequestMethod.GET],
    ['preview', 'projects/:projectId/publishes/preview', RequestMethod.GET],
    ['get', 'publishes/:id', RequestMethod.GET],
  ])('%s → %s', (handler, path, method) => {
    expect(route(handler)).toEqual({ path, method });
  });

  it('publish answers 202 Accepted — asynchronous, like generation', () => {
    expect(Reflect.getMetadata('__httpCode__', PublishController.prototype.publish)).toBe(202);
  });
});

describe('contract · no artifact-subset parameter (FR-PUB-032)', () => {
  it('a body naming artifacts changes nothing — the whole project publishes', async () => {
    const h = storageHarness();
    const { artifacts } = await connected(h, 3);
    const c = new PublishController(h.publish, h.republish);
    // A caller TRIES to select a subset; nothing reads it.
    const body = await c.publish(CTX, PROJECT, { artifactIds: [artifacts[0]!.artifactId] });
    expect(body.artifactsIncluded).toHaveLength(3);
  });
});

describe('contract · the failure body (FR-PUB-035, SC-009)', () => {
  it('a failed publish carries a reason from the closed taxonomy', async () => {
    const h = storageHarness();
    await connected(h, 1);
    h.provider.failWith('quota_exceeded');
    const c = new PublishController(h.publish, h.republish);
    const body = await c.publish(CTX, PROJECT, {});
    expect(body.state).toBe('failed');
    expect(STORAGE_FAILURE_REASONS as readonly string[]).toContain(body.failureReason as string);
    expect(body.failureReason).not.toBe('unknown');
  });

  it('the taxonomy has no unknown member at all', () => {
    expect(STORAGE_FAILURE_REASONS as readonly string[]).not.toContain('unknown');
  });

  it('an unreachable provider is 502 provider_unavailable, BEFORE anything is sent', async () => {
    const h = storageHarness();
    await connected(h, 2);
    h.provider.failWith('provider_unavailable');
    const c = new PublishController(h.publish, h.republish);
    const attempt = c.publish(CTX, PROJECT, {});
    const err = await attempt.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderUnavailableError);
    expect(toHttpStatus(err)).toBe(502);
    expect(toErrorBody(err).error.code).toBe('provider_unavailable');
    // Nothing was sent.
    expect(h.provider.destinationContents('team-folder').size).toBe(0);
  });
});

describe('contract · concurrency (FR-PUB-040)', () => {
  it('a publish already running for this project → 409, prevented not queued', async () => {
    const h = storageHarness({ putDelayMs: 30 });
    await connected(h, 3);
    const c = new PublishController(h.publish, h.republish);
    const results = await Promise.allSettled([c.publish(CTX, PROJECT, {}), c.publish(CTX, PROJECT, {})]);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConflictError);
    expect(toHttpStatus(rejected.reason)).toBe(409);
  });
});

describe('contract · GET bodies (FR-PUB-033, FR-PUB-034, FR-PUB-036)', () => {
  it('publishes/:id carries included, excluded-with-reason, destinations', async () => {
    const h = storageHarness();
    const { artifacts } = await connected(h, 2);
    h.access.deny(artifacts[1]!.artifactId);
    const c = new PublishController(h.publish, h.republish);
    const record = await c.publish(CTX, PROJECT, {});
    const body = await c.get(CTX, record.id);
    expect(body.artifactsIncluded.length).toBeGreaterThan(0);
    expect(body.artifactsExcluded[0]!.reason).not.toBe('');
    expect(body.destinationLocations.length).toBeGreaterThan(0);
  });

  it('preview answers added / replaced / unchanged, computed before any write', async () => {
    const h = storageHarness();
    await connected(h, 2);
    const c = new PublishController(h.publish, h.republish);
    const preview = await c.preview(CTX, PROJECT);
    expect(Object.keys(preview).sort()).toEqual(['added', 'replaced', 'unchanged']);
    expect(h.provider.destinationContents('team-folder').size).toBe(0);
  });
});
