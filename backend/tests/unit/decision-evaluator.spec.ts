/**
 * T745 — band treatment, written to fail first. `FR-DPE-010`, `R-031-2`.
 *
 * **Low** MAY auto-execute where policy permits; **medium** requires gates;
 * **high** requires an authorized human — so a high-band request waits,
 * `pending`, until one approves it. Default deny throughout: anything the
 * policy does not permit is refused, and the refusal explains itself.
 */
import { describe, expect, it } from 'vitest';
import { engine, gates, policy, request, rules } from '../helpers/decision-engine.js';

describe('T745 · FR-DPE-010 — low may auto-execute', () => {
  it('auto-executes a low-band action the policy treats as auto-execute', async () => {
    const { engine: e } = engine({ steering: rules([{ actionPattern: 'deploy', band: 'low' }]) });
    await expect(e.decide(request())).resolves.toMatchObject({ outcome: 'auto-executed', effectiveClass: 'low' });
  });

  it('holds a low-band action for a human when the tenant tightened low to human-approval', async () => {
    const { engine: e } = engine({
      steering: rules([{ actionPattern: 'deploy', band: 'low' }]),
      policies: policy({ bandTreatment: { low: 'human-approval', medium: 'gates-required', high: 'human-approval' } }),
    });
    await expect(e.decide(request())).resolves.toMatchObject({ outcome: 'pending', effectiveClass: 'low' });
  });
});

describe('T745 · FR-DPE-010 — medium requires gates', () => {
  const medium = rules([{ actionPattern: 'deploy', band: 'medium' }]);

  it('approves when every required gate is satisfied', async () => {
    const { engine: e } = engine({ steering: medium, gates: gates({ 'tests-green': 'satisfied' }) });
    await expect(e.decide(request({ requiredGates: ['tests-green'] }))).resolves.toMatchObject({
      outcome: 'approved',
      effectiveClass: 'medium',
    });
  });

  it('refuses a medium action that names no gate at all — gates-required with none is not a pass', async () => {
    const { engine: e } = engine({ steering: medium });
    const result = await e.decide(request());
    expect(result.outcome).toBe('refused');
    expect(result.explanation.authorityApplied).toMatch(/requires at least one gate/);
  });
});

describe('T745 · FR-DPE-010 — high requires an authorized human', () => {
  it('waits for a human — pending — even when a human asks', async () => {
    const { engine: e } = engine();
    await expect(e.decide(request({ actionType: 'release.promote' }))).resolves.toMatchObject({
      outcome: 'pending',
      effectiveClass: 'high',
    });
  });

  it('is approved when a different human approves it', async () => {
    const { engine: e } = engine();
    const pending = await e.decide(request({ actionType: 'release.promote' }));
    const approved = await e.approve({
      workspaceId: 'ws_dpe',
      decisionId: pending.decisionId,
      approver: { kind: 'human', id: 'u_approver' },
    });
    expect(approved).toMatchObject({ outcome: 'approved', effectiveClass: 'high' });
  });

  it('refuses approval by automation, however the request arrived', async () => {
    const { engine: e } = engine();
    const pending = await e.decide(request({ actionType: 'release.promote' }));
    await expect(
      e.approve({ workspaceId: 'ws_dpe', decisionId: pending.decisionId, approver: { kind: 'automation', id: 'bot' } }),
    ).resolves.toMatchObject({ outcome: 'refused' });
  });

  it('refuses a second resolution of the same pending decision', async () => {
    const { engine: e } = engine();
    const pending = await e.decide(request({ actionType: 'release.promote' }));
    await e.approve({ workspaceId: 'ws_dpe', decisionId: pending.decisionId, approver: { kind: 'human', id: 'u_a' } });
    await expect(
      e.approve({ workspaceId: 'ws_dpe', decisionId: pending.decisionId, approver: { kind: 'human', id: 'u_b' } }),
    ).rejects.toThrow(/already resolved/);
  });
});

describe('T746 · R-031-2 — no skip-on-error: an erroring source refuses', () => {
  it('refuses when the steering source throws, and says so', async () => {
    const { engine: e } = engine({ steering: { rulesetFor: async () => { throw new Error('steering down'); } } });
    const result = await e.decide(request());
    expect(result.outcome).toBe('refused');
    expect(result.explanation.constraintCited).toMatch(/FR-DPE-050/);
  });
});
