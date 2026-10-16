/**
 * EPIC-048 — shared fixtures for the learning suites.
 *
 * Records, and **recording** in-test port bindings: each one keeps every call it
 * receives in `calls`, so a test can assert what was asked as well as what was
 * answered. They are bound visibly in each test; the module default stays
 * refusing (`R-048-20`).
 */
import type {
  CandidateRecord,
  CitationRecord,
  EntryRecord,
  VersionRecord,
} from '../../src/modules/learning/learning.store.js';
import type { AuditEntry, AuditPort } from '../../src/modules/learning/learning.tokens.js';

export const DIGEST = 'a'.repeat(64);
export const OTHER_DIGEST = 'b'.repeat(64);

let n = 0;
const next = (prefix: string): string => `${prefix}_${++n}`;

export function candidateRecord(over: Partial<CandidateRecord> = {}): CandidateRecord {
  const id = over.id ?? next('lc');
  return {
    id,
    workspaceId: 'ws_a',
    projectId: 'p1',
    kind: 'new',
    targetVersionId: null,
    statement: 'Integration tests need the local database started first.',
    category: 'test-setup',
    subject: 'integration test prerequisites',
    subjectKey: 'test-setup:integration test prerequisites',
    sourceKind: 'execution',
    executionId: 'exe_1',
    sourcePrincipalId: 'agent_1',
    expertId: null,
    expertContractVersionId: null,
    expertContractVersion: null,
    confidenceLevel: 'medium',
    confidenceBasis: 'Observed three failing runs without it.',
    claimedScope: { kind: 'project', projectIds: ['p1'] },
    proposedBand: null,
    late: false,
    provisional: false,
    policyVersion: 1,
    objectDigest: DIGEST,
    idempotencyKey: `idem_${id}`,
    correlationId: `corr_${id}`,
    submittedAt: new Date('2026-10-09T10:00:00Z'),
    ...over,
  };
}

export function citationFor(c: CandidateRecord, over: Partial<CitationRecord> = {}): CitationRecord {
  return {
    id: next('lce'),
    workspaceId: c.workspaceId,
    candidateId: c.id,
    corroborationId: null,
    evidenceId: 'ev_1',
    digestAlgorithm: 'sha256',
    digest: DIGEST,
    ...over,
  };
}

export function entryRecordFor(c: CandidateRecord, over: Partial<EntryRecord> = {}): EntryRecord {
  return {
    id: next('ke'),
    workspaceId: c.workspaceId,
    category: c.category,
    subjectKey: c.subjectKey,
    originProjectId: c.projectId,
    createdAt: new Date(),
    ...over,
  };
}

export function versionRecordFor(c: CandidateRecord, entry: EntryRecord, over: Partial<VersionRecord> = {}): VersionRecord {
  return {
    id: next('kv'),
    workspaceId: c.workspaceId,
    entryId: entry.id,
    version: 1,
    statement: c.statement,
    proposedStatement: c.statement,
    scope: c.claimedScope,
    proposedScope: c.claimedScope,
    classification: 'internal',
    candidateId: c.id,
    decisionId: next('dec'),
    resolvingDecisionId: null,
    approvedByKind: 'human',
    approvedBy: 'u_h',
    approvedAt: new Date(),
    ...over,
  };
}

export interface RecordingAudit extends AuditPort {
  readonly entries: AuditEntry[];
}

export function recordingAudit(): RecordingAudit {
  const entries: AuditEntry[] = [];
  return {
    entries,
    async record(entry: AuditEntry): Promise<void> {
      entries.push(entry);
    },
  };
}
