/**
 * T736 — Constitution XI Tier 1 for the decision engine (`R-031-7`).
 *
 * Imports the real `AppModule` (`startAuthenticatedApp` calls
 * `NestFactory.create(AppModule)`, literally what `main.ts` does) and drives a
 * decision through every real route: decide, refuse with `409`, approve, read
 * the explanation, see the Inbox, read the metrics, issue a tenant policy. No
 * service is called directly and nothing is mocked.
 *
 * `T785`'s mutation proof targets this file: removing `DecisionModule` from
 * `app.module.ts` must turn it red.
 */
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';
import { DecisionService } from '../../src/modules/decision/decision.service.js';

const PREFIX = 'v1';
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

suite('T736 · the decision engine is reachable through the composed application (XI Tier 1)', () => {
  let harness: AuthenticatedApp;
  let app: INestApplication;
  let cookie = '';
  const post = (path: string, body: unknown = {}) =>
    request(app.getHttpServer()).post(`/${PREFIX}${path}`).set('Cookie', cookie).send(body as object);
  const get = (path: string) => request(app.getHttpServer()).get(`/${PREFIX}${path}`).set('Cookie', cookie);

  beforeAll(async () => {
    harness = await startAuthenticatedApp({ prefix: PREFIX, workspaceId: 'ws_t736' });
    app = harness.app;
    cookie = harness.cookie;
  }, 300_000);

  afterAll(async () => {
    await harness?.close();
  }, 120_000);

  it('resolves DecisionService from the graph the application builds', () => {
    expect(app.get(DecisionService, { strict: false })).toBeInstanceOf(DecisionService);
  });

  it.each([
    ['post', '/decisions'],
    ['post', '/decisions/probe/approve'],
    ['post', '/decisions/probe/refuse'],
    ['post', '/decisions/probe/exceptions'],
    ['get', '/decisions/probe/explanation'],
    ['get', '/decision-metrics'],
    ['get', '/inbox'],
    ['get', '/decision-objects/probe/probe/decisions'],
    ['get', '/decision-policies/current'],
    ['post', '/decision-policies'],
  ] as const)('routes %s %s — a handler answers', async (method, path) => {
    const unmatched = await get('/decisions/probe/not-a-real-sub-resource');
    const response = method === 'get' ? await get(path) : await post(path, {});
    const code = (response.body as { error?: { code?: string } })?.error?.code;
    expect(code).not.toBe('internal_error');
    expect(response.body, `${path} answered exactly as an unmatched route does`).not.toEqual(unmatched.body);
  });

  describe('a decision, end to end over HTTP', () => {
    let pendingId = '';

    it('holds a high-band action pending, with its explanation (FR-DPE-010, FR-DPE-040)', async () => {
      const res = await post('/decisions', {
        actionType: 'release.promote',
        target: { type: 'release', id: 'r-1' },
        projectId: 'p_t736',
        objectVersion: '4',
      });
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      expect(res.body).toMatchObject({ outcome: 'pending', effectiveClass: 'high' });
      expect(res.body.explanation.constraintCited).toMatch(/FR-DPE-012/);
      pendingId = res.body.decisionId;
    });

    it('refuses the requester approving their own request with 403, carrying the reason (FR-DPE-015)', async () => {
      const res = await post(`/decisions/${pendingId}/approve`);
      expect(res.status).toBe(403);
      expect(res.body.error.details.result.explanation.authorityApplied).toMatch(/FR-DPE-015/);
    });

    it('refuses a policy that lowers the high band with 400, naming the actions (FR-DPE-012)', async () => {
      const res = await post('/decision-policies', {
        bandTreatment: { low: 'auto-execute', medium: 'gates-required', high: 'auto-execute' },
        selfApprovalAllowed: [],
        automatedActions: [],
      });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/release\.promote/);
    });

    it('leaves the refused attempt visible in the audit log, naming the fence (T796b)', async () => {
      // The route probe above posted an empty policy, which is refused (and audited) as malformed.
      const res = await get('/audit?targetType=tenant_policy');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ targetId: 'v1', outcome: 'refused', detail: expect.objectContaining({ reason: 'lowers-high-band' }) }),
        ]),
      );
    });

    it('issues a policy permitting self-approval for releases, as version 1 (FR-DPE-011)', async () => {
      const res = await post('/decision-policies', {
        bandTreatment: { low: 'auto-execute', medium: 'gates-required', high: 'human-approval' },
        selfApprovalAllowed: ['release.*'],
        automatedActions: [],
      });
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      expect(res.body.version).toBe(1);
      expect((await get('/decision-policies/current')).body.version).toBe(1);
    });

    it('now approves, and says self-approval was permitted (FR-DPE-014, FR-DPE-015)', async () => {
      const res = await post(`/decisions/${pendingId}/approve`);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body.outcome).toBe('approved');
      expect(res.body.explanation.authorityApplied).toMatch(/self-approval permitted by policy v1/);
    });

    it('reads the original explanation back, renderable without a second lookup (FR-DPE-043)', async () => {
      const res = await get(`/decisions/${pendingId}/explanation`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ outcome: 'pending', effectiveClass: 'high', resolvedBy: expect.any(String) });
      expect(res.body.explanation).toMatchObject({ policyVersion: '0', riskClass: 'high', matchedRule: null });
    });

    it('reads both decisions back from the object itself, not only by id (FR-DPE-024, T796a)', async () => {
      const res = await get('/decision-objects/release/r-1/decisions');
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body.decisions).toEqual([
        expect.objectContaining({ decisionId: pendingId, outcome: 'pending', resolvedBy: expect.any(String) }),
        expect.objectContaining({ outcome: 'approved', resolves: pendingId }),
      ]);
    });

    it('refuses an action whose gate nobody can evaluate with 409, carrying the decision (FR-DPE-013)', async () => {
      const res = await post('/decisions', {
        actionType: 'deploy',
        target: { type: 'service', id: 's-1' },
        projectId: 'p_t736',
        objectVersion: '1',
        requiredGates: ['tests-green'],
      });
      expect(res.status).toBe(409);
      expect(res.body.error.details.result.gateOutcomes).toEqual([
        expect.objectContaining({ gateId: 'tests-green', result: 'violation' }),
      ]);
    });

    it('shows the blocked request in the requester’s Inbox, naming the gate (FR-DPE-025)', async () => {
      const res = await get('/inbox');
      expect(res.status).toBe(200);
      const blocked = (res.body.entries as Array<{ kind: string; blockedBy: string }>).find((e) => e.kind === 'blocked');
      expect(blocked?.blockedBy).toMatch(/tests-green/);
    });

    it('reports the band distribution and the auto-execution rate (FR-DPE-033)', async () => {
      const res = await get('/decision-metrics');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ decisions: 2, bandDistribution: { high: 2 }, autoExecutionRate: 0 });
    });
  });

  describe('T2509 · FR-DPE-017 — closing a pending decision over HTTP', () => {
    let pendingId = '';

    it('holds a second release pending', async () => {
      const res = await post('/decisions', {
        actionType: 'release.promote',
        target: { type: 'release', id: 'r-2' },
        projectId: 'p_t736',
        objectVersion: '2',
      });
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      pendingId = res.body.decisionId;
    });

    it('refuses a closure with no reason with 400', async () => {
      const res = await post(`/decisions/${pendingId}/refuse`, { kind: 'withdrawn', reason: ' ' });
      expect(res.status).toBe(400);
    });

    it('refuses the requester rejecting their own request with 403, carrying the reason, and leaves it pending', async () => {
      const res = await post(`/decisions/${pendingId}/refuse`, { kind: 'rejected', reason: 'changed my mind' });
      expect(res.status).toBe(403);
      expect(res.body.error.details.result.explanation.authorityApplied).toMatch(/withdraw it instead/);
      const audit = await get('/audit?targetType=policy_decision');
      expect(audit.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ targetId: pendingId, outcome: 'refused', detail: expect.objectContaining({ decisionOutcome: 'closure-refused' }) }),
        ]),
      );
      expect((await get(`/decisions/${pendingId}/explanation`)).body.resolvedBy).toBeNull();
    });

    it('records the requester withdrawing it, as refused with its kind and reason', async () => {
      const res = await post(`/decisions/${pendingId}/refuse`, { kind: 'withdrawn', reason: 'superseded by r-3' });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body).toMatchObject({
        outcome: 'refused',
        explanation: { closure: { kind: 'withdrawn', reason: 'superseded by r-3' } },
      });
    });

    it('refuses closing it a second time with 409', async () => {
      const res = await post(`/decisions/${pendingId}/refuse`, { kind: 'withdrawn', reason: 'again' });
      expect(res.status).toBe(409);
    });

    it('reads the closure back from the object, and the Inbox does not show it as blocked', async () => {
      const history = await get('/decision-objects/release/r-2/decisions');
      expect(history.body.decisions).toEqual([
        expect.objectContaining({ decisionId: pendingId, outcome: 'pending', resolvedBy: expect.any(String) }),
        expect.objectContaining({
          outcome: 'refused',
          resolves: pendingId,
          explanation: expect.objectContaining({ closure: { kind: 'withdrawn', reason: 'superseded by r-3' } }),
        }),
      ]);
      const inbox = (await get('/inbox')).body.entries as Array<{ objectRef: { id: string } }>;
      expect(inbox.filter((e) => e.objectRef.id === 'r-2')).toEqual([]);
    });
  });
});
