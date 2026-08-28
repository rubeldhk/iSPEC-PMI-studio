/**
 * T935 — the loop engine's service seam.
 *
 * PC-1: framework-free. Nothing here imports from `@nestjs/*`; the module wires
 * it, and it stays callable without HTTP so an MCP surface can be added in
 * Phase 3 without redesign.
 *
 * **What this file is at `T935`, and what it is not.** The module skeleton and
 * its wiring, so `T934`'s reachability test has a real graph to resolve and real
 * routes to reach. The five operations are declared and each **refuses with a
 * named reason** — `declareObject` lands at `T945`, `transition` across
 * `T946`–`T960`, the projections at `T971` onward.
 *
 * A stub returning a plausible success would be the exact defect this Epic's own
 * reachability test exists to catch, one level down: green tests over a
 * capability that does nothing. So each unbuilt operation **throws**, naming the
 * task that will implement it.
 *
 * **A throw here does not contradict `FR-GEL-014`.** That requirement is about
 * *governed refusals* — no authority, a lost OCC race, a failed gate — which are
 * `TransitionResult` values precisely so they get recorded and cannot be
 * swallowed by a caller's `catch`. "This operation does not exist yet" is not a
 * governed refusal, and giving it the same shape would put a placeholder in the
 * transition history.
 */

import { NotFoundError, UnauthenticatedError, ValidationFailedError } from '../../core/errors.js';
import { assertSameWorkspace } from '../../core/workspace.guard.js';
import type { ResolvedLoopConfig } from './loop-config.loader.js';
import type { LoopConfigRegistry } from './config-registry.js';
import type { LoopStore, LoopTransitionRow } from './loop.store.js';
import { TransitionWriter } from './transition-writer.js';
import type { AuthorityMap } from './authority.js';
import { projectFor } from './progress.projection.js';
import {
  projectProgress,
  type AuditSink,
  type LoopObjectRef,
  type LoopProgress,
  type LoopStage,
  type TransitionResult,
} from '@pmi/loop-contract';

/**
 * Who is acting, as established by the **session** — never by a request body.
 *
 * `DEF-030-003`: the transition path took the actor's *authorities* from the
 * request, so the authority gate asked whether the list the caller sent
 * contained the authority it required. The adjudication path in this same
 * module had always resolved them through `AuthorityPolicyPort`; the two halves
 * disagreed, and the wrong half was the one on the public route.
 */
export interface LoopPrincipal {
  readonly workspaceId: string;
  readonly userId: string;
}

/**
 * The authoritative directory, and the authoritative authority lookup.
 *
 * Both are **ports onto services this module already consumes** — EPIC-024's
 * `WorkspaceBoundaryService` and the `ADJUDICATION_AUTHORITY_POLICY` the
 * adjudicator uses. Neither is a new authorisation model, which `FR-GEL-063`
 * and the standing constraint both forbid.
 */
export interface LoopPrincipalResolver {
  requireWithinWorkspace(
    workspaceId: string,
    actorId: string,
  ): Promise<{
    readonly id: string;
    readonly workspaceId: string;
    readonly kind?: 'human' | 'agent' | 'service';
    readonly state?: 'active' | 'suspended' | 'revoked';
  }>;
}

export interface LoopAuthorityResolver {
  actorAuthorities(workspaceId: string, actorId: string): Promise<readonly string[]>;
}

export interface DeclareObjectInput {
  readonly projectId: string;
  readonly workflowType: string;
  readonly subjectType: string;
  readonly subjectId: string;
}

export interface TransitionInput {
  readonly objectId: string;
  /**
   * **Removed at `T1156`.** It used to be here, and `evaluateAuthority` decided
   * on it. Kept as a documented absence rather than deleted silently: a field
   * that reappears "for convenience" restores `DEF-030-003` exactly.
   */
  readonly actorAuthorities?: never;
  readonly toStage: LoopStage;
  /** The OCC token — `R-030-1`, `FR-GEL-012`. */
  readonly expectedVersion: number;
  /**
   * **Removed at `T1156`**, with `actorAuthorities`. A body claiming
   * `kind: 'human'` was recorded as human, which is `DEF-033-001`'s third
   * consequence in a different module. The kind is now resolved from the
   * directory, where it is a fact about the principal rather than a claim.
   */
  readonly actor?: never;
  /** Required for automation — `FR-GEL-031`. */
  readonly trigger?: { readonly ruleId: string; readonly eventId: string };
}

/**
 * Raised for a capability that is declared and not yet built. **Never** for a
 * governed refusal — those are `TransitionResult`s (`FR-GEL-014`).
 *
 * Deliberately NOT a `PlatformError` and deliberately carrying no status. The
 * platform's `STATUS` map documents nine codes and none of them means *"not
 * built yet"*; the comment beside `engine_unavailable` records why inventing a
 * tenth from an Epic that does not own `platform-api.md` is the mistake
 * `DEF-008-001` names. So this surfaces as `internal_error` — which is honest
 * for an unfinished route in a way that a fabricated `501` would not be, and it
 * disappears as each operation lands.
 */
export class NotYetImplementedError extends Error {
  constructor(operation: string, task: string) {
    super(`loop.${operation} is declared and not yet implemented — ${task}`);
    this.name = 'NotYetImplementedError';
  }
}

/**
 * The configuration version an object is pinned to at declaration.
 *
 * Fixed at 1 while configurations are files under version control (`R-030-7`).
 * `T944`'s tenant row carries the real sequence, and `T958` reads it — recorded
 * as a constant rather than a literal so the day it becomes dynamic there is one
 * place to change and one place to look.
 */
const CONFIG_VERSION = 1;

/** The fields without which a declaration cannot be recorded at all. */
const DECLARE_REQUIRED = [
  'projectId',
  'workflowType',
  'subjectType',
  'subjectId',
] as const;

export class LoopService {
  /**
   * The store and the registry are constructor arguments with no defaults.
   *
   * `LoopService` is constructed by `loop.module.ts`, which binds an in-memory
   * store and a registry loaded from `packages/loop-contract/workflows/`. A
   * default here would let a caller build a service that silently governs
   * nothing.
   */
  readonly #writer: TransitionWriter;

  constructor(
    private readonly store: LoopStore,
    private readonly configs: LoopConfigRegistry,
    /**
     * The tenant half of the configuration: who may perform which transition.
     *
     * Empty by default and **that is a refusal, not a permission** — an
     * unconfigured transition is one nobody authorised, and `authority.ts`
     * turns that into a refusal rather than a pass (`FR-GEL-062`).
     */
    private readonly authorities: AuthorityMap = {},
    audit?: AuditSink,
    /**
     * **Required in practice, optional in the signature** — see `resolve()`.
     *
     * Optional here only so the sixteen unit suites that construct this service
     * with a store and a registry keep compiling. Absent, every entry point
     * refuses: an unresolvable caller is not an anonymous one.
     */
    private readonly principals?: LoopPrincipalResolver,
    /** Authorities as the policy holds them (`DEF-030-003`), never as sent. */
    private readonly authorityLookup?: LoopAuthorityResolver,
  ) {
    this.#writer = new TransitionWriter(store, audit);
  }

  /**
   * `T1156` — establish who is acting, authoritatively, before anything else.
   *
   * Refuses when no resolver is wired rather than falling through to the old
   * behaviour. A service that authenticates only when it happens to have been
   * given the means is a service that does not authenticate.
   */
  async #acting(principal: LoopPrincipal | undefined): Promise<{
    workspaceId: string;
    id: string;
    kind: 'human' | 'agent' | 'service';
  }> {
    if (!principal?.workspaceId || !principal.userId) {
      throw new UnauthenticatedError('No valid session.');
    }
    if (!this.principals) {
      throw new UnauthenticatedError('No actor directory is wired; the loop cannot resolve a caller.');
    }
    const actor = await this.principals.requireWithinWorkspace(
      principal.workspaceId,
      principal.userId,
    );
    return { workspaceId: actor.workspaceId, id: actor.id, kind: actor.kind ?? 'human' };
  }

  /**
   * The authorities the policy says this actor holds.
   *
   * `[]` when nothing is wired, which `evaluateAuthority` turns into a refusal.
   * That is the same fail-closed default `GrantBackedAuthorities` already has,
   * stated here too so the absence cannot read as "unchecked".
   */
  async #heldAuthorities(workspaceId: string, actorId: string): Promise<readonly string[]> {
    return (await this.authorityLookup?.actorAuthorities(workspaceId, actorId)) ?? [];
  }

  /**
   * `FR-GEL-006` — creates a `LoopObject` at `Event`, pinning `configVersion`.
   *
   * Validation is real and lands here now; the write lands at `T945`. Not
   * scope creep — `BR-0001` scoping and `FR-GEL-011`'s authenticated identity
   * are preconditions of the operation rather than part of it, and validating
   * a request the route cannot yet fulfil is what lets the route answer
   * *"your request is wrong"* instead of *"we broke"*.
   */
  async declareObject(
    principal: LoopPrincipal,
    input: DeclareObjectInput,
  ): Promise<LoopObjectRef> {
    const actor = await this.#acting(principal);
    const missing = DECLARE_REQUIRED.filter((field) => {
      const value = (input as unknown as Record<string, unknown> | null | undefined)?.[field];
      return typeof value !== 'string' || value.length === 0;
    });
    if (missing.length > 0) {
      throw new ValidationFailedError(`declareObject requires: ${missing.join(', ')}`);
    }

    // FR-GEL-004 — the object's own type resolves its own configuration, or it
    // is not declared at all. `require` has no nullable variant to fall back to.
    const config = this.configs.require(input.workflowType);

    // FR-GEL-006 — pinned here, at creation, so an in-flight object still
    // resolves to the bytes it started under after the type is reconfigured.
    const row = await this.store.createObject({
      // The session's workspace, not the body's (`DEF-030-003`).
      workspaceId: actor.workspaceId,
      projectId: input.projectId,
      workflowType: config.workflowType,
      configVersion: CONFIG_VERSION,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      currentStage: 'Event',
    });

    return { workflowType: row.workflowType, objectId: row.id };
  }

  /**
   * `FR-GEL-010` — the one path that moves an object.
   *
   * Returns a result; never throws for a governed refusal (`FR-GEL-014`). The
   * throw below is not a refusal — it is the absence of an implementation, and
   * conflating the two is what would make a 501 look like a 403 in the history.
   */
  async transition(
    principal: LoopPrincipal,
    input: TransitionInput,
  ): Promise<TransitionResult> {
    const actor = await this.#acting(principal);
    const object = await this.store.findObject(input.objectId);
    if (!object) throw new NotFoundError(`no loop object ${input.objectId}`);

    // Tenancy, before the object's configuration is read. The opaque 404 is
    // `assertSameWorkspace`'s, so a caller cannot learn that an object it may
    // not touch exists.
    assertSameWorkspace(actor.workspaceId, object, { targetType: 'loop_object' });

    // FR-GEL-004 — the OBJECT's type resolves the configuration, never the
    // caller's. A caller naming a workflow type is a caller choosing its own
    // rules.
    const config = this.configs.require(object.workflowType);

    return this.#writer.write({
      object,
      config,
      authorities: this.authorities,
      toStage: input.toStage,
      expectedVersion: input.expectedVersion,
      actor: {
        // `agent` is an origin at the API surface; the loop records two kinds
        // (FR-GEL-032), and an agent acting on its own is automation. The kind
        // is now the directory's, so a body claiming `human` buys nothing.
        kind: actor.kind === 'human' ? 'human' : 'automation',
        id: actor.id,
        // `DEF-030-003`. Resolved through the same policy port the adjudicator
        // uses, so the two halves of this module finally agree about where an
        // authority comes from.
        authorities: await this.#heldAuthorities(object.workspaceId, actor.id),
      },
      ...(input.trigger ? { trigger: input.trigger } : {}),
      gates: [],
    });
  }

  /**
   * `FR-GEL-013` — every transition, in order, sufficient to reconstruct the
   * loop **without reading current state**.
   *
   * Returns the rows rather than `TransitionResult`s: a result is an answer to
   * a caller who just acted, and a history is a record. `T960` reconstructs the
   * object from these with `currentStage` withheld, which is the property this
   * ordering exists to support.
   */
  async history(
    principal: LoopPrincipal,
    objectId: string,
  ): Promise<readonly LoopTransitionRow[]> {
    const actor = await this.#acting(principal);
    const object = await this.store.findObject(objectId);
    // An object that does not exist is NOT an object with no transitions.
    // Returning `[]` would say the second when the truth is the first — the same
    // conflation FR-GEL-008 forbids for an omitted stage, one level up.
    if (!object) {
      throw new NotFoundError(`no loop object ${objectId}`);
    }
    // `DEF-030-003`: this route took an object id and nothing else. With a
    // persistent store that is `DEF-037-001`'s leaking history endpoint, so the
    // scope check goes in now rather than when the store is swapped.
    assertSameWorkspace(actor.workspaceId, object, { targetType: 'loop_object' });
    const rows = await this.store.transitionsFor(objectId);
    return [...rows].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  }

  /**
   * `FR-GEL-050`, `FR-GEL-051` — the projection.
   *
   * The one operation with real behaviour at `T935`, because the projection is
   * a pure function of the contract (`projectProgress`) and needs no store. It
   * is wired to nothing yet: `T972` supplies the object's configured stages and
   * position. Kept here so the contract's projection has a call site rather than
   * only a unit test.
   */
  progressFor(input: {
    configuredStages: readonly LoopStage[];
    currentStage: LoopStage;
    completedStages: readonly LoopStage[];
  }): readonly LoopProgress[] {
    return projectProgress(input);
  }

  /**
   * T940 — the same projection, resolved from a loaded configuration.
   *
   * The overload callers should reach for: it takes the **object's own
   * configuration**, so the configured stages come from the workflow type the
   * object belongs to rather than from whatever the caller passed. That is
   * `FR-GEL-004` at the projection — a Room asking for type A's progress cannot
   * be handed type B's shape by supplying the wrong array.
   */
  progressForConfig(
    config: ResolvedLoopConfig,
    position: { currentStage: LoopStage; completedStages: readonly LoopStage[] },
  ): readonly LoopProgress[] {
    return projectProgress({
      configuredStages: config.stages,
      currentStage: position.currentStage,
      completedStages: position.completedStages,
    });
  }

  /**
   * `FR-GEL-050`, `FR-GEL-051` — an object's progress, resolved from its own
   * configuration and its own history.
   *
   * `completedStages` comes from the ACCEPTED transitions rather than from a
   * column, because `FR-GEL-013` requires the history to be sufficient on its
   * own — and a stored "stages completed" list would be a second source that
   * can disagree with it.
   */
  async progressOf(
    principal: LoopPrincipal,
    objectId: string,
  ): Promise<readonly LoopProgress[]> {
    const actor = await this.#acting(principal);
    const object = await this.store.findObject(objectId);
    if (!object) throw new NotFoundError(`no loop object ${objectId}`);
    assertSameWorkspace(actor.workspaceId, object, { targetType: 'loop_object' });
    const config = this.configs.require(object.workflowType);
    // T973 — the derivation lives in `progress.projection.ts` so the service and
    // the Room cannot compute "completed" two different ways.
    return projectFor({ object, config, history: await this.history(principal, objectId) });
  }

  /**
   * `FR-GEL-022` — every exception and violation, without opening each
   * transition.
   *
   * `conflict` and `refused` are deliberately NOT included. An exception is an
   * authorised departure from the rules and a violation is an unauthorised one;
   * a lost race is neither, and a list that mixed them would make "how often do
   * we bypass our own gates?" unanswerable.
   */
  async exceptions(
    principal: LoopPrincipal,
    objectId: string,
  ): Promise<readonly LoopTransitionRow[]> {
    // Scope is enforced by `history`, which this delegates to entirely.
    const rows = await this.history(principal, objectId);
    return rows.filter((r) => r.outcome === 'exception' || r.outcome === 'violation');
  }
}
