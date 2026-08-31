/**
 * `T994h`, `T994i` (EPIC-034) — explicit rebase, and re-decision.
 *
 * `FR-CHR-013`, `FR-CHR-054`, `SC-CHR-009`, `R-034-5`.
 *
 * ## The failure this file exists to prevent
 *
 * A change is decided against baseline v1. Another change lands first and the
 * project moves to v2. The change is then applied — to v2, because that is what
 * is current. Nothing errors. The approval, the impact view and the trade-offs
 * all referred to v1, and none of that is true any more.
 *
 * The spec's own closure checklist names this as *"the one that would ship an
 * approval referring to a baseline no longer in force"*. So the rebase is an
 * **explicit recorded act**, and applying to a baseline the decision was not
 * taken against is refused rather than done quietly.
 *
 * ## Why EPIC-030's rule is not inherited
 *
 * `FR-GEL-015`'s first-commit-wins settles which *transition* won. It says
 * nothing about what a decision was **made against**, and that is the whole
 * question here. This Room is deliberately stricter, and says so.
 *
 * ## What "re-decided" compares
 *
 * `R-034-5`: the impact view retained with the decision, against one recomputed
 * on the new baseline. `FR-CHR-035` exists so this is a comparison rather than
 * somebody's recollection of whether anything material moved.
 *
 * Any difference counts. Grading which differences are "material" would put
 * this Room in the business of deciding which changed impacts a person may be
 * spared — which is the decision it exists to put in front of them. The one
 * exception is `detail` wording, because two runs of the same traversal can
 * phrase themselves differently with nothing having moved, and a re-decision
 * triggered by rephrasing teaches people to click through them.
 */
import { describe, expect, it } from 'vitest';
import { InMemoryChangeRoomStore } from '../../src/modules/change-room/change-room.store.js';
import {
  DecisionService,
  type ChangeDecisionInboxPort,
  type ChangeDecisionPolicyPort,
} from '../../src/modules/change-room/decision.service.js';
import {
  RebaselineService,
  type BaselineSnapshot,
  type BaselineWriterPort,
} from '../../src/modules/change-room/rebase.service.js';
import { IMPACT_AREAS, type ImpactArea, type ImpactAreaName, type ImpactView } from '../../src/modules/change-room/impact.types.js';
import {
  TRADEOFF_DIMENSIONS,
  type ChangeOption,
  type ChangeOptions,
} from '../../src/modules/change-room/option.types.js';

const tradeOffs = () => {
  const out = {} as ChangeOption['tradeOffs'];
  for (const d of TRADEOFF_DIMENSIONS) {
    (out as Record<string, unknown>)[d] = { stated: true, detail: `${d} considered` };
  }
  return out;
};
const option = (id: string): ChangeOption => ({
  optionId: id,
  summary: `Option ${id}`,
  reasoning: `Because of ${id}.`,
  tradeOffs: tradeOffs(),
  epistemic: 'recommendation',
});
const OPTIONS: ChangeOptions = [option('a'), option('b')];

const permits: ChangeDecisionPolicyPort = {
  async authorize() {
    return { authorized: true, authorityBasis: 'DA-0007', band: 'high' };
  },
};
const inbox: ChangeDecisionInboxPort = {
  async present() {
    return { inboxItemId: 'inbox_1' };
  },
};

/** A view where every area is `not-impacted` unless overridden. */
function view(id: string, over: Partial<Record<ImpactAreaName, Partial<ImpactArea>>> = {}): ImpactView {
  const areas = {} as Record<ImpactAreaName, ImpactArea>;
  for (const area of IMPACT_AREAS) {
    areas[area] = {
      area,
      state: 'not-impacted',
      detail: 'traversed; nothing downstream in this area',
      itemCount: 0,
      ...over[area],
    };
  }
  return {
    id,
    workspaceId: 'ws_1',
    changeRequestId: 'cr_1',
    computedAt: new Date('2026-08-30T10:00:00Z'),
    traversalDepth: 25,
    retainedForDecision: true,
    areas,
    architecture: {
      decisions: [{ id: 'adr_1', reference: 'ADR-0025', title: 'Loop', status: 'accepted' }],
      detail: '1 governed decision is reached by this change',
      violationCheck: { status: 'not-run', because: 'BR-0073 is unowned (U-17)' },
    },
  };
}

const baseline = (version: number, superseded: number | null = null): BaselineSnapshot => ({
  id: `b_${version}`,
  projectId: 'pr_1',
  version,
  memberVersionIds: ['rv_1'],
  setHash: `sha256:v${version}`,
  approvedBy: 'u_0',
  approvedAt: new Date('2026-08-01T00:00:00Z'),
  rationale: 'set',
  decisionId: 'dec_0',
  supersededBy: superseded,
  evidenceContractRef: 'ec_1',
});

function writerAt(currentVersion: number) {
  const created: BaselineSnapshot[] = [];
  const superseded: number[] = [];
  const port: BaselineWriterPort = {
    async current() {
      return baseline(currentVersion);
    },
    async approve(i) {
      const next = { ...baseline(i.version), memberVersionIds: i.memberVersionIds };
      created.push(next);
      return next;
    },
    async supersede(_id, byVersion) {
      superseded.push(byVersion);
      return baseline(currentVersion, byVersion);
    },
  };
  return { port, created, superseded };
}

/** A decided change, with its impact view retained. */
async function decided(retained: ImpactView = view('iv_1')) {
  const store = new InMemoryChangeRoomStore();
  await store.saveImpactView(retained);
  await new DecisionService(store, permits, inbox).record({
    workspaceId: 'ws_1',
    changeRequestId: 'cr_1',
    decisionId: 'dec_1',
    impactViewId: retained.id,
    decidedBy: 'u_2',
    decidedByKind: 'human',
    objectVersion: 1,
    options: OPTIONS,
    chosenOptionId: 'b',
    rationale: 'B keeps the migration reversible.',
    now: new Date('2026-08-30T12:00:00Z'),
  });
  return store;
}

const assess = (over: Record<string, unknown> = {}) => ({
  workspaceId: 'ws_1',
  changeRequestId: 'cr_1',
  decidedAgainstVersion: 1,
  currentVersion: 2,
  recomputed: view('iv_2'),
  ...over,
});

describe('T994h · the baseline has not moved', () => {
  it('needs no rebase and no re-decision', async () => {
    const store = await decided();
    const service = new RebaselineService(store, writerAt(1).port);
    const result = await service.assessRebase(assess({ currentVersion: 1 }));

    expect(result.rebaseRequired).toBe(false);
    expect(result.reDecisionRequired).toBe(false);
    expect(result.because).toMatch(/still current/i);
  });
});

describe('T994h · the baseline moved and the impact did not', () => {
  it('requires a rebase, and the decision stands', async () => {
    // `FR-CHR-054`. The rebase is still a recorded act — a change that applied
    // to v2 having been decided against v1 must say so, even when nothing about
    // its impact changed.
    const store = await decided();
    const service = new RebaselineService(store, writerAt(2).port);
    const result = await service.assessRebase(assess());

    expect(result.rebaseRequired).toBe(true);
    expect(result.reDecisionRequired).toBe(false);
    expect(result.because).toMatch(/unchanged/i);
  });

  it('rewording a detail is not a change in impact', async () => {
    // Two runs of the same traversal can phrase themselves differently. A
    // re-decision triggered by rephrasing teaches people to click through them,
    // which is how the real ones stop being read.
    const store = await decided();
    const reworded = view('iv_2', {
      tests: { detail: 'traversed 41 reachable artifacts; nothing in this area' },
    });
    const service = new RebaselineService(store, writerAt(2).port);
    const result = await service.assessRebase(assess({ recomputed: reworded }));

    expect(result.reDecisionRequired).toBe(false);
  });
});

describe('T994h · the impact changed — re-decide', () => {
  it('when an area changed state', async () => {
    const store = await decided();
    const changed = view('iv_2', { tests: { state: 'impacted', itemCount: 12 } });
    const result = await new RebaselineService(store, writerAt(2).port).assessRebase(
      assess({ recomputed: changed }),
    );

    expect(result.reDecisionRequired).toBe(true);
    expect(result.because).toMatch(/tests/);
  });

  it('when an area changed count without changing state', async () => {
    // Three affected suites becoming thirty is the same state and a different
    // decision.
    const store = await decided(view('iv_1', { tests: { state: 'impacted', itemCount: 3 } }));
    const changed = view('iv_2', { tests: { state: 'impacted', itemCount: 30 } });
    const result = await new RebaselineService(store, writerAt(2).port).assessRebase(
      assess({ recomputed: changed }),
    );
    expect(result.reDecisionRequired).toBe(true);
  });

  it('when an area became undeterminable', async () => {
    // `not-impacted` → `unknown` is a loss of knowledge, and deciding again on
    // less than was known before is exactly the case `R-034-5` is for.
    const store = await decided();
    const changed = view('iv_2', {
      operations: { state: 'unknown', itemCount: null, detail: 'the runbook index is offline' },
    });
    const result = await new RebaselineService(store, writerAt(2).port).assessRebase(
      assess({ recomputed: changed }),
    );
    expect(result.reDecisionRequired).toBe(true);
    expect(result.because).toMatch(/operations/);
  });

  it('when the governed architecture decisions differ', async () => {
    const store = await decided();
    const changed = view('iv_2');
    const result = await new RebaselineService(store, writerAt(2).port).assessRebase(
      assess({
        recomputed: {
          ...changed,
          architecture: { ...changed.architecture, decisions: [] },
        },
      }),
    );
    expect(result.reDecisionRequired).toBe(true);
    expect(result.because).toMatch(/architecture-decisions/);
  });

  it('and when the retained view cannot be read at all', async () => {
    // Reporting "nothing changed" would be a claim about a view nobody can
    // read. Requiring the decision again is the only honest answer.
    const store = new InMemoryChangeRoomStore();
    await new DecisionService(store, permits, inbox).record({
      workspaceId: 'ws_1',
      changeRequestId: 'cr_1',
      decisionId: 'dec_1',
      impactViewId: 'iv_missing',
      decidedBy: 'u_2',
      decidedByKind: 'human',
      objectVersion: 1,
      options: OPTIONS,
      chosenOptionId: 'b',
      rationale: 'B keeps the migration reversible.',
      now: new Date('2026-08-30T12:00:00Z'),
    });
    const result = await new RebaselineService(store, writerAt(2).port).assessRebase(assess());

    expect(result.reDecisionRequired).toBe(true);
    expect(result.because).toMatch(/cannot be read/i);
  });

  it('an undecided change cannot be assessed', async () => {
    const store = new InMemoryChangeRoomStore();
    await expect(
      new RebaselineService(store, writerAt(2).port).assessRebase(assess()),
    ).rejects.toThrow(/no decision/i);
  });
});

describe('T994h · SC-CHR-009 — no silent retarget', () => {
  it('refuses to re-baseline onto a version the decision was not taken against', async () => {
    // THE failure this file exists to prevent. Without this the change would
    // apply to v2 with no error, and the approval, the impact view and the
    // trade-offs would all refer to v1.
    const store = await decided();
    const w = writerAt(2);
    const service = new RebaselineService(store, w.port);

    await expect(
      service.rebaseline({
        workspaceId: 'ws_1',
        projectId: 'pr_1',
        changeRequestId: 'cr_1',
        decidedAgainstVersion: 1,
        memberVersionIds: ['rv_1', 'rv_2'],
        approvedBy: 'u_2',
        rationale: 'the regulator shortened the window',
        evidenceContractRef: 'ec_2',
        now: new Date('2026-08-30T13:00:00Z'),
        requirementOf: (): string | null => null,
      }),
    ).rejects.toThrow(/decided against v1.*current.*v2|rebase/i);
  });

  it('and writes nothing when it refuses', async () => {
    const store = await decided();
    const w = writerAt(2);
    await expect(
      new RebaselineService(store, w.port).rebaseline({
        workspaceId: 'ws_1',
        projectId: 'pr_1',
        changeRequestId: 'cr_1',
        decidedAgainstVersion: 1,
        memberVersionIds: ['rv_1'],
        approvedBy: 'u_2',
        rationale: 'x',
        evidenceContractRef: null,
        now: new Date(),
        requirementOf: (): string | null => null,
      }),
    ).rejects.toThrow();
    expect(w.created).toHaveLength(0);
    expect(w.superseded).toHaveLength(0);
  });

  it('proceeds when the decision was taken against the current version', async () => {
    // The control. Without it, refusing every re-baseline would satisfy both
    // assertions above.
    const store = await decided();
    const w = writerAt(1);
    const result = await new RebaselineService(store, w.port).rebaseline({
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      changeRequestId: 'cr_1',
      decidedAgainstVersion: 1,
      memberVersionIds: ['rv_1', 'rv_2'],
      approvedBy: 'u_2',
      rationale: 'the regulator shortened the window',
      evidenceContractRef: 'ec_2',
      now: new Date('2026-08-30T13:00:00Z'),
      requirementOf: (): string | null => null,
    });
    expect(result.baseline.version).toBe(2);
    expect(w.superseded).toEqual([2]);
  });
});

describe('T994h · FR-CHR-013 — the rebase is a recorded act', () => {
  it('records which version the change was rebased from', async () => {
    const store = await decided();
    const service = new RebaselineService(store, writerAt(2).port);
    await store.create({
      id: 'cr_1',
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      roomObjectId: 'ro_1',
      targetBaselineId: 'b_1',
      targetBaselineVersion: 1,
      requestedOutcome: 'x',
      reason: 'y',
      requester: 'u_1',
      urgency: 'normal',
      openQuestions: [],
      origin: 'direct',
      originDefectRef: null,
      transferredEvidenceRefs: [],
      transferredContextRefs: [],
      state: 'decided',
      rebasedFrom: null,
      createdAt: new Date(),
    });

    const rebased = await service.recordRebase({
      workspaceId: 'ws_1',
      changeRequestId: 'cr_1',
      toBaselineId: 'b_2',
      toBaselineVersion: 2,
    });

    // `rebasedFrom` is the version it left, so the trail runs backwards from
    // wherever it ended up.
    expect(rebased.rebasedFrom).toBe(1);
    expect(rebased.targetBaselineVersion).toBe(2);
    expect(rebased.targetBaselineId).toBe('b_2');
  });

  it('and a rebase that goes nowhere is refused', async () => {
    const store = await decided();
    await store.create({
      id: 'cr_2',
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      roomObjectId: 'ro_1',
      targetBaselineId: 'b_1',
      targetBaselineVersion: 2,
      requestedOutcome: 'x',
      reason: 'y',
      requester: 'u_1',
      urgency: 'normal',
      openQuestions: [],
      origin: 'direct',
      originDefectRef: null,
      transferredEvidenceRefs: [],
      transferredContextRefs: [],
      state: 'decided',
      rebasedFrom: null,
      createdAt: new Date(),
    });
    await expect(
      new RebaselineService(store, writerAt(2).port).recordRebase({
        workspaceId: 'ws_1',
        changeRequestId: 'cr_2',
        toBaselineId: 'b_2',
        toBaselineVersion: 2,
      }),
    ).rejects.toThrow(/forward|already/i);
  });
});
