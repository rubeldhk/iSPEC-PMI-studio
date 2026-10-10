/**
 * `T1919` (EPIC-047) — a contract may not point at something that is not there.
 *
 * `FR-EXP-022`. An Evidence Contract that does not exist cannot be satisfied,
 * so a run under it could never complete honestly; a delegate key that names
 * no Expert is a delegation nobody can receive. Both are named. And while
 * `EPIC-032` is unbound the reference cannot be checked — so the contract is
 * refused `503`, never accepted unchecked.
 */
import { describe, expect, it } from 'vitest';
import { GovernanceSeamUnboundError, ValidationFailedError } from '../../src/core/errors.js';
import { checkReferences } from '../../src/modules/experts/contract.validation.js';
import { InMemoryExpertsStore } from '../../src/modules/experts/experts.store.js';
import { refusingEvidenceContracts } from '../../src/modules/experts/experts.tokens.js';
import { contract, evidenceKnowing, expert } from '../helpers/expert-fixtures.js';

describe('T1919 · dangling references', () => {
  it('accepts references that resolve', async () => {
    const store = new InMemoryExpertsStore();
    await store.addExpert(expert({ id: 'ex_rev', key: 'reviewer' }));
    await expect(
      checkReferences('ws_1', contract({ delegatesTo: ['reviewer'] }), {
        evidence: evidenceKnowing('implementation@1'),
        store,
      }),
    ).resolves.toBeUndefined();
  });

  it('names an unknown Evidence Contract', async () => {
    const e = await checkReferences('ws_1', contract(), {
      evidence: evidenceKnowing('implementation@2'),
      store: new InMemoryExpertsStore(),
    }).catch((x: unknown) => x as ValidationFailedError);
    expect(e).toBeInstanceOf(ValidationFailedError);
    expect((e as Error).message).toMatch(/implementation@1/);
  });

  it('names each unknown delegate, and only looks in this workspace', async () => {
    const store = new InMemoryExpertsStore();
    await store.addExpert(expert({ id: 'ex_elsewhere', key: 'reviewer', workspaceId: 'ws_2' }));
    const e = await checkReferences('ws_1', contract({ delegatesTo: ['reviewer', 'architect'] }), {
      evidence: evidenceKnowing('implementation@1'),
      store,
    }).catch((x: unknown) => x as ValidationFailedError);
    expect((e as Error).message).toMatch(/reviewer/);
    expect((e as Error).message).toMatch(/architect/);
  });

  it('refuses 503 while EPIC-032 is unbound, rather than accepting unchecked', async () => {
    await expect(
      checkReferences('ws_1', contract(), { evidence: refusingEvidenceContracts(), store: new InMemoryExpertsStore() }),
    ).rejects.toBeInstanceOf(GovernanceSeamUnboundError);
  });
});
