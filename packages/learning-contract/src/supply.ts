/**
 * `T2310` (EPIC-048) — the two ports `EPIC-038` calls (`contracts/learning-contract.md` §3,
 * `R-048-11`).
 *
 * This Epic never assembles context (`FR-LRN-050`). `EPIC-038` assembles; it asks
 * this Epic two questions about a `knowledge-entry` source: *what is it* (the
 * reader) and *may it be supplied here* (admission).
 *
 * **Absent `KnowledgeAdmission` ⇒ every knowledge-entry candidate is excluded**
 * with `permission` and detail `admission port unbound` — never admitted by
 * default.
 */

/** Served for sourceType `knowledge-entry` by `EPIC-038`'s sources adapter and provenance service. */
export interface KnowledgeSourceReader {
  currentVersion(
    workspaceId: string,
    entryId: string,
  ): Promise<{ resolves: true; version: string } | { resolves: false; reason: string }>;
  /** `projectId: null` — scope is admission's job, not the index partition's. */
  read(workspaceId: string, entryId: string, versionId: string): Promise<{ text: string; projectId: null } | null>;
  status(
    workspaceId: string,
    entryId: string,
    versionId: string,
  ): Promise<{ status: 'current' } | { status: 'superseded'; supersededBy: string } | { status: 'deprecated'; reason: string }>;
}

/**
 * A subset of `EPIC-038`'s `EXCLUSION_REASONS` (`retrieval/outcome.types.ts:32`),
 * so no 038 enum or CHECK changes.
 */
export const ADMISSION_REASONS = Object.freeze(['boundary', 'classification', 'stale', 'permission'] as const);
export type AdmissionReason = (typeof ADMISSION_REASONS)[number];

/** Each `detail` begins with the name of the rule that refused (`R-048-11`). */
export const ADMISSION_DETAIL_PREFIXES = Object.freeze([
  'scope:',
  'workspace:',
  'reuse-policy:',
  'classification:',
  'superseded:',
  'deprecated:',
  'archived:',
  'memory-policy:',
] as const);
export type AdmissionDetailPrefix = (typeof ADMISSION_DETAIL_PREFIXES)[number];

export type AdmissionVerdict =
  | { readonly admitted: true; readonly inclusionNote: string }
  | { readonly admitted: false; readonly reason: AdmissionReason; readonly detail: string };

export interface AdmissionTarget {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly executionId?: string;
}

/** Consulted by `EPIC-038`'s assembly after `judgeBoundary`, before `access.mayRead`. */
export interface KnowledgeAdmission {
  /** Same order as `candidates`; one batched read. */
  admit(
    candidates: readonly { readonly sourceId: string; readonly sourceVersion: string }[],
    target: AdmissionTarget,
  ): Promise<readonly AdmissionVerdict[]>;
}

/** The verdict for every candidate when no admission port is bound. */
export const UNBOUND_ADMISSION_VERDICT: AdmissionVerdict = Object.freeze({
  admitted: false,
  reason: 'permission',
  detail: 'admission port unbound',
});

/** The prefix every admitted knowledge item's inclusion reason carries (`FR-LRN-052`). */
export const KNOWLEDGE_INCLUSION_PREFIX = 'approved knowledge —';

/** The `EPIC-038` source type knowledge enters as (`R-048-11`, `A-038-2`). */
export const KNOWLEDGE_SOURCE_TYPE = 'knowledge-entry' as const;
