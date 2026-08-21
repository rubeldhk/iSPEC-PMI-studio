/**
 * Storage Provider Contract — T389.
 *
 * Declared once here and NOWHERE else. `backend/` may import this package; it
 * may never import `packages/storage-adapters/*` or name a provider SDK.
 * Enforced by the architecture test (T432), mirroring T047 for engines.
 *
 * The rule this contract protects (FR-PUB-030, FR-PUB-039, SC-011, PP-015):
 * an additional storage provider type can be supported with ZERO changes to
 * platform behaviour outside the storage integration layer.
 *
 * See specs/002-team-review-access-storage/contracts/storage-provider-contract.md
 */

// ---------------------------------------------------------------- capabilities

/**
 * `deleteFile` is deliberately NOT here and NOT optional-but-present either:
 * publishing is one-way (S4, ADR-0004) and disconnection leaves published
 * files untouched (FR-PUB-038) — nothing in this epic ever deletes at the
 * provider. A write-only provider is supportable.
 */
export const REQUIRED_STORAGE_CAPABILITIES = [
  'connect',
  'checkHealth',
  'putFile',
  'listDestination',
] as const;

export type StorageCapability = (typeof REQUIRED_STORAGE_CAPABILITIES)[number];

export interface StorageDescriptor {
  name: string;
  version: string;
  capabilities: StorageCapability[];
  /** Provider size ceiling per file, when one exists (S6). */
  maxFileSizeBytes?: number;
}

/** FR-PUB-039 — refused at connection time, NAMING the missing capability. */
export function missingRequiredCapabilities(descriptor: StorageDescriptor): StorageCapability[] {
  return REQUIRED_STORAGE_CAPABILITIES.filter((c) => !descriptor.capabilities.includes(c));
}

// ---------------------------------------------------------------- failures

/**
 * FR-PUB-035 / SC-009 — the closed taxonomy. There is deliberately NO
 * `unknown` member, matching `job_failure_reason`: a generic failure is a
 * defect, not a fallback. S2: mapping every provider-specific error into
 * this set is the adapter's entire job — a provider error code must never
 * reach `backend/`.
 */
export const STORAGE_FAILURE_REASONS = [
  'provider_unavailable',
  'authorisation_expired',
  'quota_exceeded',
  'size_limit_exceeded',
  'destination_missing',
] as const;

export type StorageFailureReason = (typeof STORAGE_FAILURE_REASONS)[number];

export interface StorageFailure {
  reason: StorageFailureReason;
  /** Safe to show a user. Never a raw provider error. */
  message: string;
}

/** S1 — adapters RETURN failures; they never throw. */
export type StorageResult<T> = { ok: true; value: T } | { ok: false; failure: StorageFailure };

export function storageOk<T>(value: T): StorageResult<T> {
  return { ok: true, value };
}

export function storageFail<T>(reason: StorageFailureReason, message: string): StorageResult<T> {
  return { ok: false, failure: { reason, message } };
}

// ---------------------------------------------------------------- shapes

/** FR-PUB-031 — three DISTINCT states; unreachable is never healthy (S5). */
export type HealthStatus = 'healthy' | 'needs_reauthorisation' | 'unavailable';

/**
 * Plain data throughout: no platform entities, no database identifiers a
 * provider could dereference (S7 — adapters hold no platform credentials).
 */
export interface ConnectConfig {
  /** Folder or bucket within the provider (FR-PUB-029). */
  destination: string;
  /** Short-lived access token, delegated OAuth-style. NEVER a refresh token. */
  accessToken?: string;
}

export interface ConnectionDescriptor {
  providerName: string;
  destination: string;
}

export interface FileToPut {
  name: string;
  content: string;
  sizeBytes: number;
}

export interface PutOutcome {
  /** S6 — an oversized file is SKIPPED and reported; it never fails the publish. */
  status: 'written' | 'skipped';
  name: string;
  destinationLocation: string | null;
  /** S8 — where the name was invalid at the destination, what it became. */
  adaptedFrom?: string;
  skippedReason?: StorageFailureReason;
}

/**
 * S4 — names and versions only, for the republish preview (FR-PUB-036).
 * Deliberately NO content field: the contract exposes no read-back, and
 * adding one is an ADR-level decision, not an adapter feature.
 */
export interface DestinationEntry {
  name: string;
  publishedVersion: string | null;
}

// ---------------------------------------------------------------- provider

export interface StorageProvider {
  readonly descriptor: StorageDescriptor;
  connect(config: ConnectConfig): Promise<StorageResult<ConnectionDescriptor>>;
  checkHealth(connection: ConnectionDescriptor): Promise<StorageResult<HealthStatus>>;
  putFile(
    connection: ConnectionDescriptor,
    file: FileToPut,
    accessToken?: string,
  ): Promise<StorageResult<PutOutcome>>;
  listDestination(
    connection: ConnectionDescriptor,
    path?: string,
  ): Promise<StorageResult<DestinationEntry[]>>;
}
