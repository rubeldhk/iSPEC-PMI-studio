/**
 * T061 — retire marks, never deletes; derived artifacts stay traceable.
 * Written to FAIL before T068 exists (Constitution V).
 *
 * FR-006 / US7 scenario 4: anything already generated from a requirement stays
 * traceable to it, which is what makes EPIC-011's retired-link flagging
 * meaningful.
 */
import { describe, expect, it } from 'vitest';
import { RequirementRetireService } from '../../../src/modules/requirements/requirement-retire.service.js';
import { NotFoundError } from '../../../src/core/errors.js';
import { buildService } from './helpers.js';

const CTX = { workspaceId: 'ws_a', userId: 'u1' };
const PROJECT = 'p1';
const VALID = { description: 'To be retired.', type: 'functional', priority: 'p2' } as const;

describe('RequirementRetireService (FR-006)', () => {
  it('marks the requirement retired with a timestamp — the row remains', async () => {
    const { svc, store } = buildService();
    const req = await svc.create(CTX, PROJECT, VALID);
    const retired = await new RequirementRetireService(store).retire('ws_a', req.id);
    expect(retired.status).toBe('retired');
    expect(retired.retiredAt).toBeInstanceOf(Date);
    // Still retrievable, content intact.
    const read = await svc.get('ws_a', req.id);
    expect(read.description).toBe('To be retired.');
    expect(read.reference).toBe(req.reference);
  });

  it('never deletes — the store exposes no destructive operation at all', async () => {
    const { store } = buildService();
    for (const forbidden of ['delete', 'deleteMany', 'remove', 'destroy']) {
      expect(
        (store as unknown as Record<string, unknown>)[forbidden],
        `store must not expose ${forbidden}()`,
      ).toBeUndefined();
    }
  });

  it('derived artifacts stay traceable: the id a link points at still resolves', async () => {
    const { svc, store } = buildService();
    const req = await svc.create(CTX, PROJECT, VALID);
    // A derived artifact holds this id — the way a TraceabilityLink will.
    const linkTarget = req.id;
    await new RequirementRetireService(store).retire('ws_a', req.id);
    const resolved = await svc.get('ws_a', linkTarget);
    expect(resolved.id).toBe(linkTarget);
    expect(resolved.status).toBe('retired'); // flagged, not omitted
  });

  it('retiring twice is idempotent — the first timestamp is kept', async () => {
    const { svc, store } = buildService();
    const retirer = new RequirementRetireService(store, {
      now: (): Date => new Date('2026-08-20T10:00:00Z'),
    });
    const req = await svc.create(CTX, PROJECT, VALID);
    const first = await retirer.retire('ws_a', req.id);
    const again = new RequirementRetireService(store, {
      now: (): Date => new Date('2026-08-21T10:00:00Z'),
    });
    const second = await again.retire('ws_a', req.id);
    expect(second.retiredAt).toEqual(first.retiredAt);
  });

  it('cross-workspace retire is indistinguishable from absence (FR-002)', async () => {
    const { svc, store } = buildService();
    const req = await svc.create(CTX, PROJECT, VALID);
    await expect(new RequirementRetireService(store).retire('ws_b', req.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
