/**
 * T780e — an automated decision is distinguishable without inference.
 * `FR-DPE-032`, `RULE-11` (no invisible automation).
 *
 * The record says `automation` or `human` in a field of its own, and an
 * automated decision's explanation names the rule and the event that fired it.
 * Nothing has to be guessed from an actor id that happens to look like a bot.
 */
import { describe, expect, it } from 'vitest';
import { engine, policy, request, rules } from '../helpers/decision-engine.js';

describe('T780e · FR-DPE-032 — actor kind is recorded, not inferred', () => {
  it('records automation as automation, and names the firing rule and event', async () => {
    const { engine: e, repository } = engine({
      steering: rules([{ actionPattern: 'docs.publish', band: 'low' }]),
      policies: policy({ automatedActions: [{ actionPattern: 'docs.publish', ruleId: 'RULE-7' }] }),
    });
    const result = await e.decide(
      request({
        actionType: 'docs.publish',
        actor: { kind: 'automation', id: 'svc-scheduler' },
        triggeredBy: { ruleId: 'RULE-7', eventId: 'evt-9' },
      }),
    );
    expect((await repository.get('ws_dpe', result.decisionId))!.actorKind).toBe('automation');
    expect(result.explanation.triggerRule).toBe('RULE-7 (event evt-9)');
  });

  it('records a human as human, with no trigger rule', async () => {
    const { engine: e, repository } = engine({ steering: rules([{ actionPattern: 'deploy', band: 'low' }]) });
    const result = await e.decide(request({ actor: { kind: 'human', id: 'svc-looks-like-a-bot' } }));
    expect((await repository.get('ws_dpe', result.decisionId))!.actorKind).toBe('human');
    expect(result.explanation.triggerRule).toBeUndefined();
  });
});
