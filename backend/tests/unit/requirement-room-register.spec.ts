/**
 * T338c — candidates promote into `EPIC-007`'s register, and **no local
 * requirement store exists**. `FR-RQR-002`, `D-33`.
 *
 * **Bound against the real `RequirementsService`**, built by the requirements
 * suite's own helper — not a fake. `EPIC-031`'s analysis found the equivalent
 * binding *missing* there (`C2`), which is exactly the failure a hand-written
 * fake hides: the adapter satisfies a shape nobody is on the other end of, and
 * every test is green. If `EPIC-007`'s `create` signature moves, this file
 * fails to compile, which is the whole point of binding to the real one.
 *
 * The three properties, in the order they matter:
 *
 *   - **promotion writes to `EPIC-007`.** The requirement is readable from that
 *     register afterwards, with the candidate's normalized text as its
 *     description;
 *   - **the Room keeps a reference, never a copy.** `promotedTo` holds the
 *     `EPIC-007` id, and the candidate row gains no description, type or
 *     priority column in the process;
 *   - **an absent register refuses.** `ROOM_PORTS` declares `refuse` for this
 *     seam, and the assertion below reads that declaration rather than
 *     restating it — so softening the shared contract turns this file red
 *     instead of leaving it agreeing with a rule that changed.
 *
 * **`freeze` is why this port has two methods and not one.** A baseline stores
 * `EPIC-007` requirement **version ids** (`R-033-5`, data-model §5), and
 * `EPIC-007` appends a version row on *edit* — it holds the state a requirement
 * moved *from*. So a requirement that has never been edited has no version row
 * to freeze, and the set a baseline froze would have nothing immutable to point
 * at. `freeze` appends the requirement **as it stands** through `EPIC-007`'s own
 * version service, which is precisely what that table is defined to hold, and
 * returns the id of the row it created. The Room mints nothing.
 */
import { describe, expect, it } from 'vitest';
import { absentBehaviourOf } from '@pmi/room-contract';
import { buildService } from './requirements/helpers.js';
import { IntakeService } from '../../src/modules/requirement-room/intake.service.js';
import {
  EpicSevenRequirementRegister,
  RegisterUnavailableError,
  requireRegister,
} from '../../src/modules/requirement-room/register.adapter.js';
import { InMemoryRequirementRoomStore } from '../../src/modules/requirement-room/requirement-room.store.js';

const CTX = { workspaceId: 'ws_1', userId: 'user_1' };

async function fixture() {
  const { svc, versions } = buildService();
  const store = new InMemoryRequirementRoomStore();
  const intake = new IntakeService(store);
  const register = new EpicSevenRequirementRegister(svc, versions);
  const [candidate] = await intake.intake({
    workspaceId: 'ws_1',
    projectId: 'pr_1',
    roomObjectId: 'ro_1',
    sourceRef: 'direct:2026-08-23',
    text: 'A superseded baseline remains readable and names what replaced it.',
  });
  return { svc, versions, store, register, candidate: candidate! };
}

describe('T338c · a candidate promotes into EPIC-007, not into this Room', () => {
  it('creates the requirement in EPIC-007s register, readable from there', async () => {
    const { svc, register, candidate } = await fixture();

    const promoted = await register.promote(CTX, 'pr_1', {
      text: candidate.normalizedText,
      type: 'functional',
      priority: 'p1',
    });

    const fromRegister = await svc.get('ws_1', promoted.requirementId);
    expect(fromRegister.description).toBe(
      'A superseded baseline remains readable and names what replaced it.',
    );
    expect(fromRegister.workspaceId).toBe('ws_1');
    expect(fromRegister.projectId).toBe('pr_1');
  });

  it('returns EPIC-007s content hash rather than computing a second one', async () => {
    const { svc, register, candidate } = await fixture();

    const promoted = await register.promote(CTX, 'pr_1', {
      text: candidate.normalizedText,
      type: 'functional',
      priority: 'p1',
    });

    // R-033-5: two hashing schemes over the same content would eventually
    // disagree, and the disagreement surfaces as a baseline nobody can verify.
    const fromRegister = await svc.get('ws_1', promoted.requirementId);
    expect(promoted.contentHash).toBe(fromRegister.contentHash);
  });

  it('records the EPIC-007 id on the candidate as a reference, adding no columns', async () => {
    const { store, register, candidate } = await fixture();

    const promoted = await register.promote(CTX, 'pr_1', {
      text: candidate.normalizedText,
      type: 'functional',
      priority: 'p1',
    });
    const marked = await store.markPromoted(candidate.id, promoted.requirementId);

    expect(marked.promotedTo).toBe(promoted.requirementId);
    // D-33 held where it is easiest to break: after promotion the Room's row is
    // the same twelve fields it started with. A `description` here would be the
    // second requirement store, arrived at one convenient field at a time.
    expect(Object.keys(marked).sort()).toEqual([
      'acceptanceCriteria',
      'aiAnalysis',
      'createdAt',
      'epistemic',
      'id',
      'intendedForImplementation',
      'normalizedText',
      'projectId',
      'promotedTo',
      'roomObjectId',
      'sourceRef',
      'workspaceId',
    ]);
  });
});

describe('T338c · freeze produces an EPIC-007 version id, minted by EPIC-007', () => {
  it('returns an id that exists in EPIC-007s version history', async () => {
    const { versions, register, candidate } = await fixture();

    const promoted = await register.promote(CTX, 'pr_1', {
      text: candidate.normalizedText,
      type: 'functional',
      priority: 'p1',
    });
    const frozen = await register.freeze(CTX, promoted.requirementId);

    const history = await versions.listForRequirement('ws_1', promoted.requirementId);
    expect(history.map((row) => row.id)).toContain(frozen.requirementVersionId);
  });

  it('freezes the text as it stands, so the frozen row is what was approved', async () => {
    const { versions, register, candidate } = await fixture();

    const promoted = await register.promote(CTX, 'pr_1', {
      text: candidate.normalizedText,
      type: 'functional',
      priority: 'p1',
    });
    const frozen = await register.freeze(CTX, promoted.requirementId);

    const row = (await versions.listForRequirement('ws_1', promoted.requirementId)).find(
      (v) => v.id === frozen.requirementVersionId,
    );
    expect(row?.description).toBe(
      'A superseded baseline remains readable and names what replaced it.',
    );
  });

  it('refuses to freeze a requirement from another workspace, opaquely', async () => {
    const { register, candidate } = await fixture();

    const promoted = await register.promote(CTX, 'pr_1', {
      text: candidate.normalizedText,
      type: 'functional',
      priority: 'p1',
    });

    // FR-002 / SC-004 — indistinguishable from a requirement that does not
    // exist. EPIC-007's own guard produces this; the adapter does not soften it.
    await expect(
      register.freeze({ workspaceId: 'ws_other', userId: 'user_2' }, promoted.requirementId),
    ).rejects.toThrow(/Not found/);
  });
});

describe('T338c · an absent register refuses, and is never substituted', () => {
  it('agrees with the shared contract rather than restating it', () => {
    // Reads ROOM_PORTS. Soften the declaration and this fails here, instead of
    // this file quietly agreeing with a rule that moved.
    expect(absentBehaviourOf('RequirementRegister')).toBe('refuse');
  });

  it('refuses when nothing is bound, naming the seam', () => {
    expect(() => requireRegister(undefined)).toThrow(RegisterUnavailableError);
    expect(() => requireRegister(undefined)).toThrow(/EPIC-007/);
  });

  it('returns the bound register unchanged when one is present', async () => {
    const { register } = await fixture();
    expect(requireRegister(register)).toBe(register);
  });

  it('offers no in-memory fallback anywhere in the module', async () => {
    // The failure this guards is not a bug anyone writes on purpose: it is a
    // convenience added to make a test pass, which then works perfectly in
    // every test and is wrong in production. If a local requirement register
    // is ever added, its export shows up here.
    const module = await import('../../src/modules/requirement-room/register.adapter.js');
    const fallbacks = Object.keys(module).filter((name) => /InMemory|Fake|Stub|Null/.test(name));
    expect(fallbacks).toEqual([]);
  });
});
