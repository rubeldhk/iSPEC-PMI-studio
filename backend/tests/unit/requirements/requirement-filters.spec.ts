/**
 * T062 — filtering and sorting by type, priority, and status.
 * Written to FAIL before T064/T066 exist (Constitution V).
 *
 * FR-008. The service builds the filter; the indexes that make it fast at
 * register scale live in the migration (SC-009).
 */
import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../../src/core/errors.js';
import { RequirementRetireService } from '../../../src/modules/requirements/requirement-retire.service.js';
import type { RequirementsService } from '../../../src/modules/requirements/requirements.service.js';
import { buildService } from './helpers.js';

const CTX = { workspaceId: 'ws_a', userId: 'u1' };
const PROJECT = 'p1';

async function seeded(): Promise<{ svc: RequirementsService }> {
  const { svc, store } = buildService();
  await svc.create(CTX, PROJECT, { description: 'A', type: 'functional', priority: 'p1' });
  await svc.create(CTX, PROJECT, { description: 'B', type: 'business', priority: 'p2' });
  const c = await svc.create(CTX, PROJECT, { description: 'C', type: 'functional', priority: 'p3' });
  await svc.create(CTX, PROJECT, { description: 'D', type: 'constraint', priority: 'p1' });
  await new RequirementRetireService(store).retire('ws_a', c.id);
  return { svc };
}

describe('RequirementsService · filters (FR-008)', () => {
  it('filters by type', async () => {
    const { svc } = await seeded();
    const out = await svc.list('ws_a', PROJECT, { type: 'functional' });
    expect(out.map((r) => r.description).sort()).toEqual(['A', 'C']);
  });

  it('filters by priority', async () => {
    const { svc } = await seeded();
    const out = await svc.list('ws_a', PROJECT, { priority: 'p1' });
    expect(out.map((r) => r.description).sort()).toEqual(['A', 'D']);
  });

  it('filters by status — retired requirements are listable, not hidden (FR-006)', async () => {
    const { svc } = await seeded();
    const retired = await svc.list('ws_a', PROJECT, { status: 'retired' });
    expect(retired.map((r) => r.description)).toEqual(['C']);
    const active = await svc.list('ws_a', PROJECT, { status: 'active' });
    expect(active).toHaveLength(3);
  });

  it('combines filters', async () => {
    const { svc } = await seeded();
    const out = await svc.list('ws_a', PROJECT, { type: 'functional', status: 'active' });
    expect(out.map((r) => r.description)).toEqual(['A']);
  });

  it('sorts by priority in both directions', async () => {
    const { svc } = await seeded();
    const asc = await svc.list('ws_a', PROJECT, { sortBy: 'priority', sortDir: 'asc' });
    expect(asc.map((r) => r.priority)).toEqual(['p1', 'p1', 'p2', 'p3']);
    const desc = await svc.list('ws_a', PROJECT, { sortBy: 'priority', sortDir: 'desc' });
    expect(desc.map((r) => r.priority)).toEqual(['p3', 'p2', 'p1', 'p1']);
  });

  it('sorts by type', async () => {
    const { svc } = await seeded();
    const out = await svc.list('ws_a', PROJECT, { sortBy: 'type', sortDir: 'asc' });
    expect(out.map((r) => r.type)).toEqual(['business', 'constraint', 'functional', 'functional']);
  });

  it('refuses an unknown filter value, naming the field (FR-007 shape)', async () => {
    const { svc } = await seeded();
    for (const [query, field] of [
      [{ type: 'wish' }, 'type'],
      [{ priority: 'p9' }, 'priority'],
      [{ status: 'deleted' }, 'status'],
      [{ sortBy: 'colour' }, 'sortBy'],
    ] as const) {
      const err = await svc.list('ws_a', PROJECT, query as never).catch((e: unknown) => e);
      expect(err, `${field} should be refused`).toBeInstanceOf(ValidationFailedError);
      const details = (err as ValidationFailedError).details as { fields: { field: string }[] };
      expect(details.fields[0]?.field).toBe(field);
    }
  });

  it('scopes the list to the workspace AND project (FR-002, FR-003)', async () => {
    const { svc } = await seeded();
    await svc.create(CTX, 'p_other', { description: 'Other project', type: 'functional', priority: 'p1' });
    const out = await svc.list('ws_a', PROJECT, {});
    expect(out.map((r) => r.description)).not.toContain('Other project');
    expect(await svc.list('ws_b', PROJECT, {})).toEqual([]);
  });
});
