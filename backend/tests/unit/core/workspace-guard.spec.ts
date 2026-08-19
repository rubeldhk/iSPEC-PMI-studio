/**
 * T015 — cross-workspace access returns NOT FOUND, never FORBIDDEN.
 * Written to FAIL before T016 exists (Constitution V).
 *
 * FR-002 / SC-004: 403 would confirm the resource exists. A resource in another
 * workspace must be indistinguishable from one that does not exist.
 */
import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../../src/core/errors.js';
import { assertSameWorkspace, requireWorkspaceContext } from '../../../src/core/workspace.guard.js';

describe('assertSameWorkspace()', () => {
  it('permits access within the same workspace', () => {
    expect(() => assertSameWorkspace('ws_a', { workspaceId: 'ws_a' })).not.toThrow();
  });

  it('throws NotFound — not Forbidden — across workspaces', () => {
    expect(() => assertSameWorkspace('ws_a', { workspaceId: 'ws_b' })).toThrow(NotFoundError);
  });

  it('throws NotFound for a missing resource, giving an identical outcome', () => {
    // The two cases must be indistinguishable to the caller.
    let crossWorkspace: unknown;
    let missing: unknown;
    try {
      assertSameWorkspace('ws_a', { workspaceId: 'ws_b' });
    } catch (e) {
      crossWorkspace = e;
    }
    try {
      assertSameWorkspace('ws_a', null);
    } catch (e) {
      missing = e;
    }
    expect((crossWorkspace as NotFoundError).code).toBe((missing as NotFoundError).code);
    expect((crossWorkspace as NotFoundError).message).toBe((missing as NotFoundError).message);
  });

  it('records the refusal before refusing (FR-033)', () => {
    const onRefused = vi.fn();
    expect(() =>
      assertSameWorkspace('ws_a', { workspaceId: 'ws_b' }, { onRefused, targetType: 'project' }),
    ).toThrow(NotFoundError);
    expect(onRefused).toHaveBeenCalledOnce();
    expect(onRefused.mock.calls[0]?.[0]).toMatchObject({
      workspaceId: 'ws_a',
      targetType: 'project',
      outcome: 'refused',
    });
  });

  it('does not record anything on a permitted access', () => {
    const onRefused = vi.fn();
    assertSameWorkspace('ws_a', { workspaceId: 'ws_a' }, { onRefused, targetType: 'project' });
    expect(onRefused).not.toHaveBeenCalled();
  });
});

describe('requireWorkspaceContext()', () => {
  it('returns the workspace id when present', () => {
    expect(requireWorkspaceContext({ workspaceId: 'ws_a', userId: 'u1' })).toBe('ws_a');
  });

  it('throws NotFound when context is absent, disclosing nothing', () => {
    expect(() => requireWorkspaceContext(undefined)).toThrow(NotFoundError);
  });
});
