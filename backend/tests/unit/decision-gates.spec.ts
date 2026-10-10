/**
 * T776 — gate resolution. `FR-DPE-013`, `SC-DPE-006`, `ADR-0025` constraint 2.
 *
 * An unsatisfied required gate resolves to **refuse** or to
 * **proceed-under-recorded-exception**. `satisfied` is reachable only by a gate
 * provider returning it — never by omission: a gate with no provider, a
 * provider that throws, or a provider that answers for a different gate all
 * resolve to `violation`. `T784`'s mutation proof targets this file.
 */
import { describe, expect, it } from 'vitest';
import type { GateProvider } from '@pmi/decision-contract';
import { engine, gates, request, rules } from '../helpers/decision-engine.js';

const medium = rules([{ actionPattern: 'deploy', band: 'medium' }]);

describe('T776 · FR-DPE-013 — satisfied is unreachable by omission', () => {
  it('resolves every required gate to violation when no GateProvider is bound, and refuses', async () => {
    const { engine: e } = engine({ steering: medium, gates: null });
    const result = await e.decide(request({ requiredGates: ['g1', 'g2'] }));
    expect(result.outcome).toBe('refused');
    expect(result.gateOutcomes).toEqual([
      expect.objectContaining({ gateId: 'g1', result: 'violation' }),
      expect.objectContaining({ gateId: 'g2', result: 'violation' }),
    ]);
  });

  it('resolves a provider that throws to violation', async () => {
    const throwing: GateProvider = { evaluate: async () => { throw new Error('down'); } };
    const { engine: e } = engine({ steering: medium, gates: throwing });
    expect((await e.decide(request({ requiredGates: ['g1'] }))).gateOutcomes[0]!.result).toBe('violation');
  });

  it('does not accept an answer for a different gate', async () => {
    const liar: GateProvider = { evaluate: async () => ({ gateId: 'other', result: 'satisfied' }) };
    const { engine: e } = engine({ steering: medium, gates: liar });
    const result = await e.decide(request({ requiredGates: ['g1'] }));
    expect(result.gateOutcomes[0]).toMatchObject({ gateId: 'g1', result: 'violation' });
    expect(result.outcome).toBe('refused');
  });

  it('refuses when any one required gate is not satisfied, and names it', async () => {
    const { engine: e } = engine({ steering: medium, gates: gates({ g1: 'satisfied', g2: 'refused' }) });
    const result = await e.decide(request({ requiredGates: ['g1', 'g2'] }));
    expect(result.outcome).toBe('refused');
    expect(result.explanation.authorityApplied).toMatch(/g2/);
  });

  it('approves only when every required gate reports satisfied', async () => {
    const { engine: e } = engine({ steering: medium, gates: gates({ g1: 'satisfied', g2: 'satisfied' }) });
    expect((await e.decide(request({ requiredGates: ['g1', 'g2'] }))).outcome).toBe('approved');
  });

  it('applies required gates to a low-band auto-execution too — a gate is a gate', async () => {
    const { engine: e } = engine({ steering: rules([{ actionPattern: 'deploy', band: 'low' }]), gates: gates({}) });
    expect((await e.decide(request({ requiredGates: ['g1'] }))).outcome).toBe('refused');
  });
});
