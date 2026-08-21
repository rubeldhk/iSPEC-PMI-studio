/**
 * T284 — an unavailable or malformed reviewing role FAILS the gate, never a
 * pass (FR-ENH-016, contract rule E-R3, case C-19). Written to FAIL before
 * T285 exists (Constitution V).
 */
import { describe, expect, it } from 'vitest';
import { engineFail, engineOk, type EngineDescriptor } from '@pmi/engine-contract';
import { GateExecutionService } from '../../../src/modules/reviews/gate-execution.service.js';
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

function run(byRole: Record<string, unknown>) {
  const engine = {
    descriptor: DESCRIPTOR,
    reviewSpecification: async (input: { role: { name: string } }) => byRole[input.role.name],
  };
  return new GateExecutionService().execute(
    GATE as never,
    { specification: '# Spec\n\nBody.', roles: GATE.requiredRoles.map(roleByName) },
    engine as never,
  );
}

describe('T284 · E-R3 / C-19 — unavailable is failure, never a pass', () => {
  it('an unavailable role fails the gate, named', async () => {
    const outcome = await run({
      'security-reviewer': engineFail('engine_unavailable', 'sandbox down'),
      'qa-agent': engineOk({ findings: [] }, DESCRIPTOR),
    });
    expect(outcome.gateFailed).toBe(true);
    expect(outcome.failedRoles).toEqual(['security-reviewer']);
    const failed = outcome.rolesRun.find((r) => r.roleId === 'security-reviewer');
    expect(failed?.status).toBe('failed');
    expect(failed?.reason).toBe('engine_unavailable');
  });

  it('MALFORMED output (finding without location) fails that role — treated as unavailability', async () => {
    const outcome = await run({
      'security-reviewer': engineOk(
        { findings: [{ location: '', severity: 'error', message: 'where?' }] },
        DESCRIPTOR,
      ),
      'qa-agent': engineOk({ findings: [] }, DESCRIPTOR),
    });
    expect(outcome.gateFailed).toBe(true);
    const failed = outcome.rolesRun.find((r) => r.roleId === 'security-reviewer');
    expect(failed?.status).toBe('failed');
    expect(failed?.reason).toBe('malformed_output');
    // NOTHING from the malformed result is stored (E-R2).
    expect(outcome.findings).toEqual([]);
  });

  it('an engine with NO reviewSpecification fails every role with the capability named', async () => {
    const engine = { descriptor: { ...DESCRIPTOR, capabilities: DESCRIPTOR.capabilities.slice(0, 3) } };
    const outcome = await new GateExecutionService().execute(
      GATE as never,
      { specification: '# Spec\n\nBody.', roles: GATE.requiredRoles.map(roleByName) },
      engine as never,
    );
    expect(outcome.gateFailed).toBe(true);
    expect(outcome.failedRoles.sort()).toEqual(['qa-agent', 'security-reviewer']);
  });

  it('there is NO skip-the-timed-out-reviewer path: one failure among twelve is still a failed gate', async () => {
    const outcome = await run({
      'security-reviewer': engineOk(
        { findings: [{ location: 'section:auth', severity: 'error', message: 'Plaintext.' }] },
        DESCRIPTOR,
      ),
      'qa-agent': engineFail('timeout', 'wall clock'),
    });
    expect(outcome.gateFailed).toBe(true);
    // The healthy role's findings ARE kept — the gate failed, the review did not vanish.
    expect(outcome.findings.length).toBe(1);
    expect(outcome.findings[0]?.roleId).toBe('security-reviewer');
  });
});
