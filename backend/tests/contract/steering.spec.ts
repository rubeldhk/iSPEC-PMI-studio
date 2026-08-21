/**
 * T236 — contract tests for the /steering endpoints.
 *
 * `contracts/platform-api.md` predates this epic and carries no steering
 * section; the surface below follows its conventions (plural nouns, POST for
 * state-changing verbs, opaque 404s) and the steering-contract's semantics.
 */
import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { RequestMethod } from '@nestjs/common';
import {
  SteeringController,
  type SteeringApi,
} from '../../src/modules/steering/steering.controller.js';
import { ValidationFailedError, toErrorBody, toHttpStatus } from '../../src/core/errors.js';

const CTX = { workspaceId: 'ws_a', userId: 'u1' } as never;

function route(handler: string): { path: string; method: RequestMethod } {
  const fn = SteeringController.prototype[handler as keyof SteeringController] as object;
  return {
    path: Reflect.getMetadata('path', fn) as string,
    method: Reflect.getMetadata('method', fn) as RequestMethod,
  };
}

describe('contract · steering route surface (US1)', () => {
  it.each([
    ['create', 'steering', RequestMethod.POST],
    ['list', 'steering', RequestMethod.GET],
    ['get', 'steering/:id', RequestMethod.GET],
    ['edit', 'steering/:id', RequestMethod.PATCH],
    ['retire', 'steering/:id/retire', RequestMethod.POST],
    ['history', 'steering/:id/versions', RequestMethod.GET],
  ])('%s → %s', (handler, path, method) => {
    expect(route(handler)).toEqual({ path, method });
  });

  it('create is 201 — a steering document is a resource, not a job', () => {
    expect(
      Reflect.getMetadata('__httpCode__', SteeringController.prototype.create),
    ).toBe(201);
  });
});

describe('contract · refusal shapes', () => {
  it('an unknown subject is a 400 validation_failed naming the subject', async () => {
    const service = {
      create: vi.fn(async () => {
        throw new ValidationFailedError(
          'Unknown steering subject "vibes". Valid subjects: coding_standards, …',
        );
      }),
    } as unknown as SteeringApi;
    const err = await new SteeringController(service)
      .create(CTX, { subject: 'vibes', scopeType: 'organization', scopeRef: 'o', content: 'x' } as never)
      .catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(400);
    expect(toErrorBody(err).error.message).toMatch(/vibes/);
  });
});
