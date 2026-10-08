/**
 * T860e — `EPIC-015` as a producer, through the composed application.
 * `FR-EVS-050`, `SC-EVS-005`, `R-032-6`.
 *
 * An existing `EPIC-015` validation run — the report it already wrote — lands as
 * an in-toto `test-result/v0.1` attestation and satisfies a Contract item, with
 * **nothing re-run by this Epic**: the report is a fixture, read and converted,
 * and `evidence-no-review-engine.spec.ts` asserts the module could not run a
 * suite if it tried. `SC-EVS-005`: a tool satisfies an item with **zero**
 * analysis performed by PMI Studio.
 *
 * And the converse, which the bare `predicateType` match would have missed: a
 * report with a failed test lands as `FAILED`, and a `FAILED` test result does
 * not satisfy *"automated tests pass"* (`BR-0144`, `DEF-032-004`).
 */
import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';
import {
  contributionFromVitestReport,
  type VitestJsonReport,
} from '../../src/modules/evidence/qa-suite.producer.js';

const PREFIX = 'v1';
const here = dirname(fileURLToPath(import.meta.url));
const REPORT = JSON.parse(
  readFileSync(resolve(here, '../fixtures/evidence/epic-015-vitest-report.json'), 'utf8'),
) as VitestJsonReport;
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

suite('T860e · an EPIC-015 run satisfies a Contract item, re-running nothing', () => {
  let harness: AuthenticatedApp;
  let app: INestApplication;
  let cookie = '';

  const context = (id: string) => ({
    subject: { name: 'repository', digest: { gitCommit: 'b'.repeat(40) } },
    attestedArtifact: { id: 'repo-main', version: 7 },
    attachedTo: { type: 'task' as const, id },
    projectId: 'p_t860e',
    producedAt: new Date('2026-10-07T08:00:00Z'),
    configuration: 'vitest.workspace.ts',
  });

  async function bindAndContribute(id: string, report: VitestJsonReport) {
    const bound = await request(app.getHttpServer())
      .post(`/${PREFIX}/evidence/bindings`)
      .set('Cookie', cookie)
      .send({
        workRef: { type: 'task', id },
        workClass: 'defect-repair',
        projectId: 'p_t860e',
        subject: { type: 'repository', id: 'repo-main', version: 7 },
      });
    expect(bound.status, JSON.stringify(bound.body)).toBe(201);
    const contributed = await request(app.getHttpServer())
      .post(`/${PREFIX}/evidence`)
      .set('Cookie', cookie)
      .send(contributionFromVitestReport(report, context(id)));
    expect(contributed.status, JSON.stringify(contributed.body)).toBe(201);
    return request(app.getHttpServer()).get(`/${PREFIX}/evidence/task:${id}/status`).set('Cookie', cookie);
  }

  beforeAll(async () => {
    harness = await startAuthenticatedApp({ prefix: PREFIX, workspaceId: 'ws_t860e' });
    app = harness.app;
    cookie = harness.cookie;
  }, 300_000);

  afterAll(async () => {
    await harness?.close();
  }, 120_000);

  it('lands a passing run as a PASSED test-result that meets both test items of defect-repair', async () => {
    const status = await bindAndContribute('D-pass', REPORT);
    expect(status.status).toBe(200);
    expect(status.body.items.map((i: { itemId: string; state: string }) => [i.itemId, i.state])).toEqual([
      ['defect-test-passes', 'met'],
      ['regression-pass', 'met'],
    ]);
    expect(status.body.satisfied).toBe(true);
  });

  it('lands a run with a failed test as FAILED, which meets nothing (BR-0144)', async () => {
    const failing: VitestJsonReport = {
      ...REPORT,
      success: false,
      numFailedTests: 1,
      testResults: [
        { name: 'e2e/tests/full-journey.spec.ts', assertionResults: [{ fullName: 'T145 · journey', status: 'failed' }] },
      ],
    };
    const status = await bindAndContribute('D-fail', failing);
    expect(status.body.satisfied).toBe(false);
    expect(status.body.unmet).toEqual(['defect-test-passes', 'regression-pass']);
    expect(status.body.items[0].reason).toMatch(/reports a failure/);
  });
});
