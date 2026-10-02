/**
 * `T1371` (EPIC-041) — the default execution mode is a project attribute
 * (`FR-LPW-035`, ADR-0024 as amended by PMI-DOC-007 §9.2).
 *
 * A project with a `rootPath` resolves `controlled-local` as its default
 * execution kind; one without resolves `managed-isolated`; the choice is a
 * project attribute, not a global.
 *
 * Written to FAIL before `T1372` exists.
 */
import { describe, expect, it } from 'vitest';
import { ENVIRONMENT_KINDS } from '@pmi/execution-contract';
import {
  InMemoryProjectStore,
  ProjectsService,
  defaultExecutionKind,
  type ProjectRecord,
} from '../../../src/modules/projects/projects.service.js';

const CTX = { workspaceId: 'ws_a', userId: 'u1' };

describe('T1371 · defaultExecutionKind', () => {
  it('is controlled-local for a project with a root path', () => {
    expect(defaultExecutionKind({ rootPath: '/projects/alpha' } as ProjectRecord)).toBe('controlled-local');
  });

  it('is managed-isolated for a project without one', () => {
    expect(defaultExecutionKind({ rootPath: null } as ProjectRecord)).toBe('managed-isolated');
  });

  it('only ever answers with a kind the execution contract admits', () => {
    for (const rootPath of ['/p/a', null]) {
      expect(ENVIRONMENT_KINDS).toContain(defaultExecutionKind({ rootPath } as ProjectRecord));
    }
  });

  it('is decided per project, not per platform — two projects in one workspace differ', async () => {
    const store = new InMemoryProjectStore();
    const service = new ProjectsService(store);
    const local = await service.create(CTX, { name: 'Local' });
    await store.update('ws_a', local.id, { rootPath: '/projects/local' } as never);
    const managed = await service.create(CTX, { name: 'Managed' });
    expect(await service.defaultExecutionKind('ws_a', local.id)).toBe('controlled-local');
    expect(await service.defaultExecutionKind('ws_a', managed.id)).toBe('managed-isolated');
  });

  it('is an opaque 404 for another workspace\'s project', async () => {
    const service = new ProjectsService(new InMemoryProjectStore());
    const p = await service.create(CTX, { name: 'P' });
    await expect(service.defaultExecutionKind('ws_other', p.id)).rejects.toThrow(/not found/i);
  });
});
