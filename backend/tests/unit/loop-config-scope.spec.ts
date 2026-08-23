/**
 * T943 — the programme/tenant split. `FR-GEL-009`, `SC-GEL-010`, clarified
 * 2026-08-22.
 *
 * `SC-GEL-010`: *"zero loop configuration changes take effect without authorized
 * human approval, under any tenant policy — verified by enumerating the tenant
 * configuration surface."* This file is that enumeration: `stages` is the one
 * field a tenant could reach that changes what the loop DOES, and every way of
 * changing it — remove, add, reorder — is refused.
 *
 * Two halves of one configuration, and only one of them is a tenant's to write:
 *
 *   - **programme** — `stages`, in `packages/loop-contract/workflows/<type>.json`;
 *   - **tenant** — authorities, required gates and trigger rules, in the
 *     `loop_instance_configurations` row.
 *
 * The clarification settled what happens when they disagree: the tenant row is
 * **refused**, not merged and not preferred. It matters because the failure is
 * otherwise invisible and severe. A tenant able to write `stages` could remove
 * `Decide` from a workflow type that is supposed to have one, and every
 * remaining check would pass — the loop would run, transitions would be
 * recorded, gates would evaluate, and nobody would decide anything.
 *
 * Refusing is not a limitation on tenants. It is what makes *"governed workflow
 * type"* mean the same thing in every tenant.
 */
import { describe, expect, it } from 'vitest';
import { LOOP_STAGES } from '@pmi/loop-contract';
import { LoopConfigError, loadLoopConfig } from '../../src/modules/loop/loop-config.loader.js';

const HANDLED = [...LOOP_STAGES];

const PROGRAMME = {
  schemaVersion: 1,
  workflowType: 'scoped-type',
  stages: ['Event', 'Analyze', 'Decide', 'Outcome'],
  transitions: [{ from: 'Analyze', to: 'Decide', requiredGates: ['g'], trigger: null }],
  approvedBy: 'u', approvalRef: 'c',
};

describe('T943 · a tenant row that agrees loads', () => {
  it('accepts identical stages', () => {
    const config = loadLoopConfig(PROGRAMME, {
      registeredStages: HANDLED,
      tenantStages: ['Event', 'Analyze', 'Decide', 'Outcome'],
    });
    expect(config.stages).toEqual(['Event', 'Analyze', 'Decide', 'Outcome']);
  });

  it('accepts no tenant row at all — the programme file stands alone', () => {
    expect(() => loadLoopConfig(PROGRAMME, { registeredStages: HANDLED })).not.toThrow();
  });
});

describe('FR-GEL-009 · a tenant row whose stages differ is refused', () => {
  it('refuses a tenant that REMOVES a stage', () => {
    // The one that matters: dropping `Decide` from a governed workflow.
    expect(() =>
      loadLoopConfig(PROGRAMME, {
        registeredStages: HANDLED,
        tenantStages: ['Event', 'Analyze', 'Outcome'],
      }),
    ).toThrow(LoopConfigError);
  });

  it('refuses a tenant that ADDS a stage', () => {
    expect(() =>
      loadLoopConfig(PROGRAMME, {
        registeredStages: HANDLED,
        tenantStages: ['Event', 'Analyze', 'Decide', 'Evidence', 'Outcome'],
      }),
    ).toThrow(LoopConfigError);
  });

  it('refuses a tenant that REORDERS the stages', () => {
    // Same set, different loop. The order is the model (FR-GEL-002), and a
    // set-equality check would have let this through.
    expect(() =>
      loadLoopConfig(PROGRAMME, {
        registeredStages: HANDLED,
        tenantStages: ['Event', 'Decide', 'Analyze', 'Outcome'],
      }),
    ).toThrow(LoopConfigError);
  });

  it('says why, naming the rule rather than reporting a mismatch', () => {
    try {
      loadLoopConfig(PROGRAMME, { registeredStages: HANDLED, tenantStages: ['Event'] });
      throw new Error('expected a refusal');
    } catch (error) {
      expect((error as LoopConfigError).violations.join(' ')).toMatch(
        /stages are programme-defined and not tenant-writable/,
      );
    }
  });

  it('does not silently prefer either side', () => {
    // The two wrong fixes: taking the tenant's stages (a tenant rewriting the
    // model) or taking the programme's and ignoring the disagreement (a tenant
    // configuration that does something other than what it says). Neither
    // loads.
    expect(() =>
      loadLoopConfig(PROGRAMME, { registeredStages: HANDLED, tenantStages: ['Event', 'Outcome'] }),
    ).toThrow(LoopConfigError);
  });
});
