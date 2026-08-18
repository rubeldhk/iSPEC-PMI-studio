/**
 * T455 — project scoping.
 * Written to FAIL before T456 exists (Constitution V).
 *
 * **FR-003**: project content — requirements, specifications, tasks — is scoped
 * to its project, *with no leakage between projects*.
 *
 * `FR-003` is co-owned with EPIC-006 and had **zero** task coverage in this epic
 * until analysis finding **C4**. EPIC-006 `T054` builds the projects service;
 * the generic mechanism that stops content leaking belongs here, beside the
 * workspace scope it has to compose with.
 *
 * ## The assertion that matters
 *
 * Project scoping **composes with** workspace scoping — it never replaces it.
 * The tempting shortcut is to treat a project id as sufficient on its own,
 * since a project belongs to exactly one workspace. That reasoning is wrong the
 * moment an id is guessed, leaked in a URL, or copied between environments: a
 * query filtered by project alone has **no tenancy boundary at all**, and
 * `FR-002` is enforced by the filter, not by the id's provenance.
 *
 * So every assertion below that checks a project also checks the workspace.
 */
import { describe, expect, it } from 'vitest';
import {
  MissingProjectScopeError,
  MissingWorkspaceScopeError,
  projectScoped,
  projectScopedCreate,
} from '../../../src/core/workspace-scope.js';

/**
 * Capture a refusal and check WHICH refusal it was.
 *
 * `expect(fn).toThrow(SomeError)` is not enough here. Before `T456` existed
 * both the function and the error class were `undefined` imports, so
 * `toThrow(undefined)` degraded to "throws anything" and was satisfied by the
 * `TypeError` from calling a function that does not exist — a test passing
 * against no implementation at all. Comparing with `instanceof` cannot do that:
 * `x instanceof undefined` is itself a `TypeError`, so the test fails, which is
 * what a red test is for.
 */
function refusal(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('Expected a refusal, and nothing was thrown.');
}

const WS = 'ws_alpha';
const PROJECT = 'prj_apollo';
const OTHER_PROJECT = 'prj_gemini';

describe('projectScoped()', () => {
  it('injects both workspaceId and projectId into an empty query', () => {
    expect(projectScoped(WS, PROJECT)).toEqual({
      where: { workspaceId: WS, projectId: PROJECT },
    });
  });

  it('COMPOSES with workspace scoping rather than replacing it', () => {
    // The headline assertion of FR-003. A project id is not a tenancy boundary:
    // filtered by project alone, a guessed or leaked id reaches another
    // tenant's content and FR-002 is silently gone.
    const query = projectScoped(WS, PROJECT, { where: { status: 'draft' } });
    expect(query.where.workspaceId).toBe(WS);
    expect(query.where.projectId).toBe(PROJECT);
    expect(query.where['status']).toBe('draft');
  });

  it('preserves non-where options such as orderBy and take', () => {
    const query = projectScoped(WS, PROJECT, {
      where: { type: 'functional' },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
    expect(query.orderBy).toEqual({ createdAt: 'desc' });
    expect(query.take).toBe(25);
  });

  it('OVERRIDES a caller-supplied projectId — the scope always wins', () => {
    // Same rule the workspace scope has enforced since T014. A caller must
    // never be able to redirect its own scope, accidentally or otherwise.
    const query = projectScoped(WS, PROJECT, { where: { projectId: OTHER_PROJECT } });
    expect(query.where.projectId).toBe(PROJECT);
  });

  it('OVERRIDES a caller-supplied workspaceId even when a project is named', () => {
    // The compound case, and the one a project-only implementation gets wrong:
    // adding a project filter must not stop the workspace filter being applied
    // last and winning.
    const query = projectScoped(WS, PROJECT, {
      where: { workspaceId: 'ws_other', projectId: OTHER_PROJECT },
    });
    expect(query.where.workspaceId).toBe(WS);
    expect(query.where.projectId).toBe(PROJECT);
  });

  it('refuses a missing project scope rather than running unscoped', () => {
    // An unscoped read is the leak FR-003 forbids. Refusing is the only safe
    // failure: returning everything would look like a working query.
    expect(refusal(() => projectScoped(WS, '')) instanceof MissingProjectScopeError).toBe(true);
    expect(refusal(() => projectScoped(WS, '   ')) instanceof MissingProjectScopeError).toBe(true);
  });

  it('refuses a missing workspace scope even when a project is supplied', () => {
    // Proves the project scope cannot be used as a substitute for tenancy.
    // If this passed, `projectScoped('', PROJECT)` would be a cross-tenant read
    // that looked deliberate.
    expect(refusal(() => projectScoped('', PROJECT)) instanceof MissingWorkspaceScopeError).toBe(
      true,
    );
  });

  it('produces queries that cannot match another project', () => {
    // "No leakage between projects", stated as the property rather than an
    // example: two scopes in the same workspace disagree on projectId, and
    // neither query can select the other's rows.
    const apollo = projectScoped(WS, PROJECT);
    const gemini = projectScoped(WS, OTHER_PROJECT);
    expect(apollo.where.projectId).not.toBe(gemini.where.projectId);
    expect(apollo.where.workspaceId).toBe(gemini.where.workspaceId);
  });

  it('does not mutate the caller’s query object', () => {
    // A helper that edited its input would leave a scoped `where` behind for
    // the caller to reuse against a different project.
    const original = { where: { status: 'draft' } };
    projectScoped(WS, PROJECT, original);
    expect(original).toEqual({ where: { status: 'draft' } });
  });
});

describe('projectScopedCreate()', () => {
  // Reads are what T455 names, but a row only carries a projectId because
  // something put it there. Without a write counterpart every caller sets it by
  // hand, which is the class of error the helper exists to remove — and a row
  // written without one is unreachable by every scoped read above.

  it('stamps both ids onto the record', () => {
    expect(projectScopedCreate(WS, PROJECT, { title: 'Apollo spec' })).toEqual({
      title: 'Apollo spec',
      workspaceId: WS,
      projectId: PROJECT,
    });
  });

  it('OVERRIDES caller-supplied ids', () => {
    const record = projectScopedCreate(WS, PROJECT, {
      title: 'x',
      workspaceId: 'ws_other',
      projectId: OTHER_PROJECT,
    });
    expect(record.workspaceId).toBe(WS);
    expect(record.projectId).toBe(PROJECT);
  });

  it('refuses either scope missing', () => {
    expect(
      refusal(() => projectScopedCreate(WS, '', { title: 'x' })) instanceof MissingProjectScopeError,
    ).toBe(true);
    expect(
      refusal(() => projectScopedCreate('', PROJECT, { title: 'x' })) instanceof
        MissingWorkspaceScopeError,
    ).toBe(true);
  });
});
