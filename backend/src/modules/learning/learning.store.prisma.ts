/**
 * `T2319` (EPIC-048) — the learning store and the knowledge writer, in PostgreSQL.
 *
 * Raw SQL through Prisma's `$queryRawUnsafe`/`$executeRawUnsafe`, inside
 * interactive transactions. Three reasons, each sufficient:
 * - the triggers and CHECKs are the schema's real shape, and the ORM's view of
 *   the ten models carries none of them;
 * - "latest row" reads (current state, current status) are `LATERAL` queries
 *   the delegate API cannot express without reading every row;
 * - the corroboration lock is `pg_advisory_xact_lock`, which only SQL takes.
 *
 * Its own file, the house convention: unit tests load `learning.store.ts`, and
 * keeping this adapter apart keeps the generated client out of their graph.
 *
 * `T2318` asserts it behaves as `T2313` says the in-memory store does.
 */
import { ConflictError } from '../../core/errors.js';
import {
  assertTransitionAllowed,
  BROWSE_PAGE_SIZE,
  decodeCursor,
  encodeCursor,
  newLearningId,
  type AdmissionFact,
  type BrowseFilter,
  type BrowsePage,
  type CandidateRecord,
  type CandidateWithState,
  type CitationRecord,
  type CorroborationRecord,
  type EntryRecord,
  type FlagRecord,
  type LearningAppends,
  type LearningReads,
  type LearningStore,
  type LearningStoreTx,
  type RetrievabilityRecord,
  type ReviewTermsRecord,
  type StatusEventRecord,
  type TransitionInput,
  type TransitionRecord,
  type VersionRecord,
} from './learning.store.js';
import { assertMaterialisable, type KnowledgeWriter, type Materialisation, type WriteOutcome } from './knowledge.writer.js';
import type { AuditPort } from './learning.tokens.js';
import type { CandidateKind, CandidateState, FlagKind } from '@pmi/learning-contract';

/** The raw surface this adapter uses — a Prisma client or an interactive transaction. */
export interface RawDb {
  $queryRawUnsafe<T = unknown>(sql: string, ...params: unknown[]): Promise<T>;
  $executeRawUnsafe(sql: string, ...params: unknown[]): Promise<number>;
}

export interface LearningPrismaClient extends RawDb {
  $transaction<T>(fn: (tx: RawDb & { auditEntry: { create(args: { data: Record<string, unknown> }): Promise<unknown> } }) => Promise<T>, options?: { timeout?: number; maxWait?: number }): Promise<T>;
}

const TX_OPTIONS = { timeout: 20_000, maxWait: 10_000 };

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: unknown; message?: unknown; meta?: { code?: unknown; message?: unknown } };
  if (e.code === 'P2002' || e.code === '23505') return true;
  if (e.code === 'P2010' && e.meta?.code === '23505') return true;
  const text = `${String(e.message ?? '')} ${String(e.meta?.message ?? '')}`;
  return /23505|duplicate key value violates unique constraint/.test(text);
}

const ts = (d: Date): string => d.toISOString();
const json = (v: unknown): string => JSON.stringify(v);

function insertSql(table: string, row: Record<string, unknown>, casts: Record<string, string> = {}): { sql: string; params: unknown[] } {
  const keys = Object.keys(row);
  const cols = keys.map((k) => `"${k}"`).join(', ');
  const vals = keys.map((k, i) => `$${i + 1}${casts[k] ? `::${casts[k]}` : ''}`).join(', ');
  return { sql: `INSERT INTO "${table}" (${cols}) VALUES (${vals})`, params: Object.values(row) };
}

async function insert(db: RawDb, table: string, row: Record<string, unknown>, casts: Record<string, string> = {}): Promise<void> {
  const { sql, params } = insertSql(table, row, casts);
  await db.$executeRawUnsafe(sql, ...params);
}

// ---------------------------------------------------------------- mappers

type Row = Record<string, unknown>;
const d = (v: unknown): Date => (v instanceof Date ? v : new Date(String(v)));
const s = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

function toCandidate(r: Row): CandidateRecord {
  return {
    id: String(r['id']),
    workspaceId: String(r['workspaceId']),
    projectId: String(r['projectId']),
    kind: r['kind'] as CandidateKind,
    targetVersionId: s(r['targetVersionId']),
    statement: String(r['statement']),
    category: String(r['category']),
    subject: String(r['subject']),
    subjectKey: String(r['subjectKey']),
    sourceKind: r['sourceKind'] as CandidateRecord['sourceKind'],
    executionId: s(r['executionId']),
    sourcePrincipalId: String(r['sourcePrincipalId']),
    expertId: s(r['expertId']),
    expertContractVersionId: s(r['expertContractVersionId']),
    expertContractVersion: r['expertContractVersion'] === null || r['expertContractVersion'] === undefined ? null : Number(r['expertContractVersion']),
    confidenceLevel: r['confidenceLevel'] as CandidateRecord['confidenceLevel'],
    confidenceBasis: String(r['confidenceBasis']),
    claimedScope: r['claimedScope'] as CandidateRecord['claimedScope'],
    proposedBand: (s(r['proposedBand']) as CandidateRecord['proposedBand']) ?? null,
    late: Boolean(r['late']),
    provisional: Boolean(r['provisional']),
    policyVersion: Number(r['policyVersion']),
    objectDigest: String(r['objectDigest']),
    idempotencyKey: String(r['idempotencyKey']),
    correlationId: String(r['correlationId']),
    submittedAt: d(r['submittedAt']),
  };
}

function toCitation(r: Row): CitationRecord {
  return {
    id: String(r['id']),
    workspaceId: String(r['workspaceId']),
    candidateId: String(r['candidateId']),
    corroborationId: s(r['corroborationId']),
    evidenceId: String(r['evidenceId']),
    digestAlgorithm: 'sha256',
    digest: String(r['digest']),
  };
}

function toCorroboration(r: Row): CorroborationRecord {
  return {
    id: String(r['id']),
    workspaceId: String(r['workspaceId']),
    candidateId: String(r['candidateId']),
    sourceKind: r['sourceKind'] as CorroborationRecord['sourceKind'],
    executionId: s(r['executionId']),
    sourcePrincipalId: String(r['sourcePrincipalId']),
    expertId: s(r['expertId']),
    expertContractVersionId: s(r['expertContractVersionId']),
    statement: String(r['statement']),
    confidenceLevel: r['confidenceLevel'] as CorroborationRecord['confidenceLevel'],
    confidenceBasis: String(r['confidenceBasis']),
    late: Boolean(r['late']),
    idempotencyKey: String(r['idempotencyKey']),
    correlationId: String(r['correlationId']),
    submittedAt: d(r['submittedAt']),
  };
}

function toTransition(r: Row): TransitionRecord {
  return {
    id: String(r['id']),
    workspaceId: String(r['workspaceId']),
    candidateId: String(r['candidateId']),
    seq: Number(r['seq']),
    state: r['state'] as CandidateState,
    reason: s(r['reason']),
    decisionId: s(r['decisionId']),
    actorKind: r['actorKind'] as TransitionRecord['actorKind'],
    actorId: String(r['actorId']),
    at: d(r['at']),
  };
}

function toTerms(r: Row): ReviewTermsRecord {
  return {
    id: String(r['id']),
    workspaceId: String(r['workspaceId']),
    candidateId: String(r['candidateId']),
    decisionId: String(r['decisionId']),
    approvedStatement: String(r['approvedStatement']),
    approvedScope: r['approvedScope'] as ReviewTermsRecord['approvedScope'],
    classification: String(r['classification']),
    reviewerId: String(r['reviewerId']),
    at: d(r['at']),
  };
}

function toEntry(r: Row, prefix = ''): EntryRecord {
  return {
    id: String(r[`${prefix}id`]),
    workspaceId: String(r[`${prefix}workspaceId`]),
    category: String(r[`${prefix}category`]),
    subjectKey: String(r[`${prefix}subjectKey`]),
    originProjectId: String(r[`${prefix}originProjectId`]),
    createdAt: d(r[`${prefix}createdAt`]),
  };
}

function toVersion(r: Row): VersionRecord {
  return {
    id: String(r['id']),
    workspaceId: String(r['workspaceId']),
    entryId: String(r['entryId']),
    version: Number(r['version']),
    statement: String(r['statement']),
    proposedStatement: String(r['proposedStatement']),
    scope: r['scope'] as VersionRecord['scope'],
    proposedScope: r['proposedScope'] as VersionRecord['proposedScope'],
    classification: String(r['classification']),
    candidateId: String(r['candidateId']),
    decisionId: String(r['decisionId']),
    resolvingDecisionId: s(r['resolvingDecisionId']),
    approvedByKind: r['approvedByKind'] as VersionRecord['approvedByKind'],
    approvedBy: String(r['approvedBy']),
    approvedAt: d(r['approvedAt']),
  };
}

function toStatus(r: Row, prefix = ''): StatusEventRecord {
  return {
    id: String(r[`${prefix}id`]),
    workspaceId: String(r[`${prefix}workspaceId`]),
    versionId: String(r[`${prefix}versionId`]),
    status: r[`${prefix}status`] as StatusEventRecord['status'],
    successorVersionId: s(r[`${prefix}successorVersionId`]),
    reason: s(r[`${prefix}reason`]),
    actorId: String(r[`${prefix}actorId`]),
    decisionId: s(r[`${prefix}decisionId`]),
    candidateId: s(r[`${prefix}candidateId`]),
    at: d(r[`${prefix}at`]),
  };
}

function toFlag(r: Row): FlagRecord {
  return {
    id: String(r['id']),
    workspaceId: String(r['workspaceId']),
    versionId: s(r['versionId']),
    candidateId: s(r['candidateId']),
    kind: r['kind'] as FlagRecord['kind'],
    detail: String(r['detail']),
    raisedAt: d(r['raisedAt']),
    clearsFlagId: s(r['clearsFlagId']),
  };
}

function toRetrievability(r: Row): RetrievabilityRecord {
  return {
    id: String(r['id']),
    workspaceId: String(r['workspaceId']),
    versionId: String(r['versionId']),
    outcome: r['outcome'] as RetrievabilityRecord['outcome'],
    reason: s(r['reason']),
    attemptedAt: d(r['attemptedAt']),
  };
}

/** The latest status row of `v`, as a LATERAL subquery. */
const LATEST_STATUS = `LEFT JOIN LATERAL (
    SELECT * FROM "knowledge_version_status_events" se
     WHERE se."versionId" = v."id"
     ORDER BY se."at" DESC, se."createdAt" DESC, se."id" DESC LIMIT 1) st ON true`;

/** The latest transition of `c`, as a LATERAL subquery. */
const LATEST_TRANSITION = `JOIN LATERAL (
    SELECT * FROM "learning_candidate_transitions" lt
     WHERE lt."candidateId" = c."id"
     ORDER BY lt."seq" DESC LIMIT 1) t ON true`;

// ----------------------------------------------------------------- reads

class PrismaLearningReads implements LearningReads {
  constructor(protected readonly db: RawDb) {}

  protected async rows(sql: string, ...params: unknown[]): Promise<Row[]> {
    return this.db.$queryRawUnsafe<Row[]>(sql, ...params);
  }

  async candidate(workspaceId: string, id: string): Promise<CandidateRecord | null> {
    const r = await this.rows(`SELECT * FROM "learning_candidates" WHERE "workspaceId" = $1 AND "id" = $2`, workspaceId, id);
    return r[0] ? toCandidate(r[0]) : null;
  }

  async candidateByIdempotencyKey(workspaceId: string, key: string): Promise<CandidateRecord | null> {
    const r = await this.rows(`SELECT * FROM "learning_candidates" WHERE "workspaceId" = $1 AND "idempotencyKey" = $2`, workspaceId, key);
    return r[0] ? toCandidate(r[0]) : null;
  }

  async corroborationByIdempotencyKey(workspaceId: string, key: string): Promise<CorroborationRecord | null> {
    const r = await this.rows(`SELECT * FROM "learning_corroborations" WHERE "workspaceId" = $1 AND "idempotencyKey" = $2`, workspaceId, key);
    return r[0] ? toCorroboration(r[0]) : null;
  }

  async openCandidateFor(workspaceId: string, subjectKey: string, kind: CandidateKind, targetVersionId: string | null): Promise<CandidateRecord | null> {
    const r = await this.rows(
      `SELECT c.* FROM "learning_candidates" c ${LATEST_TRANSITION}
        WHERE c."workspaceId" = $1 AND c."subjectKey" = $2 AND c."kind" = $3
          AND c."targetVersionId" IS NOT DISTINCT FROM $4::text
          AND t."state" IN ('proposed','pending-review')
        ORDER BY c."submittedAt" ASC LIMIT 1`,
      workspaceId,
      subjectKey,
      kind,
      targetVersionId,
    );
    return r[0] ? toCandidate(r[0]) : null;
  }

  async transitions(workspaceId: string, candidateId: string): Promise<TransitionRecord[]> {
    const r = await this.rows(`SELECT * FROM "learning_candidate_transitions" WHERE "workspaceId" = $1 AND "candidateId" = $2 ORDER BY "seq"`, workspaceId, candidateId);
    return r.map(toTransition);
  }

  async currentTransition(workspaceId: string, candidateId: string): Promise<TransitionRecord | null> {
    const r = await this.rows(
      `SELECT * FROM "learning_candidate_transitions" WHERE "workspaceId" = $1 AND "candidateId" = $2 ORDER BY "seq" DESC LIMIT 1`,
      workspaceId,
      candidateId,
    );
    return r[0] ? toTransition(r[0]) : null;
  }

  async citations(workspaceId: string, candidateId: string): Promise<CitationRecord[]> {
    const r = await this.rows(`SELECT * FROM "learning_candidate_evidence" WHERE "workspaceId" = $1 AND "candidateId" = $2 ORDER BY "createdAt", "id"`, workspaceId, candidateId);
    return r.map(toCitation);
  }

  async corroborations(workspaceId: string, candidateId: string): Promise<CorroborationRecord[]> {
    const r = await this.rows(`SELECT * FROM "learning_corroborations" WHERE "workspaceId" = $1 AND "candidateId" = $2 ORDER BY "submittedAt", "id"`, workspaceId, candidateId);
    return r.map(toCorroboration);
  }

  async submissionsForExecution(workspaceId: string, executionId: string): Promise<number> {
    const r = await this.rows(
      `SELECT ((SELECT count(*) FROM "learning_candidates" WHERE "workspaceId" = $1 AND "executionId" = $2)
             + (SELECT count(*) FROM "learning_corroborations" WHERE "workspaceId" = $1 AND "executionId" = $2))::int AS n`,
      workspaceId,
      executionId,
    );
    return Number(r[0]?.['n'] ?? 0);
  }

  async reviewTerms(workspaceId: string, candidateId: string, decisionId: string): Promise<ReviewTermsRecord | null> {
    const r = await this.rows(
      `SELECT * FROM "learning_review_terms" WHERE "workspaceId" = $1 AND "candidateId" = $2 AND "decisionId" = $3`,
      workspaceId,
      candidateId,
      decisionId,
    );
    return r[0] ? toTerms(r[0]) : null;
  }

  async candidatesInStates(states: readonly CandidateState[], workspaceId?: string): Promise<CandidateWithState[]> {
    const r = await this.rows(
      `SELECT c.*, t."id" AS "t_id", t."seq" AS "t_seq", t."state" AS "t_state", t."reason" AS "t_reason",
              t."decisionId" AS "t_decisionId", t."actorKind" AS "t_actorKind", t."actorId" AS "t_actorId", t."at" AS "t_at"
         FROM "learning_candidates" c ${LATEST_TRANSITION}
        WHERE t."state" = ANY($1::text[]) AND ($2::text IS NULL OR c."workspaceId" = $2)
        ORDER BY c."submittedAt"`,
      [...states],
      workspaceId ?? null,
    );
    return r.map((row) => ({
      candidate: toCandidate(row),
      current: toTransition({
        id: row['t_id'],
        workspaceId: row['workspaceId'],
        candidateId: row['id'],
        seq: row['t_seq'],
        state: row['t_state'],
        reason: row['t_reason'],
        decisionId: row['t_decisionId'],
        actorKind: row['t_actorKind'],
        actorId: row['t_actorId'],
        at: row['t_at'],
      }),
    }));
  }

  async entry(workspaceId: string, id: string): Promise<EntryRecord | null> {
    const r = await this.rows(`SELECT * FROM "knowledge_entries" WHERE "workspaceId" = $1 AND "id" = $2`, workspaceId, id);
    return r[0] ? toEntry(r[0]) : null;
  }

  async version(workspaceId: string, id: string): Promise<VersionRecord | null> {
    const r = await this.rows(`SELECT * FROM "knowledge_entry_versions" WHERE "workspaceId" = $1 AND "id" = $2`, workspaceId, id);
    return r[0] ? toVersion(r[0]) : null;
  }

  async versionsOfEntry(workspaceId: string, entryId: string): Promise<VersionRecord[]> {
    const r = await this.rows(`SELECT * FROM "knowledge_entry_versions" WHERE "workspaceId" = $1 AND "entryId" = $2 ORDER BY "version"`, workspaceId, entryId);
    return r.map(toVersion);
  }

  async versionForCandidate(workspaceId: string, candidateId: string): Promise<VersionRecord | null> {
    const r = await this.rows(`SELECT * FROM "knowledge_entry_versions" WHERE "workspaceId" = $1 AND "candidateId" = $2`, workspaceId, candidateId);
    return r[0] ? toVersion(r[0]) : null;
  }

  async versionsByIds(workspaceId: string, ids: readonly string[]): Promise<VersionRecord[]> {
    if (ids.length === 0) return [];
    const r = await this.rows(`SELECT * FROM "knowledge_entry_versions" WHERE "workspaceId" = $1 AND "id" = ANY($2::text[])`, workspaceId, [...ids]);
    return r.map(toVersion);
  }

  async admissionFacts(workspaceId: string, versionIds: readonly string[]): Promise<AdmissionFact[]> {
    if (versionIds.length === 0) return [];
    const r = await this.rows(
      `SELECT v.*,
              e."id" AS "e_id", e."workspaceId" AS "e_workspaceId", e."category" AS "e_category",
              e."subjectKey" AS "e_subjectKey", e."originProjectId" AS "e_originProjectId", e."createdAt" AS "e_createdAt",
              st."id" AS "s_id", st."workspaceId" AS "s_workspaceId", st."versionId" AS "s_versionId", st."status" AS "s_status",
              st."successorVersionId" AS "s_successorVersionId", st."reason" AS "s_reason", st."actorId" AS "s_actorId",
              st."decisionId" AS "s_decisionId", st."candidateId" AS "s_candidateId", st."at" AS "s_at"
         FROM "knowledge_entry_versions" v
         JOIN "knowledge_entries" e ON e."id" = v."entryId"
         ${LATEST_STATUS}
        WHERE v."workspaceId" = $1 AND v."id" = ANY($2::text[])`,
      workspaceId,
      [...versionIds],
    );
    return r.map((row) => ({ version: toVersion(row), entry: toEntry(row, 'e_'), status: row['s_id'] === null || row['s_id'] === undefined ? null : toStatus(row, 's_') }));
  }

  async currentVersionBySubjectKey(workspaceId: string, subjectKey: string): Promise<VersionRecord | null> {
    const r = await this.rows(
      `SELECT v.* FROM "knowledge_entry_versions" v
         JOIN "knowledge_entries" e ON e."id" = v."entryId"
         ${LATEST_STATUS}
        WHERE v."workspaceId" = $1 AND e."subjectKey" = $2 AND st."status" = 'current'
        ORDER BY v."approvedAt" DESC LIMIT 1`,
      workspaceId,
      subjectKey,
    );
    return r[0] ? toVersion(r[0]) : null;
  }

  async statusEvents(workspaceId: string, versionIds: readonly string[]): Promise<StatusEventRecord[]> {
    if (versionIds.length === 0) return [];
    const r = await this.rows(
      `SELECT * FROM "knowledge_version_status_events" WHERE "workspaceId" = $1 AND "versionId" = ANY($2::text[]) ORDER BY "at", "createdAt", "id"`,
      workspaceId,
      [...versionIds],
    );
    return r.map((row) => toStatus(row));
  }

  async currentStatus(workspaceId: string, versionId: string): Promise<StatusEventRecord | null> {
    const r = await this.rows(
      `SELECT * FROM "knowledge_version_status_events" WHERE "workspaceId" = $1 AND "versionId" = $2
        ORDER BY "at" DESC, "createdAt" DESC, "id" DESC LIMIT 1`,
      workspaceId,
      versionId,
    );
    return r[0] ? toStatus(r[0]) : null;
  }

  async flags(workspaceId: string, ref: { versionId?: string; candidateId?: string }): Promise<FlagRecord[]> {
    const r = await this.rows(
      `SELECT * FROM "knowledge_flags" WHERE "workspaceId" = $1
          AND ($2::text IS NULL OR "versionId" = $2) AND ($3::text IS NULL OR "candidateId" = $3)
        ORDER BY "raisedAt", "createdAt", "id"`,
      workspaceId,
      ref.versionId ?? null,
      ref.candidateId ?? null,
    );
    return r.map(toFlag);
  }

  async openFlags(kind: FlagKind, workspaceId?: string): Promise<FlagRecord[]> {
    const r = await this.rows(
      `SELECT f.* FROM "knowledge_flags" f
        WHERE f."kind" = $1 AND f."clearsFlagId" IS NULL AND ($2::text IS NULL OR f."workspaceId" = $2)
          AND NOT EXISTS (SELECT 1 FROM "knowledge_flags" c WHERE c."clearsFlagId" = f."id")
        ORDER BY f."raisedAt", f."id"`,
      kind,
      workspaceId ?? null,
    );
    return r.map(toFlag);
  }

  async latestRetrievability(workspaceId: string, versionId: string): Promise<RetrievabilityRecord | null> {
    const r = await this.rows(
      `SELECT * FROM "knowledge_retrievability" WHERE "workspaceId" = $1 AND "versionId" = $2 ORDER BY "attemptedAt" DESC, "createdAt" DESC LIMIT 1`,
      workspaceId,
      versionId,
    );
    return r[0] ? toRetrievability(r[0]) : null;
  }

  async currentVersions(workspaceId?: string): Promise<VersionRecord[]> {
    const r = await this.rows(
      `SELECT v.* FROM "knowledge_entry_versions" v ${LATEST_STATUS}
        WHERE st."status" = 'current' AND ($1::text IS NULL OR v."workspaceId" = $1)
        ORDER BY v."approvedAt"`,
      workspaceId ?? null,
    );
    return r.map(toVersion);
  }

  async browse(workspaceId: string, filter: BrowseFilter): Promise<BrowsePage> {
    const limit = Math.min(Math.max(filter.limit ?? BROWSE_PAGE_SIZE, 1), 200);
    const after = decodeCursor(filter.cursor);
    const r = await this.rows(
      `SELECT v.*,
              e."id" AS "e_id", e."workspaceId" AS "e_workspaceId", e."category" AS "e_category",
              e."subjectKey" AS "e_subjectKey", e."originProjectId" AS "e_originProjectId", e."createdAt" AS "e_createdAt",
              st."id" AS "s_id", st."workspaceId" AS "s_workspaceId", st."versionId" AS "s_versionId", st."status" AS "s_status",
              st."successorVersionId" AS "s_successorVersionId", st."reason" AS "s_reason", st."actorId" AS "s_actorId",
              st."decisionId" AS "s_decisionId", st."candidateId" AS "s_candidateId", st."at" AS "s_at"
         FROM "knowledge_entry_versions" v
         JOIN "knowledge_entries" e ON e."id" = v."entryId"
         ${LATEST_STATUS}
        WHERE v."workspaceId" = $1
          AND ($2::text IS NULL OR e."category" = $2)
          AND ($3::text IS NULL OR v."scope"->>'kind' = $3)
          AND ($4::text IS NULL OR v."scope"->>'kind' = 'workspace' OR v."scope"->'projectIds' ? $4)
          AND ($5::text IS NULL OR st."status" = $5)
          AND ($6::timestamptz IS NULL OR (v."approvedAt", v."id") < ($6::timestamptz::timestamp, $7::text))
        ORDER BY v."approvedAt" DESC, v."id" DESC
        LIMIT $8`,
      workspaceId,
      filter.category ?? null,
      filter.scopeKind ?? null,
      filter.projectId ?? null,
      filter.status ?? null,
      after ? ts(after.approvedAt) : null,
      after ? after.id : null,
      limit + 1,
    );
    const items = r.slice(0, limit).map((row) => ({
      entry: toEntry(row, 'e_'),
      version: toVersion(row),
      status: row['s_id'] === null || row['s_id'] === undefined ? null : toStatus(row, 's_'),
    }));
    const last = items[items.length - 1];
    return { items, nextCursor: r.length > limit && last ? encodeCursor(last.version) : null };
  }
}

// --------------------------------------------------------------- appends

class PrismaLearningTx extends PrismaLearningReads implements LearningAppends {
  async insertCandidate(candidate: CandidateRecord, citations: readonly CitationRecord[], first: TransitionInput): Promise<void> {
    if (citations.length === 0) throw new ConflictError('A candidate needs at least one evidence citation (FR-LRN-012).');
    try {
      await insert(
        this.db,
        'learning_candidates',
        { ...candidate, claimedScope: json(candidate.claimedScope), submittedAt: ts(candidate.submittedAt) },
        { claimedScope: 'jsonb', submittedAt: 'timestamptz' },
      );
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictError(`idempotency key ${candidate.idempotencyKey} is already recorded in this workspace (FR-LRN-061).`);
      }
      throw err;
    }
    for (const c of citations) await insert(this.db, 'learning_candidate_evidence', { ...c });
    await this.appendTransition(first);
  }

  async insertCorroboration(corroboration: CorroborationRecord, citations: readonly CitationRecord[]): Promise<void> {
    try {
      await insert(this.db, 'learning_corroborations', { ...corroboration, submittedAt: ts(corroboration.submittedAt) }, { submittedAt: 'timestamptz' });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictError(`idempotency key ${corroboration.idempotencyKey} is already recorded in this workspace (FR-LRN-061).`);
      }
      throw err;
    }
    for (const c of citations) await insert(this.db, 'learning_candidate_evidence', { ...c });
  }

  async appendTransition(input: TransitionInput): Promise<TransitionRecord> {
    await this.db.$queryRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))::text AS locked`, `learning-candidate:${input.candidateId}`);
    const current = await this.currentTransition(input.workspaceId, input.candidateId);
    assertTransitionAllowed(current, input);
    const row: TransitionRecord = { ...input, id: input.id ?? newLearningId('lct'), seq: (current?.seq ?? 0) + 1 };
    await insert(this.db, 'learning_candidate_transitions', { ...row, at: ts(row.at) }, { at: 'timestamptz' });
    return row;
  }

  async insertReviewTerms(terms: ReviewTermsRecord): Promise<void> {
    try {
      await insert(this.db, 'learning_review_terms', { ...terms, approvedScope: json(terms.approvedScope), at: ts(terms.at) }, { approvedScope: 'jsonb', at: 'timestamptz' });
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictError('Review terms for this decision are already recorded.');
      throw err;
    }
  }

  async appendFlag(flag: FlagRecord): Promise<void> {
    await insert(this.db, 'knowledge_flags', { ...flag, raisedAt: ts(flag.raisedAt) }, { raisedAt: 'timestamptz' });
  }

  async appendRetrievability(row: RetrievabilityRecord): Promise<void> {
    await insert(this.db, 'knowledge_retrievability', { ...row, attemptedAt: ts(row.attemptedAt) }, { attemptedAt: 'timestamptz' });
  }
}

// ------------------------------------------------------------------ store

export class PrismaLearningStore extends PrismaLearningReads implements LearningStore {
  constructor(private readonly client: LearningPrismaClient) {
    super(client);
  }

  async transaction<T>(fn: (tx: LearningStoreTx) => Promise<T>, options: { readonly lockKeys?: readonly string[] } = {}): Promise<T> {
    return this.client.$transaction(async (tx) => {
      for (const key of [...(options.lockKeys ?? [])].sort()) {
        await tx.$queryRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))::text AS locked`, key);
      }
      return fn(new PrismaLearningTx(tx));
    }, TX_OPTIONS);
  }
}

// ----------------------------------------------------------------- writer

/**
 * The one insert into knowledge, in PostgreSQL. The audit entries are written
 * through the same transaction (`AuditService.record(input, tx)`), so the action
 * and its audit commit or roll back together (`FR-033`, `FR-LRN-062`).
 */
export class PrismaKnowledgeWriter implements KnowledgeWriter {
  constructor(
    private readonly client: LearningPrismaClient,
    private readonly audit: AuditPort,
  ) {}

  async insertVersion(m: Materialisation): Promise<WriteOutcome> {
    return this.client.$transaction(async (tx) => {
      const reads = new PrismaLearningReads(tx);
      await tx.$queryRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))::text AS locked`, `learning-candidate:${m.candidateId}`);
      const current = await reads.currentTransition(m.workspaceId, m.candidateId);
      if (current === null) throw new ConflictError(`No candidate ${m.candidateId} in this workspace.`);
      if (['approved', 'rejected', 'expired', 'withdrawn'].includes(current.state)) return 'already-terminal';

      const statuses = new Map<string, StatusEventRecord | null>();
      for (const e of m.statusEvents) {
        if (e.status === 'current') continue;
        await tx.$queryRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))::text AS locked`, `knowledge-version:${e.versionId}`);
        statuses.set(e.versionId, await reads.currentStatus(m.workspaceId, e.versionId));
      }
      assertMaterialisable(m, statuses);

      const auditWriter = { create: async (data: Record<string, unknown>): Promise<void> => { await tx.auditEntry.create({ data }); } };
      for (const entry of m.audit) await this.audit.record(entry, auditWriter);

      if (m.entry !== null) {
        await insert(tx, 'knowledge_entries', { ...m.entry, createdAt: ts(m.entry.createdAt) }, { createdAt: 'timestamptz' });
      }
      if (m.version !== null) {
        try {
          await insert(
            tx,
            'knowledge_entry_versions',
            { ...m.version, scope: json(m.version.scope), proposedScope: json(m.version.proposedScope), approvedAt: ts(m.version.approvedAt) },
            { scope: 'jsonb', proposedScope: 'jsonb', approvedAt: 'timestamptz' },
          );
        } catch (err) {
          if (isUniqueViolation(err)) throw new ConflictError('This candidate already has a knowledge version, or the entry already has this version number.');
          throw err;
        }
      }
      for (const e of m.statusEvents) {
        await insert(tx, 'knowledge_version_status_events', { ...e, at: ts(e.at) }, { at: 'timestamptz' });
      }
      await insert(
        tx,
        'learning_candidate_transitions',
        {
          id: newLearningId('lct'),
          workspaceId: m.workspaceId,
          candidateId: m.candidateId,
          seq: current.seq + 1,
          state: 'approved',
          reason: m.transition.reason,
          decisionId: m.transition.decisionId,
          actorKind: m.transition.actorKind,
          actorId: m.transition.actorId,
          at: ts(m.transition.at),
        },
        { at: 'timestamptz' },
      );
      return 'written';
    }, TX_OPTIONS);
  }
}
