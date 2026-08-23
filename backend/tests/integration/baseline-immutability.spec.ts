/**
 * T338g — a baselined requirement cannot be edited in place. `FR-RQR-051`,
 * `RULE-02`, `SC-RQR-001`, `BR-0042`. Quickstart Scenario 2.
 *
 * **The rule the Change Room's existence depends on.** If an edit to a
 * baselined requirement can land, `EPIC-034` is optional tooling rather than
 * the only way a baseline moves — and `FR-RQR-052`'s *"a superseded baseline
 * remains readable"* becomes "remains readable, and may now say something the
 * approver never approved".
 *
 * **Integration, and over the real edit path.** The refusal is asserted through
 * `EPIC-007`'s own `RequirementsService.edit` — the only way a requirement is
 * edited in this system — with the Room's guard wired in exactly as the
 * composition root wires it. A test that called `BaselineService` directly
 * would prove the guard *works* while saying nothing about whether anything
 * *calls* it, which is the `EPIC-031` `C2` failure this Epic keeps citing: a
 * port declared, a token registered, and nothing on the other end.
 *
 * **`409` is asserted as `toHttpStatus`, not as prose.** Contract §5 names the
 * status; reading it from the platform's own mapping means a change to that
 * table turns this file red rather than leaving a comment claiming 409 beside
 * code that returns something else.
 *
 * The four things checked, in order of what they protect:
 *
 *   - the edit is refused, with the Change Request affordance attached, so the
 *     user is offered the governed path rather than told "no";
 *   - the `setHash` is unchanged — the refusal was not partial;
 *   - the requirement text is unchanged, for the same reason one level down;
 *   - a requirement in **no current baseline** still edits freely, or the
 *     guard is just an outage.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { toHttpStatus } from '../../src/core/errors.js';
import { EditAuthorityRegistry } from '../../src/modules/requirements/edit-authority.js';
import {
  InMemoryRequirementStore,
  RequirementsService,
} from '../../src/modules/requirements/requirements.service.js';
import {
  InMemoryRequirementVersionStore,
  RequirementVersionService,
} from '../../src/modules/requirements/requirement-version.service.js';
import { BaselineService } from '../../src/modules/requirement-room/baseline.service.js';
import { EpicSevenRequirementRegister } from '../../src/modules/requirement-room/register.adapter.js';
import { InMemoryRequirementRoomStore } from '../../src/modules/requirement-room/requirement-room.store.js';

const CTX = { workspaceId: 'ws_1', userId: 'user_1' };

interface Composed {
  requirements: RequirementsService;
  register: EpicSevenRequirementRegister;
  baselines: BaselineService;
  roomStore: InMemoryRequirementRoomStore;
}

/** Mirrors the composition root: the Room registers its veto with `EPIC-007`. */
function compose(): Composed {
  const authority = new EditAuthorityRegistry();
  const versions = new RequirementVersionService(new InMemoryRequirementVersionStore());
  const requirements = new RequirementsService(new InMemoryRequirementStore(), versions, {
    onBeforeEdit: (ctx, requirement) => authority.assertEditable(ctx, requirement),
  });
  const roomStore = new InMemoryRequirementRoomStore();
  const baselines = new BaselineService(roomStore);
  authority.register(async (ctx, requirement) => {
    // The join lives in the wiring: a baseline freezes VERSION ids, and which
    // versions belong to a requirement is EPIC-007's to answer. Doing it inside
    // `BaselineService` would mean the Room holding the register (FR-RQR-002).
    const history = await versions.listForRequirement(ctx.workspaceId, requirement.id);
    await baselines.assertEditable(
      ctx,
      requirement,
      history.map((row) => row.id),
    );
  });
  return {
    requirements,
    register: new EpicSevenRequirementRegister(requirements, versions),
    baselines,
    roomStore,
  };
}

/** Promote some intent, freeze it, and approve the set it belongs to. */
async function baselined(c: Composed, text: string) {
  const promoted = await c.register.promote(CTX, 'pr_1', {
    text,
    type: 'functional',
    priority: 'p1',
  });
  const frozen = await c.register.freeze(CTX, promoted.requirementId);
  const baseline = await c.baselines.create({
    workspaceId: 'ws_1',
    projectId: 'pr_1',
    members: [
      { requirementVersionId: frozen.requirementVersionId, contentHash: frozen.contentHash },
    ],
    approvedBy: 'user_1',
    rationale: 'The set is agreed and its acceptance criteria are measurable.',
    decisionId: 'rd_1',
  });
  return { requirementId: promoted.requirementId, baseline };
}

describe('T338g · an edit to a baselined requirement is refused', () => {
  let c: Composed;
  beforeEach(() => {
    c = compose();
  });

  it('refuses with 409, through EPIC-007s real edit path', async () => {
    const { requirementId } = await baselined(c, 'A superseded baseline remains readable.');

    const error = await c.requirements
      .edit(CTX, requirementId, { description: 'A superseded baseline is deleted.' })
      .then(
        () => null,
        (err: unknown) => err,
      );

    expect(error).not.toBeNull();
    expect(toHttpStatus(error)).toBe(409);
  });

  it('carries the Change Request affordance, so the refusal offers the governed path', async () => {
    const { requirementId, baseline } = await baselined(c, 'Every decision needs a rationale.');

    const error = (await c.requirements
      .edit(CTX, requirementId, { description: 'Rationale is optional.' })
      .then(
        () => null,
        (err: unknown) => err,
      )) as { details?: Record<string, unknown> } | null;

    // BR-0042: refused as an in-place change AND offered as a Change Request
    // against that baseline. A refusal that only says "no" leaves the user with
    // no route, which is how in-place edits get argued back in.
    expect(error?.details).toMatchObject({
      remedy: 'change-request',
      baselineId: baseline.id,
      baselineVersion: baseline.version,
      setHash: baseline.setHash,
      requirementId,
    });
  });

  it('names where to raise it, rather than leaving the user to find EPIC-034', async () => {
    const { requirementId } = await baselined(c, 'An AI must not approve a requirement.');

    const error = (await c.requirements
      .edit(CTX, requirementId, { description: 'An AI may approve.' })
      .then(
        () => null,
        (err: unknown) => err,
      )) as { details?: { raiseAt?: string } } | null;

    expect(error?.details?.raiseAt).toBe('POST /rooms/change/requests');
  });
});

describe('T338g · the refusal is not partial', () => {
  let c: Composed;
  beforeEach(() => {
    c = compose();
  });

  it('leaves the setHash exactly as it stood', async () => {
    const { requirementId, baseline } = await baselined(c, 'Baselines must be immutable.');

    await c.requirements
      .edit(CTX, requirementId, { description: 'Baselines may be edited.' })
      .catch(() => undefined);

    const after = await c.roomStore.findBaselineById(baseline.id);
    expect(after?.setHash).toBe(baseline.setHash);
    expect(after?.memberVersionIds).toEqual(baseline.memberVersionIds);
  });

  it('leaves the requirement text as it stood', async () => {
    const { requirementId } = await baselined(c, 'Baselines must be immutable.');

    await c.requirements
      .edit(CTX, requirementId, { description: 'Baselines may be edited.' })
      .catch(() => undefined);

    const after = await c.requirements.get('ws_1', requirementId);
    expect(after.description).toBe('Baselines must be immutable.');
  });

  it('appends no version row for an edit that never happened', async () => {
    const { requirementId } = await baselined(c, 'Baselines must be immutable.');
    const before = (await c.requirements.versions('ws_1', requirementId)).length;

    await c.requirements
      .edit(CTX, requirementId, { description: 'Baselines may be edited.' })
      .catch(() => undefined);

    // EPIC-007 appends the PRIOR state before the record moves. A guard that
    // ran after the append would leave surplus history for an edit that was
    // refused — the record would show a change nobody made.
    expect((await c.requirements.versions('ws_1', requirementId)).length).toBe(before);
  });
});

describe('T338g · the guard refuses baselined requirements and nothing else', () => {
  let c: Composed;
  beforeEach(() => {
    c = compose();
  });

  it('lets an un-baselined requirement be edited normally', async () => {
    const promoted = await c.register.promote(CTX, 'pr_1', {
      text: 'Draft intent nobody has approved.',
      type: 'functional',
      priority: 'p2',
    });

    const edited = await c.requirements.edit(CTX, promoted.requirementId, {
      description: 'Draft intent, revised.',
    });

    // Anti-vacuity. Without this, a guard that refused every edit would pass
    // every assertion above.
    expect(edited.description).toBe('Draft intent, revised.');
  });

  it('lets a requirement whose only baseline was superseded be edited again', async () => {
    const { requirementId, baseline } = await baselined(c, 'Superseded intent.');

    // A new baseline that does NOT include this member replaces the old one.
    const replacement = await c.baselines.create({
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      members: [{ requirementVersionId: 'rv_other', contentHash: 'hash_other' }],
      approvedBy: 'user_1',
      rationale: 'The scope narrowed and this requirement left the set.',
      decisionId: 'rd_2',
    });
    await c.roomStore.supersede(baseline.id, replacement.version);

    const edited = await c.requirements.edit(CTX, requirementId, {
      description: 'Superseded intent, revised.',
    });

    // FR-RQR-052 keeps the old baseline READABLE; it does not keep it
    // GOVERNING. A superseded set that still froze its members would make every
    // requirement permanently uneditable after its first baseline.
    expect(edited.description).toBe('Superseded intent, revised.');
  });

  it('refuses a requirement that is a member of any current baseline, not just the newest', async () => {
    const { requirementId } = await baselined(c, 'Still governed.');
    // A second, unrelated current baseline in the same project.
    await c.baselines.create({
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      members: [{ requirementVersionId: 'rv_unrelated', contentHash: 'hash_unrelated' }],
      approvedBy: 'user_1',
      rationale: 'A separate set, approved separately.',
      decisionId: 'rd_3',
    });

    const error = await c.requirements
      .edit(CTX, requirementId, { description: 'Edited anyway.' })
      .then(
        () => null,
        (err: unknown) => err,
      );

    expect(toHttpStatus(error)).toBe(409);
  });
});
