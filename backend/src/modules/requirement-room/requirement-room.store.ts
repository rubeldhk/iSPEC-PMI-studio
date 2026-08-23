/**
 * T338b — where this Room's own candidates, decisions and baselines live.
 * `REQUIREMENT_ROOM_STORE`.
 *
 * **This is the Room's store, not a requirement store.** `CandidateRow` holds
 * normalized *intent* and a `promotedTo` **reference**; `BaselineRow` holds
 * requirement **version ids** and a hash. Neither holds a decided requirement's
 * description, type or priority — `FR-RQR-002`, `D-33`, and the boundary
 * `requirement-room.tokens.ts` names as the one most likely to be crossed
 * *"because a local cache of requirement text would feel convenient every
 * single day"*. The row shapes below are the `requirement_candidates` and
 * `baselines` column sets exactly, so a field cannot be added here without
 * being added to the table, where the reviewer will see it.
 *
 * **In-memory by default, and the asymmetry from `EPIC-030`'s `loop.module.ts`
 * applies unchanged**: this store defaults because an in-memory store loses
 * data, which is visible and testable. The *governance* seams — policy,
 * evidence, the `EPIC-007` register — default to nothing, because a default
 * that permits is indistinguishable at every call site from a policy that said
 * yes.
 *
 * Framework-free (PC-1).
 */
import { randomUUID } from 'node:crypto';
import type { Epistemic } from '@pmi/room-contract';
import { EPISTEMIC_KINDS, isEpistemic } from '@pmi/room-contract';
import { ConflictError, NotFoundError } from '../../core/errors.js';

/**
 * The `RoomEpistemic` spelling of a kind.
 *
 * A Postgres enum member cannot carry a hyphen, so `open-question` is stored as
 * `open_question`. That single character is the whole reason these two
 * functions exist as a named pair rather than as an inline `replace` at one
 * call site: applied in one direction only, a stored `open_question` reads back
 * as a value the contract's union does not contain, and every `switch` over the
 * four kinds falls through to its default branch — an unlabelled element
 * (`FR-RQR-011`) arriving through the storage layer instead of through a caller.
 */
export type PersistedEpistemic = 'fact' | 'inference' | 'recommendation' | 'open_question';

export function toPersistedEpistemic(kind: Epistemic): PersistedEpistemic {
  return (kind === 'open-question' ? 'open_question' : kind) as PersistedEpistemic;
}

/** Throws rather than defaulting: a default would invent a label nobody wrote. */
export function fromPersistedEpistemic(stored: string): Epistemic {
  const candidate = stored === 'open_question' ? 'open-question' : stored;
  if (!isEpistemic(candidate)) {
    throw new ConflictError(
      `stored epistemic label "${stored}" is not one of ${EPISTEMIC_KINDS.join(', ')}`,
    );
  }
  return candidate;
}

/** `requirement_candidates`. Data-model §1. */
export interface CandidateRow {
  id: string;
  workspaceId: string;
  projectId: string;
  roomObjectId: string;
  /** Which intake it came from — document, direct input, imported artifact. */
  sourceRef: string;
  normalizedText: string;
  /** Required. `R-033-4` — there is no unlabelled variant. */
  epistemic: Epistemic;
  /** Set by Phase 4's analysis, epistemically typed. Null until then. */
  aiAnalysis: unknown | null;
  /** The `EPIC-007` requirement id once decided. A reference, never a copy. */
  promotedTo: string | null;
  /**
   * `FR-RQR-030` — what the baseline gate reads. Null and `[]` are the same
   * state, and both block.
   */
  acceptanceCriteria: readonly string[] | null;
  /**
   * Presumed **true**. A candidate needs criteria until somebody says
   * otherwise — see the migration for why the other default would be a default
   * that permits.
   */
  intendedForImplementation: boolean;
  createdAt: Date;
}

/** `clarifications`. Data-model §2. */
export interface ClarificationRow {
  id: string;
  /**
   * `FR-002` / `BR-0001`. Carried from the first migration, because reachable
   * via the candidate is not the same as scoped.
   */
  workspaceId: string;
  roomObjectId: string;
  /** The candidate this question is about; null for a question about the set. */
  candidateId: string | null;
  question: string;
  /** An actor id, or an `AgentExecutionRecord` id when AI-generated. */
  askedBy: string;
  answer: string | null;
  answeredBy: string | null;
  answeredAt: Date | null;
  /**
   * That this is a **blocking kind** of question — one attached to a candidate
   * intended for implementation. Whether it *still* blocks is read from
   * `answer`; see `ClarificationService.blockers`.
   */
  blocksBaseline: boolean;
  createdAt: Date;
}

/** `requirement_decisions`. Data-model §4. */
export interface DecisionRow {
  id: string;
  workspaceId: string;
  roomObjectId: string;
  decidedBy: string;
  /**
   * `FR-RQR-041`. The type has one inhabitant this Room ever writes, and the
   * `requirement_decisions_are_human` CHECK constraint refuses the other at the
   * row — the belt beside the braces.
   */
  decidedByKind: 'human';
  /** `EPIC-031`'s words for why this was permitted — consumed, not authored. */
  authorityBasis: string;
  objectVersion: number;
  chosenOption: string;
  /** `FR-RQR-023` — the options NOT taken, in full rather than by id. */
  declinedOptions: readonly unknown[];
  /** `BR-0025` — required. */
  rationale: string;
  /** → `EPIC-031`'s Decision. Also the Decision Inbox link (`FR-RQR-044`). */
  decisionId: string;
  decidedAt: Date;
}

/** `baselines`. Data-model §5. */
export interface BaselineRow {
  id: string;
  workspaceId: string;
  projectId: string;
  /** Monotonic per project; never reused. */
  version: number;
  /** `R-033-5` — the `EPIC-007` requirement VERSION IDS. Never their text. */
  memberVersionIds: readonly string[];
  setHash: string;
  approvedBy: string;
  approvedAt: Date;
  rationale: string;
  decisionId: string;
  /** The baseline VERSION that replaced this one; null while current. */
  supersededBy: number | null;
  evidenceContractRef: string | null;
}

/**
 * `baseline_exceptions`. Data-model §6.
 *
 * **A table rather than a flag on the member**, and `FR-RQR-033` is the reason:
 * exceptions must be enumerable for a baseline *without opening each
 * requirement*. An exception that becomes invisible is a rule waived once and
 * then forgotten.
 */
export interface BaselineExceptionRow {
  id: string;
  workspaceId: string;
  baselineId: string;
  requirementVersionId: string;
  /** Which precondition was waived. Currently only missing acceptance criteria. */
  condition: string;
  /** `FR-RQR-032` — both required, at the service and at the CHECK constraint. */
  authorizedBy: string;
  reason: string;
  createdAt: Date;
}

/**
 * The persistence port.
 *
 * **There is no `updateBaseline` and no `deleteBaseline`.** The only mutation a
 * baseline accepts is `supersede`, which is what the `baselines_supersede_only`
 * trigger permits and nothing more (`RULE-02`, `BR-0026`). A port that offered
 * a general update would let a caller do at the service layer what the database
 * refuses at the row — and the two would disagree only in production.
 */
export interface RequirementRoomStore {
  createCandidates(rows: readonly CandidateRow[]): Promise<CandidateRow[]>;
  findCandidateById(id: string): Promise<CandidateRow | null>;
  listCandidates(workspaceId: string, roomObjectId: string): Promise<CandidateRow[]>;
  /** Records the `EPIC-007` reference. The text stays where `EPIC-007` put it. */
  markPromoted(id: string, requirementId: string): Promise<CandidateRow>;
  /** `T339b` — what the criteria gate later reads. */
  setCandidateCriteria(
    id: string,
    criteria: {
      acceptanceCriteria: readonly string[] | null;
      intendedForImplementation: boolean;
    },
  ): Promise<CandidateRow>;

  /**
   * One set, written together — `FR-RQR-012`. There is deliberately no
   * `createClarification` singular: a port that can ask one question is a port
   * somebody will ask six questions with, one at a time.
   */
  createClarifications(rows: readonly ClarificationRow[]): Promise<ClarificationRow[]>;
  findClarificationById(id: string): Promise<ClarificationRow | null>;
  listClarifications(workspaceId: string, roomObjectId: string): Promise<ClarificationRow[]>;
  /**
   * The one permitted mutation, and it only ever adds an answer — the shape of
   * the `clarifications_are_retained` trigger, which refuses a `DELETE`
   * outright while permitting the `UPDATE` that carries an answer
   * (`FR-RQR-013`). **There is no delete on this port.**
   */
  answerClarification(
    id: string,
    answer: { answer: string; answeredBy: string; answeredAt: Date },
  ): Promise<ClarificationRow>;

  createBaseline(row: BaselineRow): Promise<BaselineRow>;
  findBaselineById(id: string): Promise<BaselineRow | null>;
  findBaselineByVersion(projectId: string, version: number): Promise<BaselineRow | null>;
  listBaselines(workspaceId: string, projectId: string): Promise<BaselineRow[]>;
  /** Next monotonic version for the project. Never reuses a retired number. */
  nextBaselineVersion(projectId: string): Promise<number>;
  /** The one permitted update — see the note above. */
  supersede(id: string, byVersion: number): Promise<BaselineRow>;

  /**
   * `T339p`. Append-only by omission: there is no update and no delete, because
   * a decision that can be rewritten is not a decision anybody can rely on
   * having been taken.
   */
  createDecision(row: DecisionRow): Promise<DecisionRow>;
  listDecisions(workspaceId: string, roomObjectId: string): Promise<DecisionRow[]>;

  createBaselineExceptions(rows: readonly BaselineExceptionRow[]): Promise<BaselineExceptionRow[]>;
  /** `FR-RQR-033` — one lookup, by baseline. Never per requirement. */
  listBaselineExceptions(workspaceId: string, baselineId: string): Promise<BaselineExceptionRow[]>;
}

const NOT_FOUND = 'Not found.';

export class InMemoryRequirementRoomStore implements RequirementRoomStore {
  private readonly candidates = new Map<string, CandidateRow>();
  private readonly baselines = new Map<string, BaselineRow>();
  private readonly clarifications = new Map<string, ClarificationRow>();
  /** Ask order. `FR-RQR-012` presents a set; a set with no order is a shuffle. */
  private readonly clarificationOrder: string[] = [];
  private readonly exceptions = new Map<string, BaselineExceptionRow>();
  private readonly exceptionOrder: string[] = [];
  private readonly decisions = new Map<string, DecisionRow>();
  private readonly decisionOrder: string[] = [];

  async createCandidates(rows: readonly CandidateRow[]): Promise<CandidateRow[]> {
    return rows.map((row) => {
      const stored = { ...row, id: row.id || randomUUID() };
      this.candidates.set(stored.id, stored);
      return { ...stored };
    });
  }

  async findCandidateById(id: string): Promise<CandidateRow | null> {
    const row = this.candidates.get(id);
    return row ? { ...row } : null;
  }

  async listCandidates(workspaceId: string, roomObjectId: string): Promise<CandidateRow[]> {
    return [...this.candidates.values()]
      .filter((row) => row.workspaceId === workspaceId && row.roomObjectId === roomObjectId)
      .map((row) => ({ ...row }));
  }

  async markPromoted(id: string, requirementId: string): Promise<CandidateRow> {
    const row = this.candidates.get(id);
    if (!row) throw new NotFoundError(NOT_FOUND);
    const next = { ...row, promotedTo: requirementId };
    this.candidates.set(id, next);
    return { ...next };
  }

  async setCandidateCriteria(
    id: string,
    criteria: {
      acceptanceCriteria: readonly string[] | null;
      intendedForImplementation: boolean;
    },
  ): Promise<CandidateRow> {
    const row = this.candidates.get(id);
    if (!row) throw new NotFoundError(NOT_FOUND);
    const next: CandidateRow = {
      ...row,
      acceptanceCriteria: criteria.acceptanceCriteria ? [...criteria.acceptanceCriteria] : null,
      intendedForImplementation: criteria.intendedForImplementation,
    };
    this.candidates.set(id, next);
    return { ...next };
  }

  async createClarifications(rows: readonly ClarificationRow[]): Promise<ClarificationRow[]> {
    return rows.map((row) => {
      const stored = { ...row, id: row.id || randomUUID() };
      this.clarifications.set(stored.id, stored);
      this.clarificationOrder.push(stored.id);
      return { ...stored };
    });
  }

  async findClarificationById(id: string): Promise<ClarificationRow | null> {
    const row = this.clarifications.get(id);
    return row ? { ...row } : null;
  }

  async listClarifications(workspaceId: string, roomObjectId: string): Promise<ClarificationRow[]> {
    return this.clarificationOrder
      .map((id) => this.clarifications.get(id))
      .filter(
        (row): row is ClarificationRow =>
          row !== undefined && row.workspaceId === workspaceId && row.roomObjectId === roomObjectId,
      )
      .map((row) => ({ ...row }));
  }

  async answerClarification(
    id: string,
    answer: { answer: string; answeredBy: string; answeredAt: Date },
  ): Promise<ClarificationRow> {
    const row = this.clarifications.get(id);
    if (!row) throw new NotFoundError(NOT_FOUND);
    // Adds an answer and touches nothing else — the question, who asked it and
    // when are the record (FR-RQR-013).
    const next = { ...row, ...answer };
    this.clarifications.set(id, next);
    return { ...next };
  }

  async createBaseline(row: BaselineRow): Promise<BaselineRow> {
    // `baselines_projectId_version_key`, in memory. A duplicate version means
    // two approvals raced on `nextBaselineVersion`; the unique index is what
    // decides that in Postgres, so the same refusal has to exist here or the
    // in-memory path is the one that silently merges (`FR-RQR-054`).
    const clash = [...this.baselines.values()].find(
      (existing) => existing.projectId === row.projectId && existing.version === row.version,
    );
    if (clash) {
      throw new ConflictError(
        `baseline version ${row.version} already exists for project ${row.projectId}`,
      );
    }
    const stored = { ...row, id: row.id || randomUUID(), memberVersionIds: [...row.memberVersionIds] };
    this.baselines.set(stored.id, stored);
    return { ...stored, memberVersionIds: [...stored.memberVersionIds] };
  }

  async findBaselineById(id: string): Promise<BaselineRow | null> {
    const row = this.baselines.get(id);
    return row ? { ...row, memberVersionIds: [...row.memberVersionIds] } : null;
  }

  async findBaselineByVersion(projectId: string, version: number): Promise<BaselineRow | null> {
    const row = [...this.baselines.values()].find(
      (existing) => existing.projectId === projectId && existing.version === version,
    );
    return row ? { ...row, memberVersionIds: [...row.memberVersionIds] } : null;
  }

  async listBaselines(workspaceId: string, projectId: string): Promise<BaselineRow[]> {
    return [...this.baselines.values()]
      .filter((row) => row.workspaceId === workspaceId && row.projectId === projectId)
      .sort((a, b) => a.version - b.version)
      .map((row) => ({ ...row, memberVersionIds: [...row.memberVersionIds] }));
  }

  async nextBaselineVersion(projectId: string): Promise<number> {
    const versions = [...this.baselines.values()]
      .filter((row) => row.projectId === projectId)
      .map((row) => row.version);
    return versions.length === 0 ? 1 : Math.max(...versions) + 1;
  }

  async createDecision(row: DecisionRow): Promise<DecisionRow> {
    const stored: DecisionRow = {
      ...row,
      id: row.id || randomUUID(),
      declinedOptions: [...row.declinedOptions],
    };
    this.decisions.set(stored.id, stored);
    this.decisionOrder.push(stored.id);
    return { ...stored, declinedOptions: [...stored.declinedOptions] };
  }

  async listDecisions(workspaceId: string, roomObjectId: string): Promise<DecisionRow[]> {
    return this.decisionOrder
      .map((id) => this.decisions.get(id))
      .filter(
        (row): row is DecisionRow =>
          row !== undefined && row.workspaceId === workspaceId && row.roomObjectId === roomObjectId,
      )
      .map((row) => ({ ...row, declinedOptions: [...row.declinedOptions] }));
  }

  async createBaselineExceptions(
    rows: readonly BaselineExceptionRow[],
  ): Promise<BaselineExceptionRow[]> {
    return rows.map((row) => {
      const stored = { ...row, id: row.id || randomUUID() };
      this.exceptions.set(stored.id, stored);
      this.exceptionOrder.push(stored.id);
      return { ...stored };
    });
  }

  async listBaselineExceptions(
    workspaceId: string,
    baselineId: string,
  ): Promise<BaselineExceptionRow[]> {
    return this.exceptionOrder
      .map((id) => this.exceptions.get(id))
      .filter(
        (row): row is BaselineExceptionRow =>
          row !== undefined && row.workspaceId === workspaceId && row.baselineId === baselineId,
      )
      .map((row) => ({ ...row }));
  }

  async supersede(id: string, byVersion: number): Promise<BaselineRow> {
    const row = this.baselines.get(id);
    if (!row) throw new NotFoundError(NOT_FOUND);
    // Mirrors `reject_baseline_rewrite`: every other column is left exactly as
    // it stands, and only `supersededBy` moves.
    const next = { ...row, supersededBy: byVersion };
    this.baselines.set(id, next);
    return { ...next, memberVersionIds: [...next.memberVersionIds] };
  }
}
