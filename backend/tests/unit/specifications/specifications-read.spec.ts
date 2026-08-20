/**
 * T076a — the specification read surface (F-04.6, **FR-012**).
 *
 * Written to FAIL before `specifications-read.service.ts` exists
 * (Constitution V).
 *
 * FR-012 had zero task coverage until the closing `/speckit-analyze` finding
 * **E1** (RAID I-02) added F-04.6. This is that coverage: list with pagination,
 * detail, and edit — each scoped to the project and to the workspace, with
 * cross-workspace access indistinguishable from absence (FR-002, SC-004).
 */
import { describe, expect, it } from 'vitest';
import { NotFoundError, ValidationFailedError } from '../../../src/core/errors.js';
import {
  InMemorySpecificationStore,
  SpecificationsReadService,
} from '../../../src/modules/specifications/specifications-read.service.js';
import { CTX, OTHER_WS, PROJECT, WS } from './helpers.js';

const OTHER_PROJECT = 'proj_2';

async function seed(
  store: InMemorySpecificationStore,
  over: Partial<{ workspaceId: string; projectId: string; title: string; contentRaw: string }> = {},
): Promise<string> {
  const specificationId = `spec_${store.all().length + 1}`;
  const versionId = `ver_${store.allVersions().length + 1}`;
  await store.commitGeneration({
    specification: {
      id: specificationId,
      workspaceId: over.workspaceId ?? WS,
      projectId: over.projectId ?? PROJECT,
      title: over.title ?? 'Payments Specification',
      lifecycleState: 'draft',
      currentVersionId: versionId,
      engineName: 'stub',
      engineVersion: '1.4.0+model-x',
      generatedAt: new Date('2026-08-20T10:00:00.000Z'),
      isOutOfDate: false,
      createdById: 'u1',
      updatedById: 'u1',
    },
    version: {
      id: versionId,
      workspaceId: over.workspaceId ?? WS,
      specificationId,
      versionNumber: 1,
      contentRaw: over.contentRaw ?? '# Payments\n\nSettle in one transaction.',
      contentParsed: { sections: [] },
      lifecycleStateAtCreation: 'draft',
      authoredById: 'u1',
    },
    links: [
      {
        workspaceId: over.workspaceId ?? WS,
        sourceType: 'specification',
        sourceId: specificationId,
        targetType: 'requirement',
        targetId: 'req_1',
        relationship: 'generated_from',
      },
    ],
    job: { id: `job_${specificationId}`, state: 'succeeded', resultRef: specificationId },
  });
  return specificationId;
}

function service(): { service: SpecificationsReadService; store: InMemorySpecificationStore } {
  const store = new InMemorySpecificationStore();
  return { store, service: new SpecificationsReadService(store) };
}

describe('list · project scoping', () => {
  it('returns only the named project’s specifications', async () => {
    const { service: svc, store } = service();
    await seed(store);
    await seed(store, { projectId: OTHER_PROJECT, title: 'Refunds' });

    const page = await svc.list(WS, PROJECT);
    expect(page.rows.map((s) => s.projectId)).toEqual([PROJECT]);
  });

  it('returns nothing for another workspace’s project — not another tenant’s rows', async () => {
    const { service: svc, store } = service();
    await seed(store);
    const page = await svc.list(OTHER_WS, PROJECT);
    expect(page.rows).toEqual([]);
    expect(page.total).toBe(0);
  });

  it('scopes BEFORE it pages — a foreign row never occupies a slot', async () => {
    const { service: svc, store } = service();
    await seed(store, { workspaceId: OTHER_WS, title: 'Foreign' });
    await seed(store, { title: 'Ours' });

    const page = await svc.list(WS, PROJECT, { page: 1, pageSize: 1 });
    expect(page.rows.map((s) => s.title)).toEqual(['Ours']);
    expect(page.total).toBe(1);
  });
});

describe('list · pagination', () => {
  it('defaults to page 1 with a bounded page size', async () => {
    const { service: svc, store } = service();
    await seed(store);
    const page = await svc.list(WS, PROJECT);
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(25);
  });

  it('pages without losing or repeating a row', async () => {
    const { service: svc, store } = service();
    for (let i = 0; i < 5; i += 1) await seed(store, { title: `Spec ${i}` });

    const first = await svc.list(WS, PROJECT, { page: 1, pageSize: 2 });
    const second = await svc.list(WS, PROJECT, { page: 2, pageSize: 2 });
    const third = await svc.list(WS, PROJECT, { page: 3, pageSize: 2 });

    expect(first.rows).toHaveLength(2);
    expect(second.rows).toHaveLength(2);
    expect(third.rows).toHaveLength(1);
    expect(first.total).toBe(5);
    const ids = [...first.rows, ...second.rows, ...third.rows].map((s) => s.id);
    expect(new Set(ids).size).toBe(5);
  });

  it('returns an empty page past the end rather than failing', async () => {
    const { service: svc, store } = service();
    await seed(store);
    const page = await svc.list(WS, PROJECT, { page: 9, pageSize: 10 });
    expect(page.rows).toEqual([]);
    expect(page.total).toBe(1);
  });

  it.each([
    ['page 0', { page: 0 }],
    ['a negative page', { page: -1 }],
    ['a fractional page', { page: 1.5 }],
    ['pageSize 0', { pageSize: 0 }],
    ['an oversized pageSize', { pageSize: 5000 }],
  ])('refuses %s, naming the field', async (_label, query) => {
    const { service: svc } = service();
    const error = await svc.list(WS, PROJECT, query).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationFailedError);
    const details = (error as ValidationFailedError).details as { fields: { field: string }[] };
    expect(details.fields.some((f) => f.field === Object.keys(query)[0])).toBe(true);
  });
});

describe('detail', () => {
  it('returns the specification with its current version content', async () => {
    const { service: svc, store } = service();
    const id = await seed(store);
    const detail = await svc.get(WS, id);
    expect(detail.id).toBe(id);
    expect(detail.currentVersion?.contentRaw).toContain('Settle in one transaction');
  });

  it('includes engine provenance and the out-of-date flag (FR-022, FR-032)', async () => {
    const { service: svc, store } = service();
    const id = await seed(store);
    const detail = await svc.get(WS, id);
    expect(detail.engineName).toBe('stub');
    expect(detail.engineVersion).toBe('1.4.0+model-x');
    expect(detail.isOutOfDate).toBe(false);
  });

  it('is not found across a workspace boundary — 404, never 403 (FR-002, SC-004)', async () => {
    const { service: svc, store } = service();
    const id = await seed(store);
    const error = await svc.get(OTHER_WS, id).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as NotFoundError).message).toBe('Not found.');
  });

  it('a missing id and a foreign id are indistinguishable', async () => {
    const { service: svc, store } = service();
    const id = await seed(store);
    const foreign = await svc.get(OTHER_WS, id).catch((e: unknown) => e);
    const missing = await svc.get(OTHER_WS, 'spec_nope').catch((e: unknown) => e);
    expect((foreign as Error).message).toBe((missing as Error).message);
  });

  it('records the refusal before throwing (FR-033)', async () => {
    const store = new InMemorySpecificationStore();
    const refusals: { targetType: string }[] = [];
    const svc = new SpecificationsReadService(store, { onRefused: (r) => refusals.push(r) });
    const id = await seed(store);
    await svc.get(OTHER_WS, id).catch(() => undefined);
    expect(refusals).toEqual([
      { workspaceId: OTHER_WS, targetType: 'specification', outcome: 'refused' },
    ]);
  });
});

describe('edit (FR-012, FR-013)', () => {
  it('a content edit appends a new version and leaves the prior one retrievable', async () => {
    const { service: svc, store } = service();
    const id = await seed(store);
    await svc.edit(CTX, id, { contentRaw: '# Payments v2', contentParsed: { sections: ['v2'] } });

    const versions = await svc.versions(WS, id);
    expect(versions.map((v) => v.versionNumber)).toEqual([2, 1]);
    expect(versions[1]!.contentRaw).toContain('Settle in one transaction');
  });

  it('moves the current version pointer to the new version', async () => {
    const { service: svc, store } = service();
    const id = await seed(store);
    const updated = await svc.edit(CTX, id, { contentRaw: '# v2', contentParsed: { a: 1 } });
    const versions = await svc.versions(WS, id);
    expect(updated.currentVersionId).toBe(versions[0]!.id);
  });

  it('records the author of the new version (FR-014)', async () => {
    const { service: svc, store } = service();
    const id = await seed(store);
    await svc.edit({ workspaceId: WS, userId: 'u9' }, id, {
      contentRaw: '# v2',
      contentParsed: { a: 1 },
    });
    const versions = await svc.versions(WS, id);
    expect(versions[0]!.authoredById).toBe('u9');
  });

  it('a title-only edit renames without appending a content snapshot', async () => {
    // A version snapshots CONTENT. Appending an identical one for a rename
    // would make the history claim a change that never happened — the same
    // judgement the requirement register makes for a no-op edit.
    const { service: svc, store } = service();
    const id = await seed(store);
    const updated = await svc.edit(CTX, id, { title: 'Payments & Refunds' });
    expect(updated.title).toBe('Payments & Refunds');
    expect(await svc.versions(WS, id)).toHaveLength(1);
  });

  it('an edit that changes nothing appends nothing', async () => {
    const { service: svc, store } = service();
    const id = await seed(store);
    const before = await svc.get(WS, id);
    await svc.edit(CTX, id, { contentRaw: before.currentVersion!.contentRaw });
    expect(await svc.versions(WS, id)).toHaveLength(1);
  });

  it('never clears the out-of-date flag — a human decides (FR-032)', async () => {
    const { service: svc, store } = service();
    const id = await seed(store);
    await store.flagOutOfDate([id]);
    const updated = await svc.edit(CTX, id, { contentRaw: '# v2', contentParsed: { a: 1 } });
    expect(updated.isOutOfDate).toBe(true);
  });

  it.each([
    ['an empty body', {}],
    ['a blank title', { title: '   ' }],
    ['a blank contentRaw', { contentRaw: '  ' }],
  ])('refuses %s, naming the field', async (_label, input) => {
    const { service: svc, store } = service();
    const id = await seed(store);
    const error = await svc.edit(CTX, id, input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationFailedError);
  });

  it('cannot be reached across a workspace boundary', async () => {
    const { service: svc, store } = service();
    const id = await seed(store);
    const error = await svc
      .edit({ workspaceId: OTHER_WS, userId: 'u2' }, id, { title: 'Hijacked' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect((await svc.get(WS, id)).title).toBe('Payments Specification');
  });
});
