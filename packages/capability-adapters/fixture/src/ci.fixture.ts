/**
 * `T2140` (EPIC-039) — `fixture-ci`: `ReadBuildStatus` and `ReadTestResults`.
 *
 * A run is non-final until the binding's `finalAfterReads` reads of a revision
 * have been made — which is how evidence intake's re-read loop (`FR-HUB-054`,
 * quickstart Q17) is exercised without a CI service.
 */
import type { AdapterCall, AdapterDescriptor, AdapterResult } from '@pmi/capability-contract';
import { FULL_SHA, FixtureAdapter, fixtureDescriptor, invalidInput, type FixtureScript } from './shared.js';

const PASSED = ['suite > adds two numbers', 'suite > refuses a negative', 'suite > reads the fixture'];
const FAILED = ['suite > handles the edge case'];

export class FixtureCiAdapter extends FixtureAdapter {
  readonly descriptor: AdapterDescriptor = fixtureDescriptor({
    key: 'fixture-ci',
    name: 'Fixture CI',
    implements: [
      { capability: 'ReadBuildStatus', majors: [1] },
      { capability: 'ReadTestResults', majors: [1] },
    ],
    scopeMapping: { 'ci.checks': ['fixture:checks'], 'ci.artifacts': ['fixture:artifacts'] },
  });

  private readonly reads = new Map<string, number>();

  private final(revision: string, script: FixtureScript): boolean {
    if (script.invoke === 'non-final') return false;
    const n = (this.reads.get(revision) ?? 0) + 1;
    this.reads.set(revision, n);
    return script.finalAfterReads === undefined || n > script.finalAfterReads;
  }

  protected async serve(call: AdapterCall, script: FixtureScript): Promise<AdapterResult> {
    const input = call.input as { revision?: unknown } | null;
    if (input === null || typeof input !== 'object' || typeof input.revision !== 'string' || !FULL_SHA.test(input.revision)) {
      return invalidInput(`${call.capability} needs a full commit id`);
    }
    const revision = input.revision;
    const observedAt = new Date().toISOString();
    if (call.capability === 'ReadBuildStatus') {
      if (script.invoke === 'non-conforming') return { ok: true, output: { revision, state: 'almost', final: true, checks: [], observedAt } };
      const final = this.final(revision, script);
      const failed = script.result === 'FAILED';
      const checks = [
        { name: 'build', state: final ? 'success' : 'pending', final, ...(final ? { completedAt: observedAt } : {}) },
        { name: 'test', state: !final ? 'pending' : failed ? 'failure' : 'success', final, ...(final ? { completedAt: observedAt } : {}) },
      ];
      return { ok: true, output: { revision, state: !final ? 'pending' : failed ? 'failure' : 'success', final, checks, observedAt } };
    }
    if (script.invoke === 'non-conforming') return { ok: true, output: { revision, final: true, result: 'MOSTLY', observedAt } };
    const final = this.final(revision, script);
    const failed = script.result === 'FAILED';
    return {
      ok: true,
      output: {
        revision,
        final,
        result: !final ? 'NONE' : failed ? 'FAILED' : 'PASSED',
        suites: final ? 1 : 0,
        passedTests: final ? PASSED : [],
        failedTests: final && failed ? FAILED : [],
        skippedTests: [],
        source: { artifactName: 'test-results', format: 'junit-xml' },
        observedAt,
      },
    };
  }
}
