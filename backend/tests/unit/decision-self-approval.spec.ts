/**
 * T749 — self-approval. `FR-DPE-015`.
 *
 * An approver may not approve their own request unless policy explicitly
 * permits it **for that action class** — and when it does, the permission
 * appears in the explanation, so a self-approved decision never reads like an
 * ordinary one.
 */
import { describe, expect, it } from 'vitest';
import { engine, policy, request } from '../helpers/decision-engine.js';

const pendingFor = async (e: ReturnType<typeof engine>['engine'], actionType = 'docs.legal.sign') =>
  e.decide(request({ actionType, actor: { kind: 'human', id: 'u_me' }, requestedBy: 'u_me' }));

describe('T749 · FR-DPE-015 — no approving your own request by default', () => {
  it('refuses the requester approving their own pending decision', async () => {
    const { engine: e } = engine();
    const pending = await pendingFor(e);
    const result = await e.approve({ workspaceId: 'ws_dpe', decisionId: pending.decisionId, approver: { kind: 'human', id: 'u_me' } });
    expect(result.outcome).toBe('refused');
    expect(result.explanation.authorityApplied).toMatch(/FR-DPE-015/);
  });

  it('leaves the decision pending for someone else after refusing self-approval', async () => {
    const { engine: e } = engine();
    const pending = await pendingFor(e);
    await e.approve({ workspaceId: 'ws_dpe', decisionId: pending.decisionId, approver: { kind: 'human', id: 'u_me' } });
    await expect(
      e.approve({ workspaceId: 'ws_dpe', decisionId: pending.decisionId, approver: { kind: 'human', id: 'u_other' } }),
    ).resolves.toMatchObject({ outcome: 'approved' });
  });
});

describe('T749 · FR-DPE-015 — permitted only for the named class, and said so', () => {
  it('permits self-approval where policy names the action class, and the explanation says so', async () => {
    const { engine: e } = engine({ policies: policy({ selfApprovalAllowed: ['docs.*'] }) });
    const pending = await pendingFor(e);
    const result = await e.approve({ workspaceId: 'ws_dpe', decisionId: pending.decisionId, approver: { kind: 'human', id: 'u_me' } });
    expect(result.outcome).toBe('approved');
    expect(result.explanation.authorityApplied).toMatch(/self-approval.*permitted.*docs\.\*/);
  });

  it('does not extend a permission for one class to another', async () => {
    const { engine: e } = engine({ policies: policy({ selfApprovalAllowed: ['docs.*'] }) });
    const pending = await pendingFor(e, 'deploy');
    const result = await e.approve({ workspaceId: 'ws_dpe', decisionId: pending.decisionId, approver: { kind: 'human', id: 'u_me' } });
    expect(result.outcome).toBe('refused');
  });
});
