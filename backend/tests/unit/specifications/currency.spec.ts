/**
 * T263 — living-specification currency (FR-ENH-006), extending FR-032.
 * Written to FAIL before T264/T265 exist (Constitution V).
 *
 * ONE field, wider trigger: `currency_status` generalises FR-032's
 * requirement-change flag to ANY upstream artifact — two independent
 * staleness flags would disagree.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CurrencyService,
  InMemoryCurrencyStore,
} from '../../../src/modules/specifications/currency.service.js';
import {
  DependenciesService,
  InMemoryDependencyStore,
} from '../../../src/modules/dependencies/dependencies.service.js';

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA = readFileSync(resolve(here, '../../../prisma/schema.prisma'), 'utf8');

const WS = 'ws_a';

describe('T263 · the schema half (T264)', () => {
  it('Specification carries currency_status, stale_reason, and reconciliation attribution', () => {
    const block = /model Specification \{[\s\S]*?\n\}/.exec(SCHEMA)![0];
    expect(block).toMatch(/currencyStatus\s+CurrencyStatus\s+@default\(current\)/);
    expect(block).toMatch(/staleReason\s+String\?/);
    expect(block).toMatch(/reconciledAt\s+DateTime\?/);
    expect(block).toMatch(/reconciledById\s+String\?/);
  });
});

async function buildWorld(): Promise<{
  currency: CurrencyService;
  store: InMemoryCurrencyStore;
}> {
  const edges = new InMemoryDependencyStore();
  const dependencies = new DependenciesService(edges);
  // s_derived depends on the upstream ADR.
  await dependencies.create(
    WS,
    {
      source: { artifactType: 'specification', artifactId: 's_derived' },
      target: { artifactType: 'decision', artifactId: 'adr_1' },
      dependencyType: 'constrained_by',
    },
    'u1',
  );
  const store = new InMemoryCurrencyStore();
  const currency = new CurrencyService(store, {
    dependents: (workspaceId, ref) => dependencies.directDependents(workspaceId, ref),
    derivedSpecificationIds: async (_ws, requirementId) =>
      requirementId === 'req_1' ? ['s_from_req'] : [],
  });
  return { currency, store };
}

describe('T263 · any upstream change marks the specification stale, naming what changed', () => {
  it('an upstream ADR change marks the dependent specification stale via the dependency graph', async () => {
    const { currency, store } = await buildWorld();
    const marked = await currency.artifactChanged(WS, {
      artifactType: 'decision',
      artifactId: 'adr_1',
    });
    expect(marked).toContain('s_derived');
    const state = store.stateOf('s_derived');
    expect(state?.currencyStatus).toBe('stale');
    expect(state?.staleReason).toMatch(/decision/);
    expect(state?.staleReason).toMatch(/adr_1/);
  });

  it("FR-032's requirement-change trigger flows through the SAME field", async () => {
    const { currency, store } = await buildWorld();
    const marked = await currency.artifactChanged(WS, {
      artifactType: 'requirement',
      artifactId: 'req_1',
    });
    expect(marked).toContain('s_from_req');
    const state = store.stateOf('s_from_req');
    expect(state?.currencyStatus).toBe('stale');
    expect(state?.staleReason).toMatch(/requirement/);
    expect(state?.staleReason).toMatch(/req_1/);
  });

  it('an artifact with no dependents marks nothing — and that is a result, not an error', async () => {
    const { currency } = await buildWorld();
    const marked = await currency.artifactChanged(WS, {
      artifactType: 'decision',
      artifactId: 'adr_unlinked',
    });
    expect(marked).toEqual([]);
  });
});
