/**
 * T339a — nothing baselines without measurable acceptance criteria.
 * `FR-RQR-030`, `FR-RQR-031`, `SC-RQR-003`, `BR-0024`. Quickstart Scenario 4.
 *
 * **This is where `BG-01`'s *"fewer requirement-origin defects"* actually comes
 * from.** A requirement that reaches implementation with no way to tell whether
 * it was met produces a defect later, and the defect gets filed against the
 * build rather than against the requirement that could not be checked.
 *
 * **The gate reads data this Room owns.** Criteria live on the candidate
 * (`requirement_candidates.acceptanceCriteria`, migration
 * `20260823020000_epic033_acceptance_criteria`), and an approval names which
 * candidate each frozen version came from. It does **not** carry its own answer
 * to *"does this have criteria"* — a caller that supplied that could assert its
 * way past `SC-RQR-003`'s **zero**, and zero is the whole requirement.
 *
 * **It fails closed twice over.** `intendedForImplementation` defaults **true**,
 * so a candidate nobody looked at blocks rather than sails through; and a member
 * the Room cannot resolve to a candidate is refused rather than waved past. The
 * documented escape from both is `FR-RQR-032`'s recorded exception — which is
 * visible, attributed and enumerable — never a silent pass.
 *
 * **What "measurable" means here, honestly.** What a rule can check exactly is
 * that criteria were **stated**. Judging whether they are *measurable* is a
 * human's job and the analysis half's; a regex claiming to detect measurability
 * would put a heuristic between a requirement and its baseline and call the
 * result a guarantee. The exception mechanism is what carries the cases where
 * the judgement goes the other way.
 */
import { describe, expect, it } from 'vitest';
import {
  BaselineService,
  type ApproveBaselineInput,
} from '../../src/modules/requirement-room/baseline.service.js';
import { IntakeService } from '../../src/modules/requirement-room/intake.service.js';
import { InMemoryRequirementRoomStore } from '../../src/modules/requirement-room/requirement-room.store.js';

const evidence = { isSatisfied: async () => ({ satisfied: true, unmet: [] as string[] }) };

async function fixture() {
  const store = new InMemoryRequirementRoomStore();
  const intake = new IntakeService(store);
  const [candidate] = await intake.intake({
    workspaceId: 'ws_1',
    projectId: 'pr_1',
    roomObjectId: 'ro_1',
    sourceRef: 'direct:2026-08-23',
    text: 'A session that expires mid-review must return the reviewer to their place.',
  });
  return {
    store,
    intake,
    candidate: candidate!,
    baselines: new BaselineService(store, evidence),
  };
}

function approval(over: Partial<ApproveBaselineInput> = {}): ApproveBaselineInput {
  return {
    workspaceId: 'ws_1',
    projectId: 'pr_1',
    members: [],
    approvedBy: 'user_1',
    rationale: 'The set is agreed.',
    decisionId: 'rd_1',
    evidenceContractRef: 'ec_1',
    ...over,
  };
}

describe('T339a · a requirement intended for implementation needs criteria', () => {
  it('refuses the baseline when a member has none', async () => {
    const { baselines, candidate } = await fixture();

    const result = await baselines.approve(
      approval({
        members: [
          { requirementVersionId: 'rv_1', contentHash: 'h1', candidateId: candidate.id },
        ],
      }),
    );

    expect(result.outcome).toBe('refused');
    expect(result.outcome === 'refused' && result.reason).toBe('acceptance-criteria-missing');
  });

  it('names the requirement, so the refusal can be acted on — FR-RQR-031', async () => {
    const { baselines, candidate } = await fixture();

    const result = await baselines.approve(
      approval({
        members: [
          { requirementVersionId: 'rv_1', contentHash: 'h1', candidateId: candidate.id },
        ],
      }),
    );

    // "Baseline refused" with nothing named is the generic error the platform
    // contract calls a defect. The reader has to know WHICH requirement.
    expect(result.outcome === 'refused' && result.detail).toMatch(/rv_1/);
    expect(result.outcome === 'refused' && result.detail).toMatch(/expires mid-review/);
  });

  it('writes no baseline when the gate refuses', async () => {
    const { baselines, store, candidate } = await fixture();

    await baselines.approve(
      approval({
        members: [
          { requirementVersionId: 'rv_1', contentHash: 'h1', candidateId: candidate.id },
        ],
      }),
    );

    expect(await store.listBaselines('ws_1', 'pr_1')).toEqual([]);
  });

  it('proceeds once criteria are stated', async () => {
    const { baselines, intake, candidate } = await fixture();
    await intake.declareCriteria({
      workspaceId: 'ws_1',
      candidateId: candidate.id,
      acceptanceCriteria: ['Reviewer returns to the same item after re-authentication.'],
    });

    const result = await baselines.approve(
      approval({
        members: [
          { requirementVersionId: 'rv_1', contentHash: 'h1', candidateId: candidate.id },
        ],
      }),
    );

    // Anti-vacuity: without this, a gate that refused every approval would pass
    // every assertion above.
    expect(result.outcome).toBe('approved');
  });

  it('proceeds for a candidate declared not intended for implementation', async () => {
    const { baselines, intake, candidate } = await fixture();
    await intake.declareCriteria({
      workspaceId: 'ws_1',
      candidateId: candidate.id,
      intendedForImplementation: false,
    });

    const result = await baselines.approve(
      approval({
        members: [
          { requirementVersionId: 'rv_1', contentHash: 'h1', candidateId: candidate.id },
        ],
      }),
    );

    expect(result.outcome).toBe('approved');
  });

  it('names every member that is missing criteria, not just the first', async () => {
    const { store, baselines } = await fixture();
    const intake = new IntakeService(store);
    const more = await intake.intake({
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      roomObjectId: 'ro_1',
      sourceRef: 'direct:2026-08-23',
      sourceKind: 'document',
      text: 'A must hold.\n\nB must hold.',
    });

    const result = await baselines.approve(
      approval({
        members: more.map((c, i) => ({
          requirementVersionId: `rv_${i + 9}`,
          contentHash: `h${i}`,
          candidateId: c.id,
        })),
      }),
    );

    // Naming one sends the approver round the loop once per missing member.
    expect(result.outcome === 'refused' && result.detail).toMatch(/rv_9/);
    expect(result.outcome === 'refused' && result.detail).toMatch(/rv_10/);
  });
});

describe('T339a · the gate fails closed', () => {
  it('treats an untouched candidate as needing criteria', async () => {
    const { baselines, candidate, store } = await fixture();
    const stored = await store.findCandidateById(candidate.id);

    // The default that matters. `false` here would fire the gate only for
    // candidates somebody had already flagged — indistinguishable, at approval,
    // from a requirement that genuinely needed nothing.
    expect(stored?.intendedForImplementation).toBe(true);
    expect(stored?.acceptanceCriteria).toBeNull();

    const result = await baselines.approve(
      approval({
        members: [
          { requirementVersionId: 'rv_1', contentHash: 'h1', candidateId: candidate.id },
        ],
      }),
    );
    expect(result.outcome).toBe('refused');
  });

  it('refuses a member it cannot resolve to a candidate', async () => {
    const { baselines } = await fixture();

    const result = await baselines.approve(
      approval({ members: [{ requirementVersionId: 'rv_1', contentHash: 'h1' }] }),
    );

    // A member the Room cannot check is a member it cannot gate, and
    // SC-RQR-003 says zero. The escape is a recorded exception, not a shrug.
    expect(result.outcome === 'refused' && result.reason).toBe('criteria-unverifiable');
  });

  it('refuses a candidate id from another workspace, without confirming it exists', async () => {
    const { baselines, candidate } = await fixture();

    const result = await baselines.approve(
      approval({
        workspaceId: 'ws_other',
        members: [
          { requirementVersionId: 'rv_1', contentHash: 'h1', candidateId: candidate.id },
        ],
      }),
    );

    // Same outcome as a candidate that does not exist — FR-002 / SC-004.
    expect(result.outcome === 'refused' && result.reason).toBe('criteria-unverifiable');
  });

  it('refuses criteria that are only whitespace, rather than counting them', async () => {
    const { intake, candidate } = await fixture();

    await expect(
      intake.declareCriteria({
        workspaceId: 'ws_1',
        candidateId: candidate.id,
        acceptanceCriteria: ['   ', ''],
      }),
    ).rejects.toThrow(/at least one acceptance criterion/);
  });

  it('refuses an empty criteria list for a candidate that is intended for implementation', async () => {
    const { intake, candidate } = await fixture();

    await expect(
      intake.declareCriteria({
        workspaceId: 'ws_1',
        candidateId: candidate.id,
        acceptanceCriteria: [],
      }),
    ).rejects.toThrow(/at least one acceptance criterion/);
  });
});
