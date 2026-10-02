/**
 * `T1331` (EPIC-041) — the composed graph resolves durable stores.
 *
 * `FR-LPW-041`, `FR-LPW-043`; Constitution XI Tier 1. `T1330` reads the
 * composition roots and asserts intent. This boots the real `AppModule` against
 * a real PostgreSQL and asserts behaviour: every store token PMI-DOC-004B §2.1
 * found in memory resolves, through DI, to its Prisma implementation. Source
 * inspection is exactly the evidence that let `DEF-001-005` through, which is
 * why both halves exist.
 *
 * Written to FAIL before `T1325`, `T1327`, `T1329` exist.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let started: AuthenticatedApp;

beforeAll(async () => {
  if (noRuntime) return;
  started = await startAuthenticatedApp({ workspaceId: 'ws_durable', userId: 'u_durable' });
}, 600_000);

afterAll(async () => {
  await started?.close();
}, 120_000);

suite('T1331 · the composed application binds Prisma stores under DATABASE_URL', () => {
  it('TASK_STORE is a PrismaTaskStore', async () => {
    const { TASK_STORE } = await import('../../src/modules/tasks/tasks.module.js');
    const { PrismaTaskStore } = await import('../../src/modules/tasks/tasks.store.prisma.js');
    expect(started.app.get(TASK_STORE, { strict: false })).toBeInstanceOf(PrismaTaskStore);
  });

  it('the four run-side stores are Prisma stores', async () => {
    const runs = await import('../../src/modules/runs/runs.module.js');
    const prisma = await import('../../src/modules/runs/runs.store.prisma.js');
    expect(started.app.get(runs.RUN_STORE, { strict: false })).toBeInstanceOf(prisma.PrismaRunStore);
    expect(started.app.get(runs.QUESTION_STORE, { strict: false })).toBeInstanceOf(prisma.PrismaQuestionStore);
    expect(started.app.get(runs.MARKING_STORE, { strict: false })).toBeInstanceOf(prisma.PrismaMarkingStore);
    expect(started.app.get(runs.OVERRIDE_STORE, { strict: false })).toBeInstanceOf(prisma.PrismaOverrideStore);
  });

  it('GENERATION_JOB_LEDGER is a PrismaGenerationJobLedger', async () => {
    const { GENERATION_JOB_LEDGER } = await import('../../src/modules/specifications/specifications.module.js');
    const { PrismaGenerationJobLedger } = await import(
      '../../src/modules/specifications/generation-job.ledger.prisma.js'
    );
    expect(started.app.get(GENERATION_JOB_LEDGER, { strict: false })).toBeInstanceOf(PrismaGenerationJobLedger);
  });

  it('TRACEABILITY_LINK_STORE is a PrismaTraceabilityLinkStore', async () => {
    const { TRACEABILITY_LINK_STORE } = await import('../../src/modules/traceability/traceability.module.js');
    const { PrismaTraceabilityLinkStore } = await import(
      '../../src/modules/traceability/traceability-link.store.prisma.js'
    );
    expect(started.app.get(TRACEABILITY_LINK_STORE, { strict: false })).toBeInstanceOf(PrismaTraceabilityLinkStore);
  });

  it('JOB_STORE is a PrismaJobStore', async () => {
    const { JOB_STORE } = await import('../../src/modules/jobs/jobs.module.js');
    const { PrismaJobStore } = await import('../../src/modules/jobs/job.store.js');
    expect(started.app.get(JOB_STORE, { strict: false })).toBeInstanceOf(PrismaJobStore);
  });
});
