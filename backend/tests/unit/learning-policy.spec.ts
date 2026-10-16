/**
 * `T2322` (EPIC-048, `R-048-3`) — learning policy is an `EPIC-019` steering
 * document, subject `learning_policy`.
 *
 * - It parses into categories, `lowRisk`, reuse and the three defaults.
 * - A malformed document **refuses** — never read permissively.
 * - No document means no categories, so every submission is refused naming the
 *   missing policy (`FR-LRN-003`).
 * - `lowRisk` absent reads `false` (`FR-LRN-026`): nothing is low-risk unless
 *   the workspace said so.
 * - A new steering version **is** the policy change, with actor and instant
 *   (`FR-LRN-047`).
 */
import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../src/core/errors.js';
import { InMemorySteeringStore, SteeringService } from '../../src/modules/steering/steering.service.js';
import { assertSteeringSubject } from '../../src/modules/steering/steering.validation.js';
import { resolvedSteeringForProject } from '../../src/modules/governance/governance.module.js';
import {
  LearningPolicyReader,
  parseLearningPolicy,
  steeringPolicySource,
  LEARNING_POLICY_DEFAULTS,
} from '../../src/modules/learning/learning-policy.js';

const WS = 'ws_a';

const DOC = {
  categories: [
    { key: 'test-setup', description: 'How tests are run', lowRisk: true, defaultClassification: 'internal' },
    { key: 'architecture', description: 'Structural decisions' },
  ],
  reuse: { workspaceScopeAllowed: true, namedSetsAllowed: false, permittedClassifications: { default: ['internal'], byProject: { p2: ['internal', 'restricted'] } } },
  gracePeriodHours: 12,
  reviewWindowDays: 14,
  maxCandidatesPerExecution: 5,
};

describe('T2322 · parseLearningPolicy', () => {
  it('parses categories, lowRisk, reuse and the three settings', () => {
    const result = parseLearningPolicy(JSON.stringify(DOC));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.categories.map((c) => [c.key, c.lowRisk])).toEqual([
      ['test-setup', true],
      ['architecture', false],
    ]);
    expect(result.content.categories[0]!.defaultClassification).toBe('internal');
    expect(result.content.reuse.permittedClassifications.byProject?.['p2']).toEqual(['internal', 'restricted']);
    expect([result.content.gracePeriodHours, result.content.reviewWindowDays, result.content.maxCandidatesPerExecution]).toEqual([12, 14, 5]);
  });

  it('defaults the three settings to 24 h, 30 d and 20 (spec Assumption 8)', () => {
    const result = parseLearningPolicy(JSON.stringify({ categories: [{ key: 'a', description: 'a' }] }));
    expect(result.ok && [result.content.gracePeriodHours, result.content.reviewWindowDays, result.content.maxCandidatesPerExecution]).toEqual([24, 30, 20]);
    expect(LEARNING_POLICY_DEFAULTS).toEqual({ gracePeriodHours: 24, reviewWindowDays: 30, maxCandidatesPerExecution: 20 });
  });

  it('reads lowRisk absent as false — never inferred (FR-LRN-026)', () => {
    const result = parseLearningPolicy(JSON.stringify({ categories: [{ key: 'a', description: 'a' }] }));
    expect(result.ok && result.content.categories[0]!.lowRisk).toBe(false);
  });

  it('reads reuse absent as nothing reusable beyond the origin project', () => {
    const result = parseLearningPolicy(JSON.stringify({ categories: [{ key: 'a', description: 'a' }] }));
    expect(result.ok && result.content.reuse).toEqual({ workspaceScopeAllowed: false, namedSetsAllowed: false, permittedClassifications: { default: [] } });
  });

  it.each([
    ['not JSON', '{categories:'],
    ['not an object', '[]'],
    ['no categories', JSON.stringify({})],
    ['a category with no key', JSON.stringify({ categories: [{ description: 'x' }] })],
    ['a duplicated key', JSON.stringify({ categories: [{ key: 'a', description: 'x' }, { key: 'a', description: 'y' }] })],
    ['lowRisk not a boolean', JSON.stringify({ categories: [{ key: 'a', description: 'x', lowRisk: 'yes' }] })],
    ['a negative window', JSON.stringify({ categories: [{ key: 'a', description: 'x' }], reviewWindowDays: -1 })],
    ['a bound of zero', JSON.stringify({ categories: [{ key: 'a', description: 'x' }], maxCandidatesPerExecution: 0 })],
    ['permitted classifications not a list', JSON.stringify({ categories: [{ key: 'a', description: 'x' }], reuse: { permittedClassifications: { default: 'all' } } })],
  ])('refuses a malformed document: %s', (_name, content) => {
    const result = parseLearningPolicy(content);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.length).toBeGreaterThan(0);
  });
});

describe('T2322 · LearningPolicyReader over EPIC-019 steering', () => {
  function steering(): SteeringService {
    return new SteeringService(new InMemorySteeringStore());
  }

  it('the steering subject learning_policy is admitted (A-019-1)', () => {
    expect(assertSteeringSubject('learning_policy')).toBe('learning_policy');
  });

  it('no document → no categories → every submission refused naming the missing policy (FR-LRN-003)', async () => {
    const reader = new LearningPolicyReader(steeringPolicySource(steering()));
    await expect(reader.current(WS)).resolves.toEqual({ state: 'none' });
    await expect(reader.require(WS)).rejects.toThrow(/no learning policy/i);
    await expect(reader.require(WS)).rejects.toBeInstanceOf(ValidationFailedError);
  });

  it('a malformed document refuses, naming its version and the problems', async () => {
    const svc = steering();
    await svc.create(WS, { subject: 'learning_policy', scope: { scopeType: 'workspace', scopeRef: WS }, content: '{"categories": 7}', createdById: 'u_admin' });
    const reader = new LearningPolicyReader(steeringPolicySource(svc));
    const current = await reader.current(WS);
    expect(current.state).toBe('malformed');
    await expect(reader.require(WS)).rejects.toThrow(/learning policy v1 is malformed/);
  });

  it('a new steering version is the policy change, with actor and instant (FR-LRN-047)', async () => {
    const svc = steering();
    const first = await svc.create(WS, { subject: 'learning_policy', scope: { scopeType: 'workspace', scopeRef: WS }, content: JSON.stringify(DOC), createdById: 'u_admin' });
    const reader = new LearningPolicyReader(steeringPolicySource(svc));
    const v1 = await reader.require(WS);
    expect([v1.version, v1.actorId]).toEqual([1, 'u_admin']);
    expect(v1.category('test-setup')?.lowRisk).toBe(true);

    const changed = { ...DOC, categories: [{ ...DOC.categories[0]!, lowRisk: false }, DOC.categories[1]!] };
    await svc.edit(WS, first.id, JSON.stringify(changed), 'u_owner');
    const v2 = await reader.require(WS);
    expect([v2.version, v2.actorId]).toEqual([2, 'u_owner']);
    expect(v2.at).toBeInstanceOf(Date);
    expect(v2.category('test-setup')?.lowRisk).toBe(false);
    expect(v2.category('nope')).toBeNull();
  });

  it('a retired policy is no policy', async () => {
    const svc = steering();
    const doc = await svc.create(WS, { subject: 'learning_policy', scope: { scopeType: 'workspace', scopeRef: WS }, content: JSON.stringify(DOC), createdById: 'u_admin' });
    await svc.retire(WS, doc.id, 'u_admin');
    await expect(new LearningPolicyReader(steeringPolicySource(svc)).current(WS)).resolves.toEqual({ state: 'none' });
  });

  it('another workspace’s policy is not this one’s', async () => {
    const svc = steering();
    await svc.create('ws_other', { subject: 'learning_policy', scope: { scopeType: 'workspace', scopeRef: 'ws_other' }, content: JSON.stringify(DOC), createdById: 'u_x' });
    await expect(new LearningPolicyReader(steeringPolicySource(svc)).current(WS)).resolves.toEqual({ state: 'none' });
  });

  it('the policy is configuration, not guidance — it is not rendered into a project constitution', async () => {
    const svc = steering();
    await svc.create(WS, { subject: 'learning_policy', scope: { scopeType: 'workspace', scopeRef: WS }, content: JSON.stringify(DOC), createdById: 'u_admin' });
    await svc.create(WS, { subject: 'security', scope: { scopeType: 'workspace', scopeRef: WS }, content: 'Use TLS.', createdById: 'u_admin' });
    const rendered = await resolvedSteeringForProject(svc, WS, 'p1');
    expect(rendered.map((r) => r.subject)).toEqual(['security']);
  });
});
