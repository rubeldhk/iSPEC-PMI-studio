/**
 * `T1933` (EPIC-047) — what must hold before an Expert may be asked to run.
 *
 * `FR-EXP-006`, `FR-EXP-019`, `FR-EXP-022`, `R-047-3`, analysis finding C4. A
 * retired Expert, an Expert with no approved version, a command that is not a
 * governed one, and an Evidence Contract that no longer exists — each refused
 * naming the reason, before anything executes.
 */
import { describe, expect, it } from 'vitest';
import { NotFoundError, ValidationFailedError } from '../../src/core/errors.js';
import { ACTOR, ask, world } from '../helpers/expert-dispatch.js';
import { evidenceKnowing } from '../helpers/expert-fixtures.js';

async function refusal(attempt: Promise<unknown>): Promise<ValidationFailedError> {
  try {
    await attempt;
  } catch (error) {
    return error as ValidationFailedError;
  }
  throw new Error('expected a refusal');
}

describe('T1933 · dispatch preconditions', () => {
  it('an unknown Expert is not found', async () => {
    const w = await world();
    await expect(w.service.dispatch(ACTOR, ask({ expertId: 'nope' }))).rejects.toBeInstanceOf(NotFoundError);
  });

  it('a retired Expert is refused', async () => {
    const w = await world();
    await w.store.retireExpert('ws_1', 'ex_test', 'u_1', '2026-10-09T10:00:00.000Z');
    expect((await refusal(w.service.dispatch(ACTOR, ask()))).message).toMatch(/retired/);
    expect(w.preferred.runs).toHaveLength(0);
  });

  it('an Expert with no approved version is refused', async () => {
    const w = await world();
    w.approvals.resolve('d_ok', 'refused');
    expect((await refusal(w.service.dispatch(ACTOR, ask()))).message).toMatch(/no approved contract version/);
  });

  it('a command outside the governed set is refused', async () => {
    const w = await world();
    const e = await refusal(w.service.dispatch(ACTOR, ask({ command: 'deploy' })));
    expect(e.message).toMatch(/deploy.*governed command/);
  });

  it('an Evidence Contract retired since approval refuses new runs (analysis C4)', async () => {
    const w = await world();
    w.ports.evidence = evidenceKnowing('implementation@2');
    expect((await refusal(w.service.dispatch(ACTOR, ask()))).message).toMatch(/Evidence Contract implementation@1/);
    expect(w.preferred.runs).toHaveLength(0);
  });

  it('a blank objective or project is refused before anything is registered', async () => {
    const w = await world();
    await expect(w.service.dispatch(ACTOR, ask({ objective: '  ' }))).rejects.toBeInstanceOf(ValidationFailedError);
    await expect(w.service.dispatch(ACTOR, ask({ projectId: '' }))).rejects.toBeInstanceOf(ValidationFailedError);
    expect(w.executions.registered).toHaveLength(0);
  });
});
