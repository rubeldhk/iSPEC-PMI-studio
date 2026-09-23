/**
 * C2E test support — the two things `X19` made mandatory.
 *
 * Deliberately shared rather than copied into each suite: these encode
 * *policy* (every specification has a human owner; every actor is checked
 * against an authoritative workspace), and policy duplicated across ten files
 * drifts. A suite testing a violation overrides one field.
 */
import {
  WorkspaceBoundaryService,
  type ActorDirectory,
  type ActorRecord,
} from '../../src/modules/access/workspace-boundary.service.js';
import type { OwnershipBootstrap } from '../../src/modules/specifications/specifications-read.service.js';

/** A human owner, for fixtures written before ownership was required. */
export function ownershipFor(
  userId: string,
  overrides: Partial<OwnershipBootstrap> = {},
): OwnershipBootstrap {
  return {
    initiatingActorId: userId,
    initiatingActorType: 'human',
    ownerUserId: userId,
    ownerSnapshotId: `snap-${userId}`,
    correlationId: `corr-${userId}`,
    causationId: `cause-${userId}`,
    idempotencyKey: `idem-${userId}`,
    ...overrides,
  };
}

/**
 * A directory that vouches for the actors it was given, and nobody else.
 *
 * Not permissive: an unknown actor returns `null` and is refused, which is
 * what makes a cross-workspace test meaningful rather than decorative.
 */
export class FixtureActorDirectory implements ActorDirectory {
  private readonly actors = new Map<string, ActorRecord>();

  constructor(actors: readonly ActorRecord[] = []) {
    for (const actor of actors) this.actors.set(actor.id, actor);
  }

  add(id: string, workspaceId: string): this {
    this.actors.set(id, { id, workspaceId });
    return this;
  }

  async find(_workspaceId: string, actorId: string): Promise<ActorRecord | null> {
    return this.actors.get(actorId) ?? null;
  }
}

/** A boundary over a fixture directory. */
export function boundaryFor(actors: readonly ActorRecord[] = []): WorkspaceBoundaryService {
  return new WorkspaceBoundaryService(new FixtureActorDirectory(actors));
}
