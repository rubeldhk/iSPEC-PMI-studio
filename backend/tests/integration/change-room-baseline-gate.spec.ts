/**
 * `T996e`, `T996f` (EPIC-034) — the baseline gate, end to end.
 *
 * `FR-CHR-011`, `SC-CHR-001`, `RULE-02`: once a baseline is approved, no
 * implementation-changing request bypasses traceable change control.
 *
 * Two Rooms are composed here for real, because the guarantee lives in the seam
 * between them and in neither one alone. The Requirement Room refuses the
 * in-place edit (`FR-RQR-051`) and hands back an affordance naming a remedy;
 * this Room is the remedy. `BR-0042` says the refusal must *offer* the change —
 * and until `EPIC-034` existed the offer pointed at nothing, which is a refusal
 * with nowhere to go.
 *
 * The controls matter as much as the refusals. A gate that refuses everything
 * satisfies "nothing bypassed it" vacuously, so both open cases are asserted:
 * an unbaselined requirement, and one whose only baseline has been superseded.
 */
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import {
  BaselineService,
  InPlaceEditRefusedError,
  type ChangeRequestAffordance,
} from '../../src/modules/requirement-room/baseline.service.js';
import { IntakeService } from '../../src/modules/requirement-room/intake.service.js';
import { InMemoryRequirementRoomStore } from '../../src/modules/requirement-room/requirement-room.store.js';
import { ChangeIntakeService } from '../../src/modules/change-room/intake.service.js';
import { InMemoryChangeRoomStore } from '../../src/modules/change-room/change-room.store.js';

const CTX = { workspaceId: 'ws_1' };
const evidence = { isSatisfied: async () => ({ satisfied: true, unmet: [] as string[] }) };

/** Both Rooms, real services, real stores. */
async function compose() {
  const roomStore = new InMemoryRequirementRoomStore();
  const intake = new IntakeService(roomStore);
  const baselines = new BaselineService(roomStore, evidence);
  const changes = new ChangeIntakeService(new InMemoryChangeRoomStore());

  /** Freeze a version into an approved baseline, through the real gate. */
  const approve = async (versionId: string, decisionId: string, supersedes?: number) => {
    const [candidate] = await intake.intake({
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      roomObjectId: 'ro_1',
      sourceRef: 'direct:2026-08-30',
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
        {
          requirementVersionId: versionId,
          contentHash: `h_${versionId}`,
          candidateId: candidate!.id,
        },
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

  return { baselines, changes, approve };
}

const requirement = { id: 'req_1', workspaceId: 'ws_1', projectId: 'pr_1' };

/** Provoke the refusal and hand back what it offered. */
async function refusal(
  baselines: BaselineService,
  versionIds: readonly string[],
): Promise<ChangeRequestAffordance> {
  try {
    await baselines.assertEditable(CTX, requirement, versionIds);
  } catch (error) {
    expect(error).toBeInstanceOf(InPlaceEditRefusedError);
    return (error as InPlaceEditRefusedError).details as ChangeRequestAffordance;
  }
  throw new Error('the gate let an approved baseline be edited in place');
}

describe('T996e · the gate closes on an approved baseline', () => {
  it('refuses the in-place edit and names where to go instead', async () => {
    const { baselines, approve } = await compose();
    const baseline = await approve('rv_1', 'dec_1');

    const affordance = await refusal(baselines, ['rv_1']);
    expect(affordance.remedy).toBe('change-request');
    expect(affordance.baselineId).toBe(baseline.id);
    expect(affordance.baselineVersion).toBe(baseline.version);
    // `BR-0042` — a refusal that only says no is how in-place editing gets
    // argued back in, one urgent Friday at a time.
    expect(affordance.raiseAt).toBe('POST /rooms/change/requests');
  });

  it('the refusal leads to a Change Request against that same baseline', async () => {
    const { baselines, changes, approve } = await compose();
    const baseline = await approve('rv_1', 'dec_1');
    const affordance = await refusal(baselines, ['rv_1']);

    const request = await changes.fromRefusedEdit(affordance, {
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      roomObjectId: 'ro_1',
      requester: 'user_2',
      reason: 'the regulator shortened the window',
      requestedOutcome: 'require notification within one hour',
    });

    expect(request.targetBaselineId).toBe(baseline.id);
    expect(request.targetBaselineVersion).toBe(baseline.version);
    expect(request.state).toBe('open');
  });

  it('and the change is visible as traceable change control', async () => {
    // `SC-CHR-001`. Recorded somewhere unqueryable would satisfy the letter of
    // "not applied around the gate" and none of its point.
    const { baselines, changes, approve } = await compose();
    const baseline = await approve('rv_1', 'dec_1');
    const affordance = await refusal(baselines, ['rv_1']);
    await changes.fromRefusedEdit(affordance, {
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      roomObjectId: 'ro_1',
      requester: 'user_2',
      reason: 'x',
      requestedOutcome: 'y',
    });

    const open = await changes.openAgainst('ws_1', baseline.id);
    expect(open).toHaveLength(1);
    expect(open[0]?.requester).toBe('user_2');
  });

  it('urgency does not open it', async () => {
    // At the seam, not just in the unit: the gate refuses before urgency is
    // even a field anyone could read.
    const { baselines, changes, approve } = await compose();
    await approve('rv_1', 'dec_1');
    const affordance = await refusal(baselines, ['rv_1']);
    const request = await changes.fromRefusedEdit(affordance, {
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      roomObjectId: 'ro_1',
      requester: 'user_2',
      reason: 'production is down',
      requestedOutcome: 'ship it',
      urgency: 'critical',
    });
    expect(request.urgency).toBe('critical');
    expect(request.state).toBe('open');
  });
});

describe('T996e · and opens where it should', () => {
  it('an unbaselined requirement is editable in place', async () => {
    // The control. Without it every assertion above is satisfied by a gate that
    // refuses everything, which is not a gate.
    const { baselines } = await compose();
    await expect(
      baselines.assertEditable(CTX, requirement, ['rv_unfrozen']),
    ).resolves.toBeUndefined();
  });

  it('a superseded baseline does not govern', async () => {
    // `FR-RQR-052` keeps a superseded set readable, not governing. The other
    // reading would make every requirement permanently uneditable after its
    // first baseline.
    const { baselines, approve } = await compose();
    await approve('rv_1', 'dec_1');
    await approve('rv_2', 'dec_2', 1);
    await expect(baselines.assertEditable(CTX, requirement, ['rv_1'])).resolves.toBeUndefined();
  });
});

describe('T996e · the offer points at something that exists', () => {
  it('a controller serves the route the refusal advertises', async () => {
    // The half nobody checks. `DEF-005-001` and `T1178` are the same failure —
    // built, tested, reachable from nowhere — and an affordance naming a route
    // no controller declares is that failure wearing a remedy's clothes.
    const { ChangeRoomController } = await import(
      '../../src/modules/change-room/change-room.controller.js'
    );
    const proto = ChangeRoomController.prototype as unknown as Record<string, object>;
    const routes = Object.getOwnPropertyNames(proto)
      .filter((name) => name !== 'constructor')
      .map((name) => ({
        path: Reflect.getMetadata('path', proto[name]!) as string | undefined,
        method: Reflect.getMetadata('method', proto[name]!) as number | undefined,
      }))
      .filter((route) => route.path !== undefined)
      .map((route) => `${route.method === 1 ? 'POST' : 'GET'} /${route.path!}`.replace(/\/+/g, '/'));

    expect(routes).toContain('POST /rooms/change/requests');
  });
});
