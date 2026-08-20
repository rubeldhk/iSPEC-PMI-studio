/**
 * T049 — project creation validation and the unique-name-within-workspace rule.
 * Written to FAIL before T053/T054 exist (Constitution V).
 *
 * FR-001 / FR-003. Uniqueness is scoped to the workspace, not global: two
 * workspaces may each hold a project called "Platform" and that is correct —
 * the tenancy boundary is the namespace (plan.md design note).
 */
import { describe, expect, it } from 'vitest';
import {
  InMemoryProjectStore,
  ProjectsService,
} from '../../../src/modules/projects/projects.service.js';
import { ConflictError, NotFoundError, ValidationFailedError } from '../../../src/core/errors.js';

const CTX = { workspaceId: 'ws_a', userId: 'u1' };

function service(): { svc: ProjectsService; store: InMemoryProjectStore } {
  const store = new InMemoryProjectStore();
  return { svc: new ProjectsService(store), store };
}

describe('ProjectsService · create', () => {
  it('creates an active project owned by the acting user, stamped with the workspace', async () => {
    const { svc } = service();
    const project = await svc.create(CTX, { name: 'Platform' });
    expect(project.name).toBe('Platform');
    expect(project.workspaceId).toBe('ws_a');
    expect(project.ownerUserId).toBe('u1');
    expect(project.status).toBe('active');
    expect(project.archivedAt).toBeNull();
  });

  it('refuses a missing name, naming the field (FR-007 shape)', async () => {
    const { svc } = service();
    for (const name of ['', '   ']) {
      const err = await svc.create(CTX, { name }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ValidationFailedError);
      const details = (err as ValidationFailedError).details as { fields: { field: string }[] };
      expect(details.fields[0]?.field).toBe('name');
    }
  });

  it('refuses a name over 200 characters, naming the field', async () => {
    const { svc } = service();
    const err = await svc.create(CTX, { name: 'x'.repeat(201) }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationFailedError);
    const details = (err as ValidationFailedError).details as { fields: { field: string }[] };
    expect(details.fields[0]?.field).toBe('name');
  });

  it('refuses a duplicate name within the same workspace', async () => {
    const { svc } = service();
    await svc.create(CTX, { name: 'Platform' });
    await expect(svc.create(CTX, { name: 'Platform' })).rejects.toBeInstanceOf(ConflictError);
  });

  it('permits the same name in a DIFFERENT workspace — the boundary is the namespace', async () => {
    const { svc } = service();
    await svc.create(CTX, { name: 'Platform' });
    const other = await svc.create({ workspaceId: 'ws_b', userId: 'u9' }, { name: 'Platform' });
    expect(other.workspaceId).toBe('ws_b');
  });
});

describe('ProjectsService · list / get', () => {
  it('lists only the acting workspace\'s projects', async () => {
    const { svc } = service();
    await svc.create(CTX, { name: 'Mine' });
    await svc.create({ workspaceId: 'ws_b', userId: 'u9' }, { name: 'Theirs' });
    const listed = await svc.list('ws_a');
    expect(listed.map((p) => p.name)).toEqual(['Mine']);
  });

  it('get from another workspace is indistinguishable from absence (FR-002)', async () => {
    const { svc } = service();
    const theirs = await svc.create({ workspaceId: 'ws_b', userId: 'u9' }, { name: 'Theirs' });
    await expect(svc.get('ws_a', theirs.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(svc.get('ws_a', 'does-not-exist')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('ProjectsService · rename and engine selection', () => {
  it('renames, subject to the same uniqueness rule', async () => {
    const { svc } = service();
    const p = await svc.create(CTX, { name: 'Old' });
    await svc.create(CTX, { name: 'Taken' });
    const renamed = await svc.update('ws_a', p.id, { name: 'New' });
    expect(renamed.name).toBe('New');
    await expect(svc.update('ws_a', p.id, { name: 'Taken' })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('renaming a project to its own name is not a conflict', async () => {
    const { svc } = service();
    const p = await svc.create(CTX, { name: 'Same' });
    await expect(svc.update('ws_a', p.id, { name: 'Same' })).resolves.toMatchObject({
      name: 'Same',
    });
  });

  it('stores an engine selection, and null means inherit the default (FR-019)', async () => {
    const { svc } = service();
    const p = await svc.create(CTX, { name: 'P' });
    expect(await svc.findEngineNameForProject(p.id)).toBeNull();
    await svc.update('ws_a', p.id, { engineName: 'speckit' });
    expect(await svc.findEngineNameForProject(p.id)).toBe('speckit');
  });
});
