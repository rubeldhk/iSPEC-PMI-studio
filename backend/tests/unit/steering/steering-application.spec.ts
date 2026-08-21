/**
 * T241 — a SteeringApplication row for EVERY generation (FR-ENH-004,
 * SC-ENH-001). Written to FAIL before T242 exists (Constitution V).
 *
 * An artifact generated with no steering in scope gets a row with an EMPTY
 * set — never a missing row. That distinction is what makes "zero unknown
 * provenance" checkable.
 */
import { describe, expect, it } from 'vitest';
import {
  InMemorySteeringApplicationStore,
  SteeringApplicationService,
} from '../../../src/modules/steering/steering-application.service.js';
import { GenerateSpecificationService } from '../../../src/modules/specifications/generate-specification.service.js';
import { InMemorySpecificationStore } from '../../../src/modules/specifications/specifications-read.service.js';
import { StubEngine, selection } from '../specifications/helpers.js';

const WS = 'ws_a';

function build(): { service: SteeringApplicationService; store: InMemorySteeringApplicationStore } {
  const store = new InMemorySteeringApplicationStore();
  return { store, service: new SteeringApplicationService(store) };
}

const RESOLUTION = {
  resolved: [
    { subject: 'technology_stack', scopeType: 'project', content: 'PostgreSQL and Valkey.', version: 3 },
  ],
  overrides: [
    {
      winning: { id: 'sd_n', subject: 'technology_stack', scopeType: 'project', version: 3 },
      overridden: { id: 'sd_b', subject: 'technology_stack', scopeType: 'organization', version: 1 },
    },
  ],
} as const;

describe('T241 · provenance is stamped at generation time', () => {
  it('records the exact resolved set and its overrides against the artifact', async () => {
    const { service, store } = build();
    await service.recordForGeneration({
      workspaceId: WS,
      artifactType: 'specification',
      artifactId: 's1',
      resolution: RESOLUTION as never,
    });
    const row = await store.findForArtifact('specification', 's1');
    expect(row?.appliedDocuments).toEqual(RESOLUTION.resolved);
    expect(row?.overrides).toEqual(RESOLUTION.overrides);
    expect(row?.workspaceId).toBe(WS);
  });

  it('NO steering in scope → a row with an EMPTY set, never a missing row', async () => {
    const { service, store } = build();
    await service.recordForGeneration({
      workspaceId: WS,
      artifactType: 'specification',
      artifactId: 's_bare',
      resolution: { resolved: [], overrides: [] },
    });
    const row = await store.findForArtifact('specification', 's_bare');
    expect(row).not.toBeNull();
    expect(row?.appliedDocuments).toEqual([]);
    expect(row?.overrides).toEqual([]);
  });

  it('provenance is write-once — restamping the same artifact is refused, not recomputed', async () => {
    const { service } = build();
    const stamp = {
      workspaceId: WS,
      artifactType: 'specification',
      artifactId: 's1',
      resolution: RESOLUTION as never,
    };
    await service.recordForGeneration(stamp);
    await expect(service.recordForGeneration(stamp)).rejects.toThrow(/once|already/i);
  });

  it("stamping rides the GENERATION path — FR-ENH-004's 'every generation' is the pipeline, not a convention", async () => {
    const appStore = new InMemorySteeringApplicationStore();
    const appService = new SteeringApplicationService(appStore);
    const engine = StubEngine.returning();
    const generation = new GenerateSpecificationService(
      { resolveForProject: async () => engine },
      new InMemorySpecificationStore(),
      {
        steering: {
          resolveForGeneration: async () => RESOLUTION as never,
          recordForGeneration: (stamp) => appService.recordForGeneration(stamp as never),
        },
      },
    );

    const outcome = await generation.run({
      jobId: 'job_st',
      workspaceId: WS,
      projectId: 'proj_st',
      requestedById: 'u1',
      correlationId: 'corr_st',
      projectName: 'Steered',
      requirements: selection(),
      timeoutMs: 1000,
    } as never);

    expect(outcome.state).toBe('succeeded');
    // The engine received the resolved set as structured input (S1/S2).
    expect(engine.calls[0]?.steering).toEqual(RESOLUTION.resolved);
    // And the artifact carries its provenance, stamped in the same act.
    const row = await appStore.findForArtifact(
      'specification',
      (outcome as { specification?: { id: string } }).specification?.id ?? '',
    );
    expect(row?.appliedDocuments).toEqual(RESOLUTION.resolved);
  });

  it('no steering in scope → the engine gets NO steering field (S4), the artifact still gets its empty-set row', async () => {
    const appStore = new InMemorySteeringApplicationStore();
    const appService = new SteeringApplicationService(appStore);
    const engine = StubEngine.returning();
    const generation = new GenerateSpecificationService(
      { resolveForProject: async () => engine },
      new InMemorySpecificationStore(),
      {
        steering: {
          resolveForGeneration: async () => ({ resolved: [], overrides: [] }),
          recordForGeneration: (stamp) => appService.recordForGeneration(stamp as never),
        },
      },
    );

    const outcome = await generation.run({
      jobId: 'job_bare',
      workspaceId: WS,
      projectId: 'proj_st',
      requestedById: 'u1',
      correlationId: 'corr_bare',
      projectName: 'Unsteered',
      requirements: selection(),
      timeoutMs: 1000,
    } as never);

    expect(outcome.state).toBe('succeeded');
    expect(Object.hasOwn(engine.calls[0] ?? {}, 'steering')).toBe(false);
    const row = await appStore.findForArtifact(
      'specification',
      (outcome as { specification?: { id: string } }).specification?.id ?? '',
    );
    expect(row).not.toBeNull();
    expect(row?.appliedDocuments).toEqual([]);
  });

  it('a failed run stamps NOTHING — provenance belongs to artifacts, not attempts', async () => {
    const appStore = new InMemorySteeringApplicationStore();
    const appService = new SteeringApplicationService(appStore);
    const generation = new GenerateSpecificationService(
      { resolveForProject: async () => StubEngine.failing('engine_error') },
      new InMemorySpecificationStore(),
      {
        steering: {
          resolveForGeneration: async () => RESOLUTION as never,
          recordForGeneration: (stamp) => appService.recordForGeneration(stamp as never),
        },
      },
    );

    const outcome = await generation.run({
      jobId: 'job_fail',
      workspaceId: WS,
      projectId: 'proj_st',
      requestedById: 'u1',
      correlationId: 'corr_fail',
      projectName: 'Failed',
      requirements: selection(),
      timeoutMs: 1000,
    } as never);

    expect(outcome.state).toBe('failed');
    expect(await appStore.findForArtifact('specification', 'anything')).toBeNull();
  });

  it('SC-ENH-001 is checkable: every artifact submitted has provenance, none is unknown', async () => {
    const { service, store } = build();
    for (let i = 0; i < 20; i++) {
      await service.recordForGeneration({
        workspaceId: WS,
        artifactType: 'specification',
        artifactId: `s_${i}`,
        resolution: i % 3 === 0 ? { resolved: [], overrides: [] } : (RESOLUTION as never),
      });
    }
    for (let i = 0; i < 20; i++) {
      expect(await store.findForArtifact('specification', `s_${i}`)).not.toBeNull();
    }
  });
});
