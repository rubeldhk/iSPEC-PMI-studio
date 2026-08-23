/**
 * T338j — overlapping approval is a conflict, never a merge (`FR-RQR-054`), and
 * a revised source document after baseline is new intent (`FR-RQR-055`).
 *
 * **Two requirements, one failure mode.** Both describe something arriving that
 * *could* be folded into an approved set, and both say it must not be. A merge
 * changes what an approval approved after the fact, silently — the approver
 * signed off on one set and the record shows another. That is the same harm
 * `RULE-02` names, arriving through concurrency instead of through an edit.
 *
 * **`FR-RQR-054` is asserted in two layers, because the race has two shapes.**
 * Two approvals that overlap and are *both visible* to the service are refused
 * by the overlap check. Two that genuinely interleave — each reading
 * `nextBaselineVersion` before the other writes — are caught by the unique
 * `(projectId, version)` index, and the in-memory store reproduces that refusal
 * so the two paths cannot diverge. A service check alone would let the second
 * writer through in production and nowhere else.
 *
 * **`FR-RQR-055` is asserted as an absence**, which is the harder half: the
 * revised document produces candidates and the baseline is byte-identical
 * afterwards. A test that only checked "new candidates exist" would pass over
 * an implementation that also quietly moved the baseline.
 */
import { describe, expect, it } from 'vitest';
import {
  BaselineService,
  type ApprovalMember,
  type ApproveBaselineInput,
} from '../../src/modules/requirement-room/baseline.service.js';
import { IntakeService } from '../../src/modules/requirement-room/intake.service.js';
import { InMemoryRequirementRoomStore } from '../../src/modules/requirement-room/requirement-room.store.js';

const MEMBERS: readonly ApprovalMember[] = [
  { requirementVersionId: 'rv_1', contentHash: 'hash_one', candidateId: 'cand_rv_1' },
  { requirementVersionId: 'rv_2', contentHash: 'hash_two', candidateId: 'cand_rv_2' },
];

/** Stands in for `EPIC-032`. Test-local by design. */
const evidence = { isSatisfied: async () => ({ satisfied: true, unmet: [] as string[] }) };

/**
 * `T339b` added the acceptance-criteria gate: an approval now names the Room
 * candidate each frozen version came from, and the gate reads criteria from
 * this Room's own rows rather than from the request. So these fixtures seed a
 * real candidate per member, with criteria stated. A member naming no candidate
 * is refused as `criteria-unverifiable`, and `requirement-room-criteria.spec.ts`
 * owns that case.
 */
async function seedCandidates(store: InMemoryRequirementRoomStore, versionIds: readonly string[]) {
  await store.createCandidates(
    versionIds.map((versionId, index) => ({
      id: `cand_${versionId}`,
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      roomObjectId: 'ro_1',
      sourceRef: 'direct:2026-08-23',
      normalizedText: `Requirement ${index + 1}.`,
      epistemic: 'fact' as const,
      aiAnalysis: null,
      promotedTo: null,
      acceptanceCriteria: [`Verified by the check for requirement ${index + 1}.`],
      intendedForImplementation: true,
      createdAt: new Date(),
    })),
  );
}

async function service() {
  const store = new InMemoryRequirementRoomStore();
  await seedCandidates(store, ['rv_1', 'rv_2', 'rv_3', 'rv_9']);
  return { baselines: new BaselineService(store, evidence), store };
}

function approval(over: Partial<ApproveBaselineInput> = {}): ApproveBaselineInput {
  return {
    workspaceId: 'ws_1',
    projectId: 'pr_1',
    members: MEMBERS,
    approvedBy: 'user_1',
    rationale: 'The set is agreed and its acceptance criteria are measurable.',
    decisionId: 'rd_1',
    evidenceContractRef: 'ec_1',
    ...over,
  };
}

describe('T338j · overlapping approval is refused as a conflict', () => {
  it('refuses a second approval that freezes a member already frozen', async () => {
    const { baselines } = await service();
    await baselines.approve(approval());

    const second = await baselines.approve(
      approval({
        members: [
          { requirementVersionId: 'rv_2', contentHash: 'hash_two', candidateId: 'cand_rv_2' },
          { requirementVersionId: 'rv_3', contentHash: 'hash_three', candidateId: 'cand_rv_3' },
        ],
        decisionId: 'rd_2',
      }),
    );

    expect(second.outcome).toBe('refused');
    expect(second.outcome === 'refused' && second.reason).toBe('overlapping-scope-conflict');
  });

  it('names the overlapping members and the baseline holding them', async () => {
    const { baselines } = await service();
    const first = await baselines.approve(approval());

    const second = await baselines.approve(
      approval({
        members: [{ requirementVersionId: 'rv_1', contentHash: 'hash_one', candidateId: 'cand_rv_1' }],
        decisionId: 'rd_2',
      }),
    );

    // A conflict a user cannot act on is a refusal with extra steps: they need
    // to know WHICH requirements and WHOSE approval they are colliding with.
    expect(second.outcome === 'refused' && second.detail).toMatch(/rv_1/);
    expect(second.outcome === 'refused' && second.detail).toMatch(
      new RegExp(`v${first.outcome === 'approved' ? first.baseline.version : 0}`),
    );
  });

  it('merges nothing — the first baseline is untouched by the refused second', async () => {
    const { baselines, store } = await service();
    const first = await baselines.approve(approval());
    const before = first.outcome === 'approved' ? first.baseline : null;

    await baselines.approve(
      approval({
        members: [...MEMBERS, { requirementVersionId: 'rv_3', contentHash: 'hash_three', candidateId: 'cand_rv_3' }],
        decisionId: 'rd_2',
      }),
    );

    // The tempting "helpful" behaviour is to widen v1 to include rv_3. That
    // changes what was approved, after it was approved, without a decision.
    expect(await store.findBaselineById(before!.id)).toEqual(before);
  });

  it('permits an overlapping approval that explicitly supersedes the holder', async () => {
    const { baselines } = await service();
    const first = await baselines.approve(approval());
    const version = first.outcome === 'approved' ? first.baseline.version : 0;

    const second = await baselines.approve(approval({ supersedes: version, decisionId: 'rd_2' }));

    // Anti-vacuity, and the line itself: replacing a set is a decision somebody
    // takes, and it overlaps by definition. Refusing here would make FR-RQR-052
    // unreachable.
    expect(second.outcome).toBe('approved');
  });

  it('still refuses overlap with a DIFFERENT current baseline while superseding one', async () => {
    const { baselines } = await service();
    const first = await baselines.approve(approval());
    const other = await baselines.approve(
      approval({
        members: [{ requirementVersionId: 'rv_9', contentHash: 'hash_nine', candidateId: 'cand_rv_9' }],
        decisionId: 'rd_2',
      }),
    );
    const firstVersion = first.outcome === 'approved' ? first.baseline.version : 0;

    const third = await baselines.approve(
      approval({
        members: [...MEMBERS, { requirementVersionId: 'rv_9', contentHash: 'hash_nine', candidateId: 'cand_rv_9' }],
        supersedes: firstVersion,
        decisionId: 'rd_3',
      }),
    );

    expect(other.outcome).toBe('approved');
    expect(third.outcome === 'refused' && third.reason).toBe('overlapping-scope-conflict');
  });

  it('ignores superseded baselines when looking for overlap', async () => {
    const { baselines } = await service();
    const first = await baselines.approve(approval());
    const version = first.outcome === 'approved' ? first.baseline.version : 0;
    await baselines.approve(approval({ supersedes: version, decisionId: 'rd_2' }));

    // v1 is superseded and no longer freezes rv_1. A third approval that
    // supersedes v2 must not collide with the set v1 used to hold.
    const third = await baselines.approve(approval({ supersedes: 2, decisionId: 'rd_3' }));

    expect(third.outcome).toBe('approved');
  });
});

describe('T338j · a genuine race is refused at the store, not merged', () => {
  it('refuses the second writer when both took the same version number', async () => {
    const { store } = await service();
    const row = {
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      version: 1,
      memberVersionIds: ['rv_1'],
      setHash: 'set_hash',
      approvedBy: 'user_1',
      approvedAt: new Date(),
      rationale: 'because',
      decisionId: 'rd_1',
      supersededBy: null,
      evidenceContractRef: null,
    };
    await store.createBaseline({ ...row, id: 'b_1' });

    // The `baselines_projectId_version_key` unique index, in memory. Without
    // this the in-memory path is the one that silently accepts a second
    // approval at the same version, and the two implementations of the same
    // port disagree in exactly the case that matters.
    await expect(store.createBaseline({ ...row, id: 'b_2' })).rejects.toThrow(/version 1/);
  });
});

describe('T338j · a revised source document is new intent, and moves nothing', () => {
  it('produces new candidates', async () => {
    const store = new InMemoryRequirementRoomStore();
    const intake = new IntakeService(store);
    const revised = await intake.intake({
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      roomObjectId: 'ro_1',
      sourceRef: 'upload:stakeholder-brief.md@rev2',
      sourceKind: 'document',
      text: 'Baselines must be immutable.\n\nAnd exceptions must be enumerable.',
    });

    expect(revised).toHaveLength(2);
    expect(revised.every((c) => c.promotedTo === null)).toBe(true);
  });

  it('leaves an existing baseline byte-identical', async () => {
    const store = new InMemoryRequirementRoomStore();
    await seedCandidates(store, ['rv_1', 'rv_2', 'rv_3', 'rv_9']);
    const baselines = new BaselineService(store, evidence);
    const intake = new IntakeService(store);
    const approvedResult = await baselines.approve(approval());
    const before = approvedResult.outcome === 'approved' ? approvedResult.baseline : null;

    await intake.intake({
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      roomObjectId: 'ro_1',
      sourceRef: 'upload:stakeholder-brief.md@rev2',
      sourceKind: 'document',
      text: 'The same requirement, reworded after approval.',
    });

    // FR-RQR-055 stated as an absence: not "the revision was recorded" — which
    // an implementation that also moved the baseline would satisfy — but "the
    // baseline did not move".
    expect(await store.findBaselineById(before!.id)).toEqual(before);
  });
});

describe('T338j · the Evidence Contract gates approval — FR-RQR-053', () => {
  it('refuses an approval whose contract is unsatisfied, naming what is unmet', async () => {
    const store = new InMemoryRequirementRoomStore();
    await seedCandidates(store, ['rv_1', 'rv_2', 'rv_3', 'rv_9']);
    const baselines = new BaselineService(store, {
      isSatisfied: async () => ({ satisfied: false, unmet: ['acceptance-criteria', 'sign-off'] }),
    });

    const result = await baselines.approve(approval());

    // BR-0144: declaring completion is not the evidence.
    expect(result.outcome === 'refused' && result.reason).toBe('evidence-contract-unsatisfied');
    expect(result.outcome === 'refused' && result.detail).toMatch(/acceptance-criteria/);
    expect(await store.listBaselines('ws_1', 'pr_1')).toEqual([]);
  });

  it('refuses when the EPIC-032 seam is unbound, rather than approving without it', async () => {
    const store = new InMemoryRequirementRoomStore();
    await seedCandidates(store, ['rv_1', 'rv_2', 'rv_3', 'rv_9']);
    const baselines = new BaselineService(store, undefined);

    // ROOM_PORTS declares `refuse` for EvidenceContractSource. An unevaluated
    // contract is indistinguishable at the call site from a satisfied one,
    // which is the whole reason it is not defaulted.
    await expect(baselines.approve(approval())).rejects.toThrow(/EPIC-032/);
  });
});
