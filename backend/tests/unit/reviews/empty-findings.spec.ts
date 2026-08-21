/**
 * T283 — empty findings is a PASS, distinguishable from a failed call
 * (contract rule E-R4, case C-17) — the deliberate divergence from the base
 * contract's empty-output rule, and the most likely place to implement it
 * wrongly. Written to FAIL before T285 exists (Constitution V).
 */
import { describe, expect, it } from 'vitest';
import { engineFail, engineOk, type EngineDescriptor } from '@pmi/engine-contract';
import {
  GateExecutionService,
} from '../../../src/modules/reviews/gate-execution.service.js';
import { roleByName } from '../../../src/modules/reviews/roles.js';

const GATE = {
  id: 'g1',
  workspaceId: 'ws_a',
  transition: 'review->approved',
  requiredRoles: ['security-reviewer', 'qa-agent'],
  blocking: true,
};

const DESCRIPTOR: EngineDescriptor = {
  name: 'stub-reviewer',
  version: '1.0.0',
  capabilities: ['generate_specification', 'generate_tasks', 'validate_specification', 'review_specification'],
};

function engineReturning(byRole: Record<string, unknown>): {
  reviewSpecification: (input: { role: { name: string } }) => Promise<unknown>;
  descriptor: typeof DESCRIPTOR;
} {
  return {
    descriptor: DESCRIPTOR,
    reviewSpecification: async (input: { role: { name: string } }) => {
      const scripted = byRole[input.role.name];
      if (scripted instanceof Error) throw scripted;
      return scripted;
    },
  };
}

describe('T283 · E-R4 / C-17 — a review that finds nothing PASSES', () => {
  it('every role returns empty findings → the gate passes with zero findings', async () => {
    const engine = engineReturning({
      'security-reviewer': engineOk({ findings: [] }, DESCRIPTOR),
      'qa-agent': engineOk({ findings: [] }, DESCRIPTOR),
    });
    const outcome = await new GateExecutionService().execute(
      GATE as never,
      { specification: '# Spec\n\nBody.', roles: GATE.requiredRoles.map(roleByName) },
      engine as never,
    );
    expect(outcome.gateFailed).toBe(false);
    expect(outcome.findings).toEqual([]);
    expect(outcome.rolesRun.map((r) => r.roleId).sort()).toEqual(['qa-agent', 'security-reviewer']);
    expect(outcome.rolesRun.every((r) => r.status === 'completed')).toBe(true);
  });

  it('empty findings is DISTINGUISHABLE from a failed call — one of each is a failed gate with the pass recorded', async () => {
    const engine = engineReturning({
      'security-reviewer': engineOk({ findings: [] }, DESCRIPTOR),
      'qa-agent': engineFail('engine_error', 'model refused'),
    });
    const outcome = await new GateExecutionService().execute(
      GATE as never,
      { specification: '# Spec\n\nBody.', roles: GATE.requiredRoles.map(roleByName) },
      engine as never,
    );
    expect(outcome.gateFailed).toBe(true);
    const security = outcome.rolesRun.find((r) => r.roleId === 'security-reviewer');
    const qa = outcome.rolesRun.find((r) => r.roleId === 'qa-agent');
    expect(security?.status).toBe('completed');
    expect(qa?.status).toBe('failed');
    expect(qa?.reason).toBe('engine_error');
  });
});
