/**
 * T1126 (EPIC-024, C2E) — the workspace boundary, checked before grants.
 *
 * Finding `X19`: an artifact with no grants was readable and editable by
 * anyone who could name the workspace, and `workspaceId` came from the caller.
 * Two holes, and the second is the deeper one — a caller-supplied tenant id
 * that nothing validates is not a boundary, it is a parameter.
 *
 * ## What this is, and what it deliberately is not
 *
 * This is a **boundary** check: does this actor exist, and does the workspace
 * they belong to match the one being acted on? It is **not** a role model.
 * There are no roles here, no permissions, no hierarchy — the authorisation
 * decision still belongs entirely to EPIC-024's grants. This only establishes
 * that the actor is inside the tenant before those grants are consulted.
 *
 * `User.workspaceId` is the authoritative binding, and it is the only one the
 * schema has. Membership is therefore read from the user record rather than
 * inferred from what the request claimed.
 *
 * ## Fails closed, and says which way it failed
 *
 * A missing or foreign actor is refused **opaquely** — the caller learns
 * nothing about whether the actor or the artifact exists, which is the same
 * posture `FR-ACC-024` takes for artifacts. A directory that cannot be *read*
 * is a different fact: it is an operational failure, not a decision about this
 * actor, and reporting it as a refusal would tell an operator their access
 * model rejected someone when in truth the database was unreachable.
 */
import { ForbiddenError, ProviderUnavailableError } from '../../core/errors.js';

/**
 * The authoritative actor record. Identity only — no roles, by design.
 *
 * `kind` and `state` are optional and default to `'human'` / `'active'`. A
 * `users` row has neither column and needs neither: a person in the workspace
 * is a person in the workspace. They exist for **non-human** principals, whose
 * right to act can be withdrawn without deleting them (`T1140`).
 */
export interface ActorRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly kind?: 'human' | 'agent' | 'service';
  readonly state?: 'active' | 'suspended' | 'revoked';
}

/**
 * Where authoritative actor identity is read from.
 *
 * `find` returns `null` for an actor that does not exist, and **throws** when
 * the directory cannot be consulted. The two must stay distinguishable: an
 * absent actor is a decision, an unreadable directory is not.
 */
export interface ActorDirectory {
  /**
   * `workspaceId` is passed rather than bound at construction: the directory is
   * a singleton and the workspace is per-request. An earlier draft captured it
   * in the constructor, which would have served whichever tenant happened to
   * compose first.
   */
  find(workspaceId: string, actorId: string): Promise<ActorRecord | null>;
}

/** Refusal at the boundary. Carries no detail — see the note above. */
export class WorkspaceBoundaryViolation extends ForbiddenError {
  constructor(readonly detail: string) {
    super('Not found.');
    this.name = 'WorkspaceBoundaryViolation';
  }
}

/** The directory could not be consulted. Distinct from a refusal. */
export class ActorDirectoryUnavailable extends ProviderUnavailableError {
  constructor(cause: string) {
    super(`Actor directory unavailable: ${cause}`);
    this.name = 'ActorDirectoryUnavailable';
  }
}

export class WorkspaceBoundaryService {
  constructor(private readonly directory: ActorDirectory) {}

  /**
   * Establish that `actorId` is authoritatively inside `workspaceId`.
   *
   * Returns the authoritative record — callers should prefer it over the
   * identifiers they were handed, so a later check cannot silently use the
   * caller's version of the truth.
   */
  async requireWithinWorkspace(workspaceId: string, actorId: string): Promise<ActorRecord> {
    if (!isNonEmpty(workspaceId) || !isNonEmpty(actorId)) {
      // Malformed input fails closed. An empty actor id must never fall
      // through to a grant lookup that might match an empty column.
      throw new WorkspaceBoundaryViolation('workspace or actor identity is missing or malformed');
    }

    let actor: ActorRecord | null;
    try {
      actor = await this.directory.find(workspaceId, actorId);
    } catch (error) {
      throw new ActorDirectoryUnavailable(
        error instanceof Error ? `${error.name}: ${error.message}` : 'unknown fault',
      );
    }

    if (actor === null) {
      throw new WorkspaceBoundaryViolation('no authoritative actor with that identity');
    }

    // The load-bearing line. `workspaceId` arrived from the caller; this is
    // the only place it is checked against something the caller does not
    // control. Naming another workspace now buys nothing.
    if (actor.workspaceId !== workspaceId) {
      throw new WorkspaceBoundaryViolation('actor belongs to a different workspace');
    }

    // A suspended or revoked principal is still a real, correctly-scoped
    // identity — which is exactly why the boundary has to say no. Deleting the
    // record instead would take its history with it (`T1140`).
    const state = actor.state ?? 'active';
    if (state !== 'active') {
      throw new WorkspaceBoundaryViolation(`principal is ${state}`);
    }

    return actor;
  }
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Narrow view of `PrismaClient.user` — identity only, never the password. */
export interface UserDelegate {
  findUnique(args: {
    where: { id: string };
    select: { id: true; workspaceId: true };
  }): Promise<{ id: string; workspaceId: string } | null>;
}

export class PrismaActorDirectory implements ActorDirectory {
  constructor(private readonly users: UserDelegate) {}

  // `workspaceId` is unused here on purpose: a user is looked up by id and the
  // boundary compares the tenancy on the record that comes back. Filtering the
  // query by the caller's workspace would make a foreign actor indistinguishable
  // from one that does not exist, and the boundary could not name the reason.
  async find(_workspaceId: string, actorId: string): Promise<ActorRecord | null> {
    // `select` is narrow on purpose: this path needs identity and tenancy and
    // has no business loading a credential hash to answer the question.
    return this.users.findUnique({
      where: { id: actorId },
      select: { id: true, workspaceId: true },
    });
  }
}

/**
 * The directory used where no authoritative user source is composed.
 *
 * It refuses **everything**, which is the correct posture and not a
 * placeholder: an unconfigured identity source cannot vouch for anyone. The
 * alternative — vouching for everyone — is the shape of `X19` itself.
 */
export class UnconfiguredActorDirectory implements ActorDirectory {
  async find(): Promise<null> {
    return null;
  }
}


/**
 * T1140 (EPIC-024, C3B) — one directory over both kinds of principal.
 *
 * Humans resolve against `users`; agents and services resolve through
 * **EPIC-028's public registry port**. EPIC-024 does not read EPIC-028's tables
 * — the authorisation for this step forbids it, and a second reader of another
 * epic's schema is how two epics end up disagreeing about who exists.
 *
 * Humans are tried first. Both namespaces are separate and an id cannot appear
 * in both, so the order is about cost rather than precedence: most callers are
 * people, and a person should not require a registry round-trip.
 *
 * This is **not** a parallel authorisation system. It answers one question —
 * *does this identity exist here, and may it act?* — for two kinds of actor.
 * Everything after it is the same grant evaluation it always was.
 */
export interface NonHumanPrincipalLookup {
  find(
    workspaceId: string,
    principalId: string,
  ): Promise<{
    principalId: string;
    kind: 'agent' | 'service';
    workspaceId: string;
    state: 'active' | 'suspended' | 'revoked';
    identityVersion: number;
  } | null>;
}

export class CompositePrincipalDirectory implements ActorDirectory {
  constructor(
    private readonly humans: ActorDirectory,
    private readonly principals: NonHumanPrincipalLookup,
  ) {}

  async find(workspaceId: string, actorId: string): Promise<ActorRecord | null> {
    const human = await this.humans.find(workspaceId, actorId);
    if (human !== null) return human;

    const principal = await this.principals.find(workspaceId, actorId);
    if (principal === null) return null;
    return {
      id: principal.principalId,
      workspaceId: principal.workspaceId,
      kind: principal.kind,
      state: principal.state,
    };
  }
}
