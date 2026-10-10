/**
 * `T2016` (EPIC-047) — amendment `A-047-1`: `memoryPolicy: governed-knowledge`.
 *
 * `FR-EXP-020` (amended 2026-10-09 for `EPIC-048`). A contract may now declare
 * `governed-knowledge`: the Expert may submit learning candidates to Governed
 * Learning and receive approved knowledge only through context. It grants no
 * private memory. Until `EPIC-048` exists, such a contract must validate and be
 * approvable — and nothing here does any learning: a `governed-knowledge`
 * Expert is dispatched exactly as a `none` one is. Any other value is still
 * refused, naming Governed Learning.
 */
import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../src/core/errors.js';
import { Authoring } from '../../src/modules/experts/authoring.js';
import { validateContract } from '../../src/modules/experts/contract.validation.js';
import { MEMORY_POLICIES } from '../../src/modules/experts/expert.types.js';
import { InMemoryExpertsStore } from '../../src/modules/experts/experts.store.js';
import { RegistryService } from '../../src/modules/experts/registry.service.js';
import { ACTOR, ask, world } from '../helpers/expert-dispatch.js';
import { authorOfWs1, contract, evidenceKnowing, recordingApprovals } from '../helpers/expert-fixtures.js';

const governed = () => ({ ...contract(), memoryPolicy: 'governed-knowledge' as const });

describe('T2016 · memoryPolicy governed-knowledge (A-047-1)', () => {
  it('the memory policy admits exactly none and governed-knowledge', () => {
    expect(MEMORY_POLICIES).toEqual(['none', 'governed-knowledge']);
  });

  it('a contract declaring governed-knowledge validates', () => {
    expect(validateContract(governed()).memoryPolicy).toBe('governed-knowledge');
  });

  it('any other value is still refused, naming both accepted values and Governed Learning', () => {
    let error: unknown;
    try {
      validateContract({ ...contract(), memoryPolicy: 'session' });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ValidationFailedError);
    expect((error as Error).message).toMatch(/'none' or 'governed-knowledge'/);
    expect((error as Error).message).toMatch(/Governed Learning/);
    expect((error as Error).message).toMatch(/no private memory/i);
  });

  it('a governed-knowledge contract registers, is submitted, and reads approved once its decision is', async () => {
    const store = new InMemoryExpertsStore();
    const approvals = recordingApprovals();
    let n = 0;
    const registry = new RegistryService(store, {
      authoring: new Authoring(authorOfWs1()),
      approvals,
      evidence: evidenceKnowing('implementation@1'),
      clock: () => '2026-10-09T09:00:00.000Z',
      ids: () => `id_${(n += 1)}`,
    });
    const created = await registry.register('ws_1', 'u_1', { key: 'learner', name: 'Learner', contract: governed() });
    const submitted = await registry.submit('ws_1', 'u_1', created.expert.id, 1);
    expect(submitted.status).toBe('submitted');
    approvals.resolve(submitted.decisionId!, 'approved');
    const view = await registry.get('ws_1', 'u_1', created.expert.id);
    expect(view.effectiveVersion?.contract.memoryPolicy).toBe('governed-knowledge');
  });

  it('dispatching a governed-knowledge Expert asks context for exactly what a none Expert’s does', async () => {
    const none = await world();
    await none.service.dispatch(ACTOR, ask());
    const learning = await world({ contract: governed() });
    await learning.service.dispatch(ACTOR, ask());
    expect(learning.context.assembled).toEqual(none.context.assembled);
    expect(learning.executions.kindsFor('exe_1')).toEqual(none.executions.kindsFor('exe_1'));
  });
});
