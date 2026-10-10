/**
 * `T1990` (EPIC-047) — who may author an Expert.
 *
 * `FR-EXP-009`, analysis finding U1. The platform has no administrator role
 * (`DEF-038-005`), and an Expert's contract **is** a statement of what an AI may
 * do in this workspace. Left to "any member", anyone could write themselves an
 * Expert with wider permissions than their own. So authoring needs an
 * `EPIC-024` edit grant on the workspace's `expert-registry` artifact, reading
 * needs read, and an access check that fails refuses rather than allows.
 */
import { describe, expect, it } from 'vitest';
import { ForbiddenError } from '../../src/core/errors.js';
import { Authoring, REGISTRY_ARTIFACT } from '../../src/modules/experts/authoring.js';
import type { ActorAccess } from '../../src/modules/experts/experts.tokens.js';

function access(grants: Record<string, 'read' | 'edit'>): ActorAccess {
  return {
    async mayRead(_ws, userId, artifact) {
      return grants[`${userId}:${artifact.artifactType}:${artifact.artifactId}`] !== undefined;
    },
    async mayEdit(_ws, userId, artifact) {
      return grants[`${userId}:${artifact.artifactType}:${artifact.artifactId}`] === 'edit';
    },
  };
}

const registry = (ws: string): string => `${REGISTRY_ARTIFACT}:${ws}`;

describe('T1990 · authoring authority', () => {
  it('the registry artifact is per workspace', () => {
    expect(REGISTRY_ARTIFACT).toBe('expert-registry');
  });

  it('authoring refuses without an edit grant on the registry, naming FR-EXP-009', async () => {
    const authoring = new Authoring(access({ [`u_1:${registry('ws_1')}`]: 'read' }));
    await expect(authoring.requireAuthor('ws_1', 'u_1')).rejects.toBeInstanceOf(ForbiddenError);
    await expect(authoring.requireAuthor('ws_1', 'u_1')).rejects.toThrow(/FR-EXP-009/);
  });

  it('authoring is allowed with edit', async () => {
    const authoring = new Authoring(access({ [`u_1:${registry('ws_1')}`]: 'edit' }));
    await expect(authoring.requireAuthor('ws_1', 'u_1')).resolves.toBeUndefined();
  });

  it('an edit grant in one workspace authorises nothing in another', async () => {
    const authoring = new Authoring(access({ [`u_1:${registry('ws_1')}`]: 'edit' }));
    await expect(authoring.requireAuthor('ws_2', 'u_1')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('reading needs read, and is refused without it', async () => {
    await expect(
      new Authoring(access({ [`u_1:${registry('ws_1')}`]: 'read' })).requireReader('ws_1', 'u_1'),
    ).resolves.toBeUndefined();
    await expect(new Authoring(access({})).requireReader('ws_1', 'u_1')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('assignment needs edit on the task itself', async () => {
    const authoring = new Authoring(access({ 'u_1:task:t_1': 'edit', 'u_2:task:t_1': 'read' }));
    await expect(authoring.requireTaskEditor('ws_1', 'u_1', 't_1')).resolves.toBeUndefined();
    await expect(authoring.requireTaskEditor('ws_1', 'u_2', 't_1')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('a fault in the access check propagates — it never reads as permission', async () => {
    const authoring = new Authoring({
      async mayRead() {
        throw new Error('grant store unreachable');
      },
      async mayEdit() {
        throw new Error('grant store unreachable');
      },
    });
    await expect(authoring.requireAuthor('ws_1', 'u_1')).rejects.toThrow(/unreachable/);
  });
});
