/**
 * T403c — the specification records the baseline **version**, not the baseline
 * generally. `FR-RQR-061`, `BR-0027`.
 *
 * **The distinction is the whole task.** A handoff that pointed at "the
 * project's baseline" would silently change meaning every time a new one was
 * approved: a specification written against v1 would, six months later, read as
 * derived from v4 — and nobody would be able to say which requirements it was
 * actually built from. `FR-RQR-061` exists to make that question answerable.
 *
 * **So the test that matters is the one that supersedes afterwards.** Selecting
 * v1, then approving v2 that replaces it, must leave the handoff saying v1 —
 * both in the recorded version and in the row it points at. Everything else
 * here is scaffolding for that assertion.
 *
 * **`baselineVersion` and `baselineId` are both stored, deliberately.** The
 * version is what a reader sees and what `FR-RQR-061` names; the id is what
 * survives if versions were ever renumbered per project. Storing only the
 * version would make the handoff depend on a number's stability; storing only
 * the id would satisfy the schema while failing the requirement, because the
 * requirement is about the version being *recorded*.
 */
import { describe, expect, it } from 'vitest';
import { HandoffService } from '../../src/modules/requirement-room/handoff.service.js';
import { BaselineService } from '../../src/modules/requirement-room/baseline.service.js';
import { IntakeService } from '../../src/modules/requirement-room/intake.service.js';
import { InMemoryRequirementRoomStore } from '../../src/modules/requirement-room/requirement-room.store.js';

const evidence = { isSatisfied: async () => ({ satisfied: true, unmet: [] as string[] }) };

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
  return { store, approve, handoffs: new HandoffService(store) };
}

const select = (baselineVersion: number, ref = 'wf_7c21') => ({
  workspaceId: 'ws_1',
  projectId: 'pr_1',
  baselineVersion,
  specificationWorkflowRef: ref,
  selectedBy: 'user_1',
});

describe('T403c · the version is what is recorded', () => {
  it('records the version selected', async () => {
    const { approve, handoffs } = await fixture();
    await approve('rv_1', 'rd_1');

    const handoff = await handoffs.select(select(1));

    expect(handoff.baselineVersion).toBe(1);
  });

  it('records the version, not whichever is current', async () => {
    const { approve, handoffs } = await fixture();
    await approve('rv_1', 'rd_1');
    await approve('rv_2', 'rd_2');
    await approve('rv_3', 'rd_3');

    const handoff = await handoffs.select(select(2));

    // Three baselines exist. The handoff names the one that was chosen, and a
    // reader can say which requirements the specification was built from.
    expect(handoff.baselineVersion).toBe(2);
  });

  it('still names v1 after v2 supersedes it — the assertion this file exists for', async () => {
    const { approve, handoffs, store } = await fixture();
    const first = await approve('rv_1', 'rd_1');
    const handoff = await handoffs.select(select(first.version));

    const second = await approve('rv_2', 'rd_2', first.version);

    const [reread] = await handoffs.listForBaseline('ws_1', first.id);
    // A handoff pointing at "the project's baseline" would now read as v2, and
    // the specification would appear to derive from requirements approved after
    // it was written.
    expect(reread?.baselineVersion).toBe(first.version);
    expect(reread?.baselineId).toBe(first.id);
    expect(second.version).not.toBe(first.version);

    // And the superseded baseline itself is unchanged apart from the pointer
    // FR-RQR-052 requires.
    const source = await store.findBaselineById(first.id);
    expect(source?.setHash).toBe(first.setHash);
    expect(handoff.baselineVersion).toBe(first.version);
  });

  it('keeps both the version and the id, so neither has to be inferred', async () => {
    const { approve, handoffs } = await fixture();
    const baseline = await approve('rv_1', 'rd_1');

    const handoff = await handoffs.select(select(1));

    expect(handoff.baselineVersion).toBe(baseline.version);
    expect(handoff.baselineId).toBe(baseline.id);
  });

  it('numbers handoffs from the project the baseline belongs to', async () => {
    const { approve, handoffs } = await fixture();
    await approve('rv_1', 'rd_1');

    // `(projectId, version)` is the baseline's unique key, so a handoff naming
    // only a version needs the project to resolve it. Getting this wrong would
    // hand off another project's v1.
    await expect(handoffs.select({ ...select(1), projectId: 'pr_other' })).rejects.toThrow(/v1/);
  });
});

describe('T403c · the trace runs in both directions — SC-RQR-006', () => {
  it('finds every specification derived from a baseline', async () => {
    const { approve, handoffs } = await fixture();
    const baseline = await approve('rv_1', 'rd_1');
    await handoffs.select(select(1, 'wf_a'));
    await handoffs.select(select(1, 'wf_b'));

    const forward = await handoffs.listForBaseline('ws_1', baseline.id);

    expect(forward.map((h) => h.specificationWorkflowRef).sort()).toEqual(['wf_a', 'wf_b']);
  });

  it('finds the baseline version a specification derived from', async () => {
    const { approve, handoffs } = await fixture();
    await approve('rv_1', 'rd_1');
    await approve('rv_2', 'rd_2');
    await handoffs.select(select(2, 'wf_a'));

    const backward = await handoffs.listForWorkflow('ws_1', 'wf_a');

    // The other direction of SC-RQR-006: given a specification, which frozen
    // set produced it. Without this the trace is one-way and the question
    // "what was this built from" has no answer.
    expect(backward.map((h) => h.baselineVersion)).toEqual([2]);
  });

  it('does not leak another workspaces handoffs into either direction', async () => {
    const { approve, handoffs } = await fixture();
    const baseline = await approve('rv_1', 'rd_1');
    await handoffs.select(select(1, 'wf_a'));

    expect(await handoffs.listForBaseline('ws_other', baseline.id)).toEqual([]);
    expect(await handoffs.listForWorkflow('ws_other', 'wf_a')).toEqual([]);
  });
});
