/**
 * `T998`, `T998a` (EPIC-035) — a defect is judged against approved behaviour.
 *
 * `FR-DFR-020`, `FR-DFR-021`, `SC-DFR-002`, `BR-0052`. The phase goal puts the
 * stake plainly: *without the expectation-verification gate a defect process is
 * an unbudgeted change channel.*
 *
 * ## The distinction this file exists to hold
 *
 * *"No approved behaviour exists"* and *"I could not look"* must never be the
 * same answer.
 *
 * The first is a **Requirement Gap** — a real finding, routed to `EPIC-033`,
 * and often the most valuable thing triage produces. The second is an outage,
 * and treating it as the first would file a gap against a requirement that may
 * well exist, sending somebody to specify behaviour that was specified last
 * year.
 *
 * They are one `catch` block apart. `BaselineReader` unbound, or throwing,
 * returns nothing — and "nothing" reads as "none" unless something insists
 * otherwise. So the reader **refuses** when absent (`FR-GEL-062`,
 * `DEFECT_ROOM_PORTS`), and triage produces no classification at all rather
 * than the wrong one.
 *
 * ## And why classification happens before implementation work
 *
 * `SC-DFR-002`. A fix started before the judgement is a change nobody costed,
 * and the judgement afterwards is a formality — nobody unpicks a working fix
 * because triage later called it a change request.
 */
import { describe, expect, it } from 'vitest';
import {
  TriageService,
  type BaselineReaderPort,
} from '../../src/modules/defect-room/triage.service.js';
import { InMemoryDefectRoomStore } from '../../src/modules/defect-room/defect-room.store.js';

/** A reader that finds approved behaviour. */
const finds: BaselineReaderPort = {
  async approvedBehaviourFor() {
    return { found: true, behaviourRef: 'rv_1', baselineVersion: 3 };
  },
};

/** A reader that looked and found none — `FR-DFR-021`'s recordable absence. */
const findsNone: BaselineReaderPort = {
  async approvedBehaviourFor() {
    return { found: false };
  },
};

/** A reader that could not look. Not the same thing. */
const broken: BaselineReaderPort = {
  async approvedBehaviourFor() {
    throw new Error('the baseline store is unreachable');
  },
};

const defect = {
  id: 'df_1',
  workspaceId: 'ws_1',
  projectId: 'pr_1',
  contestedArtifactRef: 'spec_1',
  contestedArtifactVersion: 'v3',
  state: 'held-for-triage',
};

const service = (reader?: BaselineReaderPort) => {
  const store = new InMemoryDefectRoomStore();
  return { store, subject: new TriageService(store, reader) };
};

const triage = (over: Record<string, unknown> = {}) => ({
  workspaceId: 'ws_1',
  defectId: 'df_1',
  classifiedBy: 'u_1',
  classifiedByKind: 'human' as const,
  rationale: 'the baseline says one hour and it sends two',
  ...over,
});

async function seeded(reader?: BaselineReaderPort) {
  const s = service(reader);
  await s.store.createDefect({ ...defect, epicId: 'EPIC-999', origin: 'manual-report', severity: 'high', reportedBy: 'u_0', reportedAt: new Date() });
  return s;
}

describe('T998 · the contested behaviour is identified and linked', () => {
  it('links it when the reader finds one', async () => {
    const { subject } = await seeded(finds);
    const result = await subject.triage(triage());

    expect(result.classification.approvedBehaviourRef).toBe('rv_1');
    expect(result.classification.absenceRecorded).toBe(false);
  });

  it('and the reader is asked about the version the defect was REPORTED against', async () => {
    // `FR-DFR-024`. The current version may be v7; the report was about v3, and
    // judging it against v7 answers a question nobody asked.
    //
    // The version lives on the defect, not on the classification — data model
    // §1. A copy on the classification would be a second place the answer
    // lives, and the two would disagree the first time one was written alone.
    let askedAbout: string | null = null;
    const recording: BaselineReaderPort = {
      async approvedBehaviourFor(input) {
        askedAbout = input.artifactVersion;
        return { found: true, behaviourRef: 'rv_1', baselineVersion: 3 };
      },
    };
    const { subject } = await seeded(recording);
    await subject.triage(triage());
    expect(askedAbout).toBe('v3');
  });
});

describe('T998 · or its absence is recorded — which is a finding, not a blank', () => {
  it('a reader that found none produces a requirement gap', async () => {
    // `FR-DFR-021`, `FR-DFR-022`. The most valuable outcome triage can produce,
    // and the one that gets filed as something else when nobody has a name for
    // it.
    const { subject } = await seeded(findsNone);
    const result = await subject.triage(triage());

    expect(result.classification.outcome).toBe('requirement-gap');
    expect(result.classification.absenceRecorded).toBe(true);
    expect(result.classification.approvedBehaviourRef).toBeNull();
  });

  it('and it routes to EPIC-033 rather than staying here', async () => {
    const { subject } = await seeded(findsNone);
    const result = await subject.triage(triage());
    expect(result.destination).toContain('EPIC-033');
  });
});

describe('T998 · but "could not look" is refused, not recorded as absence', () => {
  it('an unbound reader refuses', async () => {
    // `DEFECT_ROOM_PORTS`: `BaselineReader` absent ⇒ refuse. With nothing
    // readable there is no approved behaviour to judge against, and
    // classifying anyway is the opinion `FR-DFR-020` exists to refuse.
    const { subject } = await seeded(undefined);
    await expect(subject.triage(triage())).rejects.toThrow(/EPIC-033/);
  });

  it('and a reader that throws refuses too, carrying why', async () => {
    // The one `catch` block that separates an outage from a finding.
    const { subject } = await seeded(broken);
    await expect(subject.triage(triage())).rejects.toThrow(/unreachable/);
  });

  it('neither is recorded as a requirement gap', async () => {
    // The failure this whole file is about: filing a gap against a requirement
    // that may well exist, and sending somebody to specify behaviour that was
    // specified last year.
    const { store, subject } = await seeded(broken);
    await expect(subject.triage(triage())).rejects.toThrow();
    expect(await store.listClassifications('ws_1', 'df_1')).toHaveLength(0);
  });

  it('and nothing at all is written when the reader refuses', async () => {
    const { store, subject } = await seeded(undefined);
    await expect(subject.triage(triage())).rejects.toThrow();
    expect(await store.listClassifications('ws_1', 'df_1')).toHaveLength(0);
  });

  it('the control: a reader that answers does produce a classification', async () => {
    // Without this, a service that refused every triage would satisfy all four
    // assertions above.
    const { store, subject } = await seeded(finds);
    await subject.triage(triage());
    expect(await store.listClassifications('ws_1', 'df_1')).toHaveLength(1);
  });
});

describe('T998 · SC-DFR-002 — classification precedes implementation work', () => {
  it('refuses to triage a defect already being repaired', async () => {
    // A fix started before the judgement is a change nobody costed, and the
    // judgement afterwards is a formality: nobody unpicks a working fix
    // because triage later called it a change request.
    const s = service(finds);
    await s.store.createDefect({
      ...defect,
      state: 'repairing',
      epicId: 'EPIC-999',
      origin: 'manual-report',
      severity: 'high',
      reportedBy: 'u_0',
      reportedAt: new Date(),
    });
    await expect(s.subject.triage(triage())).rejects.toThrow(/before implementation/i);
  });

  it('and one already closed', async () => {
    const s = service(finds);
    await s.store.createDefect({
      ...defect,
      state: 'closed',
      epicId: 'EPIC-999',
      origin: 'manual-report',
      severity: 'high',
      reportedBy: 'u_0',
      reportedAt: new Date(),
    });
    await expect(s.subject.triage(triage())).rejects.toThrow(/before implementation/i);
  });

  it('a defect that does not exist is absent, not invented', async () => {
    const { subject } = service(finds);
    await expect(subject.triage(triage())).rejects.toThrow(/not found/i);
  });

  it('and a defect in another workspace is absent too', async () => {
    const { subject } = await seeded(finds);
    await expect(subject.triage(triage({ workspaceId: 'ws_other' }))).rejects.toThrow(/not found/i);
  });
});

describe('T998 · what a triage must state', () => {
  it('refuses a blank rationale', async () => {
    const { subject } = await seeded(finds);
    await expect(subject.triage(triage({ rationale: '   ' }))).rejects.toThrow(/rationale/i);
  });

  it('and moves the defect out of held-for-triage when it succeeds', async () => {
    const { store, subject } = await seeded(finds);
    await subject.triage(triage());
    expect((await store.findDefect('ws_1', 'df_1'))?.state).toBe('triaged');
  });
});
