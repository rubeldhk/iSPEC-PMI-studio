/**
 * `T856j` — the three ports this Epic requires.
 *
 * Every one **refuses when absent** — `FR-EVS-035`, `FR-EVS-015`, `FR-EVS-040`
 * — the same direction as `EPIC-030` `FR-GEL-062` and `EPIC-031`. Three
 * substrate Epics, one failure direction: a governed action that slips through
 * any one of them is ungoverned.
 *
 * Every method returns a result. None throws (`R-032-2`).
 */
import type { SubjectDigest } from './attestation.js';

export interface PortDeclaration {
  readonly name: 'EvidenceStorage' | 'AccessPolicy' | 'AttestationSource';
  readonly filledBy: 'EPIC-025' | 'EPIC-024' | 'EPIC-013';
  readonly absent: 'refuse';
}

export const EVIDENCE_PORTS: readonly PortDeclaration[] = Object.freeze([
  { name: 'EvidenceStorage', filledBy: 'EPIC-025', absent: 'refuse' },
  { name: 'AccessPolicy', filledBy: 'EPIC-024', absent: 'refuse' },
  { name: 'AttestationSource', filledBy: 'EPIC-013', absent: 'refuse' },
] as const);

// ─────────────────────────────────────────────────────────── EvidenceStorage

/** Where a referenced payload lives (`FR-EVS-005`). Opaque to the gate. */
export interface EvidenceReference {
  readonly provider: string;
  readonly location: string;
}

/**
 * Why a reference did not resolve. Mirrors the `StorageFailure.reason` values of
 * `packages/storage-contract` that mean *cannot read it*, plus `unbound` for the
 * port being absent. None of them is satisfied (`FR-EVS-014`).
 */
export type UnresolvableReason =
  | 'provider_unavailable'
  | 'authorisation_expired'
  | 'destination_missing'
  | 'unbound';

export type ResolveResult =
  | { readonly resolved: true; readonly digest?: SubjectDigest }
  | { readonly resolved: false; readonly reason: UnresolvableReason };

/** Filled by `EPIC-025`'s `StorageProvider`. Absent ⇒ every reference is unresolvable. */
export interface EvidenceStorage {
  resolve(reference: EvidenceReference): Promise<ResolveResult>;
}

// ─────────────────────────────────────────────────────────── AccessPolicy

export interface EvidenceReader {
  readonly workspaceId: string;
  readonly userId: string;
}

/** What the evidence attests or is attached to — the thing whose access rules apply. */
export interface AttestedTarget {
  readonly type: string;
  readonly id: string;
}

/**
 * Filled by `EPIC-024` (`BR-0062`). `FR-EVS-015`: evidence must not become a
 * side channel around artifact access. Absent ⇒ every read is refused.
 */
export interface AccessPolicy {
  canRead(reader: EvidenceReader, target: AttestedTarget): Promise<boolean>;
}

// ─────────────────────────────────────────────────────────── AttestationSource

export interface AuthorisedSource {
  readonly uri: string;
  readonly version: string;
}

/**
 * Filled by the `EPIC-013` / `U-13` adapter registry (`BR-0125`). An external
 * tool contributes through an authorised adapter, never a bespoke per-tool
 * route (`FR-EVS-040`). Absent ⇒ every external contribution is refused.
 */
export interface AttestationSource {
  authorise(sourceUri: string, workspaceId: string): Promise<AuthorisedSource | null>;
}
