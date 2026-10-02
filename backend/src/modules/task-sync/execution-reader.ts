/**
 * `T1707` (EPIC-046) — the execution, its input binding and its agent identity
 * in **one** statement.
 *
 * The registry's own services are not used here, for the reason `EPIC-045`
 * recorded when it did the same: this module must read execution rows without
 * `ExecutionsModule` depending on it, and the fields wanted span three tables
 * that no existing projection joins in this combination. Reading is a
 * consumption, not a coupling — nothing here writes.
 *
 * It deliberately does **not** import `EPIC-045`'s reader, though the shape is
 * close. Two modules sharing a private query class would couple them for the
 * convenience of forty lines, and the plan's structure decision says each module
 * depends on Epics, executions and tasks without any of them depending back.
 */
import type { EpicRunReader, EpicRunRow } from './task-board.service.js';
import type { CountableTask, LegacyTaskSource } from './task-progress.port.js';
import type { ProposalVerdictEvent } from './proposal-state.js';
import type { AdjudicationVerdictName } from '@pmi/loop-contract';
import type { ProgressEventReader, ProgressReport } from './task-event.service.js';
import type { ExecutionLookupRow, ExecutionReader } from './task-sync.service.js';

export interface ExecutionRawDb {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

interface ExecutionRawRow {
  executionId: string;
  workspaceId: string;
  projectId: string | null;
  command: string;
  initiatorId: string;
  state: string | null;
  registeredAt: Date | string;
  completedAt: Date | string | null;
  completionComment: string | null;
  targetType: string | null;
  targetId: string | null;
  agentAdapter: string | null;
  agentVersion: string | null;
}

const SELECT = `
  SELECT e."id" AS "executionId", e."workspaceId", e."projectId", e."command", e."initiatorId",
         l."type" AS "state", e."registeredAt",
         c."occurredAt" AS "completedAt", c."payload"->>'comment' AS "completionComment",
         i."targetType", i."targetId",
         a."adapter" AS "agentAdapter", a."agentVersion"
    FROM "executions" e
    LEFT JOIN "execution_target_bindings" i ON i."executionId" = e."id" AND i."phase" = 'input'
    LEFT JOIN LATERAL (
      SELECT ev."type" FROM "execution_events" ev
       WHERE ev."executionId" = e."id" AND ev."class" = 'lifecycle'
       ORDER BY ev."sequence" DESC LIMIT 1
    ) l ON TRUE
    LEFT JOIN LATERAL (
      SELECT ev."occurredAt", ev."payload" FROM "execution_events" ev
       WHERE ev."executionId" = e."id" AND ev."class" = 'lifecycle'
         AND ev."type" IN ('completed','partially-completed','failed','cancelled','timed-out')
       ORDER BY ev."sequence" DESC LIMIT 1
    ) c ON TRUE
    LEFT JOIN LATERAL (
      SELECT s."adapter", s."agentVersion" FROM "agent_identity_snapshots" s
       WHERE s."executionId" = e."id" ORDER BY s."createdAt" DESC LIMIT 1
    ) a ON TRUE`;

function map(row: ExecutionRawRow): ExecutionLookupRow {
  return {
    executionId: row.executionId,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    command: row.command,
    initiatorId: row.initiatorId,
    state: row.state ?? 'registered',
    registeredAt: new Date(row.registeredAt).toISOString(),
    completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
    completionComment: row.completionComment,
    targetType: row.targetType,
    targetId: row.targetId,
    agentAdapter: row.agentAdapter,
    agentVersion: row.agentVersion,
  };
}

export class PrismaTaskExecutionReader implements ExecutionReader {
  constructor(private readonly db: ExecutionRawDb) {}

  async find(workspaceId: string, executionId: string): Promise<ExecutionLookupRow | null> {
    const rows = await this.db.$queryRawUnsafe<ExecutionRawRow[]>(
      `${SELECT} WHERE e."id" = $1 AND e."workspaceId" = $2`,
      executionId,
      workspaceId,
    );
    const row = rows[0];
    return row ? map(row) : null;
  }
}

/**
 * The database-less posture. Every lookup misses, so a sync attempted without a
 * database refuses as absence rather than throwing — the same shape the real
 * reader gives for an execution that does not exist.
 */
export class EmptyTaskExecutionReader implements ExecutionReader {
  async find(): Promise<ExecutionLookupRow | null> {
    return null;
  }
}

/**
 * `T1724` — the Epic's `progress-reported` events (`FR-KAN-040`).
 *
 * The Epic's executions are the ones that synced tasks for it, which is exactly
 * the set whose progress events can name its tasks: the agent's progress hook
 * runs inside its finish sequence, immediately before the sync, so by the time
 * anything reads these the sync row exists.
 *
 * The hook is named nowhere in this module, deliberately: the platform reads
 * events, and which toolkit produced them is not its business (`FR-017`,
 * `ADR-0001`, asserted by `engine-independence.spec.ts`).
 *
 * An implement run whose sync was refused whole-file contributes no events here.
 * That is honest rather than lossy — its rows were never written either, and the
 * board's staleness note is what tells a reader the parse is behind the run.
 */
export class PrismaProgressEventReader implements ProgressEventReader {
  constructor(private readonly db: ExecutionRawDb) {}

  async progressReportsFor(workspaceId: string, epicId: string): Promise<ProgressReport[]> {
    const rows = await this.db.$queryRawUnsafe<{ executionId: string; taskId: string | null; occurredAt: Date | string; emittedBy: string }[]>(
      `SELECT ev."executionId", ev."payload"->>'taskId' AS "taskId", ev."occurredAt", ev."emittedBy"
         FROM "execution_events" ev
        WHERE ev."type" = 'progress-reported'
          AND ev."executionId" IN (
            SELECT DISTINCT s."executionId" FROM "task_syncs" s
             WHERE s."workspaceId" = $1 AND s."epicId" = $2
          )
        ORDER BY ev."occurredAt"`,
      workspaceId,
      epicId,
    );
    return rows
      .filter((r): r is typeof r & { taskId: string } => typeof r.taskId === 'string' && r.taskId.length > 0)
      .map((r) => ({ executionId: r.executionId, taskId: r.taskId, occurredAt: new Date(r.occurredAt).toISOString(), emittedBy: r.emittedBy }));
  }
}

/** The database-less posture: no events, so nothing moves by itself. */
export class EmptyProgressEventReader implements ProgressEventReader {
  async progressReportsFor(): Promise<ProgressReport[]> {
    return [];
  }
}

/**
 * `T1752` — `EPIC-045`'s stored `tasks.md` for an execution (`FR-KAN-036`).
 *
 * The two syncs are independent calls in one hook sequence (`R-046-7`), so they
 * can in principle disagree about which bytes they read. This is the read that
 * lets the board SAY so; nothing repairs either side.
 */
export class PrismaArtifactDigestReader {
  constructor(private readonly db: ExecutionRawDb) {}

  async digestForExecution(workspaceId: string, executionId: string): Promise<string | null> {
    const rows = await this.db.$queryRawUnsafe<{ digest: string }[]>(
      `SELECT v."digest"
         FROM "artifact_sync_files" f
         JOIN "artifact_syncs" s ON s."id" = f."syncId"
         JOIN "artifact_versions" v ON v."id" = f."versionId"
        WHERE s."workspaceId" = $1 AND s."executionId" = $2 AND f."path" LIKE '%/tasks.md'
        ORDER BY s."syncedAt" DESC LIMIT 1`,
      workspaceId,
      executionId,
    );
    return rows[0]?.digest ?? null;
  }
}

/** No artifacts to compare against. Absence is not disagreement. */
export class EmptyArtifactDigestReader {
  async digestForExecution(): Promise<string | null> {
    return null;
  }
}

/**
 * `T1773` — the Epic's latest execution, synced or not (`FR-KAN-048`).
 *
 * Deliberately NOT read through `task_syncs`: every other read in this module
 * finds an Epic's runs through the syncs they wrote, and the run this one
 * exists to catch is precisely the one that wrote none. It goes to the input
 * binding instead — the same join `EPIC-044` uses, and for the same reason,
 * so an execution is attached to an Epic by one rule across the product.
 *
 * The binding names an Epic the way the agent's hook does: a plain number, or
 * `<parent><letter>` for a child of a decomposition (`R-044-3`). Both are
 * matched here; a target naming no Epic of this workspace matches nothing and
 * the board reports no staleness, which is the honest reading of a run
 * nobody can attribute.
 */
export class PrismaEpicRunReader implements EpicRunReader {
  constructor(private readonly db: ExecutionRawDb) {}

  async latestForEpic(workspaceId: string, epicId: string): Promise<EpicRunRow | null> {
    const rows = await this.db.$queryRawUnsafe<{ executionId: string; command: string; registeredAt: Date | string }[]>(
      `SELECT e."id" AS "executionId", e."command", e."registeredAt"
         FROM "epics" ep
         LEFT JOIN "epics" par ON par."id" = ep."parentEpicId"
         JOIN "execution_target_bindings" b
           ON b."phase" = 'input' AND b."targetType" = 'epic'
          AND (b."targetId" = ep."number"::text
               OR (ep."splitSuffix" IS NOT NULL AND par."number" IS NOT NULL
                   AND b."targetId" = par."number"::text || ep."splitSuffix"))
         JOIN "executions" e ON e."id" = b."executionId" AND e."workspaceId" = ep."workspaceId"
        WHERE ep."id" = $2 AND ep."workspaceId" = $1
        ORDER BY e."registeredAt" DESC, e."id" DESC
        LIMIT 1`,
      workspaceId,
      epicId,
    );
    const row = rows[0];
    return row ? { executionId: row.executionId, command: row.command, at: new Date(row.registeredAt).toISOString() } : null;
  }
}

/** No runs to be behind. The board reports no staleness rather than guessing. */
export class EmptyEpicRunReader implements EpicRunReader {
  async latestForEpic(): Promise<EpicRunRow | null> {
    return null;
  }
}

/**
 * `T1781` — `EPIC-012`'s specification-scoped tasks (`FR-KAN-057`).
 *
 * The project figure must include tasks with **no Epic**: a project that
 * generated tasks from a specification before it ever synced one would
 * otherwise read 0% while holding work. `T1731` declared the port and left it
 * unwired, and the convergence pass found the gap — the comment in the module
 * said the absence *understates nothing for a project whose tasks all came
 * from a sync*, which is true and is not every project.
 *
 * It reads the `tasks` table directly rather than through `TasksModule`, for
 * the reason every other reader in this file does: the direction is one-way
 * (`T1746`), and a module that imported back to get forty lines would put a
 * cycle in the graph to save a query.
 *
 * **Rows with an Epic are excluded here**, because `forProject` already reads
 * them through `tasksForEpic`. `computeProgress` keys by id and would count
 * the overlap once anyway; excluding it at the source means the second list
 * is genuinely the rows the first cannot see, which is easier to reason about
 * than a de-duplication that happens to work.
 */
export class PrismaLegacyTaskReader implements LegacyTaskSource {
  constructor(private readonly db: ExecutionRawDb) {}

  async listForProject(workspaceId: string, projectId: string): Promise<CountableTask[]> {
    const rows = await this.db.$queryRawUnsafe<{ id: string; status: string }[]>(
      `SELECT t."id", t."status"::text AS "status"
         FROM "tasks" t
         JOIN "specifications" s ON s."id" = t."specificationId"
        WHERE t."workspaceId" = $1 AND s."projectId" = $2 AND t."epicId" IS NULL`,
      workspaceId,
      projectId,
    );
    return rows.map((r) => ({ id: r.id, status: r.status as CountableTask['status'] }));
  }
}

/** No legacy rows to add. A project whose tasks all came from a sync loses nothing. */
export class EmptyLegacyTaskReader implements LegacyTaskSource {
  async listForProject(): Promise<CountableTask[]> {
    return [];
  }
}

/** The verdict events of an Epic's proposals (`T1782`). */
export interface ProposalVerdictReader {
  verdictsForEpic(workspaceId: string, epicId: string): Promise<ProposalVerdictEvent[]>;
}

/**
 * `T1782` — the recorded verdicts, read back off the event stream.
 *
 * `data-model.md` §5 forbids a verdict column and §8 requires the proposal
 * state to be folded from the proposal's events, so this is where the verdict
 * comes from. The event types are the ones `VERDICT_EVENTS` writes, and the
 * payload's `verdict` is read rather than inferred from the type — the type is
 * `EPIC-037`'s vocabulary and the payload is this Epic's fact.
 */
export class PrismaProposalVerdictReader implements ProposalVerdictReader {
  constructor(private readonly db: ExecutionRawDb) {}

  async verdictsForEpic(workspaceId: string, epicId: string): Promise<ProposalVerdictEvent[]> {
    const rows = await this.db.$queryRawUnsafe<{ proposalId: string | null; verdict: string | null; occurredAt: Date | string }[]>(
      `SELECT ev."payload"->>'proposalId' AS "proposalId", ev."payload"->>'verdict' AS "verdict", ev."occurredAt"
         FROM "execution_events" ev
        WHERE ev."workspaceId" = $1
          AND ev."payload"->>'proposalId' IN (
            SELECT p."id" FROM "task_status_proposals" p
              JOIN "tasks" t ON t."id" = p."taskId"
             WHERE p."workspaceId" = $1 AND t."epicId" = $2
          )
          AND ev."payload"->>'verdict' IS NOT NULL
        ORDER BY ev."occurredAt" ASC`,
      workspaceId,
      epicId,
    );
    return rows
      .filter((r): r is typeof r & { proposalId: string; verdict: string } => r.proposalId !== null && r.verdict !== null)
      .map((r) => ({
        proposalId: r.proposalId,
        verdict: r.verdict as AdjudicationVerdictName,
        occurredAt: new Date(r.occurredAt).toISOString(),
      }));
  }
}

/**
 * `T1792` — one proposal's verdicts, for the second person's adjudication.
 *
 * The same events `verdictsForEpic` reads, scoped to one proposal: deciding
 * whether **this** proposal is still waiting must not depend on loading every
 * proposal of the Epic.
 */
export class PrismaSingleProposalVerdictReader {
  constructor(private readonly db: ExecutionRawDb) {}

  async forProposal(workspaceId: string, proposalId: string): Promise<ProposalVerdictEvent[]> {
    const rows = await this.db.$queryRawUnsafe<{ verdict: string | null; occurredAt: Date | string }[]>(
      `SELECT ev."payload"->>'verdict' AS "verdict", ev."occurredAt"
         FROM "execution_events" ev
        WHERE ev."workspaceId" = $1
          AND ev."payload"->>'proposalId' = $2
          AND ev."payload"->>'verdict' IS NOT NULL
        ORDER BY ev."occurredAt" ASC`,
      workspaceId,
      proposalId,
    );
    return rows
      .filter((r): r is typeof r & { verdict: string } => r.verdict !== null)
      .map((r) => ({
        proposalId,
        verdict: r.verdict as AdjudicationVerdictName,
        occurredAt: new Date(r.occurredAt).toISOString(),
      }));
  }
}

/** No verdicts recorded. Nothing is outstanding, because nothing is known. */
export class EmptyProposalVerdictReader implements ProposalVerdictReader {
  async verdictsForEpic(): Promise<ProposalVerdictEvent[]> {
    return [];
  }
}

/** No verdicts for a proposal, so nothing is waiting on a second person. */
export class EmptySingleProposalVerdictReader {
  async forProposal(): Promise<ProposalVerdictEvent[]> {
    return [];
  }
}
