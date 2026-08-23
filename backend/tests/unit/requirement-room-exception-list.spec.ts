/**
 * T339e — exceptions on a baseline are enumerable **without opening each
 * requirement**. `FR-RQR-033`, `BR-0024`.
 *
 * **This is why `BaselineException` is a table and not a flag on the member**
 * (data-model §6). A waiver recorded per-requirement is a waiver you can only
 * find by looking at every requirement, and *"an exception that becomes
 * invisible is a rule waived once and then forgotten"*. Nobody opens thirty
 * requirements to check whether two of them were waived; they read the
 * baseline, see nothing, and conclude the set was clean.
 *
 * **"Without opening each requirement" is asserted as a property of the call,
 * not as prose.** The enumeration takes a **baseline id and nothing else** —
 * no member list, no requirement ids — so it cannot be satisfied by an
 * implementation that iterates members behind the caller's back. A signature
 * that accepted the members would let exactly that in.
 *
 * **Scoped, and opaque when it is not.** A baseline in another workspace is
 * indistinguishable from one that does not exist (`FR-002`, `SC-004`) — a
 * waiver list is a list of the places a rule was bent, and confirming a
 * baseline's existence through it would be a small leak of exactly the wrong
 * kind.
 */
import { describe, expect, it } from 'vitest';
import {
  BaselineService,
  type BaselineExceptionInput,
} from '../../src/modules/requirement-room/baseline.service.js';
import { IntakeService } from '../../src/modules/requirement-room/intake.service.js';
import { InMemoryRequirementRoomStore } from '../../src/modules/requirement-room/requirement-room.store.js';

const evidence = { isSatisfied: async () => ({ satisfied: true, unmet: [] as string[] }) };

const REASONS = [
  'Wording quality is judged at review, not by a measurable criterion.',
  'The behaviour is inherited from the platform and criteria live with it.',
  'Deferred to the next set by the product owner, with a date agreed.',
];

/** A baseline of `count` members, all missing criteria, all waived. */
async function baselineWithWaivers(count: number) {
  const store = new InMemoryRequirementRoomStore();
  const intake = new IntakeService(store);
  const candidates = await intake.intake({
    workspaceId: 'ws_1',
    projectId: 'pr_1',
    roomObjectId: 'ro_1',
    sourceRef: 'direct:2026-08-23',
    sourceKind: 'document',
    text: Array.from({ length: count }, (_, i) => `Requirement ${i + 1} must hold.`).join('\n\n'),
  });
  const baselines = new BaselineService(store, evidence);
  const exceptions: BaselineExceptionInput[] = candidates.map((_, i) => ({
    requirementVersionId: `rv_${i + 1}`,
    condition: 'missing-acceptance-criteria',
    authorizedBy: `user_${i + 1}`,
    reason: REASONS[i % REASONS.length]!,
  }));
  const result = await baselines.approve({
    workspaceId: 'ws_1',
    projectId: 'pr_1',
    members: candidates.map((c, i) => ({
      requirementVersionId: `rv_${i + 1}`,
      contentHash: `h${i}`,
      candidateId: c.id,
    })),
    approvedBy: 'user_1',
    rationale: 'Agreed, with the waivers below recorded against the set.',
    decisionId: 'rd_1',
    evidenceContractRef: 'ec_1',
    exceptions,
  });
  if (result.outcome !== 'approved') throw new Error(`expected approval: ${result.detail}`);
  return { store, baselines, baseline: result.baseline };
}

describe('T339e · every waiver on a baseline, in one call', () => {
  it('returns all of them from the baseline id alone', async () => {
    const { baselines, baseline } = await baselineWithWaivers(3);

    const listed = await baselines.exceptionsFor('ws_1', baseline.id);

    expect(listed).toHaveLength(3);
  });

  it('takes a baseline id and nothing else — the members are not the caller s problem', async () => {
    // FR-RQR-033 as a property of the signature. `(workspaceId, baselineId)`
    // cannot be satisfied by walking a member list the caller had to supply.
    expect(BaselineService.prototype.exceptionsFor.length).toBe(2);
  });

  it('carries who authorized each one and why, without a second lookup', async () => {
    const { baselines, baseline } = await baselineWithWaivers(3);

    const listed = await baselines.exceptionsFor('ws_1', baseline.id);

    // A list of ids would be enumerable and useless: the reader would open each
    // requirement anyway, which is the thing FR-RQR-033 forbids.
    expect(listed.map((e) => e.authorizedBy)).toEqual(['user_1', 'user_2', 'user_3']);
    for (const exception of listed) {
      expect(exception.reason.length).toBeGreaterThan(0);
      expect(exception.requirementVersionId).toMatch(/^rv_/);
    }
  });

  it('scales to a set nobody would page through by hand', async () => {
    const { baselines, baseline } = await baselineWithWaivers(30);

    const listed = await baselines.exceptionsFor('ws_1', baseline.id);

    // Thirty requirements is where "just open each one" stops happening, and
    // where a forgotten waiver starts being invisible in practice rather than
    // in principle.
    expect(listed).toHaveLength(30);
  });

  it('returns an empty list for a baseline with no waivers, not an error', async () => {
    const store = new InMemoryRequirementRoomStore();
    const intake = new IntakeService(store);
    const [candidate] = await intake.intake({
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      roomObjectId: 'ro_1',
      sourceRef: 'direct:2026-08-23',
      text: 'A clean requirement.',
    });
    await intake.declareCriteria({
      workspaceId: 'ws_1',
      candidateId: candidate!.id,
      acceptanceCriteria: ['Checked by the export test.'],
    });
    const baselines = new BaselineService(store, evidence);
    const result = await baselines.approve({
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      members: [{ requirementVersionId: 'rv_1', contentHash: 'h1', candidateId: candidate!.id }],
      approvedBy: 'user_1',
      rationale: 'Nothing waived.',
      decisionId: 'rd_1',
      evidenceContractRef: 'ec_1',
    });
    const baseline = result.outcome === 'approved' ? result.baseline : null;

    // "No waivers" and "cannot tell" must not look the same to a reader.
    expect(await baselines.exceptionsFor('ws_1', baseline!.id)).toEqual([]);
  });
});

describe('T339e · waivers stay attached to the baseline that carries them', () => {
  it('does not leak waivers between baselines', async () => {
    const { store, baselines, baseline } = await baselineWithWaivers(2);
    const intake = new IntakeService(store);
    const [clean] = await intake.intake({
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      roomObjectId: 'ro_1',
      sourceRef: 'direct:2026-08-23',
      text: 'A later, clean requirement.',
    });
    await intake.declareCriteria({
      workspaceId: 'ws_1',
      candidateId: clean!.id,
      acceptanceCriteria: ['Checked by the later test.'],
    });
    const second = await baselines.approve({
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      members: [{ requirementVersionId: 'rv_99', contentHash: 'h99', candidateId: clean!.id }],
      approvedBy: 'user_1',
      rationale: 'The next set, with nothing waived.',
      decisionId: 'rd_2',
      evidenceContractRef: 'ec_1',
    });
    const later = second.outcome === 'approved' ? second.baseline : null;

    expect(await baselines.exceptionsFor('ws_1', baseline.id)).toHaveLength(2);
    expect(await baselines.exceptionsFor('ws_1', later!.id)).toEqual([]);
  });

  it('refuses a baseline in another workspace the same way as one that does not exist', async () => {
    const { baselines, baseline } = await baselineWithWaivers(1);

    await expect(baselines.exceptionsFor('ws_other', baseline.id)).rejects.toThrow(/Not found/);
    await expect(baselines.exceptionsFor('ws_1', 'no-such-baseline')).rejects.toThrow(/Not found/);
  });

  it('still lists the waivers of a superseded baseline', async () => {
    const { store, baselines, baseline } = await baselineWithWaivers(2);
    await store.supersede(baseline.id, 2);

    // FR-RQR-052 keeps a superseded baseline READABLE, and its waivers are part
    // of what it says. A waiver that disappears when the set is replaced is the
    // forgotten rule arriving one supersession later.
    expect(await baselines.exceptionsFor('ws_1', baseline.id)).toHaveLength(2);
  });
});
