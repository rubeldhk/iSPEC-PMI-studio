/**
 * T781 — the engine fails closed. `FR-DPE-050`, `SC-DPE-007`, `R-031-5`.
 *
 * *"When the engine is unreachable, 100% of governed actions are refused rather
 * than permitted."* And refused **with the reason recorded**: an outage that
 * leaves no trace is indistinguishable from a decision nobody asked for.
 *
 * Built from the composed application's own repository, audit sink and policy
 * source — only the steering source is replaced, by one that fails the way an
 * unreachable `EPIC-019` would. Fifty low-band actions that would otherwise
 * auto-execute are attempted; all fifty are refused and stored, explained.
 */
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import type { AuditSink } from '@pmi/decision-contract';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';
import { DecisionEngine } from '../../src/modules/decision/evaluator.js';
import {
  DECISION_AUDIT_SINK,
  DECISION_POLICY_SOURCE,
  DECISION_REPOSITORY,
} from '../../src/modules/decision/decision.tokens.js';
import type { DecisionRepository } from '../../src/modules/decision/decision.repository.js';
import type { PolicySource } from '../../src/modules/decision/policy.loader.js';

const WS = 'ws_t781';
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

suite('T781 · SC-DPE-007 — an unreachable rule source refuses every governed action', () => {
  let harness: AuthenticatedApp;
  let app: INestApplication;

  beforeAll(async () => {
    harness = await startAuthenticatedApp({ prefix: 'v1', workspaceId: WS });
    app = harness.app;
  }, 300_000);

  afterAll(async () => {
    await harness?.close();
  }, 120_000);

  it('refuses 50 of 50, accepts none, and records every refusal with its reason', async () => {
    const repository = app.get<DecisionRepository>(DECISION_REPOSITORY, { strict: false });
    const engine = new DecisionEngine({
      steering: { rulesetFor: async () => { throw new Error('ECONNREFUSED steering'); } },
      policies: app.get<PolicySource>(DECISION_POLICY_SOURCE, { strict: false }),
      gates: null,
      audit: app.get<AuditSink>(DECISION_AUDIT_SINK, { strict: false }),
      repository,
    });

    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        engine.decide({
          workspaceId: WS,
          projectId: 'p1',
          actionType: 'docs.publish',
          target: { type: 'doc', id: `d-${i}` },
          objectVersion: '1',
          actor: { kind: 'human', id: harness.userId },
          requiredGates: [],
        }),
      ),
    );

    expect(results.filter((r) => r.outcome !== 'refused')).toEqual([]);
    for (const r of results) expect(r.explanation.constraintCited).toMatch(/fail closed.*ECONNREFUSED.*FR-DPE-050/);

    const stored = await repository.list(WS);
    expect(stored).toHaveLength(50);
    expect(stored.every((d) => d.outcome === 'refused' && d.explanation.constraintCited?.includes('FR-DPE-050'))).toBe(true);
  }, 120_000);
});
