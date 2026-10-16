/**
 * `T2224` (EPIC-039, `R-039-8`) — the module refuses to start without
 * `PMI_ENVIRONMENT`, naming it, and refuses a value outside the four
 * environments. It never defaults to `prod` or `local`: an environment is an
 * eligibility condition (`FR-HUB-031`), and a guessed one would permit or
 * refuse adapters on a fact nobody stated.
 *
 * Written to FAIL before `T2225`.
 */
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { resolvePlatformEnvironment } from '../../src/modules/integrations/integrations.module.js';

describe('T2224 · PMI_ENVIRONMENT at boot', () => {
  it('refuses to start without it, naming the variable', () => {
    expect(() => resolvePlatformEnvironment({})).toThrow(/PMI_ENVIRONMENT/);
    expect(() => resolvePlatformEnvironment({ PMI_ENVIRONMENT: '' })).toThrow(/PMI_ENVIRONMENT/);
  });

  it('refuses a value outside local, dev, stage, prod', () => {
    expect(() => resolvePlatformEnvironment({ PMI_ENVIRONMENT: 'production' })).toThrow(/local, dev, stage, prod/);
  });

  it('accepts each of the four', () => {
    for (const e of ['local', 'dev', 'stage', 'prod']) expect(resolvePlatformEnvironment({ PMI_ENVIRONMENT: e })).toBe(e);
  });
});
