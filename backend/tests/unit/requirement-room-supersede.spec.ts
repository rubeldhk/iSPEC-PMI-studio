/**
 * T338i — a superseded baseline stays readable and names what replaced it.
 * `FR-RQR-052`, `RULE-02`, `BR-0026`.
 *
 * **Supersession is the only thing a baseline row ever accepts after it is
 * written**, which is exactly what `reject_baseline_rewrite` permits and
 * nothing more. `RequirementRoomStore` offers no update and no delete for a
 * baseline, so the service cannot do at its layer what the database refuses at
 * the row — the two would otherwise disagree only in production.
 *
 * **Readable is not the same as governing**, and this file asserts both halves.
 * A superseded baseline can still be read in full — that is what makes an
 * approval auditable a year later. It no longer freezes its members, because a
 * set that kept governing after being replaced would make every requirement
 * permanently uneditable after its first baseline (`T338g` asserts the
 * consequence; this asserts the state).
 *
 * **Supersession is explicit, never inferred from overlap.** An approval that
 * silently replaced whatever it overlapped would be the merge `FR-RQR-054`
 * forbids, arriving under a different name. `T338j` covers the other side of
 * that line.
 */
import { describe, expect, it } from 'vitest';
import {
  BaselineService,
  type ApprovalMember,
  type ApproveBaselineInput,
} from '../../src/modules/requirement-room/baseline.service.js';
import { InMemoryRequirementRoomStore } from '../../src/modules/requirement-room/requirement-room.store.js';

const MEMBERS: readonly ApprovalMember[] = [
  { requirementVersionId: 'rv_1', contentHash: 'hash_one', candidateId: 'cand_rv_1' },
  { requirementVersionId: 'rv_2', contentHash: 'hash_two', candidateId: 'cand_rv_2' },
];

/** Stands in for `EPIC-032`. Test-local by design — `T338c` asserts the module ships none. */
function evidence(satisfied = true, unmet: readonly string[] = []) {
  return { isSatisfied: async () => ({ satisfied, unmet }) };
}

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

async function service(satisfied = true) {
  const store = new InMemoryRequirementRoomStore();
  await seedCandidates(store, ['rv_1', 'rv_2', 'rv_9']);
  return { baselines: new BaselineService(store, evidence(satisfied)), store };
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

async function approved(baselines: BaselineService, over: Partial<ApproveBaselineInput> = {}) {
  const result = await baselines.approve(approval(over));
  if (result.outcome !== 'approved') {
    throw new Error(`expected an approval, got ${result.outcome}: ${result.detail}`);
  }
  return result.baseline;
}

describe('T338i · a superseded baseline names what replaced it', () => {
  it('records the superseding version on the baseline it replaced', async () => {
    const { baselines, store } = await service();
    const first = await approved(baselines);
    const second = await approved(baselines, { supersedes: first.version, decisionId: 'rd_2' });

    const reread = await store.findBaselineById(first.id);
    expect(reread?.supersededBy).toBe(second.version);
  });

  it('leaves the replacement current', async () => {
    const { baselines } = await service();
    const first = await approved(baselines);
    const second = await approved(baselines, { supersedes: first.version, decisionId: 'rd_2' });

    expect(second.supersededBy).toBeNull();
  });

  it('supersedes only when asked, so an unrelated approval leaves it current', async () => {
    const { baselines, store } = await service();
    const first = await approved(baselines);
    await approved(baselines, {
      members: [{ requirementVersionId: 'rv_9', contentHash: 'hash_nine', candidateId: 'cand_rv_9' }],
      decisionId: 'rd_2',
    });

    // Inferring supersession from a later approval would be the merge
    // FR-RQR-054 forbids, wearing a different name.
    expect((await store.findBaselineById(first.id))?.supersededBy).toBeNull();
  });
});

describe('T338i · a superseded baseline remains readable, in full', () => {
  it('keeps every field it was approved with', async () => {
    const { baselines, store } = await service();
    const first = await approved(baselines);
    const second = await approved(baselines, { supersedes: first.version, decisionId: 'rd_2' });

    const reread = await store.findBaselineById(first.id);
    // Everything except `supersededBy` is byte-identical. This is the trigger's
    // rule asserted from the service side: an approval a year old must still
    // say what it approved, who approved it and why.
    expect({ ...reread, supersededBy: null }).toEqual({ ...first, supersededBy: null });
    expect(reread?.supersededBy).toBe(second.version);
  });

  it('still appears when the projects baselines are listed', async () => {
    const { baselines, store } = await service();
    const first = await approved(baselines);
    await approved(baselines, { supersedes: first.version, decisionId: 'rd_2' });

    const all = await store.listBaselines('ws_1', 'pr_1');
    // A superseded baseline filtered out of the list is a superseded baseline
    // nobody can read — FR-RQR-052 with the readability quietly removed.
    expect(all.map((b) => b.version)).toEqual([1, 2]);
  });

  it('keeps its own version number — versions are never reused', async () => {
    const { baselines } = await service();
    const first = await approved(baselines);
    const second = await approved(baselines, { supersedes: first.version, decisionId: 'rd_2' });
    const third = await approved(baselines, { supersedes: second.version, decisionId: 'rd_3' });

    expect([first.version, second.version, third.version]).toEqual([1, 2, 3]);
  });
});

describe('T338i · supersession refuses what it cannot do', () => {
  it('refuses to supersede a version that does not exist', async () => {
    const { baselines } = await service();
    const result = await baselines.approve(approval({ supersedes: 7 }));

    expect(result.outcome).toBe('refused');
    expect(result.outcome === 'refused' && result.reason).toBe('supersedes-unknown-baseline');
  });

  it('refuses to supersede a baseline that is already superseded', async () => {
    const { baselines } = await service();
    const first = await approved(baselines);
    await approved(baselines, { supersedes: first.version, decisionId: 'rd_2' });

    // Two baselines both claiming to have replaced v1 leaves the history with
    // no single answer to "what replaced it", which is the whole of FR-RQR-052.
    const third = await baselines.approve(approval({ supersedes: first.version, decisionId: 'rd_3' }));

    expect(third.outcome === 'refused' && third.reason).toBe('supersedes-superseded-baseline');
  });

  it('writes no baseline at all when supersession is refused', async () => {
    const { baselines, store } = await service();
    await baselines.approve(approval({ supersedes: 7 }));

    // A refused approval that still consumed a version number leaves a gap in
    // the history and the question of what happened to it.
    expect(await store.listBaselines('ws_1', 'pr_1')).toEqual([]);
  });
});
