/**
 * T1098–T1101 (EPIC-030 C2A closure) — the production adapters behind the
 * adjudication ports.
 *
 * Closure finding `X6` was that all seven ports had zero production
 * implementations: the decision engine was constructible only by tests, which
 * is not an exposed capability. This file is the other half.
 *
 * ## The rule these follow
 *
 * Each adapter **delegates to the owning Epic's authoritative service** and
 * decides nothing itself. Where an owning Epic has no such service, the adapter
 * **refuses** — it does not guess, and it does not reimplement the policy. That
 * is `FR-GEL-062`'s shape and the decision already recorded in
 * `loop.tokens.ts`: *"defaulting them to a permissive no-op would install the
 * `ADR-0025` failure mode at the foundation."*
 *
 * ## Narrow structural dependencies, not imported classes
 *
 * Following `job.store.ts`: each adapter states the **shape** it needs. The
 * concrete service drops onto it unchanged, the module wires it, and this file
 * does not import EPIC-009's or EPIC-024's internals — which is also what keeps
 * the architecture test honest.
 */
import { randomUUID } from 'node:crypto';
import type { AdjudicationVerdict } from '@pmi/loop-contract';
import type {
  AdjudicationEvidenceInput,
  AdjudicationRecordPort,
  AuthorityPolicyPort,
  GateDisposition,
  GateOutcomePort,
  IntakeAuthorizationPort,
  LifecycleValidationPort,
} from './adjudicator.service.js';
import type {
  ApplicationIntentStore,
  SpecificationTransitionPort,
} from './lifecycle-application.adapter.js';
import type { LifecycleApplicationOutcome, LifecycleApplicationPort } from '@pmi/loop-contract';
import {
  rowFromEvidence,
  verdictFromRow,
  type AdjudicationEvidenceRow,
} from './adjudication-evidence.js';

// ---------------------------------------------------------------------------
// 1. EPIC-009 — lifecycle validity.
// ---------------------------------------------------------------------------

/** The shape of `SpecificationsReadService.get`. */
export interface SpecificationReadShape {
  get(workspaceId: string, id: string): Promise<{ lifecycleState: string }>;
}

/** The shape of `permittedFrom` from EPIC-009's lifecycle machine. */
export type PermittedFrom = (state: string) => readonly string[];

/**
 * Validity, answered by EPIC-009 (`FR-GEL-065`).
 *
 * `permittedFrom` is EPIC-009's own function, injected rather than copied. A
 * transition table duplicated here would be a second lifecycle engine, which
 * the authorisation forbids in as many words.
 */
export class EpicNineLifecycleValidation implements LifecycleValidationPort {
  constructor(
    private readonly reads: SpecificationReadShape,
    private readonly permittedFrom: PermittedFrom,
  ) {}

  async currentStatus(workspaceId: string, specificationId: string): Promise<string> {
    const detail = await this.reads.get(workspaceId, specificationId);
    return detail.lifecycleState;
  }

  async isPermitted(from: string, to: string): Promise<boolean> {
    return this.permittedFrom(from).includes(to);
  }
}

// ---------------------------------------------------------------------------
// 2. EPIC-009 — applying the transition.
// ---------------------------------------------------------------------------

/** The shape of `SpecificationLifecycleService.transition`. */
export interface SpecificationLifecycleShape {
  transition(
    ctx: { workspaceId: string; userId: string },
    id: string,
    to: string,
  ): Promise<{ id: string; lifecycleState: string }>;
}

/**
 * Ask EPIC-009 to apply the transition.
 *
 * **The id EPIC-009 returns is the specification's, not the transition's.**
 * Passing it through as `appliedTransitionId` would put a false link in the
 * audit chain, so this adapter reports `null` and lets the application adapter
 * resolve it to `application_transition_unidentified`. Closing that properly
 * needs EPIC-009 to surface the transition it records — see the C2A closure
 * report.
 */
export class EpicNineTransitionAdapter implements SpecificationTransitionPort {
  constructor(private readonly lifecycle: SpecificationLifecycleShape) {}

  async transition(
    ctx: { workspaceId: string; userId: string },
    specificationId: string,
    to: string,
  ): Promise<{ id: string | null; lifecycleState: string }> {
    const record = await this.lifecycle.transition(ctx, specificationId, to);
    return { id: null, lifecycleState: record.lifecycleState };
  }
}

// ---------------------------------------------------------------------------
// 3. EPIC-021 — gate outcomes. No production service exists.
// ---------------------------------------------------------------------------

/**
 * EPIC-021 supplies no gate-outcome service: `backend/src/modules/reviews/`
 * has no Nest module, is imported by nothing, ships only an in-memory store,
 * exposes no per-specification query, and nothing writes `gate_outcomes`.
 *
 * So this reports **`unavailable`**, which routes to reconciliation — not to a
 * refusal. It is not a fixture and not a default-allow: it asserts the absence
 * of an answer rather than inventing one. `passed` here would mean "every
 * declared gate is satisfied", a claim nobody established, on the exact axis
 * `ADR-0025` warns about; `failed` would mean a gate examined this proposal and
 * turned it down, which is equally untrue.
 */
export class UnconfiguredGateOutcomes implements GateOutcomePort {
  async outcomesFor(): Promise<{ disposition: GateDisposition; blocking: string }> {
    return {
      disposition: 'unavailable',
      blocking: 'EPIC-021 supplies no gate-outcome service in this deployment',
    };
  }
}

// ---------------------------------------------------------------------------
// 4. EPIC-030 — transition authority policy.
// ---------------------------------------------------------------------------

export interface TransitionAuthorityRule {
  readonly from: string;
  readonly to: string;
  readonly requires: readonly string[];
  readonly autoApply: boolean;
}

export interface AuthorityLookup {
  authoritiesFor(workspaceId: string, actorId: string): Promise<readonly string[]>;
}

/**
 * Policy is configuration this Epic reads, not code (`PP-014`).
 *
 * ## `autoApply` defaults to TRUE, reversed in C2C
 *
 * C2A set it to `false`, reasoning that forgetting to write a rule should not
 * amount to authorising automatic application. That was right when no gates
 * existed: withholding application was the only brake in the system.
 *
 * It is wrong now, and it was hiding. With `false` as the default and no way to
 * configure a rule, **no proposal could ever reach `applied` in production** —
 * so the C2C end-to-end proof failed on a policy default rather than on
 * anything the remediation was about. A default that makes the governed path
 * unreachable is not a safe default; it is an off switch.
 *
 * What actually protects a transition is the chain in front of this: EPIC-024
 * authorises intake, EPIC-021's gates require a **human decision**
 * (`FR-ENH-014`), authority is checked, and separation of duties is absolute.
 * Once all of those pass, withholding application adds no governance — it only
 * strands the proposal.
 *
 * `validated` is therefore now the **configured exception**: a rule that names
 * a transition with `autoApply: false` routes it for separate application.
 * `requiredAuthorities` still defaults to `[]` and that default is unchanged —
 * the reversal is about application, not about authority.
 */
export class ConfiguredAuthorityPolicy implements AuthorityPolicyPort {
  constructor(
    private readonly rules: readonly TransitionAuthorityRule[],
    private readonly authorities: AuthorityLookup,
  ) {}

  private ruleFor(from: string, to: string): TransitionAuthorityRule | undefined {
    return this.rules.find((r) => r.from === from && r.to === to);
  }

  async requiredAuthorities(from: string, to: string): Promise<readonly string[]> {
    return this.ruleFor(from, to)?.requires ?? [];
  }

  async actorAuthorities(workspaceId: string, actorId: string): Promise<readonly string[]> {
    return this.authorities.authoritiesFor(workspaceId, actorId);
  }

  async autoApplyPermitted(from: string, to: string): Promise<boolean> {
    return this.ruleFor(from, to)?.autoApply ?? true;
  }
}

/** No authority is held until EPIC-024 grants say otherwise. */
export class GrantBackedAuthorities implements AuthorityLookup {
  constructor(
    private readonly grants: {
      authoritiesFor?(workspaceId: string, actorId: string): Promise<readonly string[]>;
    },
  ) {}

  async authoritiesFor(workspaceId: string, actorId: string): Promise<readonly string[]> {
    return (await this.grants.authoritiesFor?.(workspaceId, actorId)) ?? [];
  }
}

// ---------------------------------------------------------------------------
// 5. EPIC-024 — authorisation at intake.
// ---------------------------------------------------------------------------

/** The shape of `AccessEnforcementService.requireEditable`. */
export interface AccessEnforcementShape {
  requireEditable(
    workspaceId: string,
    userId: string,
    artifact: { artifactType: string; artifactId: string },
    action?: string,
  ): Promise<void>;
}

/**
 * Reuses EPIC-024 (`T1095`). No second authorisation model, and no local
 * interpretation of a grant: this hands EPIC-024 the tenant, the actor and the
 * artifact, and EPIC-024 throws or does not. Its refusal also records an access
 * attempt, which is EPIC-024's audit and not this Epic's to duplicate.
 */
export class AccessIntakeAuthorization implements IntakeAuthorizationPort {
  constructor(private readonly access: AccessEnforcementShape) {}

  async requireEditable(
    workspaceId: string,
    actorId: string,
    specificationId: string,
  ): Promise<void> {
    await this.access.requireEditable(
      workspaceId,
      actorId,
      { artifactType: 'specification', artifactId: specificationId },
      'propose-transition',
    );
  }
}

// ---------------------------------------------------------------------------
// 6. EPIC-030 — immutable evidence, in PostgreSQL.
// ---------------------------------------------------------------------------

/** Narrow view of `PrismaClient.adjudicationRecord`. */
export interface AdjudicationRecordDelegate {
  create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  findUnique(args: {
    where: {
      workspaceId_proposalId_idempotencyKey: {
        workspaceId: string;
        proposalId: string;
        idempotencyKey: string;
      };
    };
  }): Promise<AdjudicationEvidenceRow | null>;
}

/**
 * Real rows in `adjudication_records` (`FR-GEL-072`).
 *
 * Serialisation goes through {@link rowFromEvidence} / {@link verdictFromRow},
 * the same pair the test doubles use, so the round-trip under test is the
 * round-trip that runs.
 */
export class PrismaAdjudicationRecords implements AdjudicationRecordPort {
  constructor(private readonly delegate: AdjudicationRecordDelegate) {}

  async record(input: AdjudicationEvidenceInput): Promise<string> {
    const row = rowFromEvidence(input, randomUUID());
    const created = await this.delegate.create({ data: { ...row } });
    return created.id;
  }

  async findByIdempotency(
    workspaceId: string,
    proposalId: string,
    idempotencyKey: string,
  ): Promise<AdjudicationVerdict | null> {
    const row = await this.delegate.findUnique({
      where: {
        workspaceId_proposalId_idempotencyKey: { workspaceId, proposalId, idempotencyKey },
      },
    });
    return row ? verdictFromRow(row) : null;
  }
}

// ---------------------------------------------------------------------------
// 7. EPIC-030 — the durable intent store.
// ---------------------------------------------------------------------------

/** Narrow view of `PrismaClient.applicationIntent`. */
export interface ApplicationIntentDelegate {
  create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
}

/**
 * Append-only durable intent (`T1097`).
 *
 * `settle` **appends** rather than updates: an outcome nobody observed must not
 * be able to erase the record that the attempt was made. An `opened` row with
 * no `settled` partner is precisely what a reconciliation pass looks for.
 */
export class PrismaApplicationIntents implements ApplicationIntentStore {
  constructor(private readonly delegate: ApplicationIntentDelegate) {}

  async open(input: {
    workspaceId: string;
    specificationId: string;
    from: string;
    to: string;
    actorId: string;
  }): Promise<string> {
    const intentId = randomUUID();
    await this.delegate.create({
      data: {
        id: randomUUID(),
        workspaceId: input.workspaceId,
        intentId,
        phase: 'opened',
        specificationId: input.specificationId,
        expectedStatus: input.from,
        requestedStatus: input.to,
        actorId: input.actorId,
        outcome: null,
      },
    });
    return intentId;
  }

  async settle(
    intentId: string,
    workspaceId: string,
    outcome: 'confirmed' | 'refused' | 'unknown',
  ): Promise<void> {
    await this.delegate.create({
      data: {
        id: randomUUID(),
        workspaceId,
        intentId,
        phase: 'settled',
        specificationId: '',
        expectedStatus: '',
        requestedStatus: '',
        actorId: '',
        outcome,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// C2C — the production adapters that replace the placeholders above.
//
// `UnconfiguredGateOutcomes` and `EpicNineTransitionAdapter` remain exported:
// the first is still the correct binding for a deployment without EPIC-021, and
// both are still exercised by tests that prove what happens when an owner
// supplies nothing. Production now binds the two below instead.
// ---------------------------------------------------------------------------

/** EPIC-021's public contract, as EPIC-030 needs it. */
export interface GateProductionShape {
  dispositionFor(
    workspaceId: string,
    specificationId: string,
    fromStatus: string,
    toStatus: string,
    currentVersionId: string | null,
  ): Promise<{ disposition: GateDisposition; blocking: string | undefined }>;
}

/** EPIC-009's authoritative lifecycle repository, as EPIC-030 needs it. */
export interface LifecycleRepositoryShape {
  currentStatus(
    workspaceId: string,
    specificationId: string,
  ): Promise<{ status: string; versionId: string | null }>;
  apply(input: {
    workspaceId: string;
    specificationId: string;
    expectedStatus: string;
    requestedStatus: string;
    actorId: string;
    actorSnapshotId?: string;
    correlationId: string;
    causationId: string;
    idempotencyKey: string;
  }): Promise<{ transitionId: string; idempotent: boolean }>;
}

/**
 * Validity and current state, read from **the same rows the transition writes**.
 *
 * The earlier adapter read through `SpecificationsReadService`, which is bound
 * to an in-memory store. Reading state from one place and changing it in another
 * is how a specification comes to be in two states at once.
 */
export class EpicNinePersistentValidation implements LifecycleValidationPort {
  constructor(
    private readonly repo: LifecycleRepositoryShape,
    private readonly permittedFrom: PermittedFrom,
  ) {}

  async currentStatus(workspaceId: string, specificationId: string): Promise<string> {
    return (await this.repo.currentStatus(workspaceId, specificationId)).status;
  }

  async isPermitted(from: string, to: string): Promise<boolean> {
    return this.permittedFrom(from).includes(to);
  }
}

/**
 * Gate outcomes from EPIC-021, bound to the version actually being transitioned.
 *
 * The current version comes from EPIC-009, not from EPIC-021 and not from here:
 * a second answer to "which version is current" would let a stale outcome look
 * fresh (`X11`).
 */
export class EpicTwentyOneGateOutcomes implements GateOutcomePort {
  constructor(
    private readonly gates: GateProductionShape,
    private readonly lifecycle: LifecycleRepositoryShape,
  ) {}

  async outcomesFor(
    workspaceId: string,
    specificationId: string,
    requestedTransition: string,
  ): Promise<{ disposition: GateDisposition; blocking: string | undefined }> {
    const [fromStatus, toStatus] = requestedTransition.split('->');
    const { versionId } = await this.lifecycle.currentStatus(workspaceId, specificationId);
    return this.gates.dispositionFor(
      workspaceId,
      specificationId,
      fromStatus ?? '',
      toStatus ?? '',
      versionId,
    );
  }
}

/**
 * Application through EPIC-009's transactional repository (`X8` closed).
 *
 * `appliedTransitionId` is the id EPIC-009 **committed**, in the same
 * transaction as the state change. There is no longer a case where the state
 * moves and the transition cannot be named.
 *
 * A stated refusal — the expectation no longer holds, or the specification is
 * gone — is a refusal. Anything else is `unknown`, because the transaction may
 * or may not have committed.
 */
export class EpicNineTransactionalApplication implements LifecycleApplicationPort {
  constructor(private readonly repo: LifecycleRepositoryShape) {}

  async apply(input: {
    workspaceId: string;
    specificationId: string;
    expectedCurrentStatus: string;
    requestedStatus: string;
    actorId: string;
    correlationId: string;
    causationId: string;
    idempotencyKey: string;
    actorSnapshotId?: string;
  }): Promise<LifecycleApplicationOutcome> {
    try {
      const committed = await this.repo.apply({
        workspaceId: input.workspaceId,
        specificationId: input.specificationId,
        expectedStatus: input.expectedCurrentStatus,
        requestedStatus: input.requestedStatus,
        actorId: input.actorId,
        ...(input.actorSnapshotId !== undefined
          ? { actorSnapshotId: input.actorSnapshotId }
          : {}),
        correlationId: input.correlationId,
        causationId: input.causationId,
        idempotencyKey: input.idempotencyKey,
      });
      return { outcome: 'confirmed', transitionId: committed.transitionId };
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (name === 'ExpectedStateMismatchError' || name === 'NotFoundError') {
        return { outcome: 'refused', reason: reasonOf(error) };
      }
      return {
        outcome: 'unknown',
        cause: 'application_outcome_unknown',
        reason: reasonOf(error),
      };
    }
  }
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : 'unknown failure';
}
