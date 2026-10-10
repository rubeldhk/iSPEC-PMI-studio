/**
 * `EPIC-032` — the evidence module's records (data-model §1, §4, §5).
 *
 * These are the backend's shapes for what is persisted. The shapes other Epics
 * build against — the attestation envelope, the Evidence Contract, the gate
 * result — are in `@pmi/evidence-contract`, and nothing here redefines them.
 */
import type { EvidenceReference, SubjectDigest } from '@pmi/evidence-contract';

/**
 * `FR-EVS-004` — evidence attaches to an artifact, a task, a decision or an
 * outcome, and a governed work reference is one of the same four. That is how
 * evidence attached to a piece of work is found **without** a foreign key into
 * any Room's tables (data-model §4).
 */
export const ATTACHABLE_KINDS = Object.freeze(['artifact', 'task', 'decision', 'outcome'] as const);
export type AttachableKind = (typeof ATTACHABLE_KINDS)[number];

export interface WorkRef {
  readonly type: AttachableKind;
  readonly id: string;
}

export function isAttachableKind(value: unknown): value is AttachableKind {
  return typeof value === 'string' && (ATTACHABLE_KINDS as readonly string[]).includes(value);
}

/** `FR-EVS-013` — the digest of the stored payload or the referenced target. */
export interface IntegrityRecord {
  readonly algorithm: 'sha256';
  readonly value: string;
}

export interface NewAttestation {
  readonly workspaceId: string;
  readonly projectId: string;
  /** `FR-EVS-003` — the in-toto `predicateType` URI. */
  readonly predicateType: string;
  readonly subjectName: string;
  /** `FR-EVS-042` — required; the schema refuses a row without it. */
  readonly subjectDigest: SubjectDigest;
  /** `FR-EVS-011` — the platform artifact attested, and its version. */
  readonly attestedArtifactId: string;
  readonly attestedVersion: number;
  readonly producedAt: Date;
  /** `FR-EVS-010` — the producing tool or run. */
  readonly sourceUri: string;
  /** `FR-EVS-041` — required for an external contribution. */
  readonly sourceVersion: string | null;
  readonly storage: 'stored' | 'referenced';
  readonly payload: unknown;
  readonly reference: EvidenceReference | null;
  readonly attachedTo: WorkRef;
  /**
   * The contributor's own digest of the payload, when it supplied one. A
   * mismatch with what arrived is recorded, not refused: the item then reads
   * integrity-failed, which is what `FR-EVS-034` asks for.
   */
  readonly claimedIntegrity?: IntegrityRecord;
}

export interface StoredAttestation extends Omit<NewAttestation, 'claimedIntegrity'> {
  readonly id: string;
  readonly integrity: IntegrityRecord;
  /** Established at write: did what arrived match what the contributor claimed? */
  readonly integrityValid: boolean;
  readonly createdAt: Date;
}

export interface NewBinding {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly workRef: WorkRef;
  readonly workClass: string;
  /** `FR-EVS-021`, `FR-EVS-023` — fixed at creation. */
  readonly contractVersion: number;
  /** `FR-EVS-015` — the artifact's type, which `EPIC-024`'s access rules are keyed by. */
  readonly subjectArtifactType: string;
  readonly subjectArtifactId: string;
  readonly subjectVersion: number;
}

export interface WorkBinding extends NewBinding {
  readonly id: string;
  readonly createdAt: Date;
}

export type AttemptTrigger = 'declaration' | 'evidence-arrival';

export interface NewAttempt {
  readonly workspaceId: string;
  readonly workRef: WorkRef;
  readonly declaredBy: string;
  readonly outcome: 'accepted' | 'refused';
  /** `FR-EVS-032` — non-empty when refused; the schema refuses otherwise. */
  readonly unmetItems: readonly string[] | null;
  readonly contractVersion: number;
  readonly trigger: AttemptTrigger;
}

export interface CompletionAttempt extends NewAttempt {
  readonly id: string;
  readonly declaredAt: Date;
}
