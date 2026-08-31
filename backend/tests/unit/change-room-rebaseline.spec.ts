/**
 * `T994d`, `T994e` (EPIC-034) — an approved change re-baselines.
 *
 * `FR-CHR-060`: new versions of every affected artifact. `FR-CHR-061`: the prior
 * baseline remains **readable and unchanged**, and identifies what superseded
 * it. `SC-CHR-004`: 100% of approved changes, with the prior baseline
 * **byte-identical**.
 *
 * ## The tension in FR-CHR-061, and how it resolves
 *
 * "Unchanged" and "identifies what superseded it" cannot both be literally true
 * of every field: naming a successor is a change. `EPIC-033` settled it in
 * `requirement-room.store.prisma.ts` — `supersede` **updates** rather than
 * deletes, and *"only `supersededBy` moves"*.
 *
 * So byte-identical is asserted field by field with `supersededBy` named as the
 * single exception, rather than by comparing two whole objects and hoping. In
 * particular `memberVersionIds` and `setHash` must be untouched: those are what
 * the baseline **is**, and a re-baseline that edited them in place would
 * rewrite history rather than extend it.
 *
 * ## FR-CHR-050's ordering
 *
 * A baseline does not move without a decision. That is checked here rather than
 * left to callers, because "an authorized decision before implementation
 * affects an approved baseline" is only a sentence until something refuses to
 * proceed without one.
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

const PRIOR: BaselineSnapshot = Object.freeze({
  id: 'b_1',
  projectId: 'pr_1',
  version: 1,
  memberVersionIds: Object.freeze(['rv_1', 'rv_2', 'rv_3']) as readonly string[],
  setHash: 'sha256:prior',
  approvedBy: 'u_0',
  approvedAt: new Date('2026-08-01T00:00:00Z'),
  rationale: 'the original set',
  decisionId: 'dec_0',
  supersededBy: null,
  evidenceContractRef: 'ec_1',
});

/** A writer that records what it was asked to do, so the test can read it back. */
function writer(prior: BaselineSnapshot = PRIOR) {
  const state = { ...prior };
  const created: BaselineSnapshot[] = [];
  const port: BaselineWriterPort = {
    async current(_workspaceId, _projectId) {
      return state.supersededBy === null ? state : null;
    },
    async approve(input) {
      const next: BaselineSnapshot = {
        id: `b_${input.version}`,
        projectId: input.projectId,
        version: input.version,
        memberVersionIds: input.memberVersionIds,
        setHash: `sha256:v${input.version}`,
        approvedBy: input.approvedBy,
        approvedAt: input.approvedAt,
        rationale: input.rationale,
        decisionId: input.decisionId,
        supersededBy: null,
        evidenceContractRef: input.evidenceContractRef,
      };
      created.push(next);
      return next;
    },
    async supersede(_id, byVersion) {
      state.supersededBy = byVersion;
      return state;
    },
  };
  return { port, state, created };
}

async function decided(store: InMemoryChangeRoomStore): Promise<void> {
  await new DecisionService(store, permits, inbox).record({
    workspaceId: 'ws_1',
    changeRequestId: 'cr_1',
    decisionId: 'dec_1',
    impactViewId: 'iv_1',
    decidedBy: 'u_2',
    decidedByKind: 'human',
    objectVersion: 1,
    options: OPTIONS,
    chosenOptionId: 'b',
    rationale: 'B keeps the migration reversible.',
    now: new Date('2026-08-30T12:00:00Z'),
  });
}

const input = (over: Record<string, unknown> = {}) => ({
  workspaceId: 'ws_1',
  projectId: 'pr_1',
  changeRequestId: 'cr_1',
  // `SC-CHR-009` — the version the decision was taken against, compared with
  // what is current. Required, so a caller cannot omit it and get a silent
  // retarget onto whatever happens to be current.
  decidedAgainstVersion: 1,
  // `FR-CHR-060` — the new versions of every affected artifact, resolved by the
  // caller through `EPIC-007` exactly as `assertEditable` requires.
  memberVersionIds: ['rv_1', 'rv_2b', 'rv_4'],
  approvedBy: 'u_2',
  rationale: 'the regulator shortened the window',
  evidenceContractRef: 'ec_2',
  now: new Date('2026-08-30T13:00:00Z'),
  // `R-034-4`'s join, required so a missing one cannot silently turn a version
  // change into a deletion plus an arrival.
  requirementOf: (versionId: string): string | null =>
    ({ rv_1: 'req_1', rv_2: 'req_2', rv_2b: 'req_2', rv_3: 'req_3', rv_4: 'req_4' })[versionId] ??
    null,
  ...over,
});

async function fixture() {
  const store = new InMemoryChangeRoomStore();
  await decided(store);
  const w = writer();
  return { store, w, service: new RebaselineService(store, w.port) };
}

describe('T994d · a new baseline version is created', () => {
  it('at the next version, never reusing one', async () => {
    const { service, w } = await fixture();
    const result = await service.rebaseline(input());
    expect(result.baseline.version).toBe(2);
    expect(w.created).toHaveLength(1);
  });

  it('carrying the member versions it was given', async () => {
    // `FR-CHR-060`. New versions of every affected artifact — resolved by the
    // caller, because turning requirements into version ids means holding
    // `EPIC-007`'s register (`FR-RQR-002`).
    const { service } = await fixture();
    const result = await service.rebaseline(input());
    expect([...result.baseline.memberVersionIds]).toEqual(['rv_1', 'rv_2b', 'rv_4']);
  });

  it('and its own set hash, not the prior one', async () => {
    // Two baselines sharing a hash would make `R-033-5`'s integrity check
    // report that nothing changed.
    const { service } = await fixture();
    const result = await service.rebaseline(input());
    expect(result.baseline.setHash).not.toBe(PRIOR.setHash);
  });

  it('citing the decision that authorised it', async () => {
    const { service } = await fixture();
    const result = await service.rebaseline(input());
    expect(result.baseline.decisionId).toBe('dec_1');
  });
});

describe('T994d · FR-CHR-061 — the prior baseline is untouched', () => {
  it('except that it names its successor', async () => {
    const { service, w } = await fixture();
    await service.rebaseline(input());
    expect(w.state.supersededBy).toBe(2);
  });

  it('and every other field is byte-identical', async () => {
    // `SC-CHR-004`. Asserted field by field with `supersededBy` named as the
    // single exception — comparing two whole objects would pass the day
    // somebody added a field nobody thought about.
    const { service, w } = await fixture();
    await service.rebaseline(input());

    const { supersededBy: _prior, ...before } = PRIOR;
    const { supersededBy: _after, ...after } = w.state;
    expect(after).toEqual(before);
  });

  it('its members in particular', async () => {
    // What the baseline IS. A re-baseline that edited these in place would
    // rewrite history rather than extend it.
    const { service, w } = await fixture();
    await service.rebaseline(input());
    expect([...w.state.memberVersionIds]).toEqual(['rv_1', 'rv_2', 'rv_3']);
    expect(w.state.setHash).toBe('sha256:prior');
  });

  it('and its approver and rationale, which belong to that approval', async () => {
    const { service, w } = await fixture();
    await service.rebaseline(input());
    expect(w.state.approvedBy).toBe('u_0');
    expect(w.state.rationale).toBe('the original set');
  });
});

describe('T994d · FR-CHR-050 — no decision, no baseline move', () => {
  it('refuses when nothing has been decided', async () => {
    // The ordering, enforced rather than assumed. Until something refuses to
    // proceed without a decision, "decided before implementation affects a
    // baseline" is a sentence.
    const store = new InMemoryChangeRoomStore();
    const w = writer();
    const service = new RebaselineService(store, w.port);
    await expect(service.rebaseline(input())).rejects.toThrow(/no decision/i);
  });

  it('and writes nothing when it refuses', async () => {
    const store = new InMemoryChangeRoomStore();
    const w = writer();
    await expect(new RebaselineService(store, w.port).rebaseline(input())).rejects.toThrow();
    expect(w.created).toHaveLength(0);
    expect(w.state.supersededBy).toBeNull();
  });

  it('proceeds once one exists — or the refusal proves nothing', async () => {
    const { service, w } = await fixture();
    await service.rebaseline(input());
    expect(w.created).toHaveLength(1);
  });
});

describe('T994d · what else it refuses', () => {
  it('an empty member set', async () => {
    // A baseline with no members is not a baseline; it is a deletion wearing
    // one's clothes.
    const { service } = await fixture();
    await expect(service.rebaseline(input({ memberVersionIds: [] }))).rejects.toThrow(
      /at least one member/i,
    );
  });

  it('a project with no current baseline', async () => {
    // Re-baselining supersedes something. With nothing current there is
    // nothing to supersede, and `EPIC-033`'s approve path is where a first
    // baseline comes from.
    const store = new InMemoryChangeRoomStore();
    await decided(store);
    const w = writer({ ...PRIOR, supersededBy: 9 });
    await expect(new RebaselineService(store, w.port).rebaseline(input())).rejects.toThrow(
      /no current baseline/i,
    );
  });

  it('an unbound baseline writer', async () => {
    // `CHANGE_ROOM_PORTS` — the baseline seam refuses when absent. A change
    // with no target has nothing to be a change to.
    const store = new InMemoryChangeRoomStore();
    await decided(store);
    await expect(new RebaselineService(store, undefined).rebaseline(input())).rejects.toThrow(
      /EPIC-033/,
    );
  });
});
