/**
 * T255 — the dependency service: create, list, delete; a cycle-forming edge
 * is refused BEFORE storage — direct, two-hop, and multi-hop alike
 * (SC-ENH-009, with T253). Also covers T262's controller wiring, the pairing
 * tasks.md cites.
 * Written to FAIL before T256/T262 exist (Constitution V).
 */
import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { RequestMethod } from '@nestjs/common';
import {
  DependenciesService,
  InMemoryDependencyStore,
  type ArtifactRef,
} from '../../../src/modules/dependencies/dependencies.service.js';
import {
  DependenciesController,
  type DependenciesApi,
} from '../../../src/modules/dependencies/dependencies.controller.js';
import { toHttpStatus } from '../../../src/core/errors.js';

const WS = 'ws_a';
const ref = (artifactId: string): ArtifactRef => ({ artifactType: 'specification', artifactId });

function build(): { service: DependenciesService; store: InMemoryDependencyStore } {
  const store = new InMemoryDependencyStore();
  return { store, service: new DependenciesService(store) };
}

describe('T255 · create / list / delete', () => {
  it('creates an edge and lists it from BOTH endpoints', async () => {
    const { service } = build();
    const edge = await service.create(
      WS,
      { source: ref('s_a'), target: ref('s_b'), dependencyType: 'consumes' },
      'u1',
    );
    expect(edge.dependencyType).toBe('consumes');

    const fromSource = await service.listForArtifact(WS, ref('s_a'));
    const fromTarget = await service.listForArtifact(WS, ref('s_b'));
    expect(fromSource.outgoing.length).toBe(1);
    expect(fromTarget.incoming.length).toBe(1);
  });

  it('deletes an edge; deleting across workspaces is an opaque 404', async () => {
    const { service } = build();
    const edge = await service.create(
      WS,
      { source: ref('s_a'), target: ref('s_b'), dependencyType: 'consumes' },
      'u1',
    );
    await expect(service.delete('ws_b', edge.id)).rejects.toThrow();
    await service.delete(WS, edge.id);
    expect((await service.listForArtifact(WS, ref('s_a'))).outgoing).toEqual([]);
  });
});

describe('T255 · a cycle never reaches storage (FR-ENH-011, SC-ENH-009)', () => {
  it.each([
    ['direct', [['b', 'a']], ['a', 'b']],
    ['two-hop', [['a', 'b'], ['b', 'c']], ['c', 'a']],
    ['multi-hop', [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e']], ['e', 'a']],
  ] as const)('%s cycle refused before storage', async (_kind, existing, closing) => {
    const { service, store } = build();
    for (const [s, t] of existing) {
      await service.create(WS, { source: ref(s), target: ref(t), dependencyType: 'consumes' }, 'u1');
    }
    const before = (await store.listForWorkspace(WS)).length;
    await expect(
      service.create(
        WS,
        { source: ref(closing[0]), target: ref(closing[1]), dependencyType: 'consumes' },
        'u1',
      ),
    ).rejects.toThrow(/cycle|circular/i);
    expect((await store.listForWorkspace(WS)).length).toBe(before);
  });
});

describe('T262 · the controller (route wiring, refusals)', () => {
  const EDGE = { id: 'de1', source: ref('s_a'), target: ref('s_b'), dependencyType: 'consumes' };
  function api(): DependenciesApi {
    return {
      create: vi.fn(async () => EDGE),
      listForArtifact: vi.fn(async () => ({ outgoing: [EDGE], incoming: [] })),
      delete: vi.fn(async () => undefined),
      impact: vi.fn(async () => ({ affected: [], bounded: false })),
    } as unknown as DependenciesApi;
  }

  it.each([
    ['create', 'dependencies', RequestMethod.POST],
    ['list', 'artifacts/:type/:id/dependencies', RequestMethod.GET],
    ['remove', 'dependencies/:id', RequestMethod.DELETE],
    ['impact', 'artifacts/:type/:id/impact', RequestMethod.GET],
  ])('%s → %s', (handler, path, method) => {
    const fn = DependenciesController.prototype[handler as keyof DependenciesController] as object;
    expect({
      path: Reflect.getMetadata('path', fn) as string,
      method: Reflect.getMetadata('method', fn) as RequestMethod,
    }).toEqual({ path, method });
  });

  it('impact answers in ONE request — every affected artifact, no per-spec round trips (SC-ENH-002)', async () => {
    const service = api();
    (service.impact as ReturnType<typeof vi.fn>).mockResolvedValue({
      affected: [
        { artifact: ref('s_b'), distance: 1, path: [ref('s_a'), ref('s_b')] },
        { artifact: ref('s_c'), distance: 2, path: [ref('s_a'), ref('s_b'), ref('s_c')] },
      ],
      bounded: false,
    });
    const controller = new DependenciesController(service);
    const out = await controller.impact(
      { workspaceId: WS, userId: 'u1' } as never,
      'specification',
      's_a',
    );
    expect(out.affected.length).toBe(2);
    expect(out.affected[1]?.path.length).toBe(3);
  });

  it('no session → 401 before the service is touched', async () => {
    const service = api();
    const err = await new DependenciesController(service)
      .list(undefined as never, 'specification', 's_a')
      .catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(401);
    expect(service.listForArtifact).not.toHaveBeenCalled();
  });
});
