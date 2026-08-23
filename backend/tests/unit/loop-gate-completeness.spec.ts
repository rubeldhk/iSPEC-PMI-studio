/**
 * T967 — a declared gate with no recorded outcome makes the transition
 * unsatisfiable. `FR-GEL-021`, `BR-0060`, `SC-GEL-005`.
 *
 * The failure this catches is an **absence**, and absences do not throw.
 *
 * A gate declared in the configuration; a `GateProvider` that returns nothing
 * for it — unreachable, misconfigured, quietly renamed; and the natural check,
 * `outcomes.every(g => g.result === 'satisfied')`. Every gate that *answered* is
 * satisfied, so the transition proceeds, and the gate nobody evaluated is the
 * one that mattered. Nothing in that sequence is a bug anyone typed.
 *
 * So the evaluator starts from the **declared** gates rather than the returned
 * outcomes, and the assertions below are mostly about what happens when the
 * provider says less than it was asked.
 */
import { describe, expect, it } from 'vitest';
import type { GateOutcome } from '@pmi/loop-contract';
import { evaluateGates } from '../../src/modules/loop/gate-evaluator.js';

const satisfied = (gateId: string): GateOutcome => ({ gateId, result: 'satisfied' });

describe('T967 · every declared gate satisfied lets the transition through', () => {
  it('passes when all are satisfied', () => {
    const evaluation = evaluateGates({
      declared: ['g1', 'g2'],
      reported: [satisfied('g1'), satisfied('g2')],
    });
    expect(evaluation.passed).toBe(true);
    expect(evaluation.blocking).toBeUndefined();
  });

  it('passes a transition with no declared gates', () => {
    // "No gates" is a legitimate configuration (FR-GEL-020 makes the empty array
    // explicit). It must not be confused with "gates nobody evaluated".
    expect(evaluateGates({ declared: [], reported: [] }).passed).toBe(true);
  });
});

describe('BR-0060 · a gate that never ran is a violation, not a pass', () => {
  it('resolves a declared gate with no reported outcome to violation', () => {
    const evaluation = evaluateGates({ declared: ['g1', 'g2'], reported: [satisfied('g1')] });
    expect(evaluation.passed).toBe(false);
    expect(evaluation.blocking?.gateId).toBe('g2');
    expect(evaluation.blocking?.result).toBe('violation');
  });

  it('returns one outcome per DECLARED gate, never fewer', () => {
    // The structural guarantee. A caller counting outcomes gets the number of
    // gates that were required, not the number that answered — so `every()` over
    // this array cannot be fooled by a short list.
    const evaluation = evaluateGates({ declared: ['g1', 'g2', 'g3'], reported: [satisfied('g1')] });
    expect(evaluation.outcomes).toHaveLength(3);
    expect(evaluation.outcomes.map((o) => o.gateId)).toEqual(['g1', 'g2', 'g3']);
  });

  it('resolves EVERY gate to violation when the provider returned nothing at all', () => {
    // The unreachable-provider case, which is the one most likely to happen in
    // production and least likely to be noticed in a test.
    const evaluation = evaluateGates({ declared: ['g1', 'g2'], reported: [] });
    expect(evaluation.outcomes.every((o) => o.result === 'violation')).toBe(true);
    expect(evaluation.passed).toBe(false);
  });

  it('says the gate was never evaluated, rather than reporting a generic failure', () => {
    const evaluation = evaluateGates({ declared: ['g1'], reported: [] });
    expect(evaluation.outcomes[0]?.detail).toMatch(/never evaluated/);
  });

  it('ignores an outcome for a gate the transition did not declare', () => {
    // A provider answering about `g9` does not make `g1` evaluated. Reading the
    // reported list would have let this pass.
    const evaluation = evaluateGates({ declared: ['g1'], reported: [satisfied('g9')] });
    expect(evaluation.passed).toBe(false);
    expect(evaluation.outcomes).toHaveLength(1);
    expect(evaluation.outcomes[0]?.gateId).toBe('g1');
  });

  it('refuses a result outside the four members', () => {
    // A provider returning `'skipped'` must not be read as anything at all —
    // GATE_RESULTS has four members precisely so a fifth is unrepresentable, and
    // JSON does not respect that.
    const evaluation = evaluateGates({
      declared: ['g1'],
      reported: [{ gateId: 'g1', result: 'skipped' as never }],
    });
    expect(evaluation.outcomes[0]?.result).toBe('violation');
    expect(evaluation.outcomes[0]?.detail).toMatch(/not a GateResult/);
  });
});

describe('FR-GEL-021 · refused and violation both stop the transition', () => {
  it.each(['refused', 'violation'] as const)('blocks on %s', (result) => {
    const evaluation = evaluateGates({ declared: ['g1'], reported: [{ gateId: 'g1', result }] });
    expect(evaluation.passed).toBe(false);
    expect(evaluation.blocking?.result).toBe(result);
  });

  it('blocks on an exception too — it is a departure, not a pass', () => {
    // An exception lets a HUMAN decide to proceed; it does not make the gate
    // satisfied. The transition writer records it as `exception` rather than
    // `accepted`, which is what keeps SC-GEL-005 measurable.
    const evaluation = evaluateGates({
      declared: ['g1'],
      reported: [],
      exceptions: [{ gateId: 'g1', authorizedBy: 'u_lead', reason: 'hotfix window' }],
    });
    expect(evaluation.passed).toBe(false);
    expect(evaluation.blocking?.result).toBe('exception');
  });

  it('reports the FIRST blocking gate, in declaration order', () => {
    const evaluation = evaluateGates({
      declared: ['g1', 'g2', 'g3'],
      reported: [satisfied('g1'), { gateId: 'g2', result: 'refused' }, { gateId: 'g3', result: 'violation' }],
    });
    expect(evaluation.blocking?.gateId).toBe('g2');
  });
});

describe('SC-GEL-005 · the writer refuses a transition whose declared gate never ran', () => {
  // The evaluator can be right and the writer can still ask it the wrong
  // question. This asserts the wiring: the writer must evaluate the gates the
  // CONFIGURATION declares, not the ones the caller handed it.
  it('refuses when the caller reports no outcome for a declared gate', async () => {
    const { loadLoopConfig } = await import('../../src/modules/loop/loop-config.loader.js');
    const { InMemoryLoopStore } = await import('../../src/modules/loop/loop.store.js');
    const { TransitionWriter } = await import('../../src/modules/loop/transition-writer.js');
    const { LOOP_STAGES } = await import('@pmi/loop-contract');

    const config = loadLoopConfig(
      {
        schemaVersion: 1,
        workflowType: 'gated-type',
        stages: ['Event', 'Decide', 'Outcome'],
        transitions: [{ from: 'Event', to: 'Decide', requiredGates: ['must-review'], trigger: null }],
        approvedBy: 'u', approvalRef: 'c',
      },
      { registeredStages: [...LOOP_STAGES] },
    );

    const store = new InMemoryLoopStore();
    const object = await store.createObject({
      workspaceId: 'ws', projectId: 'p', workflowType: 'gated-type', configVersion: 1,
      subjectType: 'o', subjectId: 's', currentStage: 'Event',
    });

    // A caller with full authority and an EMPTY gate list — the shape a
    // misconfigured provider produces.
    const result = await new TransitionWriter(store).write({
      object,
      config,
      authorities: { 'Event->Decide': ['lead'] },
      toStage: 'Decide',
      expectedVersion: 0,
      actor: { kind: 'human', id: 'u_1', authorities: ['lead'] },
      gates: [],
    });

    expect(result.outcome).toBe('violation');
    expect(result.detail).toMatch(/must-review/);
    expect(result.detail).toMatch(/never evaluated/);
    expect((await store.findObject(object.id))?.currentStage).toBe('Event');

    // And the record carries the evaluated outcome, not the empty list the
    // caller passed — otherwise FR-GEL-022 would report nothing.
    const [row] = await store.transitionsFor(object.id);
    expect(row?.gateOutcomes).toHaveLength(1);
  });
});
