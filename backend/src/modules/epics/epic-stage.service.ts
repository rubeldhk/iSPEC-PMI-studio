/**
 * `T1567` / `T1583` (EPIC-044, `FR-EPB-001`–`FR-EPB-009`, `FR-EPB-045`,
 * `FR-EPB-046`, `R-044-3`, `R-044-4`, `R-044-10`) — the board read: ONE query
 * for the project's executions bound to an Epic, then the shared package —
 * `bindExecutions` → `evidenceFromExecutions` → `deriveStageFromEvidence` →
 * `resolveReadiness`. Nothing here names a stage or a command: the
 * configuration does; nothing here stores a stage: it is computed on read.
 */
import {
  bindExecutions,
  deriveStageFromEvidence,
  evidenceFromExecutions,
  loadStageConfig,
  packageVersion,
  productProfile,
  resolveReadiness,
  type ExecutionRow,
  type StageDefinition,
} from '@pmi/epic-stage';
import { NotFoundError } from '../../core/errors.js';
import type { EpicRecord, EpicStore } from './epic.store.js';

export interface ExecutionEvidenceRow extends ExecutionRow {
  readonly targetId: string;
}

/** One read per project (`R-044-10`): executions with an `epic` input target, their latest lifecycle and completion. */
export interface ExecutionEvidenceReader {
  forProject(workspaceId: string, projectId: string): Promise<ExecutionEvidenceRow[]>;
}

export interface EpicStage {
  readonly epicId: string;
  readonly number: number;
  readonly slug: string;
  readonly title: string;
  readonly status: string;
  readonly stage: string;
  /** Predecessor commands not reached below a present stage (`FR-EPB-006`). */
  readonly missing: string[];
  readonly last: { executionId: string; command: string; outcome: string; at: string } | null;
  readonly next: string | null;
  readonly readiness: { verdict: 'Ready' | 'Not ready' | 'n/a'; note?: string; failing: string[] };
  readonly running: { executionId: string; since: string } | null;
  readonly derivedFrom: 'executions';
}

export interface BoardRead {
  readonly epics: EpicStage[];
  readonly unbound: { executionId: string; command: string; targetId: string; registeredAt: string }[];
  readonly packageVersion: string;
  readonly profile: 'product';
  /** The board's columns in order — *Not started* then the product profile — so no screen names a stage of its own (`FR-EPB-011`). */
  readonly columns: string[];
}

export interface EpicStageDeps {
  readonly epics: EpicStore;
  readonly evidence: ExecutionEvidenceReader;
  readonly now?: () => Date;
}

const NO_CONDITIONS = 'no readiness conditions configured';

export class EpicStageService {
  private readonly now: () => Date;

  constructor(private readonly deps: EpicStageDeps) {
    this.now = deps.now ?? ((): Date => new Date());
  }

  async board(ctx: { workspaceId: string; projectId: string }): Promise<BoardRead> {
    const [epics, rows] = await Promise.all([this.deps.epics.list(ctx.workspaceId, ctx.projectId), this.deps.evidence.forProject(ctx.workspaceId, ctx.projectId)]);
    const byId = new Map(epics.map((e) => [e.id, e]));
    const bound = bindExecutions(
      rows,
      epics.map((e) => ({ id: e.id, number: e.number, parentNumber: e.parentEpicId ? byId.get(e.parentEpicId)?.number ?? null : null, splitSuffix: e.splitSuffix })),
    );
    const config = loadStageConfig();
    const profile = productProfile(config);
    return {
      epics: epics.map((e) => this.stageOf(e, bound.byEpic.get(e.id) ?? [], profile, config.notStarted)),
      unbound: bound.unbound.map((r) => ({ executionId: r.executionId, command: r.command, targetId: r.targetId, registeredAt: r.registeredAt })),
      packageVersion: packageVersion(),
      profile: 'product',
      columns: [config.notStarted.name, ...profile.map((s) => s.name)],
    };
  }

  async stage(ctx: { workspaceId: string; projectId: string }, epicId: string): Promise<EpicStage> {
    const epic = await this.deps.epics.find(epicId);
    if (!epic || epic.workspaceId !== ctx.workspaceId || epic.projectId !== ctx.projectId) throw new NotFoundError('The Epic does not exist.');
    const board = await this.board(ctx);
    const found = board.epics.find((e) => e.epicId === epicId);
    if (!found) throw new NotFoundError('The Epic does not exist.');
    return found;
  }

  private stageOf(epic: EpicRecord, rows: ExecutionEvidenceRow[], profile: StageDefinition[], notStarted: { name: string; next: string }): EpicStage {
    const evidence = evidenceFromExecutions(rows, profile);
    const derived = deriveStageFromEvidence(evidence.evidence, profile);
    const readinessStage = profile.find((s) => !s.reachedBy);
    const preReady = readinessStage ? profile.filter((s) => s.order < readinessStage.order).sort((a, b) => b.order - a.order)[0] : undefined;

    // Which predecessors are absent below the highest present stage (FR-EPB-006).
    const highestPresent = Math.max(0, ...profile.filter((s) => evidence.evidence[s.name]).map((s) => s.order));
    const missing = profile.filter((s) => s.reachedBy && s.order < highestPresent && !evidence.evidence[s.name]).map((s) => s.reachedBy as string);

    let stage = derived.stage ?? notStarted.name;
    let next: string | null = derived.stage ? derived.next : notStarted.next;

    // Readiness is layered on top of the derived stage: evaluated once the stage
    // before the readiness verdict is reached (FR-EPB-045); the customer
    // profile has no conditions yet, so the verdict is Ready with the note (FR-EPB-046).
    let readiness: EpicStage['readiness'] = { verdict: 'n/a', failing: [] };
    const reachedPreReady = preReady !== undefined && derived.stage !== null && (profile.find((s) => s.name === derived.stage)?.order ?? 0) >= preReady.order;
    if (reachedPreReady && readinessStage) {
      const resolved = resolveReadiness(
        { directory: epic.slug, kind: 'delivery', failures: [], waivers: [], today: this.now().toISOString().slice(0, 10), epicsOnDisk: [] },
        () => ({ problems: [], expired: false, grantsCover: false }),
      );
      readiness = { verdict: resolved.readiness === 'Ready' ? 'Ready' : 'Not ready', note: NO_CONDITIONS, failing: resolved.uncovered };
      if (derived.stage === preReady.name && readiness.verdict === 'Ready') {
        stage = readinessStage.name;
        next = readinessStage.next;
      }
    }

    if (epic.status !== 'active' || next === '—') next = null;

    return {
      epicId: epic.id,
      number: epic.number,
      slug: epic.slug,
      title: epic.title,
      status: epic.status,
      stage,
      missing,
      last: evidence.last ? { executionId: evidence.last.executionId, command: evidence.last.command, outcome: evidence.last.state, at: evidence.last.completedAt ?? evidence.last.registeredAt } : null,
      next,
      readiness,
      running: evidence.running ? { executionId: evidence.running.executionId, since: evidence.running.registeredAt } : null,
      derivedFrom: 'executions',
    };
  }
}

export interface EvidenceDb {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

/**
 * `T1583` — the one statement: executions with an `epic` input target, their
 * latest lifecycle event and, where terminal, the completion's time and comment
 * (`EPIC-037` writes the comment into the lifecycle event's payload).
 */
export class PrismaExecutionEvidenceReader implements ExecutionEvidenceReader {
  constructor(private readonly db: EvidenceDb) {}

  async forProject(workspaceId: string, projectId: string): Promise<ExecutionEvidenceRow[]> {
    const rows = await this.db.$queryRawUnsafe<{ executionId: string; command: string; state: string; registeredAt: Date; completedAt: Date | null; completionComment: string | null; targetId: string }[]>(
      `SELECT e."id" AS "executionId", e."command", COALESCE(l."type", 'registered') AS "state", e."registeredAt",
              c."occurredAt" AS "completedAt", c."payload"->>'comment' AS "completionComment", b."targetId"
         FROM "executions" e
         JOIN "execution_target_bindings" b ON b."executionId" = e."id" AND b."phase" = 'input' AND b."targetType" = 'epic'
         LEFT JOIN LATERAL (
           SELECT ev."type" FROM "execution_events" ev
            WHERE ev."executionId" = e."id" AND ev."class" = 'lifecycle'
              AND ev."type" IN ('started','completed','partially-completed','failed','cancelled','timed-out','blocked')
            ORDER BY ev."sequence" DESC LIMIT 1
         ) l ON TRUE
         LEFT JOIN LATERAL (
           SELECT ev."occurredAt", ev."payload" FROM "execution_events" ev
            WHERE ev."executionId" = e."id" AND ev."class" = 'lifecycle'
              AND ev."type" IN ('completed','partially-completed','failed','cancelled','timed-out')
            ORDER BY ev."sequence" DESC LIMIT 1
         ) c ON TRUE
        WHERE e."workspaceId" = $1 AND e."projectId" = $2
        ORDER BY e."registeredAt" ASC, e."id" ASC`,
      workspaceId,
      projectId,
    );
    return rows.map((r) => ({
      executionId: r.executionId,
      command: r.command,
      state: r.state,
      registeredAt: new Date(r.registeredAt).toISOString(),
      completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : null,
      completionComment: r.completionComment,
      targetId: r.targetId,
    }));
  }
}
