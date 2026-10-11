/**
 * `T2536` (EPIC-047 Convergence) — a limit a delegate inherits from its chain
 * follows the unenforceable-limit posture too.
 *
 * `FR-EXP-043`. A token or cost limit added to a delegate from its chain's
 * remaining budget was always admitted when the delegate's runner could not
 * enforce it, on the reasoning that "the chain's posture was applied at the
 * root". That holds only if the root's runner had the same inability. Now the
 * added limit takes the posture of the ancestor that set it — `refuse` by
 * default for money — and the delegate is refused unless that ancestor said
 * `proceed`.
 */
import { describe, expect, it } from 'vitest';
import { capByChain, planLimits } from '../../src/modules/experts/limits.js';
import { ACTOR, addApproved, allowDelegation, ask, world } from '../helpers/expert-dispatch.js';
import { contract, gatewaysFor, runner } from '../helpers/expert-fixtures.js';

describe('T2536 · posture of chain-added limits', () => {
  const plan = planLimits({ time: { value: 60_000 } }, {}, undefined);

  it('an added token limit the runner cannot enforce is refused under the default posture', () => {
    const cap = capByChain(plan, { tokens: 500 }, undefined, {});
    expect(cap.refusal).toMatch(/tokens.*cannot be enforced.*refuse/);
  });

  it('it is admitted, as unenforceable, when the ancestor that set it said proceed', () => {
    const cap = capByChain(plan, { tokens: 500 }, undefined, { tokens: 'proceed' });
    expect(cap.refusal).toBeNull();
    expect(cap.plan.limits.find((l) => l.limit === 'tokens')?.enforcement).toBe('unenforceable');
  });

  it('it is enforced, and not refused, on a runner that can enforce it', () => {
    const cap = capByChain(plan, { tokens: 500 }, ['tokens'], {});
    expect(cap.refusal).toBeNull();
    expect(cap.plan.limits.find((l) => l.limit === 'tokens')?.enforcement).toBe('enforced');
  });

  it('end to end: a root that could enforce tokens cannot hand them to a delegate that cannot', async () => {
    // The root's runner enforces tokens, so its default `refuse` posture never
    // fired; the delegate's runner cannot, and it inherits the root's limit.
    const w = await world({
      contract: contract({
        delegatesTo: ['reviewer'],
        models: { preferred: 'p', fallbacks: [] },
        budget: { time: { value: 60_000 }, tokens: { value: 1000 } },
      }),
    });
    await addApproved(w, 'reviewer', { models: { preferred: 'c', fallbacks: [] }, budget: { time: { value: 60_000 } } });
    await allowDelegation(w, [{ from: 'test-engineer', to: 'reviewer' }]);
    const root = runner({ model: 'p', enforceableLimits: ['tokens'] });
    w.ports.gateways = gatewaysFor({ p: [root], c: [runner({ model: 'c' })] });
    // Hook this root runner so the delegation happens from inside its run.
    const original = root.run.bind(root);
    let inner: unknown;
    root.run = async (invocation, ctx) => {
      inner = await w.service
        .dispatch(ACTOR, ask({ expertId: 'ex_reviewer', delegatedFromExecutionId: ctx.correlationId }))
        .catch((e: unknown) => e);
      return original(invocation, ctx);
    };
    await w.service.dispatch(ACTOR, ask());
    expect((inner as Error).message).toMatch(/tokens.*cannot be enforced/);
  });
});
