/**
 * T228 — four-scope path validation (FR-ENH-001).
 * Written to FAIL before T229/T230 exist (Constitution V).
 *
 * `organization → workspace → project → product`, strictly ordered; each
 * scope resolves to a parent in the level above. Pure function — no database.
 */
import { describe, expect, it } from 'vitest';
import {
  InvalidScopePathError,
  SCOPE_ORDER,
  resolveScopePath,
  type ScopeLineage,
} from '../../../src/modules/steering/scope-resolver.js';

const LINEAGE: ScopeLineage = {
  organizationId: 'org_1',
  workspaceId: 'ws_1',
  projectId: 'proj_1',
  productId: 'prod_1',
};

describe('T228 · the four scopes, strictly ordered', () => {
  it('the hierarchy is exactly organization → workspace → project → product', () => {
    expect(SCOPE_ORDER).toEqual(['organization', 'workspace', 'project', 'product']);
  });

  it('a product scope resolves through every level above it, in order', () => {
    const path = resolveScopePath({ scopeType: 'product', scopeRef: 'prod_1' }, LINEAGE);
    expect(path).toEqual([
      { scopeType: 'organization', scopeRef: 'org_1' },
      { scopeType: 'workspace', scopeRef: 'ws_1' },
      { scopeType: 'project', scopeRef: 'proj_1' },
      { scopeType: 'product', scopeRef: 'prod_1' },
    ]);
  });

  it('an organization scope is a path of one', () => {
    expect(resolveScopePath({ scopeType: 'organization', scopeRef: 'org_1' }, LINEAGE)).toEqual([
      { scopeType: 'organization', scopeRef: 'org_1' },
    ]);
  });

  it('the ref must be the one the lineage names at that level', () => {
    expect(() =>
      resolveScopePath({ scopeType: 'project', scopeRef: 'someone-elses-project' }, LINEAGE),
    ).toThrow(InvalidScopePathError);
  });

  it('a scope with no parent in the level above is refused, naming the missing level', () => {
    const err = (() => {
      try {
        resolveScopePath(
          { scopeType: 'project', scopeRef: 'proj_1' },
          { organizationId: 'org_1' }, // no workspace
        );
        return null;
      } catch (e) {
        return e as InvalidScopePathError;
      }
    })();
    expect(err).toBeInstanceOf(InvalidScopePathError);
    expect(err?.message).toMatch(/workspace/);
  });

  it('an unknown scope type is refused by name', () => {
    expect(() =>
      resolveScopePath({ scopeType: 'galaxy' as never, scopeRef: 'g1' }, LINEAGE),
    ).toThrow(/galaxy/);
  });
});

describe('T228 · the SteeringScope model (T229)', () => {
  it('exists with scope_type and scope_ref, one row per position', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const schema = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../../../prisma/schema.prisma'),
      'utf8',
    );
    const match = /model SteeringScope \{[\s\S]*?\n\}/.exec(schema);
    expect(match, 'model SteeringScope missing from schema.prisma').toBeTruthy();
    const block = match![0];
    expect(block).toMatch(/scopeType\s+SteeringScopeType/);
    expect(block).toMatch(/scopeRef\s+String/);
    expect(block).toMatch(/@@unique\(\[scopeType, scopeRef\]\)/);
    expect(schema).toMatch(/enum SteeringScopeType \{[\s\S]*?organization[\s\S]*?workspace[\s\S]*?project[\s\S]*?product[\s\S]*?\}/);
  });
});
