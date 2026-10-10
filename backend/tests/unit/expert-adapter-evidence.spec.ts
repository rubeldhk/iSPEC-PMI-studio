/**
 * `T1979` (EPIC-047) — does `EPIC-032` know this Evidence Contract?
 *
 * `R-047-11`, `FR-EXP-022`. A contract names its Evidence Contract by package
 * identity, `{workClass, contractVersion}` — the identity the completion gate
 * binds work to — and the answer comes from `ContractCatalog.get`. A catalog
 * that cannot answer is a fault that propagates: an unchecked reference must
 * not read as an absent one, and certainly not as a present one.
 */
import { describe, expect, it } from 'vitest';
import { ContractCatalog } from '../../src/modules/evidence/contract.loader.js';
import { catalogEvidence, type EvidenceCatalog } from '../../src/modules/experts/adapters/evidence.adapter.js';

function catalog(known: string[]): EvidenceCatalog & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    get(workClass, contractVersion) {
      asked.push(`${workClass}@${contractVersion}`);
      return known.includes(`${workClass}@${contractVersion}`) ? ({ workClass, contractVersion } as never) : null;
    },
  };
}

describe('T1979 · Evidence Contract references answer through ContractCatalog.get', () => {
  it('a pair the catalog holds exists', async () => {
    const c = catalog(['task-completion@1']);
    await expect(catalogEvidence(c).exists({ workClass: 'task-completion', contractVersion: 1 })).resolves.toBe(true);
    expect(c.asked).toEqual(['task-completion@1']);
  });

  it('a work class it does not hold does not', async () => {
    await expect(
      catalogEvidence(catalog(['task-completion@1'])).exists({ workClass: 'implementation', contractVersion: 1 }),
    ).resolves.toBe(false);
  });

  it('a version it does not hold does not — the version is part of the identity', async () => {
    await expect(
      catalogEvidence(catalog(['task-completion@1'])).exists({ workClass: 'task-completion', contractVersion: 2 }),
    ).resolves.toBe(false);
  });

  it('a catalog fault propagates rather than reading as absent', async () => {
    const broken: EvidenceCatalog = {
      get() {
        throw new Error('contract definitions unreadable');
      },
    };
    await expect(catalogEvidence(broken).exists({ workClass: 'task-completion', contractVersion: 1 })).rejects.toThrow(
      /contract definitions unreadable/,
    );
  });

  it("against EPIC-032's own definitions: the four it ships exist, and nothing else does", async () => {
    const evidence = catalogEvidence(ContractCatalog.fromDirectory());
    for (const workClass of ['change-closure', 'defect-repair', 'requirement-baseline', 'task-completion']) {
      await expect(evidence.exists({ workClass, contractVersion: 1 })).resolves.toBe(true);
    }
    await expect(evidence.exists({ workClass: 'implementation', contractVersion: 1 })).resolves.toBe(false);
  });
});
