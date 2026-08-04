/**
 * T011 — workspace-scoping helper.
 * Written to FAIL before T014 exists (Constitution V).
 *
 * FR-002: every read is filtered by workspace. The helper exists so a missing
 * filter is a test failure rather than a code-review comment.
 */
import { describe, expect, it } from 'vitest';
import {
  MissingWorkspaceScopeError,
  scoped,
  scopedCreate,
  withWorkspace,
} from '../../../src/core/workspace-scope.js';

const WS = 'ws_alpha';

describe('scoped()', () => {
  it('injects workspaceId into an empty query', () => {
    expect(scoped(WS, {})).toEqual({ where: { workspaceId: WS } });
  });

  it('preserves caller filters alongside the scope', () => {
    expect(scoped(WS, { where: { name: 'x' } })).toEqual({
      where: { name: 'x', workspaceId: WS },
    });
  });

  it('preserves non-where options such as orderBy and take', () => {
    const q = scoped(WS, { where: { name: 'x' }, orderBy: { createdAt: 'desc' }, take: 10 });
    expect(q.orderBy).toEqual({ createdAt: 'desc' });
    expect(q.take).toBe(10);
  });

  it('OVERRIDES a caller-supplied workspaceId — the scope always wins', () => {
    // A caller must never be able to widen or redirect its own scope.
    const q = scoped(WS, { where: { workspaceId: 'ws_other' } });
    expect(q.where.workspaceId).toBe(WS);
  });

  it('refuses an empty workspace id', () => {
    expect(() => scoped('', {})).toThrow(MissingWorkspaceScopeError);
    expect(() => scoped('   ', {})).toThrow(MissingWorkspaceScopeError);
  });
});

describe('scopedCreate()', () => {
  it('stamps workspaceId onto created rows', () => {
    expect(scopedCreate(WS, { name: 'p' })).toEqual({ name: 'p', workspaceId: WS });
  });

  it('overrides an attempt to create into another workspace', () => {
    expect(scopedCreate(WS, { name: 'p', workspaceId: 'ws_other' }).workspaceId).toBe(WS);
  });
});

describe('withWorkspace()', () => {
  it('passes the scope to the callback', async () => {
    const seen: string[] = [];
    await withWorkspace(WS, async (ws) => {
      seen.push(ws);
    });
    expect(seen).toEqual([WS]);
  });

  it('refuses to run without a scope', async () => {
    await expect(withWorkspace('', async () => undefined)).rejects.toThrow(
      MissingWorkspaceScopeError,
    );
  });
});
