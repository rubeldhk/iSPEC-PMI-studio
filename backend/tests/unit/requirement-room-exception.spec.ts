/**
 * T339c — an exception carries its authorizer and its reason, both required.
 * `FR-RQR-032`, `BR-0024`. Quickstart Scenario 4, second half.
 *
 * *"An approved exception MAY permit baseline without them; the exception MUST
 * carry its authorizer and reason."*
 *
 * **Both fields, and neither may be blank.** A waiver with no authorizer is a
 * rule that waived itself. A waiver with no reason is a decision nobody can
 * review, and — this is the part that matters — it looks **identical** to one
 * that was carefully reasoned. The `baseline_exceptions_are_explicit` CHECK
 * constraint says the same thing at the row; this is the layer that turns it
 * into a message naming the field.
 *
 * **An invalid exception is refused, never ignored.** Silently dropping one
 * sends the approval on to the criteria gate, which refuses it for a reason the
 * caller did not cause — and they go and fix the wrong thing.
 *
 * **The exception is what makes the gate liveable.** `T339a` fails closed in
 * two directions, and a gate that fails closed with no documented escape is a
 * gate people route around. This is the escape: visible, attributed, reasoned
 * and — `T339e` — enumerable.
 */
import { describe, expect, it } from 'vitest';
import {
  BaselineService,
  type ApproveBaselineInput,
  type BaselineExceptionInput,
} from '../../src/modules/requirement-room/baseline.service.js';
import { IntakeService } from '../../src/modules/requirement-room/intake.service.js';
import { InMemoryRequirementRoomStore } from '../../src/modules/requirement-room/requirement-room.store.js';

const evidence = { isSatisfied: async () => ({ satisfied: true, unmet: [] as string[] }) };

/** One candidate, deliberately WITHOUT criteria — the gate must be live. */
async function fixture() {
  const store = new InMemoryRequirementRoomStore();
  const [candidate] = await new IntakeService(store).intake({
    workspaceId: 'ws_1',
    projectId: 'pr_1',
    roomObjectId: 'ro_1',
    sourceRef: 'direct:2026-08-23',
    text: 'The report must read well.',
  });
  return { store, candidate: candidate!, baselines: new BaselineService(store, evidence) };
}

function approval(
  candidateId: string,
  over: Partial<ApproveBaselineInput> = {},
): ApproveBaselineInput {
  return {
    workspaceId: 'ws_1',
    projectId: 'pr_1',
    members: [{ requirementVersionId: 'rv_1', contentHash: 'hash_one', candidateId }],
    approvedBy: 'user_1',
    rationale: 'Agreed with the stakeholder, with one waiver recorded.',
    decisionId: 'rd_1',
    evidenceContractRef: 'ec_1',
    ...over,
  };
}

const WAIVER: BaselineExceptionInput = {
  requirementVersionId: 'rv_1',
  condition: 'missing-acceptance-criteria',
  authorizedBy: 'user_9',
  reason: 'Wording quality is judged at review; no measurable criterion is meaningful here.',
};

describe('T339c · a recorded exception permits the baseline', () => {
  it('refuses without one — the gate is live', async () => {
    const { baselines, candidate } = await fixture();

    const result = await baselines.approve(approval(candidate.id));

    // Anti-vacuity for every assertion below: if the gate did not fire, an
    // exception would not be permitting anything.
    expect(result.outcome === 'refused' && result.reason).toBe('acceptance-criteria-missing');
  });

  it('proceeds with one', async () => {
    const { baselines, candidate } = await fixture();

    const result = await baselines.approve(approval(candidate.id, { exceptions: [WAIVER] }));

    expect(result.outcome).toBe('approved');
  });

  it('waives only the member it names', async () => {
    const store = new InMemoryRequirementRoomStore();
    const intake = new IntakeService(store);
    const both = await intake.intake({
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      roomObjectId: 'ro_1',
      sourceRef: 'direct:2026-08-23',
      sourceKind: 'document',
      text: 'The report must read well.\n\nThe export must complete.',
    });
    const baselines = new BaselineService(store, evidence);

    const result = await baselines.approve({
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      members: both.map((c, i) => ({
        requirementVersionId: `rv_${i + 1}`,
        contentHash: `h${i}`,
        candidateId: c.id,
      })),
      approvedBy: 'user_1',
      rationale: 'One waiver, one requirement still to specify.',
      decisionId: 'rd_1',
      evidenceContractRef: 'ec_1',
      exceptions: [WAIVER],
    });

    // A waiver that covered the whole set would be a way to turn the gate off
    // in one line while looking like a single considered exception.
    expect(result.outcome === 'refused' && result.reason).toBe('acceptance-criteria-missing');
    expect(result.outcome === 'refused' && result.detail).toMatch(/rv_2/);
    expect(result.outcome === 'refused' && result.detail).not.toMatch(/rv_1\b/);
  });
});

describe('T339c · both fields are required', () => {
  it.each([
    ['authorizedBy', { ...WAIVER, authorizedBy: '' }],
    ['reason', { ...WAIVER, reason: '' }],
    ['requirementVersionId', { ...WAIVER, requirementVersionId: '' }],
  ])('refuses an exception with no %s, naming it', async (field, broken) => {
    const { baselines, candidate } = await fixture();

    await expect(
      baselines.approve(approval(candidate.id, { exceptions: [broken] })),
    ).rejects.toThrow(new RegExp(field));
  });

  it('refuses whitespace as an authorizer or a reason', async () => {
    const { baselines, candidate } = await fixture();

    await expect(
      baselines.approve(
        approval(candidate.id, { exceptions: [{ ...WAIVER, authorizedBy: '   ' }] }),
      ),
    ).rejects.toThrow(/authorizedBy/);
  });

  it('refuses a condition it does not recognise', async () => {
    const { baselines, candidate } = await fixture();

    // Data-model §6: currently only missing acceptance criteria is waivable. An
    // unrecognised condition waiving something unnamed is a waiver nobody can
    // audit.
    const unknown = { ...WAIVER, condition: 'because-we-are-late' } as unknown as BaselineExceptionInput;
    await expect(
      baselines.approve(approval(candidate.id, { exceptions: [unknown] })),
    ).rejects.toThrow(/condition/);
  });

  it('names which exception in the set is malformed', async () => {
    const { baselines, candidate } = await fixture();

    await expect(
      baselines.approve(
        approval(candidate.id, { exceptions: [WAIVER, { ...WAIVER, reason: '' }] }),
      ),
    ).rejects.toThrow(/exception 2/);
  });

  it('refuses rather than ignoring — no baseline is written', async () => {
    const { baselines, store, candidate } = await fixture();

    await baselines
      .approve(approval(candidate.id, { exceptions: [{ ...WAIVER, reason: '' }] }))
      .catch(() => undefined);

    // Ignoring the malformed waiver would refuse the approval at the criteria
    // gate instead, for a reason the caller did not cause.
    expect(await store.listBaselines('ws_1', 'pr_1')).toEqual([]);
  });
});

describe('T339c · the exception is recorded against the baseline it permitted', () => {
  it('stores the authorizer, the reason and the condition', async () => {
    const { baselines, candidate } = await fixture();
    const result = await baselines.approve(approval(candidate.id, { exceptions: [WAIVER] }));
    const baseline = result.outcome === 'approved' ? result.baseline : null;

    const [recorded] = await baselines.exceptionsFor('ws_1', baseline!.id);

    expect(recorded).toMatchObject({
      baselineId: baseline!.id,
      requirementVersionId: 'rv_1',
      condition: 'missing-acceptance-criteria',
      authorizedBy: 'user_9',
    });
    expect(recorded?.reason).toMatch(/judged at review/);
  });

  it('is the baseline_exceptions column set exactly', async () => {
    const { baselines, candidate } = await fixture();
    const result = await baselines.approve(approval(candidate.id, { exceptions: [WAIVER] }));
    const baseline = result.outcome === 'approved' ? result.baseline : null;

    const [recorded] = await baselines.exceptionsFor('ws_1', baseline!.id);

    expect(Object.keys(recorded ?? {}).sort()).toEqual([
      'authorizedBy',
      'baselineId',
      'condition',
      'createdAt',
      'id',
      'reason',
      'requirementVersionId',
      'workspaceId',
    ]);
  });

  it('records nothing when the approval is refused for another reason', async () => {
    const store = new InMemoryRequirementRoomStore();
    const [candidate] = await new IntakeService(store).intake({
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      roomObjectId: 'ro_1',
      sourceRef: 'direct:2026-08-23',
      text: 'The report must read well.',
    });
    const baselines = new BaselineService(store, {
      isSatisfied: async () => ({ satisfied: false, unmet: ['sign-off'] }),
    });

    const result = await baselines.approve(approval(candidate!.id, { exceptions: [WAIVER] }));

    // Exceptions are written AFTER the baseline exists, so a waiver can never
    // name a baseline that does not — and a refused approval leaves no orphan
    // waiver for a reader to find and wonder about.
    expect(result.outcome).toBe('refused');
    expect(await store.listBaselineExceptions('ws_1', 'any')).toEqual([]);
  });
});
