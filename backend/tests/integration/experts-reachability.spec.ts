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

  it('T2023 · exports and resolves EXPERT_PROVENANCE for EPIC-048 (A-047-2, FR-EXP-064)', async () => {
    const { ExpertsModule } = await import('../../src/modules/experts/experts.module.js');
    const { EXPERT_PROVENANCE } = await import('../../src/modules/experts/provenance.js');
    expect(Reflect.getMetadata('exports', ExpertsModule)).toContain(EXPERT_PROVENANCE);
    const provenance = app.select(ExpertsModule).get(EXPERT_PROVENANCE, { strict: false }) as { forExecution: unknown };
    expect(typeof provenance.forExecution).toBe('function');
  });

  describe('Phase 9 · T1978, T1980, T1982 — three ports bound to their owners as composed', () => {
    const ports = async () => {
      const { ExpertsModule } = await import('../../src/modules/experts/experts.module.js');
      const { EXPERT_PORTS } = await import('../../src/modules/experts/experts.tokens.js');
      return app.select(ExpertsModule).get(EXPERT_PORTS, { strict: false }) as import('../../src/modules/experts/experts.tokens.js').ExpertPorts;
    };

    it("EvidenceContracts answers from EPIC-032's catalog: a shipped contract exists, an unknown one does not", async () => {
      const { evidence } = await ports();
      await expect(evidence.exists({ workClass: 'task-completion', contractVersion: 1 })).resolves.toBe(true);
      await expect(evidence.exists({ workClass: 'implementation', contractVersion: 1 })).resolves.toBe(false);
    });

    it("ContractApprovals is EPIC-031's engine: with no audit writer it refuses on EPIC-031's terms, not the unbound port's", async () => {
      // No database here, so EPIC-004's audit writer is unconfigured and EPIC-031
      // refuses a decision it cannot record (FR-DPE-016, FR-033). That refusal is
      // the proof of wiring: the unbound port would have named itself instead.
      // The decided-and-read-back path runs against PostgreSQL in
      // experts-registry-route.spec.ts.
      const { approvals } = await ports();
      const submission = approvals.submit({
        workspaceId: 'ws_reach',
        actionType: 'expert-contract.approve',
        targetType: 'expert-contract-version',
        targetId: 'cv_reach',
        objectVersion: 1,
        riskClass: 'low',
        actorId: 'u_reach',
      });
      await expect(submission).rejects.toThrow(/Audit persistence is not configured/);
      await expect(submission).rejects.not.toThrow(/ContractApprovals is not bound/);
    });

    it("ContextAssembler is EPIC-038's assembly: it binds, and its refusals are EPIC-038's own, not the unbound port's", async () => {
      const { context } = await ports();
      expect(context.bind).toBeTypeOf('function');
      const attempt = context.assemble({
        workspaceId: 'ws_reach',
        projectId: 'pr_reach',
        objective: 'reachability',
        actorId: 'u_reach',
        actorRole: 'engineer',
        policy: { budgetTokens: 1000, budgetCost: 1, includeLiveState: false },
      });
      await attempt.then(
        () => undefined,
        (error: unknown) => expect(String((error as Error).message)).not.toMatch(/ContextAssembler is not bound/),
      );
    });

    it('T2564 · ExpertExecutions is the identity adapter over EPIC-037, not the refusing port (DEF-047-001)', async () => {
      // No database here, so only what the adapter decides before it touches one
      // is observable: a command that is not governed is refused by the adapter
      // itself. The refusing port would have named itself instead.
      const { executions } = await ports();
      const attempt = executions.register({
        workspaceId: 'ws_reach',
        projectId: 'pr_reach',
        command: 'deploy',
        actorId: 'u_reach',
        expertKey: 'reach',
        contractVersion: 1,
        model: 'model-a',
        objective: 'reachability',
      });
      await expect(attempt).rejects.toThrow(/not a governed command.*R-047-3/);
      await expect(attempt).rejects.not.toThrow(/ExpertExecutions is not bound/);
    });

    it('T2566 · ExpertGateways refuses naming DEF-047-002 — no agent runtime is composed into the API', async () => {
      const { gateways } = await ports();
      await expect(gateways.gatewaysFor('any-model')).rejects.toThrow(/ExpertGateways is not bound.*DEF-047-002/);
    });
  });
});
