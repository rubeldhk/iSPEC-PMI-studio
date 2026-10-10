/**
 * `T1944` (EPIC-047) — reading Expert runs back.
 *
 * `FR-EXP-073`, `SC-EXP-006`. A run is read from the record alone: its
 * session, its limits, and the governance events on its execution. A run in
 * another workspace is indistinguishable from one that does not exist.
 */
import { NotFoundError } from '../../core/errors.js';
import { delegationTree, validatePolicy, type DelegationTree } from './delegation.service.js';
import type { DelegationPolicy, ExpertSession, SessionLimit } from './expert.types.js';
import type { ExpertsStore } from './experts.store.js';
import type { ExpertPorts } from './experts.tokens.js';

export interface SessionView {
  readonly session: ExpertSession;
  readonly limits: readonly SessionLimit[];
  readonly events: readonly { kind: string; detail: Readonly<Record<string, unknown>> }[];
  /** `FR-EXP-073`, `SC-EXP-005` — ancestors to the root, descendants to the leaves. */
  readonly tree: DelegationTree;
}

export class SessionsService {
  constructor(
    private readonly store: ExpertsStore,
    /** Read at call time. */
    private readonly ports: Pick<ExpertPorts, 'executions'>,
  ) {}

  async view(workspaceId: string, executionId: string): Promise<SessionView> {
    const session = await this.store.findSession(workspaceId, executionId);
    if (session === null) throw new NotFoundError('Not found.');
    return {
      session,
      limits: await this.store.limitsFor(workspaceId, executionId),
      events: await this.ports.executions.eventsOf(workspaceId, executionId),
      tree: await delegationTree(this.store, workspaceId, executionId),
    };
  }

  /** `T1987` — 404 when unset: no policy means no delegation. */
  async policy(workspaceId: string): Promise<DelegationPolicy> {
    const policy = await this.store.policyFor(workspaceId);
    if (policy === null) throw new NotFoundError('No delegation policy is set in this workspace, so no delegation is permitted.');
    return policy;
  }

  async putPolicy(workspaceId: string, by: string, body: unknown): Promise<DelegationPolicy> {
    return this.store.putPolicy(validatePolicy(workspaceId, body, by, new Date().toISOString()));
  }

  async recent(workspaceId: string, expertId: string, limit: number): Promise<ExpertSession[]> {
    if ((await this.store.findExpert(workspaceId, expertId)) === null) throw new NotFoundError('Not found.');
    return this.store.sessionsForExpert(workspaceId, expertId, limit);
  }
}
