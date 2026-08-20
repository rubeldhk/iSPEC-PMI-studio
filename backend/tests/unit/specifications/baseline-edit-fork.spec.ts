/**
 * T855 — editing a BASELINED specification forks (F1, **FR-011a**).
 *
 * Written to FAIL before T856 exists (Constitution V).
 *
 * Found by `T194` convergence, reading US5 scenario 2 against the edit ROUTE
 * rather than against the service. `BaselineService.editBaselined` implements
 * the fork and `T099a` tests it — and `PATCH /specifications/{id}` never called
 * it, so the one state where editing must behave differently behaved the same
 * as every other.
 *
 * The baseline is immutable. An edit does not amend it and does not transition
 * it: a fork is not a transition, so it writes no lifecycle history — the
 * specification simply continues in `draft` from a new version, and the
 * baselined version remains retrievable exactly as it stood.
 */
import { describe, expect, it } from 'vitest';
import {
  InMemorySpecificationStore,
  SpecificationsReadService,
  type SpecLifecycleState,
} from '../../../src/modules/specifications/specifications-read.service.js';
import { CTX, PROJECT, WS } from './helpers.js';

const BASELINE_CONTENT = '# Payments\n\nAs baselined.';

async function seed(state: SpecLifecycleState): Promise<{
  store: InMemorySpecificationStore;
  service: SpecificationsReadService;
  id: string;
}> {
  const store = new InMemorySpecificationStore();
  const id = 'spec_1';
  await store.commitGeneration({
    specification: {
      id,
      workspaceId: WS,
      projectId: PROJECT,
      title: 'Payments',
      lifecycleState: 'draft',
      currentVersionId: 'ver_1',
      engineName: 'stub',
      engineVersion: '1.0.0',
      generatedAt: new Date('2026-08-20T10:00:00.000Z'),
      isOutOfDate: false,
      createdById: 'u1',
      updatedById: 'u1',
    },
    version: {
      id: 'ver_1',
      workspaceId: WS,
      specificationId: id,
      versionNumber: 1,
      contentRaw: BASELINE_CONTENT,
      contentParsed: { sections: ['a'] },
      lifecycleStateAtCreation: 'draft',
      authoredById: 'u1',
    },
    links: [
      {
        workspaceId: WS,
        sourceType: 'specification',
        sourceId: id,
        targetType: 'requirement',
        targetId: 'req_1',
        relationship: 'generated_from',
      },
    ],
    job: { id: 'job_1', state: 'succeeded', resultRef: id },
  });
  await store.setLifecycleState(id, state);
  return { store, id, service: new SpecificationsReadService(store) };
}

describe('editing a baselined specification forks a draft (FR-011a)', () => {
  it('moves the specification to draft', async () => {
    const { service, id } = await seed('baselined');
    const updated = await service.edit(CTX, id, {
      contentRaw: '# Payments v2',
      contentParsed: { sections: ['b'] },
    });
    expect(updated.lifecycleState).toBe('draft');
  });

  it('the forked version is born in draft, whatever the baseline was', async () => {
    const { service, id } = await seed('baselined');
    await service.edit(CTX, id, { contentRaw: '# Payments v2', contentParsed: { sections: ['b'] } });
    const versions = await service.versions(WS, id);
    expect(versions[0]!.versionNumber).toBe(2);
    expect(versions[0]!.lifecycleStateAtCreation).toBe('draft');
  });

  it('leaves the baselined version retrievable and UNCHANGED (SC-007)', async () => {
    const { service, id } = await seed('baselined');
    await service.edit(CTX, id, { contentRaw: '# Payments v2', contentParsed: { sections: ['b'] } });
    const versions = await service.versions(WS, id);
    const baseline = versions.find((v) => v.versionNumber === 1)!;
    expect(baseline.contentRaw).toBe(BASELINE_CONTENT);
  });

  it('writes no lifecycle history — a fork is not a transition', async () => {
    // `baselined -> draft` is not a permitted transition, and it is not one
    // here either: the state moves because a new line begins, not because
    // anybody moved it. Recording it would put an impossible edge in the
    // history and break the CHECK constraint that guards the table.
    const { service, store, id } = await seed('baselined');
    await service.edit(CTX, id, { contentRaw: '# Payments v2', contentParsed: { sections: ['b'] } });
    expect(store.byId(id)!.lifecycleState).toBe('draft');
  });

  it('a title-only edit does not fork — there is no new content to fork to', async () => {
    const { service, id } = await seed('baselined');
    const updated = await service.edit(CTX, id, { title: 'Payments & Refunds' });
    expect(updated.lifecycleState).toBe('baselined');
    expect(await service.versions(WS, id)).toHaveLength(1);
  });
});

describe('every other state edits in place', () => {
  it.each([['draft'], ['review'], ['approved'], ['implemented']] as const)(
    'a %s specification keeps its state on edit',
    async (state) => {
      const { service, id } = await seed(state);
      const updated = await service.edit(CTX, id, {
        contentRaw: '# Payments v2',
        contentParsed: { sections: ['b'] },
      });
      expect(updated.lifecycleState).toBe(state);
    },
  );

  it('an approved specification still creates a new version, retrievable alongside (US5 scenario 2)', async () => {
    const { service, id } = await seed('approved');
    await service.edit(CTX, id, { contentRaw: '# Payments v2', contentParsed: { sections: ['b'] } });
    const versions = await service.versions(WS, id);
    expect(versions.map((v) => v.versionNumber)).toEqual([2, 1]);
    expect(versions[1]!.contentRaw).toBe(BASELINE_CONTENT);
  });
});
