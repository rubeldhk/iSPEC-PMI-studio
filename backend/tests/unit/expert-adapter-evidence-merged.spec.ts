/**
 * `T2544` (EPIC-047 Convergence) — Evidence Contracts through the merged
 * `EPIC-032` catalogue. Supersedes `T1979`.
 *
 * `R-047-11`, `FR-EXP-022`. The catalogue's `get` is synchronous and answers
 * `null` for an absent version: `null` is `false`, a found contract `true`,
 * and a catalogue that throws propagates — it is never read as "absent".
 */
import { describe, expect, it } from 'vitest';
import { evidenceContracts } from '../../src/modules/experts/adapters/evidence.adapter.js';

const catalog = (known: Record<string, object>) => ({
  get: (workClass: string, version: number) => known[`${workClass}@${version}`] ?? null,
});

describe('T2544 · Evidence Contracts over EPIC-032', () => {
  it('a contract the catalogue holds exists', async () => {
    await expect(
      evidenceContracts(catalog({ 'implementation@1': { workClass: 'implementation' } })).exists({
        workClass: 'implementation',
        contractVersion: 1,
      }),
    ).resolves.toBe(true);
  });

  it('a null answer is false', async () => {
    await expect(evidenceContracts(catalog({})).exists({ workClass: 'implementation', contractVersion: 2 })).resolves.toBe(false);
  });

  it('a catalogue that throws propagates', async () => {
    const broken = {
      get: () => {
        throw new Error('catalogue failed to load');
      },
    };
    await expect(evidenceContracts(broken).exists({ workClass: 'implementation', contractVersion: 1 })).rejects.toThrow(
      /failed to load/,
    );
  });
});
