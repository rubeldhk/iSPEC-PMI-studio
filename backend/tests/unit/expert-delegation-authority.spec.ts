/**
 * `T1949` (EPIC-047) — delegation never widens authority.
 *
 * `FR-EXP-034`, `SC-EXP-004`. A delegate's effective authority is the
 * intersection of its own contract and every ancestor's: capabilities and tools
 * are intersected, a permission survives only at the narrower action, and
 * prohibitions accumulate. What is stored on the session is what was checked.
 */
import { describe, expect, it } from 'vitest';
import { authorityOf, intersect } from '../../src/modules/experts/authority.js';
import { addApproved, allowDelegation, ask, insideRun, world, ACTOR } from '../helpers/expert-dispatch.js';
import { contract } from '../helpers/expert-fixtures.js';

describe('T1949 · authority across a chain', () => {
  it('intersects capabilities and tools, narrows permissions, accumulates prohibitions', () => {
    const parent = authorityOf(
      contract({
        capabilities: ['test', 'analyze'],
        allowedTools: ['read-file', 'run-tests'],
        permissions: [{ artifactType: 'specification', action: 'read' }],
        prohibitedActions: ['push'],
      }),
    );
    const child = contract({
      capabilities: ['test', 'generate'],
      allowedTools: ['run-tests', 'shell'],
      permissions: [
        { artifactType: 'specification', action: 'edit' },
        { artifactType: 'requirement', action: 'read' },
      ],
      prohibitedActions: ['delete-branch'],
    });
    expect(intersect(parent, child)).toEqual({
      capabilities: ['test'],
      tools: ['run-tests'],
      permissions: [{ artifactType: 'specification', action: 'read' }],
      prohibitedActions: ['push', 'delete-branch'],
    });
  });

  it('three levels intersect all three', () => {
    const a = authorityOf(contract({ capabilities: ['test', 'analyze', 'review'] }));
    const b = intersect(a, contract({ capabilities: ['test', 'analyze'] }));
    const c = intersect(b, contract({ capabilities: ['test', 'review'] }));
    expect(c.capabilities).toEqual(['test']);
  });

  it('a delegate allowed more than its parent is refused what only it allows, and the session stores the intersection', async () => {
    const w = await world({ contract: contract({ delegatesTo: ['reviewer'], allowedTools: ['run-tests'] }) });
    await addApproved(w, 'reviewer', { allowedTools: ['run-tests', 'shell'] });
    await allowDelegation(w, [{ from: 'test-engineer', to: 'reviewer' }]);
    const { inner } = await insideRun(w, ask(), async (root) => {
      const wider = await w.service
        .dispatch(ACTOR, ask({ expertId: 'ex_reviewer', tools: ['shell'], delegatedFromExecutionId: root }))
        .catch((e: unknown) => e as Error);
      const narrow = await w.service.dispatch(ACTOR, ask({ expertId: 'ex_reviewer', delegatedFromExecutionId: root }));
      return { wider, narrow };
    });
    expect((inner.wider as Error).message).toMatch(/tool shell/);
    const session = await w.store.findSession('ws_1', inner.narrow.executionId);
    expect(session?.effectiveAuthority.tools).toEqual(['run-tests']);
  });
});
