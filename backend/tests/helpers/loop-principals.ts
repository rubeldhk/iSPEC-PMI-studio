/**
 * `T1158` — the loop's two resolvers, for tests.
 *
 * Before `DEF-030-003`, a test distinguished an analyst from a lead by sending
 * different `actorAuthorities` on each call. That is exactly what the defect
 * was: the caller declaring what it held.
 *
 * The distinction has not gone away — it has moved to where it belongs. A test
 * now describes a **directory**: these actors exist in this workspace, and these
 * are the authorities they hold. The transitions then say only who is acting.
 *
 * Both stubs fail closed. An unknown actor is refused rather than defaulted, and
 * an actor with no entry holds nothing — the same posture as
 * `WorkspaceBoundaryService` and `GrantBackedAuthorities` in production.
 */
import type { LoopAuthorityResolver, LoopPrincipalResolver } from '../../src/modules/loop/loop.service.js';

export interface TestActor {
  readonly workspaceId: string;
  readonly kind?: 'human' | 'agent' | 'service';
  readonly state?: 'active' | 'suspended' | 'revoked';
  readonly authorities?: readonly string[];
}

/** Who exists, and in which workspace. Refuses everyone else. */
export function directoryOf(actors: Readonly<Record<string, TestActor>>): LoopPrincipalResolver {
  return {
    async requireWithinWorkspace(workspaceId, actorId) {
      const actor = actors[actorId];
      if (!actor) throw new Error(`no authoritative actor ${actorId}`);
      if (actor.workspaceId !== workspaceId) {
        throw new Error('actor belongs to a different workspace');
      }
      if ((actor.state ?? 'active') !== 'active') {
        throw new Error(`principal is ${actor.state}`);
      }
      return {
        id: actorId,
        workspaceId: actor.workspaceId,
        kind: actor.kind ?? 'human',
        state: actor.state ?? 'active',
      };
    },
  };
}

/** What each actor holds, as the policy would answer. Unknown holds nothing. */
export function authoritiesOf(
  actors: Readonly<Record<string, TestActor>>,
): LoopAuthorityResolver {
  return {
    async actorAuthorities(_workspaceId, actorId) {
      return actors[actorId]?.authorities ?? [];
    },
  };
}
