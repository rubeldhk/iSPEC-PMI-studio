/**
 * T786 — the `R-031-6` targets, measured through the composed application on
 * PostgreSQL.
 *
 * | Measure | Target |
 * |---|---|
 * | decide, excluding gate providers | p95 < 40 ms |
 * | end to end — `POST /v1/decisions` over HTTP | p95 < 120 ms |
 * | Inbox read at **500 open items** | p95 < 250 ms |
 * | throughput per workspace | ≥ 50 decisions / second |
 *
 * "Decide" is the application's own `DecisionEngine` — real steering, real
 * Prisma repository, real `EPIC-004` audit — with no `GateProvider`, as the
 * target says. The figures are printed so the closing report records what was
 * measured, not that a test passed. Developer machine, Testcontainers
 * PostgreSQL; a CI runner is noisier, so the thresholds are the targets.
 */
import 'reflect-metadata';
import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';
import { DecisionEngine } from '../../src/modules/decision/evaluator.js';

const WS = 'ws_t786';
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;
const figures: Record<string, number> = {};

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]!;
}

suite('T786 · R-031-6 — the decision engine meets its performance targets', () => {
  let harness: AuthenticatedApp;
  let app: INestApplication;
  let engine: DecisionEngine;
  let n = 0;
  const decision = (actionType = 'release.promote') => ({
    workspaceId: WS,
    projectId: 'p1',
    actionType,
    target: { type: 'release', id: `r-${(n += 1)}` },
    objectVersion: '1',
    actor: { kind: 'human' as const, id: harness.userId },
    requestedBy: 'someone-else',
    requiredGates: [],
  });

  beforeAll(async () => {
    harness = await startAuthenticatedApp({ prefix: 'v1', workspaceId: WS });
    app = harness.app;
    engine = app.get(DecisionEngine, { strict: false });
  }, 300_000);

  afterAll(async () => {
    console.log('[T786] measured (ms, or decisions/s):', JSON.stringify(figures));
    await harness?.close();
  }, 120_000);

  it('decides at p95 < 40 ms, excluding gate providers', async () => {
    for (let i = 0; i < 10; i += 1) await engine.decide(decision()); // warm
    const samples: number[] = [];
    for (let i = 0; i < 100; i += 1) {
      const t = performance.now();
      await engine.decide(decision());
      samples.push(performance.now() - t);
    }
    figures['decide'] = p95(samples);
    expect(figures['decide']).toBeLessThan(40);
  }, 120_000);

  it('answers POST /v1/decisions end to end at p95 < 120 ms', async () => {
    const samples: number[] = [];
    for (let i = 0; i < 60; i += 1) {
      const t = performance.now();
      const res = await request(app.getHttpServer())
        .post('/v1/decisions')
        .set('Cookie', harness.cookie)
        .send({ actionType: 'release.promote', target: { type: 'release', id: `h-${i}` }, projectId: 'p1', objectVersion: '1' });
      samples.push(performance.now() - t);
      expect(res.status).toBe(201);
    }
    figures['endToEnd'] = p95(samples);
    expect(figures['endToEnd']).toBeLessThan(120);
  }, 120_000);

  it('reads the Inbox at p95 < 250 ms with 500 open items', async () => {
    // 500 open items THIS reader may approve — requested by someone else, so the
    // Inbox shows them (FR-DPE-015). Earlier tests' items are on top of these.
    for (let i = 0; i < 500; i += 1) await engine.decide(decision());
    const samples: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      const t = performance.now();
      const res = await request(app.getHttpServer()).get('/v1/inbox').set('Cookie', harness.cookie);
      samples.push(performance.now() - t);
      expect(res.status).toBe(200);
      expect(res.body.entries.length).toBeGreaterThanOrEqual(500);
    }
    figures['inbox500'] = p95(samples);
    expect(figures['inbox500']).toBeLessThan(250);
  }, 300_000);

  it('sustains at least 50 decisions per second in one workspace', async () => {
    const count = 200;
    const t = performance.now();
    await Promise.all(Array.from({ length: count }, () => engine.decide(decision())));
    figures['throughput'] = Math.round((count / (performance.now() - t)) * 1000);
    expect(figures['throughput']).toBeGreaterThanOrEqual(50);
  }, 120_000);
});
