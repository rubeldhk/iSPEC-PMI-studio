/**
 * `T1414` (EPIC-043, `R-043-3`) — a delegation on the execution's project covers
 * a target of any type inside it; a target in another project does not; an
 * execution with no project is checked against its target alone.
 *
 * The check is not weakened: it is tried against the target first, exactly as
 * before, and only then against the project. Written to FAIL before `T1415`.
 */
import { describe, expect, it, vi } from 'vitest';
import { resolveDelegationForRegistration, type DelegationPort } from '../../../src/modules/executions/execution-registration.service.js';

function port(granted: { artifactType: string; artifactId: string }[]): DelegationPort {
  return {
    requireDelegated: vi.fn(async (input) => {
      const hit = granted.find((g) => g.artifactType === input.artifact.artifactType && g.artifactId === input.artifact.artifactId);
      if (!hit) throw new Error(`no active delegation for ${input.artifact.artifactType}:${input.artifact.artifactId}`);
      return { id: `del_${hit.artifactType}`, identityVersion: 1 };
    }),
  };
}

const BASE = { workspaceId: 'ws_a', principalId: 'pr_1', action: 'execution.register' as const };

describe('T1414 · delegation resolved through the project', () => {
  it('a delegation on the target itself still wins first', async () => {
    const p = port([{ artifactType: 'specification', artifactId: 'spec_1' }, { artifactType: 'project', artifactId: 'proj_1' }]);
    const d = await resolveDelegationForRegistration(p, { ...BASE, projectId: 'proj_1', target: { targetType: 'specification', targetId: 'spec_1' } });
    expect(d.id).toBe('del_specification');
    expect(p.requireDelegated).toHaveBeenCalledTimes(1);
  });

  it('a delegation on the project covers a target of any type inside it', async () => {
    const p = port([{ artifactType: 'project', artifactId: 'proj_1' }]);
    const d = await resolveDelegationForRegistration(p, { ...BASE, projectId: 'proj_1', target: { targetType: 'specification', targetId: 'spec_9' } });
    expect(d.id).toBe('del_project');
    expect(p.requireDelegated).toHaveBeenLastCalledWith(expect.objectContaining({ artifact: { artifactType: 'project', artifactId: 'proj_1' } }));
  });

  it('a delegation on another project does not', async () => {
    const p = port([{ artifactType: 'project', artifactId: 'proj_OTHER' }]);
    await expect(
      resolveDelegationForRegistration(p, { ...BASE, projectId: 'proj_1', target: { targetType: 'specification', targetId: 'spec_9' } }),
    ).rejects.toThrow(/no active delegation/);
  });

  it('an execution with no project is checked against its target only', async () => {
    const p = port([{ artifactType: 'project', artifactId: 'proj_1' }]);
    await expect(
      resolveDelegationForRegistration(p, { ...BASE, projectId: undefined, target: { targetType: 'specification', targetId: 'spec_9' } }),
    ).rejects.toThrow(/no active delegation/);
    expect(p.requireDelegated).toHaveBeenCalledTimes(1);
  });
});
