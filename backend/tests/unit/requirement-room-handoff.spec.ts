/**
 * T403a — a baselined set is a selectable input to specification.
 * `FR-RQR-060`, `BR-0027`. Quickstart Scenario 7.
 *
 * **Without this the Room produces an artifact nothing consumes.** Everything
 * before it — intake, clarification, criteria, decision, baseline — ends in a
 * frozen set sitting in a table. This is the task that closes the chain from
 * intent to specification, and `SC-RQR-006` asks for it to be traceable in
 * both directions.
 *
 * **"One or more" is the load-bearing phrase.** A baseline is selectable by
 * several specification workflows, so there is no unique constraint tying a
 * baseline to one of them. Two teams specifying from the same approved set is
 * the normal case, not a conflict — what *is* refused is selecting the same
 * baseline into the same workflow twice, which records nothing new and leaves a
 * reader wondering which of the two rows mattered.
 *
 * **A superseded baseline is readable but not selectable**, and the refusal
 * names what replaced it. `FR-RQR-052` keeps an approved set readable so an
 * approval stays auditable; specifying *new work* against a set that has been
 * replaced is a different act, and doing it silently is how a specification
 * comes to derive from requirements nobody has agreed to since. The same
 * distinction `assertEditable` draws: readable is not governing.
 */
import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../src/core/errors.js';
import {
  HandoffService,
  type SelectBaselineInput,
} from '../../src/modules/requirement-room/handoff.service.js';
import { BaselineService } from '../../src/modules/requirement-room/baseline.service.js';
import { IntakeService } from '../../src/modules/requirement-room/intake.service.js';
import { InMemoryRequirementRoomStore } from '../../src/modules/requirement-room/requirement-room.store.js';

const evidence = { isSatisfied: async () => ({ satisfied: true, unmet: [] as string[] }) };

/** A real approved baseline, through the real gate. */
async function fixture() {
  const store = new InMemoryRequirementRoomStore();
  const intake = new IntakeService(store);
  const baselines = new BaselineService(store, evidence);
  const approve = async (versionId: string, decisionId: string, supersedes?: number) => {
    const [candidate] = await intake.intake({
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      roomObjectId: 'ro_1',
      sourceRef: 'direct:2026-08-23',
      text: `The set frozen as ${versionId} must hold.`,
    });
    await intake.declareCriteria({
      workspaceId: 'ws_1',
      candidateId: candidate!.id,
      acceptanceCriteria: [`Checked by the test for ${versionId}.`],
    });
    const result = await baselines.approve({
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      members: [
        { requirementVersionId: versionId, contentHash: `h_${versionId}`, candidateId: candidate!.id },
      ],
      approvedBy: 'user_1',
      rationale: 'Agreed with the stakeholder.',
      decisionId,
      evidenceContractRef: 'ec_1',
      ...(supersedes === undefined ? {} : { supersedes }),
    });
    if (result.outcome !== 'approved') throw new Error(`expected approval: ${result.detail}`);
    return result.baseline;
  };
  return { store, baselines, approve, handoffs: new HandoffService(store) };
}

function selection(over: Partial<SelectBaselineInput> = {}): SelectBaselineInput {
  return {
    workspaceId: 'ws_1',
    projectId: 'pr_1',
    baselineVersion: 1,
    specificationWorkflowRef: 'wf_7c21',
    selectedBy: 'user_1',
    ...over,
  };
}

describe('T403a · an approved baseline is selectable', () => {
  it('records the selection against the baseline', async () => {
    const { approve, handoffs } = await fixture();
    const baseline = await approve('rv_1', 'rd_1');

    const handoff = await handoffs.select(selection());

    expect(handoff.baselineId).toBe(baseline.id);
    expect(handoff.specificationWorkflowRef).toBe('wf_7c21');
    expect(handoff.selectedBy).toBe('user_1');
    expect(handoff.selectedAt).toBeInstanceOf(Date);
  });

  it('is the handoffs column set exactly', async () => {
    const { approve, handoffs } = await fixture();
    await approve('rv_1', 'rd_1');

    const handoff = await handoffs.select(selection());

    expect(Object.keys(handoff).sort()).toEqual([
      'baselineId',
      'baselineVersion',
      'id',
      'selectedAt',
      'selectedBy',
      'specificationWorkflowRef',
      'workspaceId',
    ]);
  });

  it('is selectable by MORE THAN ONE specification workflow — FR-RQR-060', async () => {
    const { approve, handoffs } = await fixture();
    const baseline = await approve('rv_1', 'rd_1');

    await handoffs.select(selection({ specificationWorkflowRef: 'wf_a' }));
    await handoffs.select(selection({ specificationWorkflowRef: 'wf_b' }));

    // "One or more" is the requirement's phrase. Two teams specifying from one
    // approved set is the normal case, not a conflict.
    const listed = await handoffs.listForBaseline('ws_1', baseline.id);
    expect(listed.map((h) => h.specificationWorkflowRef).sort()).toEqual(['wf_a', 'wf_b']);
  });

  it('refuses the same baseline into the same workflow twice', async () => {
    const { approve, handoffs } = await fixture();
    await approve('rv_1', 'rd_1');
    await handoffs.select(selection());

    // A second identical row records nothing new and leaves a reader asking
    // which of the two mattered.
    await expect(handoffs.select(selection())).rejects.toThrow(/already/i);
  });

  it('lists nothing for a baseline nobody selected', async () => {
    const { approve, handoffs } = await fixture();
    const baseline = await approve('rv_1', 'rd_1');

    // "Not selected yet" and "cannot tell" must not look the same.
    expect(await handoffs.listForBaseline('ws_1', baseline.id)).toEqual([]);
  });
});

describe('T403a · what cannot be selected', () => {
  it('refuses a version that does not exist', async () => {
    const { handoffs } = await fixture();

    await expect(handoffs.select(selection({ baselineVersion: 9 }))).rejects.toThrow(/v9/);
  });

  it('refuses a superseded baseline, naming what replaced it', async () => {
    const { approve, handoffs } = await fixture();
    const first = await approve('rv_1', 'rd_1');
    const second = await approve('rv_2', 'rd_2', first.version);

    const error = await handoffs.select(selection({ baselineVersion: first.version })).then(
      () => null,
      (err: unknown) => err as Error,
    );

    // Readable is not selectable. Specifying new work against a replaced set is
    // how a specification comes to derive from requirements nobody has agreed
    // to since — and the refusal has to say where to go instead.
    expect(error?.message).toMatch(new RegExp(`v${second.version}`));
  });

  it('refuses a baseline in another workspace the same way as one that does not exist', async () => {
    const { approve, handoffs } = await fixture();
    await approve('rv_1', 'rd_1');

    // FR-002 / SC-004 — a handoff must not confirm that a baseline exists
    // somewhere the caller cannot see.
    await expect(handoffs.select(selection({ workspaceId: 'ws_other' }))).rejects.toThrow(
      /Not found|v1/,
    );
  });

  it.each(['specificationWorkflowRef', 'selectedBy'] as const)(
    'refuses a selection with no %s',
    async (field) => {
      const { approve, handoffs } = await fixture();
      await approve('rv_1', 'rd_1');

      await expect(handoffs.select(selection({ [field]: '  ' }))).rejects.toThrow(
        new RegExp(field),
      );
    },
  );

  it('writes nothing when the selection is refused', async () => {
    const { approve, handoffs } = await fixture();
    const baseline = await approve('rv_1', 'rd_1');

    await handoffs.select(selection({ specificationWorkflowRef: '' })).catch(() => undefined);

    expect(await handoffs.listForBaseline('ws_1', baseline.id)).toEqual([]);
  });

  it('refuses a workflow reference that is not a string', async () => {
    const { approve, handoffs } = await fixture();
    await approve('rv_1', 'rd_1');

    const smuggled = selection({
      specificationWorkflowRef: { engine: 'speckit', id: 7 },
    } as unknown as Partial<SelectBaselineInput>);

    // Opaque means opaque: a structured reference would grow an engine field,
    // and FR-RQR-062 would be gone one merge later.
    await expect(handoffs.select(smuggled)).rejects.toThrow(ValidationFailedError);
  });
});
