/**
 * `T2014` (EPIC-047) — a request's own limits must be limits.
 *
 * `FR-EXP-044`, `FR-EXP-040`. A request may narrow its contract's limits. A
 * value that is not a finite positive number — zero, negative, `NaN`,
 * `Infinity`, a string, or a kind that is not a limit — is the caller's
 * mistake, refused `400` before anything is registered, like a blank
 * objective. Otherwise `Math.min` with `NaN` would quietly yield a limit of
 * `NaN`, and a negative time would fire the abort at once.
 */
import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../src/core/errors.js';
import type { DispatchRequest } from '../../src/modules/experts/dispatch.service.js';
import { ACTOR, ask, world } from '../helpers/expert-dispatch.js';

const bad: [string, unknown][] = [
  ['zero', { time: 0 }],
  ['negative', { tokens: -5 }],
  ['NaN', { tokens: Number.NaN }],
  ['Infinity', { cost: Number.POSITIVE_INFINITY }],
  ['a string', { resource: '10' }],
  ['an unknown kind', { memory: 10 }],
  ['not an object', [100]],
];

describe('T2014 · request limits', () => {
  for (const [name, limits] of bad) {
    it(`a request limit that is ${name} is refused 400 before registration`, async () => {
      const w = await world();
      const error = await w.service
        .dispatch(ACTOR, ask({ limits: limits as DispatchRequest['limits'] }))
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationFailedError);
      expect((error as Error).message).toMatch(/limit/i);
      expect(w.executions.registered).toHaveLength(0);
    });
  }

  it('finite positive request limits are accepted and narrow as before', async () => {
    const w = await world();
    const result = await w.service.dispatch(ACTOR, ask({ limits: { time: 30_000, tokens: 1500.5 } }));
    const limits = await w.store.limitsFor('ws_1', result.executionId);
    expect(limits.find((l) => l.limit === 'time')?.value).toBe(30_000);
    expect(limits.find((l) => l.limit === 'tokens')?.value).toBe(1500.5);
  });
});
