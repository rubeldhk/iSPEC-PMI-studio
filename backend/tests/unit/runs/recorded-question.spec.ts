/**
 * T341 — every deferred question records its options, the suggested answer,
 * and enough context for someone who did not start the run (FR-RUN-003,
 * FR-RUN-007) — and the run proceeds on the suggestion as a PROVISIONAL
 * answer, not a decision (FR-RUN-004).
 */
import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../../src/core/errors.js';
import { WS, harness, startUnattended } from '../review/helpers.js';

describe('T341 · question deferral with suggested answers', () => {
  it('records options, suggested answer, and context (FR-RUN-003, FR-RUN-007)', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const { question } = await h.recorder.record(WS, run.id, {
      context: 'The requirements name two auth providers; the spec must pick one.',
      optionsConsidered: ['oauth', 'saml'],
      suggestedAnswer: 'oauth',
    });
    expect(question.context).toContain('auth providers');
    expect(question.optionsConsidered).toEqual(['oauth', 'saml']);
    expect(question.suggestedAnswer).toBe('oauth');
  });

  it('proceeds using the suggested answer as PROVISIONAL, not a decision (FR-RUN-004)', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const deferred = await h.recorder.record(WS, run.id, {
      context: 'Storage choice.',
      optionsConsidered: ['postgres', 'sqlite'],
      suggestedAnswer: 'postgres',
    });
    expect(deferred.proceedWith).toBe('postgres');
    expect(deferred.question.provisionalAnswerApplied).toBe('postgres');
    // The run kept going — recording is how it AVOIDS pausing.
    expect((await h.runMode.get(WS, run.id)).state).toBe('running');
  });

  it('refuses a question without context — unanswerable by a teammate (FR-RUN-007)', async () => {
    const h = harness();
    const run = await startUnattended(h);
    await expect(
      h.recorder.record(WS, run.id, {
        context: '  ',
        optionsConsidered: ['a', 'b'],
        suggestedAnswer: 'a',
      }),
    ).rejects.toThrow(ValidationFailedError);
  });

  it('refuses a question without options or without a suggested answer (FR-RUN-003)', async () => {
    const h = harness();
    const run = await startUnattended(h);
    await expect(
      h.recorder.record(WS, run.id, { context: 'x', optionsConsidered: [], suggestedAnswer: 'a' }),
    ).rejects.toThrow(ValidationFailedError);
    await expect(
      h.recorder.record(WS, run.id, { context: 'x', optionsConsidered: ['a'], suggestedAnswer: '' }),
    ).rejects.toThrow(ValidationFailedError);
  });
});
