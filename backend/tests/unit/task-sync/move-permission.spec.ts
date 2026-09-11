/**
 * `T1789` (EPIC-046, `FR-KAN-018`, `BR-0003`, `contracts/board-contract.md` §4)
 * — who may move a card, and the board saying so before they try.
 *
 * ## Two problems, one root
 *
 * The second convergence pass found the board showing the status control to
 * everyone. Reading the route to confirm it turned up the larger half: the
 * proposal route passed **`canMove: true`** as a literal, so the permission
 * `TaskProposalService` carefully checks was never actually resolved. Every
 * project member could move any card, whatever their grant.
 *
 * `BR-0003` and §4 want both halves: the permission enforced, and the board
 * rendering **read-only with the reason stated and no move control at all** for
 * someone who does not hold it. A control that submits and comes back
 * `refused` is not the same thing — it teaches a person their permission by
 * making them fail.
 *
 * ## Why a predicate and not the existing gate
 *
 * `requireOwner` throws and **audits a refusal**. Asking *may this reader move
 * a card* on every board load is not an access refusal, and recording one per
 * page view would fill the audit trail with non-events. So the rule is shared
 * and the reaction is not: one predicate, no throw, no audit.
 *
 * Written to FAIL before `mayMove` exists.
 */
import { describe, expect, it, vi } from 'vitest';
import { OwnerGate } from '../../../src/modules/governance/owner-gate.js';

function gate(opts: { owner?: string; grants?: { userId: string; level: string }[] | null } = {}) {
  const audit = { record: vi.fn(async () => undefined) };
  const deps = {
    projects: { get: async (_ws: string, id: string) => ({ id, ownerUserId: opts.owner ?? 'u_owner' }) },
    grants: opts.grants === null ? null : { activeGrants: async () => opts.grants ?? [] },
    audit,
  };
  return { gate: new OwnerGate(deps as never), audit };
}

describe('T1789 · who may move a card (BR-0003)', () => {
  it('the project owner may', async () => {
    const { gate: g } = gate();
    expect(await g.mayMove({ workspaceId: 'ws_a', userId: 'u_owner' }, 'p1')).toBe(true);
  });

  it('a member holding an edit grant may', async () => {
    const { gate: g } = gate({ grants: [{ userId: 'u_ana', level: 'edit' }] });
    expect(await g.mayMove({ workspaceId: 'ws_a', userId: 'u_ana' }, 'p1')).toBe(true);
  });

  it('a member with only a read grant may NOT', async () => {
    const { gate: g } = gate({ grants: [{ userId: 'u_ana', level: 'read' }] });
    expect(await g.mayMove({ workspaceId: 'ws_a', userId: 'u_ana' }, 'p1')).toBe(false);
  });

  it('a member with no grant at all may NOT', async () => {
    const { gate: g } = gate();
    expect(await g.mayMove({ workspaceId: 'ws_a', userId: 'u_ana' }, 'p1')).toBe(false);
  });

  it('answers false for a project outside the workspace rather than throwing', async () => {
    // A board read must not turn into a 404 because of a permission question.
    // Absence and no-permission look the same from here, which is the correct
    // disclosure: neither tells the reader anything about the other project.
    const audit = { record: vi.fn(async () => undefined) };
    const g = new OwnerGate({
      projects: { get: async () => { throw new Error('nope'); } },
      grants: null,
      audit,
    } as never);
    expect(await g.mayMove({ workspaceId: 'ws_a', userId: 'u_ana' }, 'p_other')).toBe(false);
  });

  it('records NO audit row — asking is not being refused', async () => {
    // `requireOwner` audits a refusal because a refusal happened. This is a
    // question asked on every board load; auditing it would fill the trail
    // with non-events and bury the refusals that matter.
    const { gate: g, audit } = gate();
    await g.mayMove({ workspaceId: 'ws_a', userId: 'u_ana' }, 'p1');
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('is the same rule requireOwner enforces, not a second one', async () => {
    // If these ever disagree, a board renders a control that the route then
    // refuses — the exact experience `BR-0003` is trying to prevent.
    const { gate: g } = gate({ grants: [{ userId: 'u_ana', level: 'edit' }] });
    expect(await g.mayMove({ workspaceId: 'ws_a', userId: 'u_ana' }, 'p1')).toBe(true);
    await expect(g.requireOwner({ workspaceId: 'ws_a', userId: 'u_ana' }, 'p1', 'move a task')).resolves.toBeUndefined();

    const { gate: h } = gate({ grants: [{ userId: 'u_ana', level: 'read' }] });
    expect(await h.mayMove({ workspaceId: 'ws_a', userId: 'u_ana' }, 'p1')).toBe(false);
    await expect(h.requireOwner({ workspaceId: 'ws_a', userId: 'u_ana' }, 'p1', 'move a task')).rejects.toThrow();
  });
});
