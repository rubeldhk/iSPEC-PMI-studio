/**
 * T862a — the gate fails closed when the store cannot be reached.
 * `FR-EVS-035`, `SC-EVS-009`, `R-032-5`.
 *
 * *"When the evidence store is unreachable, 100% of completion attempts are
 * refused and zero are accepted."* An unreachable store means the Contract
 * cannot be evaluated, and an unevaluated Contract is not a satisfied one.
 *
 * Two layers, each tested on its own, because each would hide the other:
 *
 * 1. **A real outage.** The composed application's own `CompletionGate` — the
 *    instance `EvidenceModule` builds — is asked to complete work whose evidence
 *    *is* sufficient, after the PostgreSQL container has been stopped. Nothing is
 *    mocked: the store is genuinely gone. Driven below HTTP because the session
 *    is validated against the same database, so an HTTP request would be refused
 *    by authentication before it reached the gate and would prove nothing about
 *    the gate.
 * 2. **Reads fail, writes succeed.** The gate must refuse on an unreadable store
 *    even where the refusal can be recorded — otherwise layer 1 passes only
 *    because recording the acceptance also failed. `T862d`'s mutation targets this.
 */
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { predicateTypeFor } from '@pmi/evidence-contract';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';
import { CompletionGate } from '../../src/modules/evidence/completion.gate.js';
import { EVIDENCE_CATALOG } from '../../src/modules/evidence/evidence.tokens.js';
import type { ContractCatalog } from '../../src/modules/evidence/contract.loader.js';
import { InMemoryEvidenceRepository } from '../../src/modules/evidence/evidence.repository.js';

const PREFIX = 'v1';
const WS = 'ws_t862a';
const work = { type: 'task', id: 'T-862a' } as const;
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

suite('T862a · SC-EVS-009 — an unreachable store refuses every completion', () => {
  let harness: AuthenticatedApp;
  let app: INestApplication;

  beforeAll(async () => {
    harness = await startAuthenticatedApp({ prefix: PREFIX, workspaceId: WS });
    app = harness.app;
    const send = (route: string, body: unknown) =>
      request(app.getHttpServer()).post(`/${PREFIX}/evidence${route}`).set('Cookie', harness.cookie).send(body as object);

    // Work whose Contract IS satisfied while the store is up — so a refusal
    // below can only be the outage, never missing evidence.
    expect(
      (
        await send('/bindings', {
          workRef: work,
          workClass: 'task-completion',
          projectId: 'p1',
          subject: { type: 'file', id: 'a1', version: 1 },
        })
      ).status,
    ).toBe(201);
    for (const kind of ['test-result', 'approval'] as const) {
      const res = await send('', {
        attestation: {
          _type: 'https://in-toto.io/Statement/v1',
          subject: [{ name: 'a1', digest: { gitCommit: 'c'.repeat(40) } }],
          predicateType: predicateTypeFor(kind),
          predicate: { result: 'PASSED' },
        },
        attestedArtifact: { id: 'a1', version: 1 },
        attachedTo: work,
        producedAt: '2026-10-07T00:00:00Z',
        source: { uri: 'pmi:qa-suite' },
        projectId: 'p1',
      });
      expect(res.status, JSON.stringify(res.body)).toBe(201);
    }
  }, 300_000);

  afterAll(async () => {
    await app?.close();
  }, 120_000);

  it('would accept while the store is reachable — the control', async () => {
    const evaluation = await app.get(CompletionGate, { strict: false }).evaluate(WS, work);
    expect(evaluation.evaluated && evaluation.status.satisfied).toBe(true);
  });

  it('layer 1 — refuses 100% of 50 attempts, accepting none, once PostgreSQL is gone', async () => {
    await harness.container.stop();
    const gate = app.get(CompletionGate, { strict: false });
    const results = await Promise.all(Array.from({ length: 50 }, () => gate.complete(WS, work, 'agent:x')));
    expect(results.filter((r) => r.ok)).toHaveLength(0);
    for (const r of results) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.unmet[0]).toMatch(/could not be reached|could not be recorded/);
    }
  }, 120_000);

  it('layer 2 — refuses on an unreadable store even where the refusal can be recorded', async () => {
    const repository = new InMemoryEvidenceRepository();
    const unreadable = Object.assign(Object.create(repository) as InMemoryEvidenceRepository, {
      attachedTo: async () => {
        throw new Error('connection refused');
      },
    });
    await repository.appendBinding({
      workspaceId: WS,
      projectId: 'p1',
      workRef: work,
      workClass: 'task-completion',
      contractVersion: 1,
      subjectArtifactType: 'file',
      subjectArtifactId: 'a1',
      subjectVersion: 1,
    });
    const gate = new CompletionGate(unreadable, app.get<ContractCatalog>(EVIDENCE_CATALOG, { strict: false }), null);
    const results = await Promise.all(Array.from({ length: 50 }, () => gate.complete(WS, work, 'agent:x')));
    expect(results.every((r) => !r.ok)).toBe(true);
    const attempts = await repository.attempts(WS, work);
    expect(attempts).toHaveLength(50);
    expect(attempts.every((a) => a.outcome === 'refused')).toBe(true);
  });
});
