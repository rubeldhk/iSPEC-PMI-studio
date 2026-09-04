/**
 * `T1432` (EPIC-043, `R-043-7`, `FR-PIC-035`, `FR-PIC-050`–`052`) — the
 * per-project execution timeline: a read model over `executions`,
 * `execution_events` and `status_transition_proposals`, newest first, filtered
 * and page-token paginated. Session-scoped: the project must be in the caller's
 * workspace, and another workspace's project is absent, not forbidden.
 *
 * Nothing here writes; nothing here applies or approves (`FR-PIC-054`). The
 * proposal state is folded from governance events, because a proposal row has
 * no decision column — the decision is an event (Constitution XII.2).
 */
import { EXECUTION_SURFACES } from '@pmi/execution-registry-contract';
import { NotFoundError, ValidationFailedError } from '../../core/errors.js';

export interface TimelineDb {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

export interface TimelineFilters {
  readonly surface?: string;
  readonly state?: string;
  readonly initiator?: string;
  readonly after?: string;
  readonly limit?: number;
}

export interface TimelineEntry {
  readonly executionId: string;
  readonly command: string;
  readonly surface: string;
  readonly assurance: string;
  readonly state: string;
  readonly governanceState: string;
  readonly initiator: { readonly principalId: string; readonly kind: string };
  readonly sponsorUserId: string | null;
  readonly registeredAt: string;
  readonly completedAt: string | null;
  readonly proposal: { readonly id: string; readonly proposedState: string; readonly state: ProposalState; readonly decidedBy: string | null } | null;
}

export interface TimelinePage {
  readonly items: TimelineEntry[];
  readonly nextCursor: string | null;
}

export interface TimelineEvent {
  readonly sequence: number;
  readonly type: string;
  readonly category: string;
  readonly actorId: string | null;
  readonly occurredAt: string;
  readonly payload: Record<string, unknown>;
}

export type ProposalState = 'proposed' | 'approved' | 'refused';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const STATES = ['registered', 'started', 'completed', 'partially-completed', 'failed', 'cancelled', 'timed-out', 'blocked'] as const;

// -------------------------------------------------------------- page token

export function encodeCursor(input: { registeredAt: string; id: string }): string {
  return Buffer.from(JSON.stringify(input), 'utf8').toString('base64url');
}

export function decodeCursor(token: string): { registeredAt: string; id: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as { registeredAt?: unknown; id?: unknown };
    if (typeof parsed.registeredAt !== 'string' || typeof parsed.id !== 'string') return null;
    if (Number.isNaN(Date.parse(parsed.registeredAt))) return null;
    return { registeredAt: parsed.registeredAt, id: parsed.id };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------- proposals

/** The decision is an event; the proposal row only says it was made. */
export function foldProposalState(
  events: readonly { type: string; payload: Record<string, unknown> }[],
  proposalId: string,
): { state: ProposalState; decidedBy: string | null } {
  let state: ProposalState = 'proposed';
  let decidedBy: string | null = null;
  for (const event of events) {
    if (event.payload['proposalId'] !== proposalId) continue;
    if (event.type === 'approval-granted' || event.type === 'transition-applied') {
      state = 'approved';
      decidedBy = typeof event.payload['decidedBy'] === 'string' ? event.payload['decidedBy'] : decidedBy;
    } else if (event.type === 'approval-refused' || event.type === 'transition-refused') {
      state = 'refused';
      decidedBy = typeof event.payload['decidedBy'] === 'string' ? event.payload['decidedBy'] : decidedBy;
    }
  }
  return { state, decidedBy };
}

// ------------------------------------------------------------------ rows

interface ExecutionRow {
  id: string;
  command: string;
  surface: string;
  assurance: string;
  initiatorType: string;
  initiatorId: string;
  sponsorUserId: string | null;
  lifecycleState: string;
  governanceState: string;
  registeredAt: Date | string;
  completedAt: Date | string | null;
  proposalId: string | null;
  proposedState: string | null;
}

interface EventRow {
  sequence: number;
  type: string;
  class: string;
  emittedBy?: string | null;
  actorId?: string | null;
  occurredAt: Date | string;
  payload: Record<string, unknown>;
}

const iso = (v: Date | string): string => (v instanceof Date ? v.toISOString() : new Date(v).toISOString());

export class ExecutionTimelineService {
  constructor(private readonly db: TimelineDb) {}

  async list(workspaceId: string, projectId: string, filters: TimelineFilters): Promise<TimelinePage> {
    await this.requireProject(workspaceId, projectId);
    const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

    const where: string[] = ['e."workspaceId" = $1', 'e."projectId" = $2'];
    const values: unknown[] = [workspaceId, projectId];
    const bind = (value: unknown): string => {
      values.push(value);
      return `$${values.length}`;
    };
    if (filters.surface !== undefined) {
      if (!(EXECUTION_SURFACES as readonly string[]).includes(filters.surface)) {
        throw new ValidationFailedError(`Unknown surface "${filters.surface}".`, { fields: { surface: EXECUTION_SURFACES.join(', ') } });
      }
      where.push(`e."surface" = ${bind(filters.surface)}`);
    }
    if (filters.state !== undefined) {
      if (!(STATES as readonly string[]).includes(filters.state)) {
        throw new ValidationFailedError(`Unknown state "${filters.state}".`, { fields: { state: STATES.join(', ') } });
      }
      where.push(`COALESCE(l."type", 'registered') = ${bind(filters.state)}`);
    }
    if (filters.initiator !== undefined) where.push(`e."initiatorId" = ${bind(filters.initiator)}`);
    if (filters.after !== undefined) {
      const page = decodeCursor(filters.after);
      if (page === null) throw new ValidationFailedError('The page token is not one this timeline issued.', { fields: { after: 'opaque' } });
      where.push(`(e."registeredAt", e."id") < (${bind(new Date(page.registeredAt))}, ${bind(page.id)})`);
    }

    const rows = await this.db.$queryRawUnsafe<ExecutionRow[]>(
      `SELECT e."id", e."command", e."surface", e."assurance", e."initiatorType", e."initiatorId",
              pr."sponsorUserId", COALESCE(l."type", 'registered') AS "lifecycleState",
              e."governanceState", e."registeredAt", c."occurredAt" AS "completedAt",
              sp."id" AS "proposalId", sp."proposedState"
         FROM "executions" e
         LEFT JOIN "principals" pr ON pr."id" = e."initiatorId"
         LEFT JOIN LATERAL (
           SELECT ev."type" FROM "execution_events" ev
            WHERE ev."executionId" = e."id" AND ev."class" = 'lifecycle'
              AND ev."type" IN ('started','completed','partially-completed','failed','cancelled','timed-out','blocked')
            ORDER BY ev."sequence" DESC LIMIT 1
         ) l ON TRUE
         LEFT JOIN LATERAL (
           SELECT ev."occurredAt" FROM "execution_events" ev
            WHERE ev."executionId" = e."id" AND ev."class" = 'lifecycle'
              AND ev."type" IN ('completed','partially-completed','failed','cancelled','timed-out')
            ORDER BY ev."sequence" DESC LIMIT 1
         ) c ON TRUE
         LEFT JOIN LATERAL (
           SELECT x."id", x."proposedState" FROM "status_transition_proposals" x
            WHERE x."executionId" = e."id" ORDER BY x."proposedAt" DESC LIMIT 1
         ) sp ON TRUE
        WHERE ${where.join(' AND ')}
        ORDER BY "registeredAt" DESC, e."id" DESC
        LIMIT ${limit + 1}`,
      ...values,
    );

    const page = rows.slice(0, limit);
    const items: TimelineEntry[] = [];
    for (const row of page) {
      let proposal: TimelineEntry['proposal'] = null;
      if (row.proposalId !== null) {
        const decided = await this.db.$queryRawUnsafe<{ type: string; payload: Record<string, unknown> }[]>(
          `SELECT "type", "payload" FROM "execution_events" WHERE "executionId" = $1 AND "class" = 'governance' ORDER BY "sequence" ASC`,
          row.id,
        );
        proposal = { id: row.proposalId, proposedState: row.proposedState ?? '', ...foldProposalState(decided, row.proposalId) };
      }
      items.push({
        executionId: row.id,
        command: row.command,
        surface: row.surface,
        assurance: row.assurance,
        state: row.lifecycleState,
        governanceState: row.governanceState,
        initiator: { principalId: row.initiatorId, kind: row.initiatorType },
        sponsorUserId: row.sponsorUserId ?? null,
        registeredAt: iso(row.registeredAt),
        completedAt: row.completedAt === null ? null : iso(row.completedAt),
        proposal,
      });
    }
    const last = page[page.length - 1];
    const nextCursor = rows.length > limit && last !== undefined ? encodeCursor({ registeredAt: iso(last.registeredAt), id: last.id }) : null;
    return { items, nextCursor };
  }

  async events(workspaceId: string, projectId: string, executionId: string): Promise<TimelineEvent[]> {
    await this.requireProject(workspaceId, projectId);
    const rows = await this.db.$queryRawUnsafe<EventRow[]>(
      `SELECT ev."sequence", ev."type", ev."class", ev."emittedBy", ev."occurredAt", ev."payload"
         FROM "execution_events" ev
         JOIN "executions" e ON e."id" = ev."executionId"
        WHERE ev."executionId" = $1 AND e."workspaceId" = $2 AND e."projectId" = $3
        ORDER BY ev."sequence" ASC`,
      executionId,
      workspaceId,
      projectId,
    );
    return rows
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map((r) => ({
        sequence: r.sequence,
        type: r.type,
        category: r.class,
        actorId: r.emittedBy ?? r.actorId ?? null,
        occurredAt: iso(r.occurredAt),
        payload: r.payload ?? {},
      }));
  }

  private async requireProject(workspaceId: string, projectId: string): Promise<void> {
    const rows = await this.db.$queryRawUnsafe<{ id: string }[]>(
      `SELECT "id" FROM "projects" WHERE "id" = $1 AND "workspaceId" = $2 LIMIT 1`,
      projectId,
      workspaceId,
    );
    if (rows.length === 0) throw new NotFoundError('Not found.');
  }
}
