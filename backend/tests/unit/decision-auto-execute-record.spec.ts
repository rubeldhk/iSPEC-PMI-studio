/**
 * T747 — an auto-executed action still leaves a record. `FR-DPE-016`,
 * `SC-DPE-005`, `ADR-0025` constraint 4: *low risk means no human in the loop,
 * not no record.*
 *
 * And the record is the precondition, not an afterthought: with no `AuditSink`
 * the engine refuses rather than auto-executing unrecorded.
 */
import { describe, expect, it } from 'vitest';
import { engine, request, rules } from '../helpers/decision-engine.js';

const low = rules([{ actionPattern: 'deploy', band: 'low' }]);

describe('T747 · FR-DPE-016 — no human in the loop is not no record', () => {
  it('stores the auto-executed decision with its explanation', async () => {
    const { engine: e, repository } = engine({ steering: low });
    const result = await e.decide(request());
    const stored = await repository.get('ws_dpe', result.decisionId);
    expect(stored).toMatchObject({ outcome: 'auto-executed', actorKind: 'human', objectVersion: '7' });
    expect(stored!.explanation.riskClass).toBe('low');
  });

  it('writes an audit entry naming the decision, the action and the outcome', async () => {
    const { engine: e, audit } = engine({ steering: low });
    const result = await e.decide(request());
    expect(audit.entries).toEqual([
      { workspaceId: 'ws_dpe', decisionId: result.decisionId, actionType: 'deploy', outcome: 'auto-executed', actor: 'u_requester' },
    ]);
  });

  it('audits refusals as well — every outcome, not only the permitted ones', async () => {
    const { engine: e, audit } = engine();
    await e.decide(request({ actor: { kind: 'automation', id: 'bot' } }));
    expect(audit.entries.map((a) => a.outcome)).toEqual(['refused']);
  });

  it('refuses, rather than auto-executing unrecorded, when no AuditSink is bound (FR-DPE-050)', async () => {
    const { engine: e } = engine({ steering: low, audit: null });
    const result = await e.decide(request());
    expect(result.outcome).toBe('refused');
    expect(result.explanation.constraintCited).toMatch(/AuditSink/);
  });
});
