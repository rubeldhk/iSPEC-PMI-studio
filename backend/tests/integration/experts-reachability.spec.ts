/**
 * `T1901` (EPIC-047) — the Experts module is reachable through the composed
 * application.
 *
 * Constitution XI Tier 1. Written before `T1902` creates the module, so it is
 * observed failing first (Constitution V). Composition, not persistence: no
 * database is started, so a storage fault cannot masquerade as a wiring one.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';

describe('T1901 · the Experts module is reachable through the composed application', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../../src/app.module.js');
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
  }, 300_000);

  afterAll(async () => {
    await app?.close();
  }, 60_000);

  it('registers ExpertsModule in the composition root', async () => {
    const { ExpertsModule } = await import('../../src/modules/experts/experts.module.js');
    expect(() => app.select(ExpertsModule)).not.toThrow();
  });

  it('resolves ExpertsService, which declares the engineering-experts area and no Room', async () => {
    const { ExpertsModule, ExpertsService } = await import('../../src/modules/experts/experts.module.js');
    const service = app.select(ExpertsModule).get(ExpertsService, { strict: false });
    expect(service).toBeInstanceOf(ExpertsService);
    // `FR-EXP-070` — a registry screen in its own area, not a governed Room.
    expect(service.area).toBe('engineering-experts');
    expect(service).not.toHaveProperty('workflowType');
  });

  // `T2579` — the three merged Epics' adapters are what the module binds, not
  // the refusing stand-ins: a refusing port rejects with
  // `GovernanceSeamUnboundError` naming itself; a bound one reaches its owner.
  it('T2579 · binds EPIC-031, EPIC-032 and EPIC-038 for real; only gateways and executions refuse', async () => {
    const { ExpertsModule } = await import('../../src/modules/experts/experts.module.js');
    const { EXPERT_PORTS } = await import('../../src/modules/experts/experts.tokens.js');
    const { GovernanceSeamUnboundError } = await import('../../src/core/errors.js');
    const ports = app.select(ExpertsModule).get(EXPERT_PORTS, { strict: false }) as import('../../src/modules/experts/experts.tokens.js').ExpertPorts;
    const unbound = async (call: () => Promise<unknown>) => (await call().then(() => null, (e: unknown) => e)) instanceof GovernanceSeamUnboundError;

    expect(await unbound(() => ports.approvals.resolutionOf('ws_reach', 'no-such-decision'))).toBe(false);
    expect(await unbound(() => ports.evidence.exists({ workClass: 'task-completion', contractVersion: 1 }))).toBe(false);
    expect(typeof ports.context.bind).toBe('function');
    expect(
      await unbound(() =>
        ports.context.assemble({
          workspaceId: 'ws_reach',
          projectId: 'p_reach',
          objective: 'reachability',
          actorId: 'u_reach',
          actorRole: 'engineer',
          policy: { budgetTokens: 1000, budgetCost: 1, includeLiveState: false },
        }),
      ),
    ).toBe(false);

    expect(await unbound(() => ports.gateways.gatewaysFor('any-model'))).toBe(true);
    expect(await unbound(() => ports.executions.eventsOf('ws_reach', 'e_reach'))).toBe(true);
  });

  it('T2023 · exports and resolves EXPERT_PROVENANCE for EPIC-048 (A-047-2, FR-EXP-064)', async () => {
    const { ExpertsModule } = await import('../../src/modules/experts/experts.module.js');
    const { EXPERT_PROVENANCE } = await import('../../src/modules/experts/provenance.js');
    expect(Reflect.getMetadata('exports', ExpertsModule)).toContain(EXPERT_PROVENANCE);
    const provenance = app.select(ExpertsModule).get(EXPERT_PROVENANCE, { strict: false }) as { forExecution: unknown };
    expect(typeof provenance.forExecution).toBe('function');
  });
});
