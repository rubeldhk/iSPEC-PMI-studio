/**
 * `T1908` (EPIC-047) — the store: an interface, and an in-memory
 * implementation for unit tests only.
 *
 * `R-047-14`, `FR-EXP-004`. There is deliberately **no** method that changes a
 * contract version: the only write after insert is `recordDecision`, once. An
 * assignment is superseded, never edited (`FR-EXP-055`). Every read takes the
 * workspace, so an Expert elsewhere is indistinguishable from one that is
 * absent (`FR-EXP-008`).
 */
import { ConflictError } from '../../core/errors.js';
import type {
  Assignment,
  ContractVersion,
  DelegationPolicy,
  EngineeringExpert,
  ExpertSession,
  SessionLimit,
} from './expert.types.js';

export interface ExpertsStore {
  addExpert(row: EngineeringExpert): Promise<EngineeringExpert>;
  findExpert(workspaceId: string, id: string): Promise<EngineeringExpert | null>;
  findExpertByKey(workspaceId: string, key: string): Promise<EngineeringExpert | null>;
  listExperts(workspaceId: string): Promise<EngineeringExpert[]>;
  /** Idempotent: the first retirement's actor and instant are kept. */
  retireExpert(workspaceId: string, id: string, by: string, at: string): Promise<void>;

  addVersion(row: ContractVersion): Promise<ContractVersion>;
  /** Ascending by version. */
  versionsFor(workspaceId: string, expertId: string): Promise<ContractVersion[]>;
  /** Once, from null. A second write is a `ConflictError`. */
  recordDecision(workspaceId: string, versionId: string, decisionId: string): Promise<void>;

  policyFor(workspaceId: string): Promise<DelegationPolicy | null>;
  putPolicy(row: DelegationPolicy): Promise<DelegationPolicy>;

  addSession(row: ExpertSession): Promise<ExpertSession>;
  findSession(workspaceId: string, executionId: string): Promise<ExpertSession | null>;
  /** Newest first. */
  sessionsForExpert(workspaceId: string, expertId: string, limit: number): Promise<ExpertSession[]>;
  childrenOf(workspaceId: string, executionId: string): Promise<ExpertSession[]>;
  endSession(
    workspaceId: string,
    executionId: string,
    end: { outcome: NonNullable<ExpertSession['outcome']>; endedAt: string; toolObservation?: ExpertSession['toolObservation'] },
  ): Promise<void>;

  putLimit(row: SessionLimit): Promise<SessionLimit>;
  limitsFor(workspaceId: string, executionId: string): Promise<SessionLimit[]>;

  addAssignment(row: Assignment): Promise<Assignment>;
  /** Newest first. */
  assignmentsFor(workspaceId: string, taskId: string): Promise<Assignment[]>;
  /** Once. A second supersession is a `ConflictError`. */
  supersedeAssignment(workspaceId: string, id: string, by: string, at: string): Promise<void>;
}

const copy = <T>(value: T): T => structuredClone(value);

export class InMemoryExpertsStore implements ExpertsStore {
  readonly #experts = new Map<string, EngineeringExpert>();
  readonly #versions = new Map<string, ContractVersion>();
  readonly #policies = new Map<string, DelegationPolicy>();
  readonly #sessions = new Map<string, ExpertSession>();
  readonly #limits = new Map<string, SessionLimit>();
  readonly #assignments = new Map<string, Assignment>();

  async addExpert(row: EngineeringExpert): Promise<EngineeringExpert> {
    if ([...this.#experts.values()].some((e) => e.workspaceId === row.workspaceId && e.key === row.key)) {
      throw new ConflictError(`an Expert with the key '${row.key}' is already registered in this workspace`);
    }
    this.#experts.set(row.id, copy(row));
    return copy(row);
  }

  async findExpert(workspaceId: string, id: string): Promise<EngineeringExpert | null> {
    const row = this.#experts.get(id);
    return row && row.workspaceId === workspaceId ? copy(row) : null;
  }

  async findExpertByKey(workspaceId: string, key: string): Promise<EngineeringExpert | null> {
    const row = [...this.#experts.values()].find((e) => e.workspaceId === workspaceId && e.key === key);
    return row ? copy(row) : null;
  }

  async listExperts(workspaceId: string): Promise<EngineeringExpert[]> {
    return [...this.#experts.values()]
      .filter((e) => e.workspaceId === workspaceId)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(copy);
  }

  async retireExpert(workspaceId: string, id: string, by: string, at: string): Promise<void> {
    const row = this.#experts.get(id);
    if (!row || row.workspaceId !== workspaceId || row.status === 'retired') return;
    this.#experts.set(id, { ...row, status: 'retired', retiredBy: by, retiredAt: at });
  }

  async addVersion(row: ContractVersion): Promise<ContractVersion> {
    if ([...this.#versions.values()].some((v) => v.expertId === row.expertId && v.version === row.version)) {
      throw new ConflictError(`version ${row.version} of this Expert already exists`);
    }
    this.#versions.set(row.id, copy(row));
    return copy(row);
  }

  async versionsFor(workspaceId: string, expertId: string): Promise<ContractVersion[]> {
    return [...this.#versions.values()]
      .filter((v) => v.workspaceId === workspaceId && v.expertId === expertId)
      .sort((a, b) => a.version - b.version)
      .map(copy);
  }

  async recordDecision(workspaceId: string, versionId: string, decisionId: string): Promise<void> {
    const row = this.#versions.get(versionId);
    if (!row || row.workspaceId !== workspaceId) throw new ConflictError('no such contract version');
    if (row.decisionId !== null) {
      throw new ConflictError(`contract version ${row.version} was already submitted (decision ${row.decisionId})`);
    }
    this.#versions.set(versionId, { ...row, decisionId });
  }

  async policyFor(workspaceId: string): Promise<DelegationPolicy | null> {
    const row = this.#policies.get(workspaceId);
    return row ? copy(row) : null;
  }

  async putPolicy(row: DelegationPolicy): Promise<DelegationPolicy> {
    this.#policies.set(row.workspaceId, copy(row));
    return copy(row);
  }

  async addSession(row: ExpertSession): Promise<ExpertSession> {
    if (this.#sessions.has(row.executionId)) throw new ConflictError(`session ${row.executionId} already exists`);
    this.#sessions.set(row.executionId, copy(row));
    return copy(row);
  }

  async findSession(workspaceId: string, executionId: string): Promise<ExpertSession | null> {
    const row = this.#sessions.get(executionId);
    return row && row.workspaceId === workspaceId ? copy(row) : null;
  }

  async sessionsForExpert(workspaceId: string, expertId: string, limit: number): Promise<ExpertSession[]> {
    return [...this.#sessions.values()]
      .filter((s) => s.workspaceId === workspaceId && s.expertId === expertId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit)
      .map(copy);
  }

  async childrenOf(workspaceId: string, executionId: string): Promise<ExpertSession[]> {
    return [...this.#sessions.values()]
      .filter((s) => s.workspaceId === workspaceId && s.delegatedFromExecutionId === executionId)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
      .map(copy);
  }

  async endSession(
    workspaceId: string,
    executionId: string,
    end: { outcome: NonNullable<ExpertSession['outcome']>; endedAt: string; toolObservation?: ExpertSession['toolObservation'] },
  ): Promise<void> {
    const row = this.#sessions.get(executionId);
    if (!row || row.workspaceId !== workspaceId || row.outcome !== null) return;
    this.#sessions.set(executionId, {
      ...row,
      outcome: end.outcome,
      endedAt: end.endedAt,
      ...(end.toolObservation ? { toolObservation: end.toolObservation } : {}),
    });
  }

  async putLimit(row: SessionLimit): Promise<SessionLimit> {
    this.#limits.set(`${row.executionId}:${row.limit}`, copy(row));
    return copy(row);
  }

  async limitsFor(workspaceId: string, executionId: string): Promise<SessionLimit[]> {
    const session = this.#sessions.get(executionId);
    if (!session || session.workspaceId !== workspaceId) return [];
    return [...this.#limits.values()].filter((l) => l.executionId === executionId).map(copy);
  }

  async addAssignment(row: Assignment): Promise<Assignment> {
    this.#assignments.set(row.id, copy(row));
    return copy(row);
  }

  async assignmentsFor(workspaceId: string, taskId: string): Promise<Assignment[]> {
    return [...this.#assignments.values()]
      .filter((a) => a.workspaceId === workspaceId && a.taskId === taskId)
      .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))
      .map(copy);
  }

  async supersedeAssignment(workspaceId: string, id: string, by: string, at: string): Promise<void> {
    const row = this.#assignments.get(id);
    if (!row || row.workspaceId !== workspaceId) throw new ConflictError('no such assignment');
    if (row.supersededAt !== null) throw new ConflictError(`assignment ${id} was already superseded`);
    this.#assignments.set(id, { ...row, supersededAt: at, supersededBy: by });
  }
}
