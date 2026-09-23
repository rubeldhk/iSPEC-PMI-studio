/**
 * `T998d` (EPIC-035) — an agent may propose, and may not confirm.
 *
 * `FR-DFR-023`, `RULE-03`. Refused at the service **and** by the database
 * check, because the two protect against different things: the service gives
 * the better message to somebody using the product, and the constraint holds
 * when a caller reaches past the service entirely.
 *
 * ## The line this draws, and why it is where it is
 *
 * An agent triaging is genuinely useful. It can read the baseline, compare it
 * to the report, and say *"this looks like the system doing what it was told to
 * do"* faster and more consistently than a person working through a backlog.
 *
 * What it must not do is **confirm**. A confirmed defect authorises repair
 * work, and `RULE-03` puts that authorisation with a human — not because the
 * agent is likely to be wrong, but because when it is wrong there has to be
 * somebody who decided, and "the triage bot said so" is not a decision anybody
 * made.
 *
 * The other two outcomes are open to an agent, and that asymmetry is the point:
 * this is not a rule about agents being untrusted. It is a rule about which
 * single act requires a person.
 */
import { describe, expect, it } from 'vitest';
import {
  TriageService,
  type BaselineReaderPort,
} from '../../src/modules/defect-room/triage.service.js';
import { InMemoryDefectRoomStore } from '../../src/modules/defect-room/defect-room.store.js';

const finds: BaselineReaderPort = {
  async approvedBehaviourFor() {
    return { found: true, behaviourRef: 'rv_1', baselineVersion: 3 };
  },
};
const findsNone: BaselineReaderPort = {
  async approvedBehaviourFor() {
    return { found: false };
  },
};

async function room(reader: BaselineReaderPort = finds) {
  const store = new InMemoryDefectRoomStore();
  await store.createDefect({
    id: 'df_1',
    workspaceId: 'ws_1',
    projectId: 'pr_1',
    epicId: 'EPIC-999',
    state: 'held-for-triage',
    origin: 'agent',
    contestedArtifactRef: 'spec_1',
    contestedArtifactVersion: 'v3',
    severity: 'high',
    reportedBy: 'agent_1',
    reportedAt: new Date(),
  });
  return { store, subject: new TriageService(store, reader) };
}

const input = (over: Record<string, unknown> = {}) => ({
  workspaceId: 'ws_1',
  defectId: 'df_1',
  classifiedBy: 'agent_1',
  classifiedByKind: 'agent',
  rationale: 'the baseline says one hour; the log shows two notifications',
  proposedByAgent: true,
  ...over,
});

describe('T998d · an agent must not confirm a defect', () => {
  it('the service refuses it', async () => {
    const { subject } = await room();
    await expect(subject.triage(input())).rejects.toThrow(/must not confirm/i);
  });

  it('and names the requirement, so the refusal is actionable', async () => {
    const { subject } = await room();
    await expect(subject.triage(input())).rejects.toThrow(/FR-DFR-023/);
  });

  it('writing nothing', async () => {
    const { store, subject } = await room();
    await expect(subject.triage(input())).rejects.toThrow();
    expect(await store.listClassifications('ws_1', 'df_1')).toHaveLength(0);
  });

  it('and the same is true whatever the agent calls itself', async () => {
    // The check is "is this a human", not "is this the string `agent`". A kind
    // nobody declared is not a human either.
    const { subject } = await room();
    for (const kind of ['ai', 'system', 'automation', 'service-account', 'bot']) {
      await expect(subject.triage(input({ classifiedByKind: kind }))).rejects.toThrow(
        /must not confirm/i,
      );
    }
  });
});

describe('T998d · but an agent MAY propose the other two', () => {
  it('a change request', async () => {
    // The asymmetry is the point. This is not a rule about agents being
    // untrusted — it is a rule about which single act requires a person.
    const { subject } = await room();
    const result = await subject.triage(input({ proposedOutcome: 'change-request' }));
    expect(result.classification.outcome).toBe('change-request');
    expect(result.classification.classifiedByKind).toBe('agent');
  });

  it('and a requirement gap', async () => {
    const { subject } = await room(findsNone);
    const result = await subject.triage(input());
    expect(result.classification.outcome).toBe('requirement-gap');
  });

  it('recording that an agent proposed it', async () => {
    // `FR-DFR-023`. A later reader needs to know a machine made this call —
    // not to distrust it, but because the confirming actor is a different
    // question and the record must be able to answer both.
    const { subject } = await room(findsNone);
    const result = await subject.triage(input());
    expect(result.classification.proposedByAgent).toBe(true);
  });

  it('and a human confirming the same defect is accepted', async () => {
    // The control for the whole file. Without it, a service refusing every
    // triage would satisfy every refusal above.
    const { subject } = await room();
    const result = await subject.triage(
      input({ classifiedBy: 'u_1', classifiedByKind: 'human', proposedByAgent: true }),
    );
    expect(result.classification.outcome).toBe('confirmed-defect');
    // The proposal is still attributed, even though a human confirmed it.
    expect(result.classification.proposedByAgent).toBe(true);
    expect(result.classification.classifiedByKind).toBe('human');
  });
});
