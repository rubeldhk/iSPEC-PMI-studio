/**
 * `T1431` (EPIC-043, `R-043-7`, `FR-PIC-050`–`052`) — the per-project timeline
 * read model. Pure parts unit-tested here (filters, cursor, row shaping, the
 * proposal state fold); the SQL runs in `execution-timeline.spec.ts` (T1436).
 *
 * Written to FAIL before `T1432`.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  ExecutionTimelineService,
  decodeCursor,
  encodeCursor,
  foldProposalState,
  type TimelineDb,
} from '../../../src/modules/executions/execution-timeline.service.js';

function row(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'exec_1',
    command: 'specify',
    surface: 'mcp-client',
    assurance: 'local',
    initiatorType: 'connector',
    initiatorId: 'pr_1',
    sponsorUserId: 'u_owner',
    lifecycleState: 'registered',
    governanceState: 'governed',
    registeredAt: new Date('2026-09-04T10:00:00Z'),
    completedAt: null,
    proposalId: null,
    proposedState: null,
    ...over,
  };
}

function db(rows: Record<string, unknown>[] = [], events: Record<string, unknown>[] = []): TimelineDb & { queries: string[] } {
  const queries: string[] = [];
  return {
    queries,
    $queryRawUnsafe: vi.fn(async (sql: string) => {
      queries.push(sql);
      if (/FROM "projects"/.test(sql)) return [{ id: 'proj_1' }];
      if (/FROM "executions" e/.test(sql)) return rows;
      if (/FROM "execution_events"/.test(sql)) return events;
      return rows;
    }) as TimelineDb['$queryRawUnsafe'],
  };
}

describe('T1431 · cursor', () => {
  it('round-trips a registeredAt + id pair and rejects garbage', () => {
    const c = encodeCursor({ registeredAt: '2026-09-04T10:00:00.000Z', id: 'exec_9' });
    expect(decodeCursor(c)).toEqual({ registeredAt: '2026-09-04T10:00:00.000Z', id: 'exec_9' });
    expect(decodeCursor('not-a-cursor')).toBeNull();
  });
});

describe('T1431 · foldProposalState', () => {
  it('is proposed until a governance event decides it', () => {
    expect(foldProposalState([{ type: 'status-transition-proposed', payload: { proposalId: 'p1' } }], 'p1')).toEqual({ state: 'proposed', decidedBy: null });
    expect(foldProposalState([{ type: 'status-transition-proposed', payload: { proposalId: 'p1' } }, { type: 'approval-granted', payload: { proposalId: 'p1', decidedBy: 'u_1' } }], 'p1')).toEqual({ state: 'approved', decidedBy: 'u_1' });
    expect(foldProposalState([{ type: 'transition-refused', payload: { proposalId: 'p1', decidedBy: 'u_2' } }], 'p1')).toEqual({ state: 'refused', decidedBy: 'u_2' });
  });
});

describe('T1431 · list', () => {
  it('shapes rows newest first with the seven fields and the proposal, and refuses unknown filters', async () => {
    const d = db([row(), row({ id: 'exec_0', registeredAt: new Date('2026-09-04T09:00:00Z'), lifecycleState: 'completed', completedAt: new Date('2026-09-04T09:30:00Z'), proposalId: 'p1', proposedState: 'review' })]);
    const service = new ExecutionTimelineService(d);
    const page = await service.list('ws_a', 'proj_1', {});
    expect(page.items.map((i) => i.executionId)).toEqual(['exec_1', 'exec_0']);
    expect(page.items[0]).toMatchObject({ command: 'specify', surface: 'mcp-client', assurance: 'local', state: 'registered', initiator: { principalId: 'pr_1', kind: 'connector' }, sponsorUserId: 'u_owner', completedAt: null, proposal: null });
    expect(page.items[1]?.proposal).toMatchObject({ id: 'p1', proposedState: 'review', state: 'proposed' });
    expect(page.nextCursor).toBeNull();
    await expect(service.list('ws_a', 'proj_1', { surface: 'not-a-surface' })).rejects.toMatchObject({ code: 'validation_failed' });
  });

  it('applies surface, state and initiator filters to the query and pages by cursor', async () => {
    const many = Array.from({ length: 51 }, (_, i) => row({ id: `exec_${i}`, registeredAt: new Date(Date.UTC(2026, 8, 4, 10, 0, 59 - i)) }));
    const d = db(many);
    const service = new ExecutionTimelineService(d);
    const page = await service.list('ws_a', 'proj_1', { surface: 'mcp-client', state: 'registered', initiator: 'pr_1', limit: 50 });
    expect(page.items).toHaveLength(50);
    expect(page.nextCursor).not.toBeNull();
    const sql = d.queries.find((q) => /FROM "executions"/.test(q)) ?? '';
    expect(sql).toMatch(/"surface" = \$/);
    expect(sql).toMatch(/"initiatorId" = \$/);
    expect(sql).toMatch(/ORDER BY "registeredAt" DESC/);
  });

  it('refuses another workspace\'s project as absent', async () => {
    const d = db();
    (d.$queryRawUnsafe as ReturnType<typeof vi.fn>).mockImplementation(async (sql: string) => (/FROM "projects"/.test(sql) ? [] : []));
    const service = new ExecutionTimelineService(d);
    await expect(service.list('ws_other', 'proj_1', {})).rejects.toMatchObject({ code: 'not_found' });
    await expect(service.events('ws_other', 'proj_1', 'exec_1')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('returns an execution\'s events in sequence with type, category, actor and time', async () => {
    const d = db([row()], [{ sequence: 2, type: 'progress-reported', class: 'lifecycle', actorId: 'pr_1', occurredAt: new Date('2026-09-04T10:01:00Z'), payload: { taskId: 'T1' } }, { sequence: 1, type: 'registered', class: 'lifecycle', actorId: 'pr_1', occurredAt: new Date('2026-09-04T10:00:00Z'), payload: {} }]);
    const service = new ExecutionTimelineService(d);
    const events = await service.events('ws_a', 'proj_1', 'exec_1');
    expect(events.map((e) => e.sequence)).toEqual([1, 2]);
    expect(events[1]).toMatchObject({ type: 'progress-reported', category: 'lifecycle', actorId: 'pr_1', payload: { taskId: 'T1' } });
  });
});
