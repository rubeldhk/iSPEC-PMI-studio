/**
 * T950, T952, T954, T955, T964 — the one path that moves an object.
 * `FR-GEL-010`, `FR-GEL-012`, `FR-GEL-014`, `FR-GEL-015`, `FR-GEL-031`,
 * `FR-GEL-032`, `FR-GEL-041`.
 *
 * PC-1: framework-free.
 *
 * **Three rules this file exists to hold, and each has a way of quietly
 * stopping being true:**
 *
 *   1. **A refusal is recorded** (`FR-GEL-014`). Every early return below writes
 *      a row before returning. A loop that refused correctly and recorded
 *      nothing passes every behavioural test anyone would think to write — the
 *      object did not move, the caller got a refusal, the state is right — and
 *      loses the answer to *"has anyone tried this, and what stopped them?"*
 *   2. **The write is one transaction** (`FR-GEL-041`, `R-030-2`). The
 *      transition and its audit record land together or neither lands. The
 *      failure mode is a process dying between two writes, which no test catches
 *      by accident.
 *   3. **Concurrency is optimistic and the loser is told who won** (`R-030-1`,
 *      `FR-GEL-015`). Advancing is conditional on the version the attempt was
 *      made against; the loser records `conflict` with `wonBy`, so a `409` is
 *      readable rather than a shrug.
 */

import type {
  AuditSink,
  GateOutcome,
  LoopStage,
  TransactionHandle,
  TransitionResult,
} from '@pmi/loop-contract';
import { evaluateAuthority, transitionKey, type AuthorityMap } from './authority.js';
import type { ResolvedLoopConfig } from './loop-config.loader.js';
import type { LoopObjectRow, LoopStore, LoopTransitionRow } from './loop.store.js';

export interface TransitionActor {
  readonly kind: 'human' | 'automation';
  readonly id: string;
  readonly authorities: readonly string[];
}

export interface TransitionRequest {
  readonly object: LoopObjectRow;
  readonly config: ResolvedLoopConfig;
  readonly authorities: AuthorityMap;
  readonly toStage: LoopStage;
  /** `R-030-1` — the OCC token the caller read the object at. */
  readonly expectedVersion: number;
  readonly actor: TransitionActor;
  /** `FR-GEL-031` — required when `actor.kind` is `automation`. */
  readonly trigger?: { readonly ruleId: string; readonly eventId: string };
  readonly gates: readonly GateOutcome[];
}

export class TransitionWriter {
  constructor(
    private readonly store: LoopStore,
    /**
     * `EPIC-004`'s sink, supplied at the composition root. Absent means audit is
     * unwired — and this Epic does not silently proceed without it: see
     * `#recordAndAudit`.
     */
    private readonly audit?: AuditSink,
  ) {}

  async write(request: TransitionRequest): Promise<TransitionResult> {
    const { object, config, toStage, actor } = request;
    const from = object.currentStage;

    // FR-GEL-031, RULE-11 — before anything else, because an automation with no
    // rule must not reach a state where it could be permitted.
    if (actor.kind === 'automation' && !request.trigger?.ruleId) {
      return this.#refuse(
        request,
        transitionKey(from, toStage),
        'an automated transition must name the trigger rule that fired it (FR-GEL-031, RULE-11)',
      );
    }

    // Declared, configured, permitted — in that order (see `authority.ts`).
    const verdict = evaluateAuthority({
      config,
      authorities: request.authorities,
      from,
      to: toStage,
      actorAuthorities: actor.authorities,
    });
    if (!verdict.permitted) {
      return this.#refuse(request, this.#requiredAuthorityLabel(request), verdict.reason);
    }

    // FR-GEL-021 — a gate that did not resolve `satisfied` stops the transition,
    // and the outcome is recorded rather than the transition silently proceeding.
    const blocking = request.gates.find((gate) => gate.result !== 'satisfied');
    if (blocking) {
      return this.#refuse(
        request,
        verdict.basis,
        `gate "${blocking.gateId}" resolved ${blocking.result} (FR-GEL-021)`,
        blocking.result === 'violation' ? 'violation' : 'exception',
      );
    }

    // R-030-1 + FR-GEL-041 — the advance, the record and the audit are ONE
    // transaction.
    //
    // The advance is inside it deliberately. With the advance outside, a failing
    // audit would roll back to a snapshot taken *after* the object had already
    // moved — the object would stay advanced with no record of why, which is the
    // exact opposite of fail-closed and would still pass a test that only
    // checked the transition table.
    const settled = await this.store.runInTransaction(async (tx) => {
      const advanced = await this.store.advanceObject({
        id: object.id,
        expectedVersion: request.expectedVersion,
        toStage,
      });
      // Returned, not thrown: a lost race must NOT roll back, because the
      // conflict is a fact this loop records.
      if (!advanced) return { kind: 'conflict' as const };

      const row = await this.#append(request, tx, {
        fromStage: from,
        outcome: 'accepted',
        refusalReason: null,
        wonBy: null,
        authorityBasis: verdict.basis,
      });
      return { kind: 'accepted' as const, row, version: advanced.version };
    });

    if (settled.kind === 'conflict') {
      // FR-GEL-015 — first commit wins, and the loser is told which transition
      // won rather than being left to infer it from a version number.
      const wonBy = await this.#winnerOf(object.id, request.expectedVersion);
      const current = await this.store.findObject(object.id);
      return this.#refuse(
        request,
        verdict.basis,
        `this attempt held version ${request.expectedVersion} and the object is at ` +
          `${current?.version ?? 'unknown'} — first commit wins (FR-GEL-015)` +
          (wonBy ? `; won by transition ${wonBy}` : ''),
        'conflict',
        wonBy,
      );
    }

    return {
      outcome: 'accepted',
      transitionId: settled.row.id,
      object: { workflowType: object.workflowType, objectId: object.id },
      fromStage: from,
      toStage,
      actor: { kind: actor.kind, id: actor.id },
      version: settled.version,
      gates: request.gates,
    };
  }

  /**
   * Record a refusal decided **before** the transition rules were consulted.
   *
   * `TriggerDispatcher` needs this: a duplicate firing (`FR-GEL-033`) is settled
   * by the rule and the event, not by authority or by whether the transition is
   * declared. Routing it through `write` produced a record saying
   * *"Analyze->Analyze is not declared"* — true, and completely the wrong reason.
   *
   * Still goes through `#refuse`, so it is recorded in one transaction with its
   * audit entry like every other refusal. The point is to name the right cause,
   * not to take a shortcut past the guarantees.
   */
  recordRefusal(
    request: TransitionRequest,
    reason: string,
    authorityBasis = 'loop.pre-transition',
  ): Promise<TransitionResult> {
    return this.#refuse(request, authorityBasis, reason);
  }

  /** The authority the transition required, for a refusal's `authorityBasis`. */
  #requiredAuthorityLabel(request: TransitionRequest): string {
    const key = transitionKey(request.object.currentStage, request.toStage);
    const required = request.authorities[key];
    return required && required.length > 0 ? `required:${required.join('|')}` : `required:${key}`;
  }

  /** Which accepted transition took the version this attempt was holding. */
  async #winnerOf(objectId: string, expectedVersion: number): Promise<string | null> {
    const rows = await this.store.transitionsFor(objectId);
    const winner = rows.find((r) => r.outcome === 'accepted' && r.objectVersion === expectedVersion);
    return winner?.id ?? null;
  }

  /**
   * Every refusal path funnels through here, so *"is this one recorded?"* has
   * one answer instead of five.
   */
  async #refuse(
    request: TransitionRequest,
    authorityBasis: string,
    reason: string,
    outcome: 'refused' | 'conflict' | 'exception' | 'violation' = 'refused',
    wonBy: string | null = null,
  ): Promise<TransitionResult> {
    const row = await this.#recordAndAudit(request, {
      fromStage: request.object.currentStage,
      outcome,
      refusalReason: reason,
      wonBy,
      authorityBasis,
    });
    return {
      outcome,
      transitionId: row.id,
      object: { workflowType: request.object.workflowType, objectId: request.object.id },
      fromStage: request.object.currentStage,
      toStage: request.toStage,
      actor: { kind: request.actor.kind, id: request.actor.id },
      version: request.object.version,
      gates: request.gates,
      detail: reason,
    };
  }

  /**
   * `FR-GEL-041`, `R-030-2` — the transition and its audit record, atomically.
   *
   * If the audit write fails the whole thing rolls back, including an advance
   * that already happened. **Fail-closed**: a transition whose audit did not
   * land is a state change nobody can account for, and `SC-GEL-003` asserts the
   * stage is unchanged on read-back.
   */
  async #recordAndAudit(
    request: TransitionRequest,
    fields: {
      fromStage: LoopStage | null;
      outcome: LoopTransitionRow['outcome'];
      refusalReason: string | null;
      wonBy: string | null;
      authorityBasis: string;
    },
  ): Promise<LoopTransitionRow> {
    return this.store.runInTransaction((tx) => this.#append(request, tx, fields));
  }

  /** The record and its audit entry, inside a transaction the caller opened. */
  async #append(
    request: TransitionRequest,
    tx: TransactionHandle,
    fields: {
      fromStage: LoopStage | null;
      outcome: LoopTransitionRow['outcome'];
      refusalReason: string | null;
      wonBy: string | null;
      authorityBasis: string;
    },
  ): Promise<LoopTransitionRow> {
    {
      const row = await this.store.appendTransition(
        {
          workspaceId: request.object.workspaceId,
          objectId: request.object.id,
          // FR-GEL-012 — the version the attempt was made AGAINST, not the one
          // it produced. Two racing attempts were both made against the same
          // number, and that is what orders them.
          objectVersion: request.expectedVersion,
          fromStage: fields.fromStage,
          toStage: request.toStage,
          outcome: fields.outcome,
          refusalReason: fields.refusalReason,
          wonBy: fields.wonBy,
          actorId: request.actor.id,
          actorKind: request.actor.kind,
          authorityBasis: fields.authorityBasis,
          triggerRuleId: request.trigger?.ruleId ?? null,
          triggerEventId: request.trigger?.eventId ?? null,
          configVersion: request.object.configVersion,
          gateOutcomes: request.gates,
        },
        tx,
      );

      if (this.audit) {
        await this.audit.record(
          {
            object: { workflowType: request.object.workflowType, objectId: request.object.id },
            fromStage: fields.fromStage ?? request.toStage,
            toStage: request.toStage,
            actor: { kind: request.actor.kind, id: request.actor.id },
            outcome: fields.outcome,
            occurredAt: row.occurredAt,
          },
          tx,
        );
      }

      return row;
    }
  }
}

export type { TransactionHandle };
