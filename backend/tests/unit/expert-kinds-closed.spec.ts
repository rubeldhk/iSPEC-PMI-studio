/**
 * `T2540` (EPIC-047 Convergence) — every kind the Experts module records is in
 * the closed set, and nothing else can be recorded.
 *
 * `R-047-4`, `FR-EXP-061`. The payload `kind` of `expert-governance-recorded`
 * is a closed set in `EPIC-037`'s contract. The module drifted from it —
 * `run-failed` and `contract-version-in-force` were recorded and absent — and
 * nothing noticed, because `record` took any string. It now takes only an
 * `ExpertGovernanceKind`, and this test reads the module's source for every
 * kind it records, so a new one cannot be added without the set.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { EXPERT_GOVERNANCE_KINDS, type ExpertGovernanceKind } from '@pmi/execution-registry-contract';
import type { ExpertExecutions } from '../../src/modules/experts/experts.tokens.js';

const here = dirname(fileURLToPath(import.meta.url));
const MODULE = resolve(here, '../../src/modules/experts');

function recordedKinds(): Set<string> {
  const kinds = new Set<string>();
  const files = readdirSync(MODULE, { recursive: true }) as string[];
  for (const file of files.filter((f) => f.endsWith('.ts'))) {
    const source = readFileSync(join(MODULE, file), 'utf8');
    // `record(ws, executionId, 'kind', …)` and `record(ws, id, 'kind', …)`, across line breaks.
    for (const m of source.matchAll(/\brecord\(\s*[\w.]+,\s*[\w.]+,\s*'([a-z-]+)'/g)) kinds.add(m[1]!);
  }
  return kinds;
}

describe('T2540 · the closed set of Expert governance kinds', () => {
  it('finds the kinds the module records — the check is not vacuous', () => {
    const kinds = recordedKinds();
    expect(kinds.size).toBeGreaterThanOrEqual(12);
    expect(kinds).toContain('dispatch-refused');
  });

  it('every kind recorded is a member of EXPERT_GOVERNANCE_KINDS', () => {
    const outside = [...recordedKinds()].filter((k) => !(EXPERT_GOVERNANCE_KINDS as readonly string[]).includes(k));
    expect(outside, 'recorded but not in the closed set').toEqual([]);
  });

  it('record accepts only an ExpertGovernanceKind', () => {
    expectTypeOf<Parameters<ExpertExecutions['record']>[2]>().toEqualTypeOf<ExpertGovernanceKind>();
  });
});
