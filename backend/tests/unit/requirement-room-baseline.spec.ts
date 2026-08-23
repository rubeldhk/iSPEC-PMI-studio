/**
 * T338e — what a baseline is made of. `FR-RQR-050`, `R-033-5`.
 *
 * *"Stores member version ids and a `setHash` from `requirement-hash.ts`, never
 * copies of requirement text."*
 *
 * The entity this Epic exists to add. `EPIC-007` versions **a requirement**;
 * nothing in the repository represented **a set approved together**, and that
 * absence is `BR-0026`.
 *
 * Two assertions carry most of the weight:
 *
 *   - **the row is the `baselines` column set, exactly.** Not "contains no
 *     description" — that passes for any field nobody thought to forbid. A
 *     baseline that grew a `memberText` column would be a second copy of every
 *     requirement in the set, editable independently of `EPIC-007`, and
 *     `FR-RQR-052`'s *"a superseded baseline remains readable"* would quietly
 *     start meaning "remains readable, and may say something different";
 *   - **`setHash` is `requirementSetHash`'s output**, compared against a call
 *     to that function rather than against a literal. A literal would pin the
 *     algorithm, so improving the hash would mean editing this file — and a
 *     test you have to edit to keep green stops being evidence.
 *
 * `FR-RQR-051`'s refusal rests entirely on the last block here: a member whose
 * content moved produces a different set hash. If that stops being true, the
 * in-place-edit refusal has nothing to detect.
 */
import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../src/core/errors.js';
import {
  requirementSetHash,
  type BaselineMember,
} from '../../src/modules/requirements/requirement-hash.js';
import {
  BaselineService,
  type CreateBaselineInput,
} from '../../src/modules/requirement-room/baseline.service.js';
import { InMemoryRequirementRoomStore } from '../../src/modules/requirement-room/requirement-room.store.js';

const MEMBERS: readonly BaselineMember[] = [
  { requirementVersionId: 'rv_1', contentHash: 'hash_one' },
  { requirementVersionId: 'rv_2', contentHash: 'hash_two' },
];

function input(over: Partial<CreateBaselineInput> = {}): CreateBaselineInput {
  return {
    workspaceId: 'ws_1',
    projectId: 'pr_1',
    members: MEMBERS,
    approvedBy: 'user_1',
    rationale: 'The stakeholder set is agreed and the acceptance criteria are measurable.',
    decisionId: 'rd_1',
    ...over,
  };
}

function service(): { baselines: BaselineService; store: InMemoryRequirementRoomStore } {
  const store = new InMemoryRequirementRoomStore();
  return { baselines: new BaselineService(store), store };
}

describe('T338e · a baseline stores version ids, never requirement text', () => {
  it('freezes the member version ids it was given', async () => {
    const { baselines } = service();
    const baseline = await baselines.create(input());

    expect(baseline.memberVersionIds).toEqual(['rv_1', 'rv_2']);
  });

  it('is the baselines column set exactly — no field holds requirement content', async () => {
    const { baselines } = service();
    const baseline = await baselines.create(input());

    expect(Object.keys(baseline).sort()).toEqual([
      'approvedAt',
      'approvedBy',
      'decisionId',
      'evidenceContractRef',
      'id',
      'memberVersionIds',
      'projectId',
      'rationale',
      'setHash',
      'supersededBy',
      'version',
      'workspaceId',
    ]);
  });

  it('holds no member content hash — the members are ids, and the set has one hash', async () => {
    const { baselines } = service();
    const baseline = await baselines.create(input());

    // The frozen members are identifiers. The contentHash of each lives in
    // EPIC-007, where it is maintained; carrying a copy here would be the
    // second place it can be edited (R-033-5).
    expect(JSON.stringify(baseline.memberVersionIds)).not.toContain('hash_one');
  });
});

describe('T338e · the setHash comes from requirement-hash.ts', () => {
  it('is exactly what requirementSetHash returns for the members', async () => {
    const { baselines } = service();
    const baseline = await baselines.create(input());

    expect(baseline.setHash).toBe(requirementSetHash(MEMBERS));
  });

  it('does not depend on the order the members were listed in', async () => {
    const { baselines } = service();
    const forward = await baselines.create(input());
    const reversed = await baselines.create(input({ members: [...MEMBERS].reverse() }));

    // A baseline is a SET. Two approvals of the same members in a different
    // order that hashed differently would read as overlapping scope nobody
    // could explain (FR-RQR-054).
    expect(reversed.setHash).toBe(forward.setHash);
  });

  it('changes when a member is added or removed', async () => {
    const { baselines } = service();
    const two = await baselines.create(input());
    const three = await baselines.create(
      input({ members: [...MEMBERS, { requirementVersionId: 'rv_3', contentHash: 'hash_three' }] }),
    );

    expect(three.setHash).not.toBe(two.setHash);
  });

  it('changes when a members content moves — this is what FR-RQR-051 detects', async () => {
    const { baselines } = service();
    const before = await baselines.create(input());
    const after = await baselines.create(
      input({
        members: [
          { requirementVersionId: 'rv_1', contentHash: 'hash_one_edited' },
          { requirementVersionId: 'rv_2', contentHash: 'hash_two' },
        ],
      }),
    );

    // If this ever stops being true, the in-place-edit refusal has nothing left
    // to detect and RULE-02 becomes an argument rather than a check.
    expect(after.setHash).not.toBe(before.setHash);
  });

  it('cannot collide with a single requirements own content hash', async () => {
    const single: BaselineMember = { requirementVersionId: 'rv_1', contentHash: 'hash_one' };
    expect(requirementSetHash([single])).not.toBe(single.contentHash);
  });
});

describe('T338e · a baseline carries who approved it, why, when and which version', () => {
  it('records approver, rationale and timestamp — FR-RQR-050', async () => {
    const { baselines } = service();
    const baseline = await baselines.create(input());

    expect(baseline.approvedBy).toBe('user_1');
    expect(baseline.rationale).toMatch(/acceptance criteria/);
    expect(baseline.approvedAt).toBeInstanceOf(Date);
    expect(baseline.decisionId).toBe('rd_1');
  });

  it('numbers versions monotonically per project, starting at 1', async () => {
    const { baselines } = service();
    const first = await baselines.create(input());
    const second = await baselines.create(input());

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
  });

  it('numbers each project independently', async () => {
    const { baselines } = service();
    await baselines.create(input());
    const other = await baselines.create(input({ projectId: 'pr_2' }));

    expect(other.version).toBe(1);
  });

  it('is current when created — supersededBy is null until something replaces it', async () => {
    const { baselines } = service();
    const baseline = await baselines.create(input());

    expect(baseline.supersededBy).toBeNull();
  });
});

describe('T338e · a baseline refuses rather than freezing something meaningless', () => {
  it('refuses an empty member set', async () => {
    const { baselines } = service();
    // A baseline of nothing has a valid hash and approves no requirement. It
    // would satisfy every downstream check and mean nothing.
    await expect(baselines.create(input({ members: [] }))).rejects.toThrow(ValidationFailedError);
  });

  it('refuses a duplicated member, naming it', async () => {
    const { baselines } = service();
    const doubled = [...MEMBERS, { requirementVersionId: 'rv_1', contentHash: 'hash_one' }];

    await expect(baselines.create(input({ members: doubled }))).rejects.toThrow(/rv_1/);
  });

  it('refuses an empty rationale — BR-0025, matching the CHECK constraint', async () => {
    const { baselines } = service();
    // `baselines_state_their_rationale` refuses this at the database. The
    // service refusal exists so a caller learns which field, not that a
    // constraint fired.
    await expect(baselines.create(input({ rationale: '   ' }))).rejects.toThrow(/rationale/);
  });

  it.each(['workspaceId', 'projectId', 'approvedBy', 'decisionId'] as const)(
    'refuses a missing %s',
    async (field) => {
      const { baselines } = service();
      await expect(baselines.create(input({ [field]: '' }))).rejects.toThrow(new RegExp(field));
    },
  );
});
