/**
 * T1089 (EPIC-030 Phase C2A) — asking EPIC-009 to apply a transition.
 *
 * `FR-GEL-069`. **EPIC-009 exposes no shared transaction boundary**:
 * `SpecificationLifecycleService.transition()` performs two writes — record the
 * transition, then set the lifecycle state — and accepts no transaction client.
 * Changing that is an EPIC-009 change, outside this step's boundary.
 *
 * So atomicity is **not claimed**. This is the explicit orchestration model the
 * authorisation permits instead: a durable intent is recorded **before** the
 * call, and the outcome is reported honestly afterwards.
 *
 * ## Three outcomes, and why "unknown" is not a failure
 *
 * | EPIC-009 said | Outcome | Adjudication verdict |
 * |---|---|---|
 * | it applied the transition | `confirmed` | `applied` |
 * | it refused | `refused` | `refused` |
 * | nothing, or the call died | **`unknown`** | `reconciliation_required` |
 *
 * The third row is the one that matters. A timeout means the transition **may
 * or may not** have happened. Reporting `applied` would assert something
 * nobody observed; reporting `refused` would assert the opposite, equally
 * unobserved. A human resolves it, which is what `reconciliation_required`
 * means (`FR-GEL-069`).
 *
 * Integration tests: `backend/tests/integration/loop/adjudication-application.spec.ts` (T1088).
 */
import type { LifecycleApplicationOutcome, LifecycleApplicationPort } from '@pmi/loop-contract';

/** The slice of EPIC-009 this adapter uses. Narrow on purpose. */
export interface SpecificationTransitionPort {
  transition(
    ctx: { workspaceId: string; userId: string },
    specificationId: string,
    to: string,
    /**
     * `id` is the **authoritative transition** id. `null` where EPIC-009
     * changed the state but surfaced no transition identity — see
     * `application_transition_unidentified`. Not optional: a caller must decide
     * what to do about it rather than read `undefined` and move on.
     */
  ): Promise<{ id: string | null; lifecycleState: string }>;
}

/** Durable record of intent, written before the call and resolved after. */
export interface ApplicationIntentStore {
  open(input: {
    workspaceId: string;
    specificationId: string;
    from: string;
    to: string;
    actorId: string;
  }): Promise<string>;
  /**
   * `workspaceId` is passed rather than looked up: every row is tenant-scoped
   * (`BR-0001`), and reading the opened row to discover its tenant would mean
   * consulting a record to decide who is allowed to write it.
   */
  settle(
    intentId: string,
    workspaceId: string,
    outcome: 'confirmed' | 'refused' | 'unknown',
  ): Promise<void>;
}

export class LifecycleApplicationAdapter implements LifecycleApplicationPort {
  constructor(
    private readonly lifecycle: SpecificationTransitionPort,
    private readonly intents: ApplicationIntentStore,
  ) {}

  async apply(input: {
    workspaceId: string;
    specificationId: string;
    expectedCurrentStatus: string;
    requestedStatus: string;
    actorId: string;
  }): Promise<LifecycleApplicationOutcome> {
    // The intent is durable BEFORE the call. If this process dies mid-flight,
    // the open intent is what a reconciliation pass finds — without it, an
    // application that may have happened leaves no trace at all.
    const intentId = await this.intents.open({
      workspaceId: input.workspaceId,
      specificationId: input.specificationId,
      from: input.expectedCurrentStatus,
      to: input.requestedStatus,
      actorId: input.actorId,
    });

    try {
      const record = await this.lifecycle.transition(
        { workspaceId: input.workspaceId, userId: input.actorId },
        input.specificationId,
        input.requestedStatus,
      );

      // Confirmation means EPIC-009 reports the specification IS in the
      // requested state. Anything else is not a confirmation, however the call
      // returned.
      if (record.lifecycleState !== input.requestedStatus) {
        await this.intents.settle(intentId, input.workspaceId, 'unknown');
        return {
          outcome: 'unknown',
          // EPIC-009 answered — so the outcome is not unobserved, it is
          // *unconfirmed*. The two need different reconciliation, which is why
          // the cause is structural rather than prose.
          cause: 'application_state_unconfirmed',
          reason:
            `EPIC-009 returned without error but reports "${record.lifecycleState}" rather than ` +
            `"${input.requestedStatus}".`,
          intentId,
        };
      }

      // The state is right and the transition is anonymous. `applied` requires
      // an id (`FR-GEL-072` links proposal -> verdict -> transition), and
      // inventing one would put a false link in an audit record.
      if (record.id === null || record.id === '') {
        await this.intents.settle(intentId, input.workspaceId, 'unknown');
        return {
          outcome: 'unknown',
          cause: 'application_transition_unidentified',
          reason:
            'EPIC-009 confirmed the requested state but surfaced no transition identity, so the ' +
            'adjudication chain cannot be completed.',
          intentId,
        };
      }

      await this.intents.settle(intentId, input.workspaceId, 'confirmed');
      return { outcome: 'confirmed', transitionId: record.id };
    } catch (error) {
      // A refusal EPIC-009 states is a refusal. Anything else — a timeout, a
      // dropped connection, an unexpected fault — leaves the outcome genuinely
      // unknown, and must not be reported as either.
      if (isStatedRefusal(error)) {
        await this.intents.settle(intentId, input.workspaceId, 'refused');
        return { outcome: 'refused', reason: reasonOf(error) };
      }
      await this.intents.settle(intentId, input.workspaceId, 'unknown');
      return {
        outcome: 'unknown',
        cause: 'application_outcome_unknown',
        reason: reasonOf(error),
        intentId,
      };
    }
  }
}

/**
 * A refusal EPIC-009 *stated*, as opposed to a failure that happened to it.
 *
 * Deliberately narrow: only an error EPIC-009 raises to mean "this transition
 * is not permitted" counts. Treating every error as a refusal would report a
 * database outage as a policy decision.
 */
function isStatedRefusal(error: unknown): boolean {
  const name = error instanceof Error ? error.name : '';
  return (
    name === 'InvalidLifecycleTransitionError' ||
    name === 'ValidationFailedError' ||
    name === 'ForbiddenError'
  );
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : 'unknown failure';
}
