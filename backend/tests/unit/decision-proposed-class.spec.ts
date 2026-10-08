/**
 * T771 — an AI may propose a class and may never assign one. `FR-DPE-003`,
 * `SC-DPE-003`, `ADR-0025` (*policy-declared, not model-inferred*).
 *
 * The effective class comes from policy. A proposal is **retained separately**
 * and never merged into it — however confident, however it is phrased.
 */
import { describe, expect, it } from 'vitest';
import { engine, request, rules } from '../helpers/decision-engine.js';

describe('T771 · FR-DPE-003 — proposing is not assigning', () => {
  it('ignores a proposal of low for an action policy classifies high', async () => {
    const { engine: e, repository } = engine({ steering: rules([{ actionPattern: 'deploy', band: 'high' }]) });
    const result = await e.decide(request({ proposedClass: 'low' }));
    expect(result.effectiveClass).toBe('high');
    const stored = await repository.get('ws_dpe', result.decisionId);
    expect(stored).toMatchObject({ effectiveClass: 'high', proposedClass: 'low' });
  });

  it('ignores a proposal of high for an action policy classifies low — the proposal is not a ratchet either', async () => {
    const { engine: e } = engine({ steering: rules([{ actionPattern: 'deploy', band: 'low' }]) });
    expect((await e.decide(request({ proposedClass: 'high' }))).effectiveClass).toBe('low');
  });

  it('records no proposal where none was made', async () => {
    const { engine: e, repository } = engine({ steering: rules([{ actionPattern: 'deploy', band: 'low' }]) });
    const result = await e.decide(request());
    expect((await repository.get('ws_dpe', result.decisionId))!.proposedClass).toBeNull();
  });
});
