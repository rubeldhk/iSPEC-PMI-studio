/**
 * `T998k` (EPIC-035) — reproduction capture, and the non-automatable exception.
 *
 * `FR-DFR-030` to `FR-DFR-033`, `FR-DFR-043`, `R-035-7`, `BR-0053`.
 *
 * ## Evidence goes through `EPIC-032`, and this Room writes no access rules
 *
 * `R-035-7` found that `FR-DFR-032` and `FR-DFR-033` are **one composition, not
 * two mechanisms**: the evidence store's own `AccessPolicy` port is filled by
 * `EPIC-024` and refuses to read around artifact access, so a second check here
 * would be a second thing that can be wrong.
 *
 * With no store bound there is nowhere to put evidence that honours the
 * artifact's rules, so recording **refuses** rather than keeping a Room-local
 * copy under this Room's rules. That distinction matters more here than
 * anywhere else in the product: reproduction detail is the one place a user is
 * actively encouraged to paste a payload that reproduces a failure (`PP-008`),
 * and a HAR carrying a session token filed under "who can see defects" is
 * readable by everyone who can see defects.
 *
 * The payload passes through and is never stored: the row holds references.
 *
 * ## The exception has three obligations, not one
 *
 * `FR-DFR-043` — the reason recorded, alternative evidence required, and the
 * exception **visible and enumerable**. The second is the one that gets
 * dropped, and without it *"not automatable"* is a bypass with a checkbox. The
 * third is the one nobody reads as an obligation: an exception you cannot count
 * is indistinguishable from a policy, because finding out how often it is used
 * would mean reading every defect.
 *
 * Framework-free (PC-1).
 */
import { randomUUID } from 'node:crypto';
import { NotFoundError, ValidationFailedError } from '../../core/errors.js';
import type { DefectRoomStore, ReproductionRow } from './defect-room.store.js';
import { REPRODUCIBILITY, type Reproducibility } from './reproduction.types.js';

/**
 * `EPIC-032`'s contribution surface, named after its own contract
 * (`specs/032-evidence-store-contracts/contracts/evidence-contract.md`,
 * `POST /evidence`, `FR-EVS-001`).
 *
 * Shaped after the in-toto Attestation v1 Statement the contract adopts, so
 * that when `packages/evidence-contract` lands the names already line up. A
 * port invented with different words is a port that has to be re-agreed the day
 * the real one arrives — `FR-SHL-003` caught exactly that in `EPIC-034`.
 */
export interface EvidenceAttestation {
  readonly _type: 'https://in-toto.io/Statement/v1';
  readonly subject: readonly { readonly name: string; readonly digest: Readonly<Record<string, string>> }[];
  readonly predicateType: string;
  readonly predicate: unknown;
}

export interface EvidenceStorePort {
  contribute(input: {
    workspaceId: string;
    workRef: string;
    attestation: EvidenceAttestation;
  }): Promise<{ evidenceRef: string }>;
}

export interface RecordReproductionInput {
  readonly workspaceId: string;
  readonly defectId: string;
  readonly reproducible: string;
  readonly environment: string;
  readonly affectedBehaviourRef: string;
  /** `FR-DFR-043` — nullable, never optional. `null` states "no exception here". */
  readonly notAutomatableReason: string | null;
  /** Payloads, forwarded to `EPIC-032` and never stored here. */
  readonly evidence: readonly EvidenceAttestation[];
  readonly observedAt: Date;
  readonly recordedBy: string;
}

/**
 * The kinds for which evidence is required.
 *
 * `not-reproduced` is the one honest empty case: nothing was observed, and
 * demanding evidence of an absence pushes people to record something rather
 * than nothing — worse than the gap it fills.
 */
const EVIDENCE_REQUIRED: readonly Reproducibility[] = ['always', 'intermittent', 'not-automatable'];

export class ReproductionService {
  constructor(
    private readonly store: DefectRoomStore,
    private readonly evidence?: EvidenceStorePort | undefined,
  ) {}

  async record(input: RecordReproductionInput): Promise<ReproductionRow> {
    const defect = await this.store.findDefect(input.workspaceId, input.defectId);
    if (!defect) throw new NotFoundError('Not found.');

    const reproducible = input.reproducible as Reproducibility;
    if (!(REPRODUCIBILITY as readonly string[]).includes(reproducible)) {
      throw new ValidationFailedError(
        `reproducible is one of ${REPRODUCIBILITY.join(', ')} (FR-DFR-031)`,
      );
    }

    if (input.environment.trim() === '') {
      throw new ValidationFailedError('a reproduction states where it was observed (FR-DFR-030)');
    }

    if (input.affectedBehaviourRef.trim() === '') {
      throw new ValidationFailedError(
        'a reproduction names the behaviour it affects, so the report has a subject (FR-DFR-030)',
      );
    }

    const reason = input.notAutomatableReason?.trim() ?? '';
    if (reproducible === 'not-automatable' && reason === '') {
      throw new ValidationFailedError(
        'a not-automatable defect records why, so the exception is visible and enumerable ' +
          '(FR-DFR-043)',
      );
    }
    if (reproducible !== 'not-automatable' && reason !== '') {
      // The exception has to be countable, and a reason attached to a defect
      // that is automatable inflates the count with a case that never used it.
      throw new ValidationFailedError(
        'a not-automatable reason belongs only where the exception applies, so the exception ' +
          'stays countable (FR-DFR-043)',
      );
    }

    if (EVIDENCE_REQUIRED.includes(reproducible) && input.evidence.length === 0) {
      throw new ValidationFailedError(
        reproducible === 'not-automatable'
          ? 'a not-automatable defect requires alternative evidence, or the exception is a bypass ' +
            'with a checkbox (FR-DFR-043)'
          : 'a reproduction captures evidence as data rather than leaving it implicit in the test ' +
            '(FR-DFR-030)',
      );
    }

    // Contributed **before** the row is written, so a store that refuses or
    // throws leaves nothing behind citing a ref nobody filed.
    const evidenceRefs = await this.contributeAll(input, defect.id);

    return this.store.recordReproduction({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      defectId: defect.id,
      reproducible,
      environment: input.environment.trim(),
      evidenceRefs,
      affectedBehaviourRef: input.affectedBehaviourRef.trim(),
      notAutomatableReason: reason === '' ? null : reason,
      observedAt: input.observedAt,
      createdAt: new Date(),
    });
  }

  /**
   * `FR-DFR-043` — every exception in the workspace, countable.
   *
   * The obligation nobody reads as an obligation. Without this the only way to
   * learn how often the exception is used is to open every defect, so nobody
   * would, and a bypass would look like an absence of defects.
   */
  async exceptions(workspaceId: string): Promise<ReproductionRow[]> {
    return this.store.notAutomatableIn(workspaceId);
  }

  private async contributeAll(
    input: RecordReproductionInput,
    defectId: string,
  ): Promise<string[]> {
    if (input.evidence.length === 0) return [];

    if (!this.evidence) {
      // Refuse, never keep a local copy. `DEFECT_ROOM_PORTS`: `EvidenceStore`
      // absent ⇒ refuse, because a Room-local attachment honours this Room's
      // access rules rather than the artifact's (`FR-DFR-033`, `BR-0062`).
      throw new ValidationFailedError(
        'no evidence store is bound (EPIC-032 supplies it), so there is nowhere to put this ' +
          'evidence that honours the access rules of the artifact it concerns — and a copy held ' +
          'here would honour this Room’s rules instead',
      );
    }

    // Deliberately not wrapped in a try/catch: a store that throws is an
    // outage, and continuing would write a reproduction citing evidence nobody
    // filed.
    const refs: string[] = [];
    for (const attestation of input.evidence) {
      const { evidenceRef } = await this.evidence.contribute({
        workspaceId: input.workspaceId,
        workRef: defectId,
        attestation,
      });
      refs.push(evidenceRef);
    }
    return refs;
  }
}
