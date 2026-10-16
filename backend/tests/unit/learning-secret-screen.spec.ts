/**
 * `T2328` (EPIC-048, `FR-LRN-018`, `BR-0173`) — a candidate is screened for
 * secrets before anything is stored.
 *
 * A match is refused naming the rule and the field — never the value: a refusal
 * that echoed it would put the secret in a log, a response and an agent's
 * transcript at once. And there is no row afterwards: the tables are
 * append-only, so a secret written there could never be removed.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { GovernanceSeamUnboundError, ValidationFailedError } from '../../src/core/errors.js';
import { InMemoryLearningStore } from '../../src/modules/learning/learning.store.js';
import { LearningPolicyReader } from '../../src/modules/learning/learning-policy.js';
import { SubmissionService, type SubmissionActor } from '../../src/modules/learning/submission.service.js';
import { refusingPorts } from '../../src/modules/learning/learning.tokens.js';
import { secretScreenPort } from '../../src/modules/learning/secret.screen.js';
import { learningWorld, submission, type LearningTestWorld } from '../helpers/learning-ports.js';

const AGENT: SubmissionActor = { kind: 'agent', workspaceId: 'ws_a', principalId: 'agent_1', projectId: 'p1' };
const TOKEN = `ghp_${'Z'.repeat(36)}`;

let world: LearningTestWorld;
let store: InMemoryLearningStore;

function service(ports = world.ports): SubmissionService {
  return new SubmissionService({ store, ports, policy: new LearningPolicyReader(ports.policy) });
}

async function refusal(body: Record<string, unknown>): Promise<ValidationFailedError> {
  try {
    await service().submit({ actor: AGENT, projectId: 'p1', body });
  } catch (err) {
    expect(err).toBeInstanceOf(ValidationFailedError);
    return err as ValidationFailedError;
  }
  throw new Error('expected a refusal');
}

beforeEach(() => {
  world = { ...learningWorld() };
  world = { ...world, ports: { ...world.ports, secrets: secretScreenPort() } };
  store = new InMemoryLearningStore();
});

describe('T2328 · every free-text field is screened', () => {
  it.each([
    ['statement', { statement: `Use ${TOKEN} for the CI` }],
    ['subject', { subject: `deploy key ${TOKEN}` }],
    ['category', { category: TOKEN }],
    ['confidence.basis', { confidence: { level: 'high', basis: `I logged in with ${TOKEN}` } }],
    ['correlationId', { correlationId: TOKEN }],
    ['evidence[0].evidenceId', { evidence: [{ evidenceId: TOKEN, digest: { sha256: 'a'.repeat(64) } }] }],
  ])('%s', async (field, over) => {
    const err = await refusal(submission(over));
    expect(err.message).toContain('github-token');
    expect(err.message).toContain(field);
    expect((err.details as { rule: string; field: string })).toEqual({ rule: 'github-token', field });
  });
});

describe('T2328 · the refusal never carries the value', () => {
  it('names the rule and the field only', async () => {
    const err = await refusal(submission({ statement: `postgresql://admin:hunter2@db:5432/app is the database` }));
    expect(err.message).toContain('connection-string');
    expect(err.message).not.toContain('hunter2');
    expect(JSON.stringify(err.details)).not.toContain('hunter2');
  });

  it('screens before parsing — a malformed body carrying a secret is refused for the secret', async () => {
    const err = await refusal({ statement: `AKIAABCDEFGHIJKLMNOP`, schemaVersion: 9 });
    expect(err.message).toContain('aws-access-key');
  });
});

describe('T2328 · nothing is stored (FR-LRN-018)', () => {
  it('no candidate, citation or transition exists after a refusal', async () => {
    await refusal(submission({ idempotencyKey: 'secret-1', statement: `use ${TOKEN}` }));
    expect(await store.candidateByIdempotencyKey('ws_a', 'secret-1')).toBeNull();
    expect(await store.candidatesInStates(['proposed', 'pending-review'])).toEqual([]);
    expect(await store.submissionsForExecution('ws_a', 'exe_1')).toBe(0);
  });

  it('a clean submission passes the screen', async () => {
    await expect(service().submit({ actor: AGENT, projectId: 'p1', body: submission() })).resolves.toMatchObject({ status: 201 });
  });
});

describe('T2328 · SecretScreen unbound refuses', () => {
  it('503 naming the port — an unscreened submission is not stored', async () => {
    const ports = { ...world.ports, secrets: refusingPorts().secrets };
    await expect(service(ports).submit({ actor: AGENT, projectId: 'p1', body: submission() })).rejects.toBeInstanceOf(GovernanceSeamUnboundError);
    expect(await store.submissionsForExecution('ws_a', 'exe_1')).toBe(0);
  });
});
