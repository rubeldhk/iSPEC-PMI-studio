/**
 * `T857f` — the completion gate. `BR-0144`, `RULE-05`: *"done" is not proof.*
 *
 * A declaration of completion — by an agent or a user — is a request to be
 * judged, never a judgement. The gate evaluates the Contract the work is bound
 * to and either accepts or refuses, naming every unmet item (`FR-EVS-030`,
 * `FR-EVS-032`), and records the outcome either way (`FR-EVS-033`).
 *
 * ## A result, never an exception (`R-032-2`)
 *
 * `complete` returns a `CompletionResult` for every outcome, including the
 * store being unreachable. A refusal that arrives as an exception can be
 * swallowed by a caller's `catch`; one that arrives as a value has to be read.
 *
 * ## Fail closed (`FR-EVS-035`, `R-032-5`)
 *
 * Where the Contract cannot be evaluated — the store cannot be reached, the
 * work is bound to no Contract, the bound version is no longer loaded — the
 * gate refuses. An unevaluated Contract is not a satisfied one. `EPIC-030`
 * `FR-GEL-041` and `EPIC-031` `FR-DPE-050` fail the same way: three substrate
 * Epics, one failure direction.
 */
import {
  kindOf,
  refuse,
  type CompletionResult,
  type ContractStatus,
  type EvidenceKind,
  type EvidenceStorage,
} from '@pmi/evidence-contract';
import { assess, assessForRollup, deriveStatus, type AssessedEvidence } from './contract.status.js';
import type { ContractCatalog } from './contract.loader.js';
import type { EvidenceRepository, RollupEvidence } from './evidence.repository.js';
import { refKey } from './evidence.repository.js';
import type { AttemptTrigger, StoredAttestation, WorkBinding, WorkRef } from './evidence.types.js';

/**
 * `T1798`, `FR-EVS-027` — one attached attestation, as a Room's Evidence region
 * lists it: provenance and trust, never the payload.
 */
export interface AttachedEvidence {
  readonly id: string;
  readonly predicateType: string;
  /** `null` for a predicate type the registry does not know. */
  readonly kind: EvidenceKind | null;
  readonly source: { readonly uri: string; readonly version: string | null };
  readonly producedAt: string;
  readonly attestedArtifact: { readonly id: string; readonly version: number };
  readonly storage: 'stored' | 'referenced';
  readonly integrity: 'valid' | 'failed';
  readonly resolution: 'resolved' | 'unresolvable';
  readonly reportsFailure: boolean;
  /** `FR-EVS-012` — attests the artifact and version the work is judged against. */
  readonly current: boolean;
}

function attachedFrom(
  binding: WorkBinding,
  stored: readonly StoredAttestation[],
  assessed: readonly AssessedEvidence[],
): AttachedEvidence[] {
  return stored.map((a, i) => {
    const judged = assessed[i]!;
    return {
      id: a.id,
      predicateType: a.predicateType,
      kind: kindOf(a.predicateType),
      source: { uri: a.sourceUri, version: a.sourceVersion },
      producedAt: a.producedAt.toISOString(),
      attestedArtifact: { id: a.attestedArtifactId, version: a.attestedVersion },
      storage: a.storage,
      integrity: judged.integrity,
      resolution: judged.resolution,
      reportsFailure: judged.reportsFailure === true,
      current: a.attestedArtifactId === binding.subjectArtifactId && a.attestedVersion === binding.subjectVersion,
    };
  });
}

/** One binding's status for the rollup, or why it could not be evaluated. */
export type RollupStatus =
  | { readonly evaluated: true; readonly status: ContractStatus }
  | { readonly evaluated: false; readonly reason: string };

export type Evaluation =
  | {
      readonly evaluated: true;
      readonly binding: WorkBinding;
      readonly status: ContractStatus;
      readonly attached: readonly AttachedEvidence[];
    }
  | { readonly evaluated: false; readonly reason: string; readonly binding: WorkBinding | null };

export class CompletionGate {
  constructor(
    private readonly repository: EvidenceRepository,
    private readonly catalog: ContractCatalog,
    private readonly storage: EvidenceStorage | null,
  ) {}

  /** The Contract status of one piece of work, or why it could not be evaluated. Never throws. */
  async evaluate(workspaceId: string, workRef: WorkRef): Promise<Evaluation> {
    let binding: WorkBinding | null = null;
    try {
      const bindings = await this.repository.bindings(workspaceId, workRef);
      binding = bindings.at(-1) ?? null;
      if (binding === null) {
        return {
          evaluated: false,
          binding: null,
          reason: `no Evidence Contract is bound to ${workRef.type}:${workRef.id} (FR-EVS-021)`,
        };
      }
      return await this.evaluateWith(binding, await this.repository.attachedTo(workspaceId, workRef));
    } catch {
      return {
        evaluated: false,
        binding,
        reason: 'the evidence store could not be reached, so the Contract cannot be evaluated (FR-EVS-035)',
      };
    }
  }

  /** The evaluation of one binding against evidence already loaded. */
  private async evaluateWith(binding: WorkBinding, attestations: readonly StoredAttestation[]): Promise<Evaluation> {
    const contract = this.catalog.get(binding.workClass, binding.contractVersion);
    if (contract === null) {
      return {
        evaluated: false,
        binding,
        reason:
          `Evidence Contract ${binding.workClass} v${binding.contractVersion} is not loaded, ` +
          'so it cannot be evaluated (FR-EVS-023, FR-EVS-035)',
      };
    }
    const evidence = await assess(attestations, this.storage);
    return {
      evaluated: true,
      binding,
      attached: attachedFrom(binding, attestations, evidence),
      status: deriveStatus(contract, evidence, {
        artifactId: binding.subjectArtifactId,
        version: binding.subjectVersion,
      }),
    };
  }

  /**
   * The rollup's statuses (`FR-EVS-006`, `SC-EVS-008`): one light query for
   * every binding's evidence, then the same `deriveStatus` the gate uses —
   * assessed by `assessForRollup`, which trusts the write-time integrity verdict
   * rather than re-hashing every payload. Never throws; an unreadable store
   * makes every one unevaluated, and the rollup counts those rather than hiding
   * them.
   */
  async rollupStatuses(workspaceId: string, bindings: readonly WorkBinding[]): Promise<Map<string, RollupStatus>> {
    const out = new Map<string, RollupStatus>();
    let evidence: Map<string, RollupEvidence[]>;
    try {
      evidence = await this.repository.rollupEvidence(workspaceId, bindings.map((b) => b.workRef));
    } catch {
      for (const binding of bindings) {
        out.set(refKey(binding.workRef), {
          evaluated: false,
          reason: 'the evidence store could not be reached, so the Contract cannot be evaluated (FR-EVS-035)',
        });
      }
      return out;
    }
    for (const binding of bindings) {
      const contract = this.catalog.get(binding.workClass, binding.contractVersion);
      if (contract === null) {
        out.set(refKey(binding.workRef), {
          evaluated: false,
          reason: `Evidence Contract ${binding.workClass} v${binding.contractVersion} is not loaded`,
        });
        continue;
      }
      const assessed = await assessForRollup(evidence.get(refKey(binding.workRef)) ?? [], this.storage);
      out.set(refKey(binding.workRef), {
        evaluated: true,
        status: deriveStatus(contract, assessed, {
          artifactId: binding.subjectArtifactId,
          version: binding.subjectVersion,
        }),
      });
    }
    return out;
  }

  /**
   * Judge a declaration of completion. Records the attempt — accepted or
   * refused — whenever the work is bound, so a refusal is never silent.
   */
  async complete(
    workspaceId: string,
    workRef: WorkRef,
    declaredBy: string,
    trigger: AttemptTrigger = 'declaration',
  ): Promise<CompletionResult> {
    const evaluation = await this.evaluate(workspaceId, workRef);

    const result: CompletionResult = !evaluation.evaluated
      ? refuse([evaluation.reason])
      : evaluation.status.satisfied
        ? { ok: true }
        : refuse(evaluation.status.unmet);

    if (evaluation.binding !== null) {
      try {
        await this.repository.appendAttempt({
          workspaceId,
          workRef,
          declaredBy,
          outcome: result.ok ? 'accepted' : 'refused',
          unmetItems: result.ok ? null : result.unmet,
          contractVersion: evaluation.binding.contractVersion,
          trigger,
        });
      } catch {
        // An acceptance that could not be recorded is not an acceptance: the
        // record is what makes completion auditable (FR-EVS-033).
        if (result.ok) {
          return refuse([
            'the completion could not be recorded, so it was not accepted (FR-EVS-033, FR-EVS-035)',
          ]);
        }
      }
    }
    return result;
  }
}
