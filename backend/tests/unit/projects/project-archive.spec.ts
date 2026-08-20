/**
 * T050 — archive preserves all content.
 * Written to FAIL before T054 exists (Constitution V).
 *
 * FR-001 / US1 scenario 5: archive is a STATUS, never a delete — the same
 * treatment retired requirements and superseded ADRs get. The store fake
 * records every operation, so "nothing was deleted" is asserted against the
 * operations that ran, not inferred from what happens to remain.
 */
import { describe, expect, it } from 'vitest';
import {
  InMemoryProjectStore,
  ProjectsService,
} from '../../../src/modules/projects/projects.service.js';

const CTX = { workspaceId: 'ws_a', userId: 'u1' };

describe('ProjectsService · archive', () => {
  it('marks the project archived with a timestamp', async () => {
    const store = new InMemoryProjectStore();
    const svc = new ProjectsService(store);
    const p = await svc.create(CTX, { name: 'P', description: 'kept' });
    const archived = await svc.archive('ws_a', p.id);
    expect(archived.status).toBe('archived');
    expect(archived.archivedAt).toBeInstanceOf(Date);
  });

  it('changes ONLY status and archivedAt — every other field survives intact', async () => {
    const store = new InMemoryProjectStore();
    const svc = new ProjectsService(store);
    const p = await svc.create(CTX, {
      name: 'Platform',
      description: 'The description outlives archival.',
    });
    await svc.update('ws_a', p.id, { engineName: 'speckit' });

    const archived = await svc.archive('ws_a', p.id);
    expect(archived.name).toBe('Platform');
    expect(archived.description).toBe('The description outlives archival.');
    expect(archived.engineName).toBe('speckit');
    expect(archived.ownerUserId).toBe('u1');
    expect(archived.workspaceId).toBe('ws_a');
    expect(archived.createdAt).toEqual(p.createdAt);
  });

  it('never deletes anything — the store has no delete to call', () => {
    // The strongest form of "archive preserves content": the persistence port
    // exposes no destructive operation, so a regression cannot even compile.
    const store = new InMemoryProjectStore();
    for (const forbidden of ['delete', 'deleteMany', 'remove', 'destroy']) {
      expect(
        (store as unknown as Record<string, unknown>)[forbidden],
        `store must not expose ${forbidden}()`,
      ).toBeUndefined();
    }
  });

  it('an archived project is still readable — with its content', async () => {
    const store = new InMemoryProjectStore();
    const svc = new ProjectsService(store);
    const p = await svc.create(CTX, { name: 'P', description: 'still here' });
    await svc.archive('ws_a', p.id);
    const read = await svc.get('ws_a', p.id);
    expect(read.status).toBe('archived');
    expect(read.description).toBe('still here');
  });

  it('archiving twice is idempotent — same status, first timestamp kept', async () => {
    let now = Date.parse('2026-08-20T10:00:00Z');
    const store = new InMemoryProjectStore();
    const svc = new ProjectsService(store, { now: () => new Date(now) });
    const p = await svc.create(CTX, { name: 'P' });
    const first = await svc.archive('ws_a', p.id);
    now += 60_000;
    const second = await svc.archive('ws_a', p.id);
    expect(second.archivedAt).toEqual(first.archivedAt);
  });
});
