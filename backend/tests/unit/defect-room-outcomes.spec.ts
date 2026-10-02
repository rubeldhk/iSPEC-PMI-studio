/**
 * `T998b`, `T998c` (EPIC-035) — three outcomes, each resolving to its
 * destination.
 *
 * `FR-DFR-022`, `FR-DFR-077`, `ADR-0016`.
 *
 * ## Why the third outcome is not a nicety
 *
 * Confirmed Defect and Change Request are the two everybody builds. The third —
 * **no approved behaviour exists at all** — is the one that has no obvious home,
 * and a triager without a name for it picks whichever of the other two is less
 * awkward to write down.
 *
 * Filed as a defect, somebody spends a day making code match a behaviour nobody
 * ever specified. Filed as a change request, it invents a baseline to change.
 * Both readings are recoverable only by asking the triager what they meant, and
 * by then they will not remember.
 *
 * `T997e` proved the outcomes and the mapping exist as types. This file proves
 * the **service produces each of them**, which is a different claim: a total
 * `Record` guarantees every outcome has a destination, not that any outcome is
 * ever reached.
 */
import { describe, expect, it } from 'vitest';
import { CLASSIFICATION_OUTCOMES } from '../../src/modules/defect-room/classification.types.js';
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

async function room(reader: BaselineReaderPort) {
  const store = new InMemoryDefectRoomStore();
  await store.createDefect({
    id: 'df_1',
    workspaceId: 'ws_1',
    projectId: 'pr_1',
    epicId: 'EPIC-999',
    state: 'held-for-triage',
    origin: 'manual-report',
    contestedArtifactRef: 'spec_1',
    contestedArtifactVersion: 'v3',
    severity: 'high',
    reportedBy: 'u_0',
    reportedAt: new Date(),
  });
  return { store, subject: new TriageService(store, reader) };
}

const input = (over: Record<string, unknown> = {}) => ({
  workspaceId: 'ws_1',
  defectId: 'df_1',
  classifiedBy: 'u_1',
  classifiedByKind: 'human' as const,
  rationale: 'weighed against the approved behaviour',
  ...over,
});

describe('T998b · the service reaches all three outcomes', () => {
  it('confirmed defect — behaviour found, and the system does not do it', async () => {
    const { subject } = await room(finds);
    const result = await subject.triage(input());
    expect(result.classification.outcome).toBe('confirmed-defect');
    expect(result.classification.destination).toBe('repair');
  });

  it('change request — behaviour found, and the reporter wants it changed', async () => {
    const { subject } = await room(finds);
    const result = await subject.triage(input({ proposedOutcome: 'change-request' }));
    expect(result.classification.outcome).toBe('change-request');
    expect(result.classification.destination).toBe('change-room');
  });

  it('requirement gap — no approved behaviour exists at all', async () => {
    const { subject } = await room(findsNone);
    const result = await subject.triage(input());
    expect(result.classification.outcome).toBe('requirement-gap');
    expect(result.classification.destination).toBe('requirement-room');
  });

  it('and between them they cover the whole vocabulary', async () => {
    // The assertion that would fail if a fourth outcome were added and nothing
    // produced it — an outcome nothing reaches is a branch nobody tests.
    const reached = new Set<string>();
    reached.add((await (await room(finds)).subject.triage(input())).classification.outcome);
    reached.add(
      (await (await room(finds)).subject.triage(input({ proposedOutcome: 'change-request' })))
        .classification.outcome,
    );
    reached.add((await (await room(findsNone)).subject.triage(input())).classification.outcome);
    expect([...reached].sort()).toEqual([...CLASSIFICATION_OUTCOMES].sort());
  });
});

describe('T998b · an absence is a gap, and the caller cannot say otherwise', () => {
  it('a proposed change request does not override a found absence', async () => {
    // The finding is not a matter of opinion. Letting the proposal win would
    // put the triager back in the position `BR-0052` removes them from: filing
    // whichever outcome is least awkward.
    const { subject } = await room(findsNone);
    const result = await subject.triage(input({ proposedOutcome: 'change-request' }));
    expect(result.classification.outcome).toBe('requirement-gap');
  });

  it('nor a proposed confirmed defect', async () => {
    const { subject } = await room(findsNone);
    const result = await subject.triage(input({ proposedOutcome: 'confirmed-defect' }));
    expect(result.classification.outcome).toBe('requirement-gap');
  });

  it('but a proposal IS honoured when behaviour was found', async () => {
    // The control. Without it, a service that ignored every proposal would
    // satisfy both assertions above.
    const { subject } = await room(finds);
    const result = await subject.triage(input({ proposedOutcome: 'change-request' }));
    expect(result.classification.outcome).toBe('change-request');
  });
});

describe('T998b · every classification rests with a destination', () => {
  it.each([
    ['confirmed-defect', 'repair'],
    ['change-request', 'change-room'],
    ['requirement-gap', 'requirement-room'],
  ])('%s stores %s', async (outcome, destination) => {
    // `FR-DFR-077` — stored, not derived at read time. A classification that
    // needed a join to say where it goes could rest with nowhere to go while
    // looking complete, which is exactly what the database CHECK refuses.
    const { store, subject } = await room(outcome === 'requirement-gap' ? findsNone : finds);
    await subject.triage(
      input(outcome === 'change-request' ? { proposedOutcome: 'change-request' } : {}),
    );
    const stored = await store.currentClassification('ws_1', 'df_1');
    expect(stored?.outcome).toBe(outcome);
    expect(stored?.destination).toBe(destination);
  });

  it('and none is written without one', async () => {
    const { store, subject } = await room(finds);
    await subject.triage(input());
    for (const row of await store.listClassifications('ws_1', 'df_1')) {
      expect(row.destination.length).toBeGreaterThan(0);
    }
  });
});
