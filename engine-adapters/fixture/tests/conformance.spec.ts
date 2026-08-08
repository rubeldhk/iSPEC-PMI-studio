/**
 * T039 — the shared conformance suite, run against the fixture adapter.
 *
 * The fixture is measured by exactly the same thirteen cases as the real
 * engine. That is the point of building it first (plan.md build order): the
 * contract, the registry and every downstream consumer are proven against an
 * engine whose behaviour is fully controllable, so a red case means the
 * *contract* is wrong rather than the AI agent being unpredictable.
 */
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { expect } from 'vitest';
import {
  PHASE_1_CAPABILITIES,
  type EngineCapability,
  type EngineDescriptor,
} from '@pmi/engine-contract';
import { runEngineConformance, type ConformanceHarness } from '@pmi/engine-contract/conformance';
import { FixtureEngine, FIXTURE_INPUT_CEILING } from '../src/index';

/** A credential-shaped value the engine can see, so C13 is a real test rather than a tautology. */
const SECRET_PROBE = 'sk-fixtureProbe0123456789';
process.env['AI_PROVIDER_TOKEN'] = SECRET_PROBE;

/** Snapshot of the temp directory, so C12 can prove the fixture adds nothing to it. */
const tempBefore = new Set(readdirSync(tmpdir()));

const harness: ConformanceHarness = {
  name: 'fixture',
  inputCeiling: FIXTURE_INPUT_CEILING,
  secretProbe: SECRET_PROBE,

  create: () => new FixtureEngine(),

  createFailing: (reason) => new FixtureEngine({ failWith: reason }),

  createSlow: (delayMs) => new FixtureEngine({ delayMs }),

  incompleteDescriptor: (missing: EngineCapability): EngineDescriptor => ({
    name: 'fixture-incomplete',
    version: 'fixture-1.0.0+model=none',
    capabilities: PHASE_1_CAPABILITIES.filter((capability) => capability !== missing),
  }),

  /**
   * The fixture creates no process, container, or temporary file — so E8 for
   * this adapter means proving it stayed that way, not cleaning up after it.
   * The Spec Kit adapter's harness asserts real teardown (T093).
   */
  assertNothingLeftBehind: async () => {
    const added = readdirSync(tmpdir()).filter((entry) => !tempBefore.has(entry));
    const ours = added.filter((entry) => /fixture|pmi|speckit/i.test(entry));
    expect(ours, 'the fixture engine left temporary files behind').toEqual([]);
  },
};

runEngineConformance(harness);
