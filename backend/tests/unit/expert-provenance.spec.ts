/**
 * `T2023` (EPIC-047) — amendment `A-047-2`: which Expert ran an execution.
 *
 * `FR-EXP-064`. `EPIC-048`'s `ExpertProvenance` port asks, for an execution,
 * whether it is an Expert session and, if so, which Expert and contract version
 * ran it and that version's memory policy — the policy decides whether the
 * Expert may submit learning. The answer is the version the session **started**
 * under (`FR-EXP-062`), read from the record every time; an execution that is
 * not an Expert session, or is in another workspace, reads `null`.
 */
import { describe, expect, it } from 'vitest';
import { expertProvenance } from '../../src/modules/experts/provenance.js';
import { ACTOR, ask, world } from '../helpers/expert-dispatch.js';
import { contract, version } from '../helpers/expert-fixtures.js';

describe('T2023 · ExpertProvenance.forExecution (A-047-2)', () => {
  it('answers which Expert and contract version ran an execution, with its memory policy', async () => {
    const w = await world();
    await w.service.dispatch(ACTOR, ask());
    await expect(expertProvenance(w.store).forExecution('ws_1', 'exe_1')).resolves.toEqual({
      expertId: 'ex_test',
      contractVersionId: 'cv_1',
      contractVersion: 1,
      memoryPolicy: 'none',
    });
  });

  it('reports governed-knowledge when the version it ran under declares it', async () => {
    const w = await world({ contract: contract({ memoryPolicy: 'governed-knowledge' }) });
    await w.service.dispatch(ACTOR, ask());
    expect((await expertProvenance(w.store).forExecution('ws_1', 'exe_1'))?.memoryPolicy).toBe('governed-knowledge');
  });

  it('keeps answering with the version the session started under after a later one is approved', async () => {
    const w = await world();
    await w.service.dispatch(ACTOR, ask());
    await w.store.addVersion(version({ id: 'cv_2', version: 2, contract: contract({ memoryPolicy: 'governed-knowledge' }), decisionId: 'd_2' }));
    w.approvals.resolve('d_2', 'approved');
    expect(await expertProvenance(w.store).forExecution('ws_1', 'exe_1')).toMatchObject({ contractVersion: 1, memoryPolicy: 'none' });
  });

  it('an execution that is not an Expert session, or is in another workspace, reads null', async () => {
    const w = await world();
    await w.service.dispatch(ACTOR, ask());
    const provenance = expertProvenance(w.store);
    await expect(provenance.forExecution('ws_1', 'exe_unknown')).resolves.toBeNull();
    await expect(provenance.forExecution('ws_2', 'exe_1')).resolves.toBeNull();
  });
});
