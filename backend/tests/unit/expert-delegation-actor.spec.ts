/**
 * `T2004` (EPIC-047) — a delegation chain acts for the person who started it.
 *
 * `FR-EXP-034`, US3/AC3, `FR-EXP-014`. A delegate's authority is the
 * intersection down the chain **and** the originating actor's own grants. So a
 * session records the actor who started its root run; a delegate inherits that
 * actor, its targets are checked against them, and a different user cannot
 * delegate under somebody else's session to borrow its standing. The
 * integration half — the column round-trips through PostgreSQL — is in
 * `tests/integration/expert-store-prisma.spec.ts`.
 */
import { describe, expect, it } from 'vitest';
import { ACTOR, addApproved, allowDelegation, ask, world, type World } from '../helpers/expert-dispatch.js';
import { accessFrom, contract, gatewaysFor, runner } from '../helpers/expert-fixtures.js';

const OTHER = { workspaceId: 'ws_1', userId: 'u_2', role: 'engineer' } as const;

async function delegating(): Promise<World> {
  const w = await world({
    contract: contract({ delegatesTo: ['reviewer'], models: { preferred: 'parent-model', fallbacks: [] } }),
    access: accessFrom({
      'u_1:specification:sp_1': 'edit',
      'u_2:specification:sp_1': 'edit',
      'u_2:specification:sp_2': 'edit',
    }),
  });
  await addApproved(w, 'reviewer', { models: { preferred: 'child-model', fallbacks: [] } });
  await allowDelegation(w, [{ from: 'test-engineer', to: 'reviewer' }]);
  return w;
}

/** Run the parent as u_1; inside it, `delegate` dispatches the child as whoever it chooses. */
async function withParent(w: World, delegate: (parentId: string) => Promise<unknown>): Promise<unknown> {
  let inner: unknown;
  w.ports.gateways = gatewaysFor({
    'parent-model': [
      runner({ model: 'parent-model' }, async (ctx) => {
        inner = await delegate(ctx.correlationId).catch((e: unknown) => e);
        return { status: 'succeeded', outputs: ['test-report'] };
      }),
    ],
    'child-model': [runner({ model: 'child-model' })],
  });
  await w.service.dispatch(ACTOR, ask());
  return inner;
}

describe('T2004 · the originating actor', () => {
  it('a root session records the actor who started it', async () => {
    const w = await world();
    await w.service.dispatch(ACTOR, ask());
    expect((await w.store.findSession('ws_1', 'exe_1'))?.actorId).toBe('u_1');
  });

  it('a delegate records the actor of its root run', async () => {
    const w = await delegating();
    const child = (await withParent(w, (p) =>
      w.service.dispatch(ACTOR, ask({ expertId: 'ex_reviewer', delegatedFromExecutionId: p })),
    )) as { executionId: string };
    expect((await w.store.findSession('ws_1', child.executionId))?.actorId).toBe('u_1');
  });

  it('a different user cannot delegate under someone else’s session', async () => {
    const w = await delegating();
    const error = await withParent(w, (p) =>
      w.service.dispatch(OTHER, ask({ expertId: 'ex_reviewer', delegatedFromExecutionId: p })),
    );
    expect(String((error as Error).message)).toMatch(/started by another actor.*FR-EXP-034/);
    expect(w.executions.kindsFor('exe_1')).toContain('delegation-refused');
    expect(w.executions.kindsFor('exe_2')).toContain('dispatch-refused');
  });

  it('a delegate’s targets are checked against the originating actor', async () => {
    // u_2 may edit sp_2; u_1, who started the chain, may not. The delegate is refused.
    const w = await delegating();
    const error = await withParent(w, (p) =>
      w.service.dispatch(ACTOR, ask({
        expertId: 'ex_reviewer',
        delegatedFromExecutionId: p,
        targets: [{ artifactType: 'specification', artifactId: 'sp_2', action: 'read' }],
      })),
    );
    expect(String((error as Error).message)).toMatch(/sp_2/);
  });
});
