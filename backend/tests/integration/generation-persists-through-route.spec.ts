/**
 * `T1383` (EPIC-041) — a generation submitted through the real route is
 * consumed by the real worker path and survives a restart.
 *
 * `SC-LPW-008`, `FR-LPW-040`, `FR-LPW-042`; Constitution XI Tier 1. Added for
 * analysis finding `C1`: `T1320` proves the worker's persistence function and
 * `T1332` proves the stores, and nothing proved a user's submission reached
 * either. This is milestone `M0`'s own proof.
 *
 * **Zero hand-assembled composition.** The API is the real `AppModule` with
 * `DATABASE_URL` and `VALKEY_URL` set the way an operator sets them. The queue is
 * a real Valkey. The consumer is a real BullMQ `Worker` bound to the same queue
 * name, whose processor is the runner `@pmi/backend/worker-api` exports — the
 * exact code `worker/src/main.ts` runs — with the fixture engine supplied the
 * way the worker's composition root supplies one. Then the application is
 * disposed, a second is booted, and everything is read back through the routes.
 *
 * This file imports an engine adapter, which `backend/**` may not do. It is
 * exempted by name in `eslint.config.js`, for the reason `engine-swap.spec.ts`
 * is: a test that proves the API-to-worker path cannot be written without an
 * engine on the worker's side of it. The production boundary is unaffected.
 *
 * Written to FAIL before `T1321`, `T1325`, `T1329` exist.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { Worker } from 'bullmq';
import { FixtureEngine } from '@pmi/engine-adapter-fixture';
import { rebootApp, startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let valkey: StartedTestContainer;
let started: AuthenticatedApp;
let worker: Worker | undefined;

beforeAll(async () => {
  if (noRuntime) return;
  valkey = await new GenericContainer('valkey/valkey:7-alpine').withExposedPorts(6379).start();
  const valkeyUrl = `redis://${valkey.getHost()}:${valkey.getMappedPort(6379)}`;
  // Set BEFORE the composition root runs — where production learns it too.
  process.env['VALKEY_URL'] = valkeyUrl;

  started = await startAuthenticatedApp({
    workspaceId: 'ws_route',
    userId: 'u_route',
    seed: async (db) => {
      // The API resolves engines from what the worker recorded (T1321): a
      // descriptor-only registration. The fixture's own descriptor, verbatim.
      await db.query(
        `INSERT INTO "engine_registrations" ("id","name","version","capabilities","isDefault","updatedAt")
         VALUES ('er_fixture','fixture','fixture-1.0.0+model=none',
                 ARRAY['generate_specification','generate_tasks','validate_specification'], true, now())`,
      );
    },
  });

  // The consumer: the same runner worker/src/main.ts uses, on the same queue.
  const { createGenerationRunner } = await import('../../src/worker-api.js');
  const { GENERATION_QUEUE_NAME } = await import('../../src/modules/jobs/jobs.module.js');
  const runner = createGenerationRunner({ resolveEngine: () => new FixtureEngine() });
  worker = new Worker(
    GENERATION_QUEUE_NAME,
    async (job) => runner.run((job.data as { jobId: string }).jobId, { timeoutMs: 30_000 }),
    { connection: { url: valkeyUrl } },
  );
  await worker.waitUntilReady();
}, 600_000);

afterAll(async () => {
  await worker?.close();
  await started?.close();
  await valkey?.stop();
  delete process.env['VALKEY_URL'];
}, 120_000);

interface JobShape {
  state: string;
  failureReason: string | null;
  resultRef: string | null;
}

async function until<T>(fn: () => Promise<T>, done: (v: T) => boolean, ms = 30_000): Promise<T> {
  const deadline = Date.now() + ms;
  let last: T;
  do {
    last = await fn();
    if (done(last)) return last;
    await new Promise((r) => setTimeout(r, 250));
  } while (Date.now() < deadline);
  return last;
}

suite('T1383 · POST → queue → worker → PostgreSQL → restart → GET', () => {
  it('persists a generation submitted from the route and reads it back after a restart', async () => {
    const api = started.app.getHttpServer();
    const cookie = started.cookie;

    const project = await request(api).post('/v1/projects').set('Cookie', cookie).send({ name: 'Route' }).expect(201);
    const projectId = project.body.id as string;

    const reqIds: string[] = [];
    for (const [ref, description] of [
      ['R1', 'A user can create a project'],
      ['R2', 'A project owns a directory'],
    ]) {
      const r = await request(api)
        .post(`/v1/projects/${projectId}/requirements`)
        .set('Cookie', cookie)
        .send({ reference: ref, description, type: 'functional', priority: 'p1' })
        .expect(201);
      reqIds.push(r.body.id as string);
    }

    const submitted = await request(api)
      .post(`/v1/projects/${projectId}/jobs/generate-specification`)
      .set('Cookie', cookie)
      .send({ requirementIds: reqIds })
      .expect(202);
    const jobId = submitted.body.id as string;
    expect(submitted.body.state).toBe('queued');

    const finished = await until(
      async (): Promise<JobShape> => (await request(api).get(`/v1/jobs/${jobId}`).set('Cookie', cookie).expect(200)).body as JobShape,
      (b) => !['queued', 'running'].includes(b.state),
    );
    expect(finished.state, `job ended as ${finished.state} (${finished.failureReason ?? 'no reason'})`).toBe('succeeded');
    expect(finished.resultRef).toBeTruthy();

    // Restart.
    await started.app.close();
    const second = await rebootApp(started.databaseUrl, { workspaceId: started.workspaceId, userId: started.userId });
    try {
      const api2 = second.app.getHttpServer();
      const job = await request(api2).get(`/v1/jobs/${jobId}`).set('Cookie', second.cookie).expect(200);
      expect(job.body).toMatchObject({ state: 'succeeded', resultRef: finished.resultRef });

      const spec = await request(api2).get(`/v1/specifications/${finished.resultRef}`).set('Cookie', second.cookie).expect(200);
      expect(spec.body.title).toBeTruthy();
      expect(spec.body.engineName).toBe('fixture');

      const versions = await request(api2)
        .get(`/v1/specifications/${finished.resultRef}/versions`)
        .set('Cookie', second.cookie)
        .expect(200);
      expect(versions.body).toHaveLength(1);

      // SC-002 — linked to EVERY selected requirement, still, after the restart.
      // The trace answers in requirement ids. Before T1325 bound the link store
      // to PostgreSQL it answered [] here, with the links sitting in the table.
      const trace = await request(api2)
        .get(`/v1/specifications/${finished.resultRef}/trace`)
        .set('Cookie', second.cookie)
        .expect(200);
      const traced = trace.body as { requirementIds: string[] };
      expect(traced.requirementIds.sort()).toEqual([...reqIds].sort());
    } finally {
      await second.app.close();
    }
  });
});
