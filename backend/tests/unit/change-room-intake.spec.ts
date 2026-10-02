/**
 * `T996a`, `T996b` (EPIC-034) — a proposed modification is recordable only as a
 * Change Request linked to a baseline.
 *
 * `FR-CHR-010`, `FR-CHR-020`. The baseline link is the first check rather than
 * one of several, because the rest of the record is meaningless without it: a
 * change with no target has nothing to be a change *to*, and the delta it
 * eventually produces would freeze nothing.
 */
import { describe, expect, it } from 'vitest';
import {
  ChangeIntakeService,
  URGENCY_LEVELS,
  type ChangeRequestAffordance,
} from '../../src/modules/change-room/intake.service.js';
import { InMemoryChangeRoomStore } from '../../src/modules/change-room/change-room.store.js';

const service = (): ChangeIntakeService => new ChangeIntakeService(new InMemoryChangeRoomStore());

/**
 * The real shape `EPIC-033` hands over, imported rather than restated — a local
 * copy would compile forever after the real one changed.
 */
const affordance = (over: Partial<ChangeRequestAffordance> = {}): ChangeRequestAffordance => ({
  remedy: 'change-request',
  baselineId: 'b_1',
  baselineVersion: 1,
  setHash: 'sha256:abc',
  requirementId: 'r_1',
  raiseAt: 'POST /rooms/change/requests',
  ...over,
});


const input = (over: Record<string, unknown> = {}) => ({
  workspaceId: 'ws_1',
  projectId: 'pr_1',
  roomObjectId: 'ro_1',
  targetBaselineId: 'b_1',
  targetBaselineVersion: 2,
  requestedOutcome: 'require notification within one hour',
  reason: 'the regulator shortened the window',
  requester: 'u_1',
  ...over,
});

describe('T996a · a change is always AGAINST a baseline', () => {
  it('records one when the baseline is named', async () => {
    const request = await service().raise(input());
    expect(request.targetBaselineId).toBe('b_1');
    expect(request.targetBaselineVersion).toBe(2);
    expect(request.state).toBe('open');
  });

  it('refuses one with no baseline id', async () => {
    await expect(service().raise(input({ targetBaselineId: '' }))).rejects.toThrow(
      /always against a baseline/i,
    );
  });

  it('refuses one with no baseline version', async () => {
    // `FR-CHR-010`. Not defaulted to the latest: a change raised against
    // "whatever is current" answers a question nobody asked.
    await expect(
      service().raise(input({ targetBaselineVersion: undefined })),
    ).rejects.toThrow(/always against a baseline/i);
  });

  it('refuses a non-integer version', async () => {
    await expect(service().raise(input({ targetBaselineVersion: 1.5 }))).rejects.toThrow(
      /always against a baseline/i,
    );
  });
});

describe('T996a · what BR-0043 requires', () => {
  it.each(['requestedOutcome', 'reason', 'requester'])('refuses a blank %s', async (field) => {
    await expect(service().raise(input({ [field]: '   ' }))).rejects.toThrow(
      new RegExp(field),
    );
  });

  it('carries the unresolved questions it was given', async () => {
    const request = await service().raise(
      input({ questions: ['does this affect the mobile client?', 'who signs it off?'] }),
    );
    expect(request.openQuestions).toHaveLength(2);
    expect(request.openQuestions[0]?.answer).toBeNull();
  });

  it('writes nothing when it refuses', async () => {
    // Every check happens before the store is touched, so a rejected request
    // cannot leave a half-formed change behind.
    const store = new InMemoryChangeRoomStore();
    const intake = new ChangeIntakeService(store);
    await expect(intake.raise(input({ reason: '' }))).rejects.toThrow();
    expect(await store.listForBaseline('ws_1', 'b_1')).toHaveLength(0);
  });
});

describe('T996a · where RULE-02 leads', () => {
  it('turns EPIC-033’s refusal affordance into a request against the SAME baseline', async () => {
    // `FR-RQR-051` refuses an in-place edit and offers a change request. Until
    // this existed the refusal named a remedy nobody could take.
    const request = await service().fromRefusedEdit(
      affordance({ baselineId: 'b_9', baselineVersion: 7 }),
      {
        workspaceId: 'ws_1',
        projectId: 'pr_1',
        roomObjectId: 'ro_1',
        requester: 'u_1',
        reason: 'the wording is wrong',
        requestedOutcome: 'reword the constraint',
      },
    );
    // The version travels from the affordance. The refusal named a specific
    // baseline, and raising against a different one would answer a different
    // question.
    expect(request.targetBaselineId).toBe('b_9');
    expect(request.targetBaselineVersion).toBe(7);
  });

  it('refuses an affordance that offers something else', async () => {
    await expect(
      service().fromRefusedEdit(
        affordance({ remedy: 'something-else' as never }),
        {
          workspaceId: 'ws_1',
          projectId: 'pr_1',
          roomObjectId: 'ro_1',
          requester: 'u_1',
          reason: 'x',
          requestedOutcome: 'y',
        },
      ),
    ).rejects.toThrow(/does not offer a change request/i);
  });
});

describe('T996a · provenance', () => {
  it('records a direct origin by default', async () => {
    expect((await service().raise(input())).origin).toBe('direct');
  });

  it('refuses a defect transfer that does not name its defect', async () => {
    // Losing where a change came from is worse than refusing the transfer.
    await expect(service().raise(input({ origin: 'defect-transfer' }))).rejects.toThrow(
      /names the defect/i,
    );
  });

  it('records the defect when the transfer names it', async () => {
    const request = await service().raise(
      input({ origin: 'defect-transfer', originDefectRef: 'DEF-035-001' }),
    );
    expect(request.originDefectRef).toBe('DEF-035-001');
  });
});

describe('T996a · urgency levels', () => {
  it('names three', () => {
    expect([...URGENCY_LEVELS]).toEqual(['normal', 'high', 'critical']);
  });

  it('refuses one nobody declared', async () => {
    await expect(service().raise(input({ urgency: 'drop-everything' }))).rejects.toThrow(
      /urgency must be one of/i,
    );
  });
});
