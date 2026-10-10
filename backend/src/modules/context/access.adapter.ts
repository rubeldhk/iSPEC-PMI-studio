/**
 * `T1258` (EPIC-038) — `AccessPolicy` bound to `EPIC-024`.
 *
 * `FR-CTX-054`, `R-038-7`. Adjudication is `EPIC-024`'s, and this file decides
 * nothing of its own: it routes the question to the two checks `EPIC-024`
 * already owns and returns their answer.
 *
 * ## The two checks, and the order
 *
 * 1. **The actor is inside the requesting workspace** —
 *    `WorkspaceBoundaryService.requireWithinWorkspace`, against the authoritative
 *    user record rather than the session's claim. A refusal there is a `false`.
 * 2. **The actor may read the artifact** — `AccessInheritanceService
 *    .effectivelyReadable`, derivation sources included, for the types
 *    `EPIC-024` keys grants by. Its rule is strict: *no grants means nobody has
 *    been given access, not that everybody has.*
 *
 * ## The types `EPIC-024` does not govern
 *
 * The approved source set (`FR-CTX-015`) includes requirements, baselines,
 * decisions and execution history, and none of them carries a grant model
 * today. Applying the strict rule to them would refuse every one forever,
 * because nothing can ever hold a grant on them. For those, the rule that
 * applies is check 1 — the same position `EPIC-032` took for evidence
 * (`DEF-032-003`) — and `DEF-038-001` records that the list of governed types
 * has an owner who has not yet extended it.
 *
 * ## A crossing is judged in the requesting workspace
 *
 * An authorised crossing (`FR-CTX-051`) is material from another workspace,
 * where the actor holds no grants and never will. Its permission is the
 * authorisation `judgeBoundary` already required, plus check 1. Asking
 * `EPIC-024` about grants in a workspace the actor is not in would refuse every
 * crossing and make `FR-CTX-051` unreachable.
 *
 * ## An outage is not a refusal
 *
 * A directory or grant store that cannot be read **throws**, and assembly is
 * deliberately not wrapped around it. Turning an outage into `false` would
 * write a `permission` exclusion saying the actor may not read something,
 * which is a statement about the access model the access model never made.
 *
 * Framework-free (PC-1).
 */
import { ForbiddenError } from '../../core/errors.js';
import type { AssemblyPorts } from './assembly.service.js';

/** The types `EPIC-024` keys grants by today. `DEF-038-001`. */
export const ACCESS_GOVERNED_TYPES: ReadonlySet<string> = new Set(['specification', 'project']);

/** The slice of `WorkspaceBoundaryService` this adapter reads. */
export interface MembershipCheck {
  requireWithinWorkspace(workspaceId: string, actorId: string): Promise<unknown>;
}

/** The slice of `AccessInheritanceService` this adapter reads. */
export interface ReadabilityCheck {
  effectivelyReadable(
    workspaceId: string,
    userId: string,
    artifact: { artifactType: string; artifactId: string },
  ): Promise<boolean>;
}

export function accessPolicyFromEpic024(
  boundary: MembershipCheck,
  readability: ReadabilityCheck,
): AssemblyPorts['access'] {
  return {
    async mayRead(actorId, source, requestingWorkspaceId): Promise<boolean> {
      try {
        await boundary.requireWithinWorkspace(requestingWorkspaceId, actorId);
      } catch (error) {
        // A boundary refusal is a decision. Anything else — the directory could
        // not be read — is an outage and propagates.
        if (error instanceof ForbiddenError) return false;
        throw error;
      }

      const crossing = source.workspaceId !== requestingWorkspaceId;
      if (crossing || !ACCESS_GOVERNED_TYPES.has(source.sourceType)) return true;

      return readability.effectivelyReadable(requestingWorkspaceId, actorId, {
        artifactType: source.sourceType,
        artifactId: source.sourceId,
      });
    },
  };
}
