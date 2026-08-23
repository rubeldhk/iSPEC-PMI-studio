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

import { ValidationFailedError } from '../../core/errors.js';
import type { ResolvedLoopConfig } from './loop-config.loader.js';
import type { LoopConfigRegistry } from './config-registry.js';
import type { LoopStore } from './loop.store.js';
import {
  projectProgress,
  type LoopObjectRef,
  type LoopProgress,
  type LoopStage,
  type TransitionResult,
} from '@pmi/loop-contract';

export interface DeclareObjectInput {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly workflowType: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly actorId: string;
}

export interface TransitionInput {
  readonly objectId: string;
  readonly toStage: LoopStage;
  /** The OCC token — `R-030-1`, `FR-GEL-012`. */
  readonly expectedVersion: number;
  readonly actor: { readonly kind: 'human' | 'automation' | 'agent'; readonly id: string };
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
  'workspaceId',
  'projectId',
  'workflowType',
  'subjectType',
  'subjectId',
  'actorId',
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
  constructor(
    private readonly store: LoopStore,
    private readonly configs: LoopConfigRegistry,
  ) {}

  /**
   * `FR-GEL-006` — creates a `LoopObject` at `Event`, pinning `configVersion`.
   *
   * Validation is real and lands here now; the write lands at `T945`. Not
   * scope creep — `BR-0001` scoping and `FR-GEL-011`'s authenticated identity
   * are preconditions of the operation rather than part of it, and validating
   * a request the route cannot yet fulfil is what lets the route answer
   * *"your request is wrong"* instead of *"we broke"*.
   */
  async declareObject(input: DeclareObjectInput): Promise<LoopObjectRef> {
    const missing = DECLARE_REQUIRED.filter((field) => {
      const value = (input as Record<string, unknown> | null | undefined)?.[field];
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
      workspaceId: input.workspaceId,
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
  transition(_input: TransitionInput): Promise<TransitionResult> {
    throw new NotYetImplementedError('transition', 'T946–T960');
  }

  /** `FR-GEL-013` — every transition, in order, sufficient to reconstruct the loop. */
  history(_objectId: string): Promise<readonly TransitionResult[]> {
    throw new NotYetImplementedError('history', 'T971');
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

  /** `FR-GEL-022` — every exception and violation, without opening each transition. */
  exceptions(_objectId: string): Promise<readonly TransitionResult[]> {
    throw new NotYetImplementedError('exceptions', 'T973');
  }
}
