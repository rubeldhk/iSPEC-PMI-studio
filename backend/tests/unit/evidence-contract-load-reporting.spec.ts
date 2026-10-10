/**
 * T1994 — a refused Contract version is reported, not silently left unloaded.
 * `FR-EVS-024`, US2/AC4. Written to fail first.
 *
 * `ContractCatalog` refuses a version that weakens one work is in flight under
 * (`T858b`), and lists it in `refusals()`. Nothing in the running application
 * read that list: the author of the weakened version saw it ship, and new work
 * kept binding the predecessor with no signal anywhere. A refusal nobody can
 * see is indistinguishable from a deploy that did not happen.
 *
 * `loadCatalog` is what `EvidenceModule` builds the catalog with: it reads the
 * in-flight set first, treats every version as in flight when the store cannot
 * say (the strict reading), and reports each refusal.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { predicateTypeFor } from '@pmi/evidence-contract';
import { loadCatalog } from '../../src/modules/evidence/contract.loader.js';

const TEST = predicateTypeFor('test-result');
const SCAN = predicateTypeFor('scan');

const v1 = {
  workClass: 'task-completion',
  contractVersion: 1,
  items: [
    { itemId: 'tests-pass', description: 'Tests pass', acceptingPredicateTypes: [TEST] },
    { itemId: 'scanned', description: 'Scanned', acceptingPredicateTypes: [SCAN] },
  ],
};
const weakened = { ...v1, contractVersion: 2, items: [v1.items[0]] };

let directory = '';
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 't1994-'));
  writeFileSync(join(directory, 'task-completion.v1.json'), JSON.stringify(v1));
  writeFileSync(join(directory, 'task-completion.v2.json'), JSON.stringify(weakened));
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

describe('T1994 · FR-EVS-024 — a refused Contract version is reported', () => {
  it('reports the weakened version, naming the class, the version and why', async () => {
    const reported: string[] = [];
    const catalog = await loadCatalog(
      { inFlightContractVersions: async () => new Set(['task-completion@1']) },
      { directory, report: (message) => reported.push(message) },
    );
    expect(catalog.latest('task-completion')!.contractVersion).toBe(1);
    expect(reported).toHaveLength(1);
    expect(reported[0]).toMatch(/task-completion v2/);
    expect(reported[0]).toMatch(/v1/);
    expect(reported[0]).toMatch(/item scanned removed/);
    expect(reported[0]).toMatch(/FR-EVS-024/);
  });

  it('treats every version as in flight when the store cannot say — and still reports', async () => {
    const reported: string[] = [];
    const catalog = await loadCatalog(
      {
        inFlightContractVersions: async () => {
          throw new Error('store unreachable');
        },
      },
      { directory, report: (message) => reported.push(message) },
    );
    expect(catalog.get('task-completion', 2)).toBeNull();
    expect(reported).toHaveLength(1);
  });

  it('reports nothing when nothing was refused', async () => {
    const reported: string[] = [];
    const catalog = await loadCatalog(
      { inFlightContractVersions: async () => new Set() },
      { directory, report: (message) => reported.push(message) },
    );
    expect(catalog.latest('task-completion')!.contractVersion).toBe(2);
    expect(reported).toEqual([]);
  });
});
