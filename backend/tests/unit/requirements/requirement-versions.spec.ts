/**
 * T060 — an edit appends a version; prior text stays retrievable.
 * Written to FAIL before T067 exists (Constitution V).
 *
 * FR-009 / US2 scenario 2. The history is append-only in code here and at the
 * database via the `requirement_versions_immutable` trigger (T457/T458).
 */
import { describe, expect, it } from 'vitest';
import {
  InMemoryRequirementVersionStore,
  RequirementVersionService,
} from '../../../src/modules/requirements/requirement-version.service.js';
import { buildService } from './helpers.js';

const CTX = { workspaceId: 'ws_a', userId: 'u1' };
const PROJECT = 'p1';
const VALID = { description: 'Original text.', type: 'functional', priority: 'p1' } as const;

describe('edit history (FR-009)', () => {
  it('an edit appends exactly one version carrying the PRIOR state', async () => {
    const { svc } = buildService();
    const req = await svc.create(CTX, PROJECT, VALID);
    await svc.edit(CTX, req.id, { description: 'Amended text.' });

    const history = await svc.versions('ws_a', req.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.description).toBe('Original text.');
    expect(history[0]?.type).toBe('functional');
    expect(history[0]?.priority).toBe('p1');
    expect(history[0]?.authoredById).toBe('u1');
  });

  it('prior text stays retrievable through repeated edits, newest first', async () => {
    const { svc } = buildService();
    const req = await svc.create(CTX, PROJECT, VALID);
    await svc.edit(CTX, req.id, { description: 'Second.' });
    await svc.edit(CTX, req.id, { description: 'Third.' });

    const history = await svc.versions('ws_a', req.id);
    expect(history.map((v) => v.description)).toEqual(['Second.', 'Original text.']);
    // The current record carries the latest text.
    expect((await svc.get('ws_a', req.id)).description).toBe('Third.');
  });

  it('a priority or type change is history too, not only text', async () => {
    const { svc } = buildService();
    const req = await svc.create(CTX, PROJECT, VALID);
    await svc.edit(CTX, req.id, { priority: 'p3' });
    const history = await svc.versions('ws_a', req.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.priority).toBe('p1');
  });

  it('an edit that changes nothing appends nothing', async () => {
    const { svc } = buildService();
    const req = await svc.create(CTX, PROJECT, VALID);
    await svc.edit(CTX, req.id, { description: 'Original text.' });
    expect(await svc.versions('ws_a', req.id)).toHaveLength(0);
  });

  it('history is workspace-scoped like everything else (FR-002)', async () => {
    const { svc } = buildService();
    const req = await svc.create(CTX, PROJECT, VALID);
    await svc.edit(CTX, req.id, { description: 'Amended.' });
    expect(await svc.versions('ws_b', req.id)).toEqual([]);
  });
});

describe('RequirementVersionService is append-only by construction', () => {
  it('exposes no update or delete operation', () => {
    const service = new RequirementVersionService(new InMemoryRequirementVersionStore());
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(service));
    for (const forbidden of ['update', 'delete', 'remove', 'destroy', 'edit']) {
      expect(methods, `service must not expose ${forbidden}()`).not.toContain(forbidden);
    }
  });

  it('the store fake refuses mutation of an appended row, mirroring the trigger', async () => {
    const store = new InMemoryRequirementVersionStore();
    const service = new RequirementVersionService(store);
    await service.append({
      workspaceId: 'ws_a',
      requirementId: 'r1',
      description: 'as it stood',
      type: 'functional',
      priority: 'p1',
      authoredById: 'u1',
    });
    const [row] = await service.listForRequirement('ws_a', 'r1');
    expect(() => store.mutateForTest(row!.id)).toThrow(/append-only/i);
  });
});
