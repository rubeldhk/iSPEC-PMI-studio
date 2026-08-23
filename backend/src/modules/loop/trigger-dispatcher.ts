/**
 * T966 — where a rule fires. `FR-GEL-030`, `FR-GEL-033`.
 *
 * PC-1: framework-free.
 *
 * `FR-GEL-030` declares that triggered transitions exist and must cite a visible
 * rule; the loader refuses a configuration that does not (`T962`) and the writer
 * refuses a call that does not (`T950`). **This is where one actually fires**,
 * and it adds the one rule the other two cannot: `FR-GEL-033`'s
 * *one rule, one event, one advance*.
 *
 * **Why idempotency belongs here and not in the caller.** A rule engine that
 * delivers at-least-once is the normal case, not the broken one — a retry after
 * a timeout, a redelivered queue message, two workers picking up the same event.
 * Every one of those is a correct caller doing a correct thing, and if the loop
 * advanced twice it would be the loop's fault.
 *
 * **A repeat records a duplicate rather than advancing.** Not silence: the
 * second firing is a fact, and *"this rule fired twice for one event"* is how a
 * misconfigured trigger is noticed. Silently swallowing it would make a rule
 * firing in a tight loop indistinguishable from one firing correctly.
 */

import type { LoopStage, TransitionResult } from '@pmi/loop-contract';
import type { LoopStore } from './loop.store.js';
import type { ResolvedLoopConfig } from './loop-config.loader.js';
import type { AuthorityMap } from './authority.js';
import { TransitionWriter } from './transition-writer.js';

export interface TriggerFiring {
  readonly objectId: string;
  readonly toStage: LoopStage;
  readonly expectedVersion: number;
  /** `FR-GEL-031` — both required. A firing that cannot name itself is not one. */
  readonly ruleId: string;
  readonly eventId: string;
  readonly actorId: string;
  readonly actorAuthorities: readonly string[];
}

export type DispatchResult =
  | { readonly kind: 'advanced'; readonly result: TransitionResult }
  | { readonly kind: 'duplicate'; readonly result: TransitionResult; readonly originalId: string }
  | { readonly kind: 'refused'; readonly result: TransitionResult };

export class TriggerDispatcher {
  constructor(
    private readonly store: LoopStore,
    private readonly writer: TransitionWriter,
  ) {}

  async fire(
    firing: TriggerFiring,
    config: ResolvedLoopConfig,
    authorities: AuthorityMap,
  ): Promise<DispatchResult> {
    const object = await this.store.findObject(firing.objectId);
    if (!object) throw new Error(`no loop object ${firing.objectId}`);

    // FR-GEL-033 — one rule, one event, one advance.
    //
    // Checked against ACCEPTED transitions only, matching the partial unique
    // index in the migration. A previous REFUSED firing must not block a retry:
    // the rule may have been refused for a reason that has since changed, and
    // treating a refusal as "already handled" would strand the object.
    const prior = (await this.store.transitionsFor(firing.objectId)).find(
      (row) =>
        row.outcome === 'accepted' &&
        row.triggerRuleId === firing.ruleId &&
        row.triggerEventId === firing.eventId,
    );

    if (prior) {
      // Recorded, not swallowed. A rule firing twice for one event is a fact
      // worth having — it is how a misconfigured trigger is noticed at all.
      // Recorded through `recordRefusal`, not through `write`.
      //
      // `write` would consult authority and the declared transitions first, and
      // since the object is already AT the target stage it produced a record
      // saying "Analyze->Analyze is not declared" — true, and completely the
      // wrong reason. A duplicate is settled by the rule and the event; nothing
      // about authority is in question.
      const result = await this.writer.recordRefusal(
        {
          object,
          config,
          authorities,
          toStage: firing.toStage,
          // The version the object is AT, so the duplicate does not also look
          // like a lost race. A duplicate and a conflict are different facts.
          expectedVersion: object.version,
          actor: { kind: 'automation', id: firing.actorId, authorities: firing.actorAuthorities },
          trigger: { ruleId: firing.ruleId, eventId: firing.eventId },
          gates: [],
        },
        `rule ${firing.ruleId} already advanced this object for event ${firing.eventId} (FR-GEL-033)`,
        'loop.trigger-idempotency',
      );
      return { kind: 'duplicate', result, originalId: prior.id };
    }

    const result = await this.writer.write({
      object,
      config,
      authorities,
      toStage: firing.toStage,
      expectedVersion: firing.expectedVersion,
      actor: { kind: 'automation', id: firing.actorId, authorities: firing.actorAuthorities },
      trigger: { ruleId: firing.ruleId, eventId: firing.eventId },
      gates: [],
    });

    return result.outcome === 'accepted'
      ? { kind: 'advanced', result }
      : { kind: 'refused', result };
  }
}
