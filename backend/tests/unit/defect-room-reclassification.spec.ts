/**
 * `T998e`, `T998f` (EPIC-035) — superseded versions and reclassification.
 *
 * `FR-DFR-024`, `FR-DFR-025`, `ADR-0016`.
 *
 * ## "Never silently re-targeted"
 *
 * A defect is reported against v3. By the time anyone triages it the artifact
 * is at v7. The convenient move is to judge it against v7 — that is what is
 * true now, and v3 is history.
 *
 * It is also a different question. The reporter observed v3 behaving a certain
 * way; whether v7 does the same is worth knowing and is **not what they said**.
 * Re-targeting silently produces a record that reads as though they reported
 * v7, and if v7 fixed it the defect closes as *"cannot reproduce"* against a
 * report that was accurate.
 *
 * So the version reported is kept, the re-evaluation against current is a
 * separate recorded act, and both are visible.
 *
 * ## "A reclassified record is a new row"
 *
 * `ADR-0016`'s never-delete rule is about auditability, and **an updated row
 * destroys the same history a deleted one does, more quietly** — the record
 * says what it says now, with nothing to show it once said otherwise.
 *
 * The old row stands untouched except for a pointer to what replaced it, which
 * is the shape `EPIC-033` uses for a superseded baseline: *only `supersededBy`
 * moves*.
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

async function room() {
  const store = new InMemoryDefectRoomStore();
  await store.createDefect({
    id: 'df_1',
    workspaceId: 'ws_1',
    projectId: 'pr_1',
    epicId: 'EPIC-999',
    state: 'held-for-triage',
    origin: 'manual-report',
    contestedArtifactRef: 'spec_1',
    // Reported against v3. The artifact is at v7 by the time anyone looks.
    contestedArtifactVersion: 'v3',
    severity: 'high',
    reportedBy: 'u_0',
    reportedAt: new Date(),
  });
  return { store, subject: new TriageService(store, finds) };
}

const input = (over: Record<string, unknown> = {}) => ({
  workspaceId: 'ws_1',
  defectId: 'df_1',
  classifiedBy: 'u_1',
  classifiedByKind: 'human' as const,
  rationale: 'the baseline says one hour and it sends two',
  ...over,
});

describe('T998e · the version reported is kept', () => {
  it('the defect still says v3 after triage', async () => {
    // `FR-DFR-024`. If v7 fixed it, the defect would close as "cannot
    // reproduce" against a report that was accurate — and the reporter would
    // learn that filing defects is pointless.
    const { store, subject } = await room();
    await subject.triage(input());
    expect((await store.findDefect('ws_1', 'df_1'))?.contestedArtifactVersion).toBe('v3');
  });

  it('and nothing in triage rewrites it', async () => {
    const { store, subject } = await room();
    const before = await store.findDefect('ws_1', 'df_1');
    await subject.triage(input());
    const after = await store.findDefect('ws_1', 'df_1');
    // Only the state moves. The report is what it was.
    expect({ ...after, state: before!.state }).toEqual(before);
  });
});

describe('T998e · re-evaluation against current is a separate, recorded act', () => {
  it('records a new classification against the current version', async () => {
    // Both facts survive: what was reported, and what is true now. Neither
    // replaces the other.
    const { store, subject } = await room();
    const first = await subject.triage(input());

    const second = await subject.reevaluateAgainstCurrent({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      currentArtifactVersion: 'v7',
      classifiedBy: 'u_2',
      classifiedByKind: 'human',
      rationale: 'v7 still sends two notifications',
    });

    expect(second.classification.id).not.toBe(first.classification.id);
    expect(await store.listClassifications('ws_1', 'df_1')).toHaveLength(2);
  });

  it('and the earlier one is marked superseded rather than rewritten', async () => {
    const { store, subject } = await room();
    const first = await subject.triage(input());
    const second = await subject.reevaluateAgainstCurrent({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      currentArtifactVersion: 'v7',
      classifiedBy: 'u_2',
      classifiedByKind: 'human',
      rationale: 'v7 still sends two',
    });

    const all = await store.listClassifications('ws_1', 'df_1');
    const original = all.find((row) => row.id === first.classification.id)!;
    expect(original.supersededByClassificationId).toBe(second.classification.id);
    expect(original.reclassifiedAt).toBeInstanceOf(Date);
  });

  it('with its substance untouched', async () => {
    // `ADR-0016`. The old row stands; only the pointer moves. An outcome or a
    // rationale rewritten in place would destroy the same history a deletion
    // does, and leave nothing to show it happened.
    const { store, subject } = await room();
    const first = await subject.triage(input({ rationale: 'the original reading' }));
    await subject.reevaluateAgainstCurrent({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      currentArtifactVersion: 'v7',
      classifiedBy: 'u_2',
      classifiedByKind: 'human',
      rationale: 'the later reading',
    });

    const all = await store.listClassifications('ws_1', 'df_1');
    const original = all.find((row) => row.id === first.classification.id)!;
    expect(original.rationale).toBe('the original reading');
    expect(original.outcome).toBe(first.classification.outcome);
    expect(original.classifiedBy).toBe('u_1');
  });

  it('and the current classification is the one nothing supersedes', async () => {
    const { store, subject } = await room();
    await subject.triage(input());
    const second = await subject.reevaluateAgainstCurrent({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      currentArtifactVersion: 'v7',
      classifiedBy: 'u_2',
      classifiedByKind: 'human',
      rationale: 'v7 still sends two',
    });
    expect((await store.currentClassification('ws_1', 'df_1'))?.id).toBe(second.classification.id);
  });

  it('nothing is deleted, ever', async () => {
    // `SC-DFR-005` — **zero** reclassified defect records deleted, all retained
    // as reclassified. Cited here at convergence (`T999y`, finding `F1`): the
    // guarantee was built and proved by this file and `T999j`, and the
    // identifier appeared in no source or test, so the criterion was satisfied
    // and not findable by anything that extracts rather than reads. That is
    // `EPIC-033`'s `A1` failure exactly — legible to a person, invisible to a
    // search.
    //
    // The store offers no delete at all — the promise is kept by the absence of
    // the capability rather than by everyone remembering not to use it.
    const store = new InMemoryDefectRoomStore();
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(store));
    for (const verb of ['delete', 'remove', 'destroy', 'purge', 'drop']) {
      expect(
        methods.some((name) => new RegExp(`^${verb}`, 'i').test(name)),
        `the store exposes ${verb}`,
      ).toBe(false);
    }
  });

  it('the delete check can fire', () => {
    expect(['deleteClassification'].some((n) => /^delete/i.test(n))).toBe(true);
  });
});

describe('T998e · what re-evaluation refuses', () => {
  it('a defect that has never been classified', async () => {
    // There is nothing to supersede. Recording a "re-evaluation" as the first
    // classification would claim a history that did not happen.
    const { subject } = await room();
    await expect(
      subject.reevaluateAgainstCurrent({
        workspaceId: 'ws_1',
        defectId: 'df_1',
        currentArtifactVersion: 'v7',
        classifiedBy: 'u_2',
        classifiedByKind: 'human',
        rationale: 'x',
      }),
    ).rejects.toThrow(/never been classified/i);
  });

  it('a re-evaluation against the version already judged', async () => {
    // Nothing moved, so there is nothing to re-evaluate. A second identical
    // classification would be noise in the very record `ADR-0016` protects.
    const { subject } = await room();
    await subject.triage(input());
    await expect(
      subject.reevaluateAgainstCurrent({
        workspaceId: 'ws_1',
        defectId: 'df_1',
        currentArtifactVersion: 'v3',
        classifiedBy: 'u_2',
        classifiedByKind: 'human',
        rationale: 'x',
      }),
    ).rejects.toThrow(/already judged against/i);
  });

  it('and a re-evaluation of a defect already being repaired', async () => {
    // `SC-DFR-002` applies to the second judgement as much as the first. A
    // re-judgement while the fix is underway is the same unbudgeted change
    // channel arriving a week later, and the restrictive reading is the one
    // `FR-GEL-062` asks for: a default that permits is invisible.
    const { store, subject } = await room();
    await subject.triage(input());
    await store.setDefectState('ws_1', 'df_1', 'repairing');
    await expect(
      subject.reevaluateAgainstCurrent({
        workspaceId: 'ws_1',
        defectId: 'df_1',
        currentArtifactVersion: 'v7',
        classifiedBy: 'u_2',
        classifiedByKind: 'human',
        rationale: 'v7 still sends two',
      }),
    ).rejects.toThrow(/before implementation/i);
  });

  it('and an agent confirming the re-evaluation', async () => {
    // `FR-DFR-023` applies to every confirmation, not only the first.
    const { subject } = await room();
    await subject.triage(input());
    await expect(
      subject.reevaluateAgainstCurrent({
        workspaceId: 'ws_1',
        defectId: 'df_1',
        currentArtifactVersion: 'v7',
        classifiedBy: 'agent_1',
        classifiedByKind: 'agent',
        rationale: 'v7 still sends two',
      }),
    ).rejects.toThrow(/must not confirm/i);
  });
});
