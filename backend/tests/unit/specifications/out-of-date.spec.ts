/**
 * T093a — out-of-date detection (F-04.7, **FR-032**).
 *
 * Written to FAIL before `out-of-date.service.ts` exists (Constitution V).
 *
 * The requirement is narrow and the narrowness is the point: when a source
 * requirement changes, the derived specification is **flagged**. It is not
 * regenerated, not edited, not archived. A human decides what to do — because
 * regenerating on a requirement edit would silently discard a specification a
 * team may have reviewed and approved.
 *
 * The change signal is EPIC-007's content hash (`T069`), which normalises
 * whitespace and preserves case, so a re-space flags nothing and a change of
 * meaning flags everything derived.
 */
import { describe, expect, it } from 'vitest';
import { requirementContentHash } from '../../../src/modules/requirements/requirement-hash.js';
import { OutOfDateService } from '../../../src/modules/specifications/out-of-date.service.js';
import { InMemorySpecificationStore } from '../../../src/modules/specifications/specifications-read.service.js';
import { OTHER_WS, PROJECT, WS } from './helpers.js';

let seq = 0;

async function seed(
  store: InMemorySpecificationStore,
  requirementIds: string[],
  workspaceId = WS,
): Promise<string> {
  seq += 1;
  const id = `spec_${seq}`;
  const versionId = `ver_${seq}`;
  await store.commitGeneration({
    specification: {
      id,
      workspaceId,
      projectId: PROJECT,
      title: 'Payments Specification',
      lifecycleState: 'approved',
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
      contentRaw: '# Payments\n\nSettle in one transaction.',
      contentParsed: { sections: ['payments'] },
      lifecycleStateAtCreation: 'approved',
      authoredById: 'u1',
    },
    links: requirementIds.map((targetId) => ({
      workspaceId,
      sourceType: 'specification' as const,
      sourceId: id,
      targetType: 'requirement' as const,
      targetId,
      relationship: 'generated_from' as const,
    })),
    job: { id: `job_${id}`, state: 'succeeded' },
  });
  return id;
}

const BEFORE = requirementContentHash({
  description: 'The system shall settle payments.',
  type: 'functional',
  priority: 'p1',
});
const AFTER = requirementContentHash({
  description: 'The system shall settle payments within one business day.',
  type: 'functional',
  priority: 'p1',
});

function change(over: Record<string, unknown> = {}): {
  workspaceId: string;
  requirementId: string;
  previousContentHash: string;
  currentContentHash: string;
} {
  return {
    workspaceId: WS,
    requirementId: 'req_1',
    previousContentHash: BEFORE,
    currentContentHash: AFTER,
    ...over,
  } as never;
}

function service(): { service: OutOfDateService; store: InMemorySpecificationStore } {
  const store = new InMemorySpecificationStore();
  return { store, service: new OutOfDateService(store) };
}

describe('a changed requirement flags its derived specifications (FR-032)', () => {
  it('flags every specification generated from the requirement', async () => {
    const { service: svc, store } = service();
    const a = await seed(store, ['req_1']);
    const b = await seed(store, ['req_1', 'req_2']);

    const result = await svc.flagForRequirementChange(change());
    expect(result.flagged.sort()).toEqual([a, b].sort());
    expect(store.byId(a)!.isOutOfDate).toBe(true);
    expect(store.byId(b)!.isOutOfDate).toBe(true);
  });

  it('leaves specifications that do not derive from it alone', async () => {
    const { service: svc, store } = service();
    const unrelated = await seed(store, ['req_9']);
    await svc.flagForRequirementChange(change());
    expect(store.byId(unrelated)!.isOutOfDate).toBe(false);
  });

  it('never crosses a workspace boundary', async () => {
    const { service: svc, store } = service();
    const foreign = await seed(store, ['req_1'], OTHER_WS);
    const result = await svc.flagForRequirementChange(change());
    expect(result.flagged).toEqual([]);
    expect(store.byId(foreign)!.isOutOfDate).toBe(false);
  });

  it('is idempotent — an already-flagged specification stays flagged once', async () => {
    const { service: svc, store } = service();
    const id = await seed(store, ['req_1']);
    await svc.flagForRequirementChange(change());
    const second = await svc.flagForRequirementChange(change());
    expect(second.flagged).toEqual([]);
    expect(store.byId(id)!.isOutOfDate).toBe(true);
  });

  it('flags nothing when the requirement derives no specification', async () => {
    const { service: svc } = service();
    expect((await svc.flagForRequirementChange(change())).flagged).toEqual([]);
  });
});

describe('only a MATERIAL change flags (T069’s hash decides)', () => {
  it('an unchanged hash flags nothing', async () => {
    const { service: svc, store } = service();
    const id = await seed(store, ['req_1']);
    const result = await svc.flagForRequirementChange(
      change({ previousContentHash: BEFORE, currentContentHash: BEFORE }),
    );
    expect(result.flagged).toEqual([]);
    expect(store.byId(id)!.isOutOfDate).toBe(false);
  });

  it('re-spacing a requirement is not a change', async () => {
    const respaced = requirementContentHash({
      description: '  The system shall   settle payments.  ',
      type: 'functional',
      priority: 'p1',
    });
    const { service: svc, store } = service();
    const id = await seed(store, ['req_1']);
    await svc.flagForRequirementChange(
      change({ previousContentHash: BEFORE, currentContentHash: respaced }),
    );
    expect(store.byId(id)!.isOutOfDate).toBe(false);
  });

  it('a priority change IS a change', async () => {
    const reprioritised = requirementContentHash({
      description: 'The system shall settle payments.',
      type: 'functional',
      priority: 'p3',
    });
    const { service: svc, store } = service();
    const id = await seed(store, ['req_1']);
    await svc.flagForRequirementChange(
      change({ previousContentHash: BEFORE, currentContentHash: reprioritised }),
    );
    expect(store.byId(id)!.isOutOfDate).toBe(true);
  });
});

describe('flagging alters nothing but the flag (FR-032)', () => {
  it('does not touch the specification content', async () => {
    const { service: svc, store } = service();
    const id = await seed(store, ['req_1']);
    const before = structuredClone(store.versionsFor(id));

    await svc.flagForRequirementChange(change());

    expect(store.versionsFor(id)).toEqual(before);
  });

  it('does not append a version — nothing is regenerated', async () => {
    const { service: svc, store } = service();
    const id = await seed(store, ['req_1']);
    await svc.flagForRequirementChange(change());
    expect(store.versionsFor(id)).toHaveLength(1);
    expect(store.commits).toHaveLength(1);
  });

  it('does not move the lifecycle state', async () => {
    const { service: svc, store } = service();
    const id = await seed(store, ['req_1']);
    await svc.flagForRequirementChange(change());
    expect(store.byId(id)!.lifecycleState).toBe('approved');
  });

  it('does not change the current version pointer or the title', async () => {
    const { service: svc, store } = service();
    const id = await seed(store, ['req_1']);
    const before = store.byId(id)!;
    await svc.flagForRequirementChange(change());
    const after = store.byId(id)!;
    expect(after.currentVersionId).toBe(before.currentVersionId);
    expect(after.title).toBe(before.title);
  });

  it('cannot regenerate — the service holds no engine at all', () => {
    // Structural, not behavioural: there is no seam through which a future
    // change could make flagging trigger a run.
    expect(OutOfDateService.length).toBe(1);
    expect(JSON.stringify(Object.keys(new OutOfDateService(new InMemorySpecificationStore())))).not
      .toContain('engine');
  });
});
