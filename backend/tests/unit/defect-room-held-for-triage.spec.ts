/**
 * `T999b` (EPIC-035) — the defect that cannot be linked.
 *
 * `FR-DFR-012`, `FR-DFR-023`, `SC-DFR-006`.
 *
 * ## The two ways to get this wrong, and they are opposites
 *
 * **Refuse it.** The monitoring alert cannot say which Epic it belongs to, so
 * the report bounces. Whoever was going to file it does not, and the defect is
 * now known only to the person who saw it.
 *
 * **Accept it quietly.** The row is written with a null Epic, nothing says so,
 * and it never appears in per-Epic quality accounting again. `BR-0051`'s stake
 * in one line: an unlinked defect is invisible.
 *
 * The requirement takes neither: **held for triage with the missing link
 * named**. It is recorded, it is findable, and the thing that is wrong with it
 * is stated rather than left for somebody to notice.
 *
 * `SC-DFR-006` measures exactly this — *100% carry an Epic and project link, or
 * are visibly held for triage.* The word doing the work is **visibly**.
 *
 * ## And an agent-filed defect is an origin, not an authority
 *
 * The second half composes this service with `TriageService` rather than
 * restating `FR-DFR-023`'s rule. Two services each asserting their own half of
 * a guarantee is how the guarantee comes to hold in neither: filing as `agent`
 * and confirming as `agent` are separately reasonable, and the composition is
 * the only place their combination is visible.
 */
import { describe, expect, it } from 'vitest';
import { DefectIntakeService, type IntakeInput } from '../../src/modules/defect-room/intake.service.js';
import { InMemoryDefectRoomStore } from '../../src/modules/defect-room/defect-room.store.js';
import {
  DefectAnalyticsService,
  InMemoryEscapeStore,
} from '../../src/modules/defect-room/analytics.service.js';
import {
  TriageService,
  type BaselineReaderPort,
} from '../../src/modules/defect-room/triage.service.js';

const finds: BaselineReaderPort = {
  async approvedBehaviourFor() {
    return { found: true, behaviourRef: 'rv_1', baselineVersion: 3 };
  },
};

function room(): {
  store: InMemoryDefectRoomStore;
  escapes: InMemoryEscapeStore;
  subject: DefectIntakeService;
  triage: TriageService;
} {
  const store = new InMemoryDefectRoomStore();
  const escapes = new InMemoryEscapeStore();
  return {
    store,
    escapes,
    subject: new DefectIntakeService(store, new DefectAnalyticsService(escapes)),
    triage: new TriageService(store, finds),
  };
}

const report = (over: Partial<IntakeInput> = {}): IntakeInput => ({
  workspaceId: 'ws_1',
  projectId: 'pr_1',
  epicId: 'EPIC-999',
  origin: 'manual-report',
  contestedArtifactRef: 'spec_1',
  contestedArtifactVersion: 'v3',
  severity: 'high',
  reportedBy: 'u_1',
  ...over,
});

describe('T999b · an unlinkable defect is held, not refused and not swallowed', () => {
  it('is recorded rather than refused', async () => {
    // The monitoring alert that cannot name an Epic still gets filed. A refusal
    // here means the defect is known only to whoever saw it.
    const { subject } = room();
    const result = await subject.report(report({ epicId: null }));
    expect(result.defect.id).toBeTruthy();
  });

  it('and held for triage', async () => {
    const { subject } = room();
    const result = await subject.report(report({ epicId: null }));
    expect(result.defect.state).toBe('held-for-triage');
    expect(result.defect.epicId).toBeNull();
  });

  it('with the missing link NAMED, not merely absent', async () => {
    // `FR-DFR-012`. A null column says something is missing to a reader who
    // already suspected it. The caller filing the report is told.
    const { subject } = room();
    const result = await subject.report(report({ epicId: null }));
    expect(result.heldFor).toMatch(/epic/i);
    expect(result.heldFor).toMatch(/FR-DFR-012/);
  });

  it('and an empty string is the same as absent, not an Epic called ""', async () => {
    // The gap a trim would close and a truthiness check would not: `''` is a
    // link nobody made, and storing it satisfies "epicId IS NOT NULL" while
    // linking to nothing.
    const { subject } = room();
    const result = await subject.report(report({ epicId: '   ' }));
    expect(result.defect.epicId).toBeNull();
    expect(result.defect.state).toBe('held-for-triage');
  });

  it('the escape row is still written, so the hold does not cost the data', async () => {
    // A held defect that skipped capture would be missing from escape analysis
    // for exactly as long as it stayed unlinked — which is the population most
    // worth looking at.
    const { escapes, subject } = room();
    const result = await subject.report(report({ epicId: null, origin: 'monitoring' }));
    expect((await escapes.findForDefect('ws_1', result.defect.id))?.origin).toBe('monitoring');
  });

  it('and a linked report is NOT held, so the check is not vacuous', async () => {
    const { subject } = room();
    const result = await subject.report(report());
    expect(result.heldFor).toBeNull();
    expect(result.defect.state).not.toBe('held-for-triage');
  });
});

describe('T999b · the hold is resolvable, or it is a hole', () => {
  it('linking an Epic afterwards moves it out of held-for-triage', async () => {
    // `SC-DFR-006` says held-for-triage is a visible state, not a grave. With
    // no way out, every unlinkable defect stays uncounted forever and the
    // measure reads 100% while nothing was ever linked.
    const { store, subject } = room();
    const held = await subject.report(report({ epicId: null }));
    await subject.linkToEpic('ws_1', held.defect.id, 'EPIC-999', 'u_2');

    const row = await store.findDefect('ws_1', held.defect.id);
    expect(row?.epicId).toBe('EPIC-999');
    expect(row?.state).toBe('triaged');
  });

  it('refuses to link a blank Epic', async () => {
    const { subject } = room();
    const held = await subject.report(report({ epicId: null }));
    await expect(subject.linkToEpic('ws_1', held.defect.id, '  ', 'u_2')).rejects.toThrow(
      /epic/i,
    );
  });

  it('and a defect in another workspace is absent, not forbidden', async () => {
    const { subject } = room();
    const held = await subject.report(report({ epicId: null }));
    await expect(
      subject.linkToEpic('ws_other', held.defect.id, 'EPIC-999', 'u_2'),
    ).rejects.toThrow(/not found/i);
  });

  it('and lists what is held, because "visibly" is the word that matters', async () => {
    // `SC-DFR-006`. A held defect findable only by opening every record is
    // indistinguishable from one nobody held.
    const { subject } = room();
    await subject.report(report({ epicId: null }));
    await subject.report(report());
    const held = await subject.heldForTriage('ws_1');
    expect(held).toHaveLength(1);
    expect(held[0]?.epicId).toBeNull();
  });
});

describe('T999b · an agent may file, and still may not confirm', () => {
  it('accepts a defect filed by an agent', async () => {
    const { subject } = room();
    const result = await subject.report(report({ origin: 'agent', reportedBy: 'agent_1' }));
    expect(result.defect.origin).toBe('agent');
  });

  it('and that agent still cannot confirm it', async () => {
    // `FR-DFR-023`, composed rather than restated. Filing as an agent and
    // confirming as an agent are separately reasonable; this is the only place
    // their combination is visible.
    const { subject, triage } = room();
    const filed = await subject.report(report({ origin: 'agent', reportedBy: 'agent_1' }));

    await expect(
      triage.triage({
        workspaceId: 'ws_1',
        defectId: filed.defect.id,
        classifiedBy: 'agent_1',
        classifiedByKind: 'agent',
        rationale: 'the baseline says one hour and it sends two',
        proposedByAgent: true,
      }),
    ).rejects.toThrow(/must not confirm/i);
  });

  it('though a human can confirm the same agent-filed defect', async () => {
    // The control: the origin is not what refuses. Without this, an intake that
    // marked agent-filed defects unconfirmable by anyone would pass the test
    // above while breaking the requirement it claims to serve.
    const { subject, triage } = room();
    const filed = await subject.report(report({ origin: 'agent', reportedBy: 'agent_1' }));

    const result = await triage.triage({
      workspaceId: 'ws_1',
      defectId: filed.defect.id,
      classifiedBy: 'u_1',
      classifiedByKind: 'human',
      rationale: 'the baseline says one hour and it sends two',
      proposedByAgent: true,
    });
    expect(result.classification.outcome).toBe('confirmed-defect');
  });

  it('and a held-for-triage defect can still be triaged, which is the point of the state', async () => {
    // The name says it: held FOR triage. A state that blocked the thing it is
    // named after would leave every unlinkable defect permanently unjudged.
    const { subject, triage } = room();
    const held = await subject.report(report({ epicId: null }));

    const result = await triage.triage({
      workspaceId: 'ws_1',
      defectId: held.defect.id,
      classifiedBy: 'u_1',
      classifiedByKind: 'human',
      rationale: 'the baseline says one hour and it sends two',
    });
    expect(result.classification.outcome).toBe('confirmed-defect');
  });
});
