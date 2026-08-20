/**
 * T083f — specification search and filtering (F-04.6, MPS Volume 2).
 *
 * Written to FAIL before `specification-search.service.ts` exists
 * (Constitution V).
 *
 * The rule plan.md states and this file enforces: **search is scoped before it
 * is matched.** A search that filters after matching is a leak with a ranking
 * algorithm — the match set has already crossed the tenancy boundary by the
 * time the filter runs, and any bug in the filter exposes it.
 */
import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../../src/core/errors.js';
import { SpecificationSearchService } from '../../../src/modules/specifications/specification-search.service.js';
import { InMemorySpecificationStore } from '../../../src/modules/specifications/specifications-read.service.js';
import { OTHER_WS, PROJECT, WS } from './helpers.js';

const OTHER_PROJECT = 'proj_2';

let seq = 0;

async function seed(
  store: InMemorySpecificationStore,
  fields: {
    title: string;
    contentRaw: string;
    workspaceId?: string;
    projectId?: string;
    updatedAt?: Date;
  },
): Promise<string> {
  seq += 1;
  const id = `spec_${seq}`;
  const versionId = `ver_${seq}`;
  const workspaceId = fields.workspaceId ?? WS;
  await store.commitGeneration({
    specification: {
      id,
      workspaceId,
      projectId: fields.projectId ?? PROJECT,
      title: fields.title,
      lifecycleState: 'draft',
      currentVersionId: versionId,
      engineName: 'stub',
      engineVersion: '1.0.0',
      generatedAt: new Date('2026-08-20T10:00:00.000Z'),
      isOutOfDate: false,
      createdById: 'u1',
      updatedById: 'u1',
    },
    version: {
      id: versionId,
      workspaceId,
      specificationId: id,
      versionNumber: 1,
      contentRaw: fields.contentRaw,
      contentParsed: {},
      lifecycleStateAtCreation: 'draft',
      authoredById: 'u1',
    },
    links: [
      {
        workspaceId,
        sourceType: 'specification',
        sourceId: id,
        targetType: 'requirement',
        targetId: 'req_1',
        relationship: 'generated_from',
      },
    ],
    job: { id: `job_${id}`, state: 'succeeded', resultRef: id },
  });
  if (fields.updatedAt) await store.touch(id, fields.updatedAt);
  return id;
}

function service(): { service: SpecificationSearchService; store: InMemorySpecificationStore } {
  const store = new InMemorySpecificationStore();
  return { store, service: new SpecificationSearchService(store) };
}

describe('search · matching', () => {
  it('matches a title', async () => {
    const { service: svc, store } = service();
    await seed(store, { title: 'Payments Settlement', contentRaw: 'unrelated body' });
    await seed(store, { title: 'Refunds', contentRaw: 'unrelated body' });

    const page = await svc.search(WS, { term: 'settlement' });
    expect(page.rows.map((r) => r.title)).toEqual(['Payments Settlement']);
    expect(page.rows[0]!.matchedIn).toEqual(['title']);
  });

  it('matches content', async () => {
    const { service: svc, store } = service();
    await seed(store, { title: 'Refunds', contentRaw: 'The system shall settle in one transaction.' });

    const page = await svc.search(WS, { term: 'one transaction' });
    expect(page.rows.map((r) => r.title)).toEqual(['Refunds']);
    expect(page.rows[0]!.matchedIn).toEqual(['content']);
  });

  it('matches case-insensitively', async () => {
    const { service: svc, store } = service();
    await seed(store, { title: 'PAYMENTS', contentRaw: 'body' });
    expect((await svc.search(WS, { term: 'payments' })).rows).toHaveLength(1);
  });

  it('reports both fields when both match', async () => {
    const { service: svc, store } = service();
    await seed(store, { title: 'Payments', contentRaw: 'payments settle nightly' });
    expect((await svc.search(WS, { term: 'payments' })).rows[0]!.matchedIn).toEqual([
      'title',
      'content',
    ]);
  });

  it('returns nothing rather than everything when nothing matches', async () => {
    const { service: svc, store } = service();
    await seed(store, { title: 'Payments', contentRaw: 'body' });
    const page = await svc.search(WS, { term: 'zzz' });
    expect(page.rows).toEqual([]);
    expect(page.total).toBe(0);
  });
});

describe('search · scoped before matched', () => {
  it('never returns another workspace’s specification, however well it matches', async () => {
    const { service: svc, store } = service();
    await seed(store, { title: 'Payments', contentRaw: 'payments', workspaceId: OTHER_WS });
    const page = await svc.search(WS, { term: 'payments' });
    expect(page.rows).toEqual([]);
  });

  it('confines the search to one project when asked', async () => {
    const { service: svc, store } = service();
    await seed(store, { title: 'Payments A', contentRaw: 'x' });
    await seed(store, { title: 'Payments B', contentRaw: 'x', projectId: OTHER_PROJECT });

    const page = await svc.search(WS, { term: 'payments', projectId: PROJECT });
    expect(page.rows.map((r) => r.title)).toEqual(['Payments A']);
  });

  it('searches every project in the workspace when none is named', async () => {
    const { service: svc, store } = service();
    await seed(store, { title: 'Payments A', contentRaw: 'x' });
    await seed(store, { title: 'Payments B', contentRaw: 'x', projectId: OTHER_PROJECT });

    expect((await svc.search(WS, { term: 'payments' })).total).toBe(2);
  });

  it('asks its source for a SCOPED candidate set, not for everything', async () => {
    const { service: svc, store } = service();
    await seed(store, { title: 'Payments', contentRaw: 'x' });
    await svc.search(WS, { term: 'payments', projectId: PROJECT });
    // The scope reaches the source. If matching happened first and filtering
    // second, this call would carry no scope at all.
    expect(store.scopedCalls).toEqual([{ workspaceId: WS, projectId: PROJECT }]);
  });
});

describe('search · ordering', () => {
  it('ranks a title match above a content-only match', async () => {
    const { service: svc, store } = service();
    await seed(store, { title: 'Refunds', contentRaw: 'mentions payments once' });
    await seed(store, { title: 'Payments', contentRaw: 'unrelated' });

    expect((await svc.search(WS, { term: 'payments' })).rows.map((r) => r.title)).toEqual([
      'Payments',
      'Refunds',
    ]);
  });

  it('orders equal-rank hits by most recently updated', async () => {
    const { service: svc, store } = service();
    await seed(store, {
      title: 'Payments Old',
      contentRaw: 'x',
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await seed(store, {
      title: 'Payments New',
      contentRaw: 'x',
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    });

    expect((await svc.search(WS, { term: 'payments' })).rows.map((r) => r.title)).toEqual([
      'Payments New',
      'Payments Old',
    ]);
  });

  it('is deterministic when rank and timestamp tie', async () => {
    const { service: svc, store } = service();
    const at = new Date('2026-05-01T00:00:00.000Z');
    await seed(store, { title: 'Payments B', contentRaw: 'x', updatedAt: at });
    await seed(store, { title: 'Payments A', contentRaw: 'x', updatedAt: at });

    expect((await svc.search(WS, { term: 'payments' })).rows.map((r) => r.title)).toEqual([
      'Payments A',
      'Payments B',
    ]);
  });
});

describe('search · filtering and paging', () => {
  it('filters by lifecycle state', async () => {
    const { service: svc, store } = service();
    const id = await seed(store, { title: 'Payments A', contentRaw: 'x' });
    await seed(store, { title: 'Payments B', contentRaw: 'x' });
    // The interface form (T113): workspace-scoped, actor-stamped — the old
    // two-argument test helper was absorbed by the real write path.
    await store.setLifecycleState(WS, id, 'approved', 'u_search');

    const page = await svc.search(WS, { term: 'payments', lifecycleState: 'approved' });
    expect(page.rows.map((r) => r.title)).toEqual(['Payments A']);
  });

  it('filters to out-of-date specifications (FR-032)', async () => {
    const { service: svc, store } = service();
    const id = await seed(store, { title: 'Payments A', contentRaw: 'x' });
    await seed(store, { title: 'Payments B', contentRaw: 'x' });
    await store.flagOutOfDate([id]);

    const page = await svc.search(WS, { term: 'payments', isOutOfDate: true });
    expect(page.rows.map((r) => r.title)).toEqual(['Payments A']);
  });

  it('pages the result set', async () => {
    const { service: svc, store } = service();
    for (let i = 0; i < 3; i += 1) {
      await seed(store, { title: `Payments ${i}`, contentRaw: 'x' });
    }
    const page = await svc.search(WS, { term: 'payments', page: 2, pageSize: 2 });
    expect(page.rows).toHaveLength(1);
    expect(page.total).toBe(3);
  });
});

describe('search · refusals', () => {
  it.each([['an empty term', ''], ['whitespace only', '   ']])(
    'refuses %s, naming the field',
    async (_label, term) => {
      const { service: svc } = service();
      const error = await svc.search(WS, { term }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationFailedError);
      const details = (error as ValidationFailedError).details as { fields: { field: string }[] };
      expect(details.fields.some((f) => f.field === 'q')).toBe(true);
    },
  );

  it('refuses an unknown lifecycle state rather than silently ignoring it', async () => {
    const { service: svc } = service();
    const error = await svc
      .search(WS, { term: 'x', lifecycleState: 'nonsense' as never })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationFailedError);
  });
});
