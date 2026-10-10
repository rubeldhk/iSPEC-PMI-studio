/**
 * `T2314` (EPIC-048) — the learning store: the interface services receive, and
 * the in-memory implementation unit tests load.
 *
 * ## The shape is part of the fence (`R-048-4` fence 1)
 *
 * This interface has **no** method that inserts a knowledge version, a version
 * status event or an `approved` transition. Those live on `KnowledgeWriter`
 * (`knowledge.writer.ts`), which the composition root hands to `materialiser.ts`
 * alone. A service holding a `LearningStore` cannot write knowledge, whatever it
 * is asked to do — `T2332` asserts who imports the writer.
 *
 * ## Append-only, every table (`FR-LRN-029`, `-031`, `-035`, `-039`)
 *
 * Nothing here updates or deletes. State is the latest transition row; status is
 * the latest status row; a flag is cleared by a later row naming it. The
 * database says the same with `reject_mutation()` on all ten tables.
 *
 * The PostgreSQL adapter is `learning.store.prisma.ts`, its own file so the
 * generated client never enters a unit test's graph.
 */
import type {
  CandidateKind,
  CandidateState,
  ClaimedScope,
  ConfidenceLevel,
  FlagKind,
  RetrievabilityOutcome,
  RiskBand,
  VersionStatus,
} from '@pmi/learning-contract';
import { TERMINAL_CANDIDATE_STATES, scopeIncludesProject } from '@pmi/learning-contract';
import { ConflictError } from '../../core/errors.js';

// ------------------------------------------------------------------ records

/** `learning_candidates` — the immutable core (data-model §1). */
export interface CandidateRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly kind: CandidateKind;
  readonly targetVersionId: string | null;
  readonly statement: string;
  readonly category: string;
  readonly subject: string;
  readonly subjectKey: string;
  readonly sourceKind: 'execution' | 'person';
  readonly executionId: string | null;
  readonly sourcePrincipalId: string;
  readonly expertId: string | null;
  readonly expertContractVersionId: string | null;
  readonly expertContractVersion: number | null;
  readonly confidenceLevel: ConfidenceLevel;
  readonly confidenceBasis: string;
  readonly claimedScope: ClaimedScope;
  readonly proposedBand: RiskBand | null;
  readonly late: boolean;
  readonly provisional: boolean;
  readonly policyVersion: number;
  readonly objectDigest: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly submittedAt: Date;
}

/** `learning_candidate_evidence` — an id and a digest, nothing else (`FR-LRN-012`). */
export interface CitationRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly candidateId: string;
  readonly corroborationId: string | null;
  readonly evidenceId: string;
  readonly digestAlgorithm: 'sha256';
  readonly digest: string;
}

/** `learning_corroborations` (`FR-LRN-017`). */
export interface CorroborationRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly candidateId: string;
  readonly sourceKind: 'execution' | 'person';
  readonly executionId: string | null;
  readonly sourcePrincipalId: string;
  readonly expertId: string | null;
  readonly expertContractVersionId: string | null;
  readonly statement: string;
  readonly confidenceLevel: ConfidenceLevel;
  readonly confidenceBasis: string;
  readonly late: boolean;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly submittedAt: Date;
}

export type TransitionActorKind = 'human' | 'policy' | 'platform';

/** `learning_candidate_transitions` (data-model §4). */
export interface TransitionRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly candidateId: string;
  readonly seq: number;
  readonly state: CandidateState;
  readonly reason: string | null;
  readonly decisionId: string | null;
  readonly actorKind: TransitionActorKind;
  readonly actorId: string;
  readonly at: Date;
}

export type TransitionInput = Omit<TransitionRecord, 'id' | 'seq'> & { readonly id?: string };

/** `learning_review_terms` (data-model §5). */
export interface ReviewTermsRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly candidateId: string;
  readonly decisionId: string;
  readonly approvedStatement: string;
  readonly approvedScope: ClaimedScope;
  readonly classification: string;
  readonly reviewerId: string;
  readonly at: Date;
}

/** `knowledge_entries` (data-model §6). */
export interface EntryRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly category: string;
  readonly subjectKey: string;
  readonly originProjectId: string;
  readonly createdAt: Date;
}

/** `knowledge_entry_versions` — the trusted record (data-model §7). */
export interface VersionRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly entryId: string;
  readonly version: number;
  readonly statement: string;
  readonly proposedStatement: string;
  readonly scope: ClaimedScope;
  readonly proposedScope: ClaimedScope;
  readonly classification: string;
  readonly candidateId: string;
  readonly decisionId: string;
  readonly resolvingDecisionId: string | null;
  readonly approvedByKind: 'human' | 'policy';
  readonly approvedBy: string;
  readonly approvedAt: Date;
}

/** `knowledge_version_status_events` (data-model §8). */
export interface StatusEventRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly versionId: string;
  readonly status: VersionStatus;
  readonly successorVersionId: string | null;
  readonly reason: string | null;
  readonly actorId: string;
  readonly decisionId: string | null;
  /** The candidate whose approval caused this status — the `deprecate` candidate's proof. */
  readonly candidateId: string | null;
  readonly at: Date;
}

/** `knowledge_flags` (data-model §9). */
export interface FlagRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly versionId: string | null;
  readonly candidateId: string | null;
  readonly kind: FlagKind;
  readonly detail: string;
  readonly raisedAt: Date;
  readonly clearsFlagId: string | null;
}

/** `knowledge_retrievability` (data-model §10). */
export interface RetrievabilityRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly versionId: string;
  readonly outcome: RetrievabilityOutcome;
  readonly reason: string | null;
  readonly attemptedAt: Date;
}

export interface BrowseFilter {
  readonly projectId?: string;
  readonly scopeKind?: ClaimedScope['kind'];
  readonly category?: string;
  readonly status?: VersionStatus;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface BrowseRow {
  readonly entry: EntryRecord;
  readonly version: VersionRecord;
  readonly status: StatusEventRecord | null;
}

export interface BrowsePage {
  readonly items: readonly BrowseRow[];
  readonly nextCursor: string | null;
}

export interface CandidateWithState {
  readonly candidate: CandidateRecord;
  readonly current: TransitionRecord;
}

// ------------------------------------------------------------- interfaces

export interface LearningReads {
  candidate(workspaceId: string, id: string): Promise<CandidateRecord | null>;
  candidateByIdempotencyKey(workspaceId: string, key: string): Promise<CandidateRecord | null>;
  corroborationByIdempotencyKey(workspaceId: string, key: string): Promise<CorroborationRecord | null>;
  /** An open (`proposed`/`pending-review`) candidate with this subject, kind and target. */
  openCandidateFor(workspaceId: string, subjectKey: string, kind: CandidateKind, targetVersionId: string | null): Promise<CandidateRecord | null>;
  transitions(workspaceId: string, candidateId: string): Promise<TransitionRecord[]>;
  currentTransition(workspaceId: string, candidateId: string): Promise<TransitionRecord | null>;
  citations(workspaceId: string, candidateId: string): Promise<CitationRecord[]>;
  corroborations(workspaceId: string, candidateId: string): Promise<CorroborationRecord[]>;
  /** Candidates and corroborations recorded for one execution (`FR-LRN-007`). */
  submissionsForExecution(workspaceId: string, executionId: string): Promise<number>;
  reviewTerms(workspaceId: string, candidateId: string, decisionId: string): Promise<ReviewTermsRecord | null>;
  /** Candidates whose current state is one of `states` — every workspace when none is named (jobs). */
  candidatesInStates(states: readonly CandidateState[], workspaceId?: string): Promise<CandidateWithState[]>;
  entry(workspaceId: string, id: string): Promise<EntryRecord | null>;
  version(workspaceId: string, id: string): Promise<VersionRecord | null>;
  versionsOfEntry(workspaceId: string, entryId: string): Promise<VersionRecord[]>;
  versionForCandidate(workspaceId: string, candidateId: string): Promise<VersionRecord | null>;
  versionsByIds(workspaceId: string, ids: readonly string[]): Promise<VersionRecord[]>;
  /** The version whose current status is `current`, for an entry with this subject key. */
  currentVersionBySubjectKey(workspaceId: string, subjectKey: string): Promise<VersionRecord | null>;
  statusEvents(workspaceId: string, versionIds: readonly string[]): Promise<StatusEventRecord[]>;
  currentStatus(workspaceId: string, versionId: string): Promise<StatusEventRecord | null>;
  flags(workspaceId: string, ref: { readonly versionId?: string; readonly candidateId?: string }): Promise<FlagRecord[]>;
  latestRetrievability(workspaceId: string, versionId: string): Promise<RetrievabilityRecord | null>;
  /** Versions whose current status is `current` — every workspace when none is named (jobs). */
  currentVersions(workspaceId?: string): Promise<VersionRecord[]>;
  browse(workspaceId: string, filter: BrowseFilter): Promise<BrowsePage>;
}

export interface LearningAppends {
  /** Candidate, its citations (≥ 1) and its first transition, together. */
  insertCandidate(candidate: CandidateRecord, citations: readonly CitationRecord[], first: TransitionInput): Promise<void>;
  insertCorroboration(corroboration: CorroborationRecord, citations: readonly CitationRecord[]): Promise<void>;
  /** Refuses `approved` (the writer's alone) and anything after a terminal state. */
  appendTransition(transition: TransitionInput): Promise<TransitionRecord>;
  insertReviewTerms(terms: ReviewTermsRecord): Promise<void>;
  appendFlag(flag: FlagRecord): Promise<void>;
  appendRetrievability(row: RetrievabilityRecord): Promise<void>;
}

export type LearningStoreTx = LearningReads & LearningAppends;

export interface LearningStore extends LearningReads {
  /**
   * Run `fn` atomically. `lockKeys` are serialised for the transaction — the
   * advisory lock `R-048-15` takes on `(workspaceId, subjectKey)`.
   */
  transaction<T>(fn: (tx: LearningStoreTx) => Promise<T>, options?: { readonly lockKeys?: readonly string[] }): Promise<T>;
}

// ----------------------------------------------------------- shared rules

export function isTerminal(state: CandidateState): boolean {
  return (TERMINAL_CANDIDATE_STATES as readonly string[]).includes(state);
}

/** Refused here and, in PostgreSQL, by `learning_transitions_guard`. */
export function assertTransitionAllowed(current: TransitionRecord | null, next: TransitionInput): void {
  if (next.state === 'approved') {
    throw new ConflictError('An approved transition is written only with its knowledge, by the materialiser (R-048-4).');
  }
  if (current !== null && isTerminal(current.state)) {
    throw new ConflictError(`Candidate ${next.candidateId} is ${current.state}, a terminal state; nothing follows it (FR-LRN-004).`);
  }
}

export function encodeCursor(row: { approvedAt: Date; id: string }): string {
  return Buffer.from(`${row.approvedAt.toISOString()}|${row.id}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string | undefined): { approvedAt: Date; id: string } | null {
  if (cursor === undefined || cursor === '') return null;
  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  const [at, id] = raw.split('|');
  if (!at || !id || Number.isNaN(Date.parse(at))) return null;
  return { approvedAt: new Date(at), id };
}

export const BROWSE_PAGE_SIZE = 50;

// -------------------------------------------------------------- in-memory

/** The in-memory tables. Shared with the in-memory writer through {@link WRITER_ACCESS}. */
export interface InMemoryTables {
  candidates: CandidateRecord[];
  citations: CitationRecord[];
  corroborations: CorroborationRecord[];
  transitions: TransitionRecord[];
  reviewTerms: ReviewTermsRecord[];
  entries: EntryRecord[];
  versions: VersionRecord[];
  statusEvents: StatusEventRecord[];
  flags: FlagRecord[];
  retrievability: RetrievabilityRecord[];
}

/** How `InMemoryKnowledgeWriter` reaches the tables. Not on the `LearningStore` interface. */
export const WRITER_ACCESS = Symbol('learning.writer-access');

let seq = 0;
export function newLearningId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function emptyTables(): InMemoryTables {
  return { candidates: [], citations: [], corroborations: [], transitions: [], reviewTerms: [], entries: [], versions: [], statusEvents: [], flags: [], retrievability: [] };
}

function snapshot(t: InMemoryTables): InMemoryTables {
  return {
    candidates: [...t.candidates],
    citations: [...t.citations],
    corroborations: [...t.corroborations],
    transitions: [...t.transitions],
    reviewTerms: [...t.reviewTerms],
    entries: [...t.entries],
    versions: [...t.versions],
    statusEvents: [...t.statusEvents],
    flags: [...t.flags],
    retrievability: [...t.retrievability],
  };
}

const OPEN: readonly CandidateState[] = ['proposed', 'pending-review'];

/** Unit tests only. Every transaction is serialised and rolled back on throw. */
export class InMemoryLearningStore implements LearningStore {
  private tables: InMemoryTables = emptyTables();
  private queue: Promise<unknown> = Promise.resolve();

  /** The writer's handle on the tables. Deliberately outside `LearningStore`. */
  [WRITER_ACCESS](): { tables: InMemoryTables; exclusive<T>(fn: () => Promise<T>): Promise<T> } {
    return { tables: this.tables, exclusive: (fn) => this.exclusive(fn) };
  }

  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const before = snapshot(this.tables);
      try {
        return await fn();
      } catch (err) {
        Object.assign(this.tables, before);
        throw err;
      }
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async transaction<T>(fn: (tx: LearningStoreTx) => Promise<T>): Promise<T> {
    return this.exclusive(() => fn(this.txView()));
  }

  private txView(): LearningStoreTx {
    const reads: LearningReads = this;
    const appends: LearningAppends = {
      insertCandidate: async (candidate, citations, first) => {
        if (citations.length === 0) throw new ConflictError('A candidate needs at least one evidence citation (FR-LRN-012).');
        if (this.tables.candidates.some((c) => c.workspaceId === candidate.workspaceId && c.idempotencyKey === candidate.idempotencyKey)) {
          throw new ConflictError(`idempotency key ${candidate.idempotencyKey} is already recorded in this workspace (FR-LRN-061).`);
        }
        this.tables.candidates.push(candidate);
        this.tables.citations.push(...citations);
        await appends.appendTransition(first);
      },
      insertCorroboration: async (corroboration, citations) => {
        if (this.tables.corroborations.some((c) => c.workspaceId === corroboration.workspaceId && c.idempotencyKey === corroboration.idempotencyKey)) {
          throw new ConflictError(`idempotency key ${corroboration.idempotencyKey} is already recorded in this workspace (FR-LRN-061).`);
        }
        this.tables.corroborations.push(corroboration);
        this.tables.citations.push(...citations);
      },
      appendTransition: async (input) => {
        const current = this.latestTransition(input.workspaceId, input.candidateId);
        assertTransitionAllowed(current, input);
        const row: TransitionRecord = { ...input, id: input.id ?? newLearningId('lct'), seq: (current?.seq ?? 0) + 1 };
        this.tables.transitions.push(row);
        return row;
      },
      insertReviewTerms: async (terms) => {
        if (this.tables.reviewTerms.some((t) => t.candidateId === terms.candidateId && t.decisionId === terms.decisionId)) {
          throw new ConflictError('Review terms for this decision are already recorded.');
        }
        this.tables.reviewTerms.push(terms);
      },
      appendFlag: async (flag) => {
        this.tables.flags.push(flag);
      },
      appendRetrievability: async (row) => {
        this.tables.retrievability.push(row);
      },
    };
    return Object.assign(Object.create(reads) as LearningReads, appends);
  }

  private latestTransition(workspaceId: string, candidateId: string): TransitionRecord | null {
    const rows = this.tables.transitions.filter((t) => t.workspaceId === workspaceId && t.candidateId === candidateId);
    return rows.reduce<TransitionRecord | null>((acc, t) => (acc === null || t.seq > acc.seq ? t : acc), null);
  }

  private latestStatus(workspaceId: string, versionId: string): StatusEventRecord | null {
    const rows = this.tables.statusEvents.filter((s) => s.workspaceId === workspaceId && s.versionId === versionId);
    return rows.length === 0 ? null : rows[rows.length - 1]!;
  }

  async candidate(workspaceId: string, id: string): Promise<CandidateRecord | null> {
    return this.tables.candidates.find((c) => c.workspaceId === workspaceId && c.id === id) ?? null;
  }

  async candidateByIdempotencyKey(workspaceId: string, key: string): Promise<CandidateRecord | null> {
    return this.tables.candidates.find((c) => c.workspaceId === workspaceId && c.idempotencyKey === key) ?? null;
  }

  async corroborationByIdempotencyKey(workspaceId: string, key: string): Promise<CorroborationRecord | null> {
    return this.tables.corroborations.find((c) => c.workspaceId === workspaceId && c.idempotencyKey === key) ?? null;
  }

  async openCandidateFor(workspaceId: string, subjectKey: string, kind: CandidateKind, targetVersionId: string | null): Promise<CandidateRecord | null> {
    return (
      this.tables.candidates.find((c) => {
        if (c.workspaceId !== workspaceId || c.subjectKey !== subjectKey || c.kind !== kind || c.targetVersionId !== targetVersionId) return false;
        const state = this.latestTransition(workspaceId, c.id)?.state;
        return state !== undefined && OPEN.includes(state);
      }) ?? null
    );
  }

  async transitions(workspaceId: string, candidateId: string): Promise<TransitionRecord[]> {
    return this.tables.transitions.filter((t) => t.workspaceId === workspaceId && t.candidateId === candidateId).sort((a, b) => a.seq - b.seq);
  }

  async currentTransition(workspaceId: string, candidateId: string): Promise<TransitionRecord | null> {
    return this.latestTransition(workspaceId, candidateId);
  }

  async citations(workspaceId: string, candidateId: string): Promise<CitationRecord[]> {
    return this.tables.citations.filter((c) => c.workspaceId === workspaceId && c.candidateId === candidateId);
  }

  async corroborations(workspaceId: string, candidateId: string): Promise<CorroborationRecord[]> {
    return this.tables.corroborations.filter((c) => c.workspaceId === workspaceId && c.candidateId === candidateId);
  }

  async submissionsForExecution(workspaceId: string, executionId: string): Promise<number> {
    return (
      this.tables.candidates.filter((c) => c.workspaceId === workspaceId && c.executionId === executionId).length +
      this.tables.corroborations.filter((c) => c.workspaceId === workspaceId && c.executionId === executionId).length
    );
  }

  async reviewTerms(workspaceId: string, candidateId: string, decisionId: string): Promise<ReviewTermsRecord | null> {
    return this.tables.reviewTerms.find((t) => t.workspaceId === workspaceId && t.candidateId === candidateId && t.decisionId === decisionId) ?? null;
  }

  async candidatesInStates(states: readonly CandidateState[], workspaceId?: string): Promise<CandidateWithState[]> {
    const out: CandidateWithState[] = [];
    for (const c of this.tables.candidates) {
      if (workspaceId !== undefined && c.workspaceId !== workspaceId) continue;
      const current = this.latestTransition(c.workspaceId, c.id);
      if (current !== null && states.includes(current.state)) out.push({ candidate: c, current });
    }
    return out;
  }

  async entry(workspaceId: string, id: string): Promise<EntryRecord | null> {
    return this.tables.entries.find((e) => e.workspaceId === workspaceId && e.id === id) ?? null;
  }

  async version(workspaceId: string, id: string): Promise<VersionRecord | null> {
    return this.tables.versions.find((v) => v.workspaceId === workspaceId && v.id === id) ?? null;
  }

  async versionsOfEntry(workspaceId: string, entryId: string): Promise<VersionRecord[]> {
    return this.tables.versions.filter((v) => v.workspaceId === workspaceId && v.entryId === entryId).sort((a, b) => a.version - b.version);
  }

  async versionForCandidate(workspaceId: string, candidateId: string): Promise<VersionRecord | null> {
    return this.tables.versions.find((v) => v.workspaceId === workspaceId && v.candidateId === candidateId) ?? null;
  }

  async versionsByIds(workspaceId: string, ids: readonly string[]): Promise<VersionRecord[]> {
    const wanted = new Set(ids);
    return this.tables.versions.filter((v) => v.workspaceId === workspaceId && wanted.has(v.id));
  }

  async currentVersionBySubjectKey(workspaceId: string, subjectKey: string): Promise<VersionRecord | null> {
    const entries = new Set(this.tables.entries.filter((e) => e.workspaceId === workspaceId && e.subjectKey === subjectKey).map((e) => e.id));
    return (
      this.tables.versions.find((v) => v.workspaceId === workspaceId && entries.has(v.entryId) && this.latestStatus(workspaceId, v.id)?.status === 'current') ?? null
    );
  }

  async statusEvents(workspaceId: string, versionIds: readonly string[]): Promise<StatusEventRecord[]> {
    const wanted = new Set(versionIds);
    return this.tables.statusEvents.filter((s) => s.workspaceId === workspaceId && wanted.has(s.versionId));
  }

  async currentStatus(workspaceId: string, versionId: string): Promise<StatusEventRecord | null> {
    return this.latestStatus(workspaceId, versionId);
  }

  async flags(workspaceId: string, ref: { versionId?: string; candidateId?: string }): Promise<FlagRecord[]> {
    return this.tables.flags.filter(
      (f) =>
        f.workspaceId === workspaceId &&
        (ref.versionId === undefined || f.versionId === ref.versionId) &&
        (ref.candidateId === undefined || f.candidateId === ref.candidateId),
    );
  }

  async latestRetrievability(workspaceId: string, versionId: string): Promise<RetrievabilityRecord | null> {
    const rows = this.tables.retrievability.filter((r) => r.workspaceId === workspaceId && r.versionId === versionId);
    return rows.length === 0 ? null : rows[rows.length - 1]!;
  }

  async currentVersions(workspaceId?: string): Promise<VersionRecord[]> {
    return this.tables.versions.filter(
      (v) => (workspaceId === undefined || v.workspaceId === workspaceId) && this.latestStatus(v.workspaceId, v.id)?.status === 'current',
    );
  }

  async browse(workspaceId: string, filter: BrowseFilter): Promise<BrowsePage> {
    const limit = Math.min(Math.max(filter.limit ?? BROWSE_PAGE_SIZE, 1), 200);
    const after = decodeCursor(filter.cursor);
    const rows: BrowseRow[] = [];
    const sorted = this.tables.versions
      .filter((v) => v.workspaceId === workspaceId)
      .sort((a, b) => b.approvedAt.getTime() - a.approvedAt.getTime() || (a.id < b.id ? 1 : -1));
    for (const version of sorted) {
      if (after !== null) {
        const t = version.approvedAt.getTime();
        const at = after.approvedAt.getTime();
        if (t > at || (t === at && version.id >= after.id)) continue;
      }
      const entry = this.tables.entries.find((e) => e.id === version.entryId);
      if (entry === undefined) continue;
      const status = this.latestStatus(workspaceId, version.id);
      if (filter.category !== undefined && entry.category !== filter.category) continue;
      if (filter.scopeKind !== undefined && version.scope.kind !== filter.scopeKind) continue;
      if (filter.projectId !== undefined && !scopeIncludesProject(version.scope, filter.projectId)) continue;
      if (filter.status !== undefined && status?.status !== filter.status) continue;
      rows.push({ entry, version, status });
      if (rows.length > limit) break;
    }
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return { items: page, nextCursor: rows.length > limit && last ? encodeCursor(last.version) : null };
  }
}
