/**
 * `T996g`, `T996h` (EPIC-034) — clarification and withdrawal.
 *
 * `FR-CHR-022`: the open questions are presented as **one set** and answerable
 * in place. One set rather than a queue, because a requester who can see all
 * five questions can answer them in the order that suits what they know; a
 * queue makes the second question wait on the first for no reason anybody could
 * name.
 *
 * `FR-CHR-023`: a withdrawn request **and its analysis** are both retained.
 * That somebody questioned a baseline and then thought better of it is part of
 * how the baseline earned its standing, and deleting it leaves a record showing
 * the baseline was never questioned at all.
 *
 * Retention here is not asserted by observing that nothing happened to be
 * deleted — it is asserted structurally: the store has no way to delete a row.
 * A promise kept by a code path that happens not to exist is a promise somebody
 * breaks by adding one.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NotFoundError, ValidationFailedError } from '../../src/core/errors.js';
import { ChangeIntakeService } from '../../src/modules/change-room/intake.service.js';
import {
  InMemoryChangeRoomStore,
  type ChangeRequestRow,
} from '../../src/modules/change-room/change-room.store.js';

const here = dirname(fileURLToPath(import.meta.url));
const STORE_SOURCE = readFileSync(
  join(here, '..', '..', 'src', 'modules', 'change-room', 'change-room.store.ts'),
  'utf8',
);

/** A request carrying three unresolved questions. */
async function raised(): Promise<{
  intake: ChangeIntakeService;
  store: InMemoryChangeRoomStore;
  request: ChangeRequestRow;
}> {
  const store = new InMemoryChangeRoomStore();
  const intake = new ChangeIntakeService(store);
  const request = await intake.raise({
    workspaceId: 'ws_1',
    projectId: 'pr_1',
    roomObjectId: 'ro_1',
    targetBaselineId: 'b_1',
    targetBaselineVersion: 3,
    requestedOutcome: 'require notification within one hour',
    reason: 'the regulator shortened the window',
    requester: 'u_1',
    questions: [
      'does this affect the mobile client?',
      'who signs it off?',
      'is one hour measured from detection or from confirmation?',
    ],
  });
  return { intake, store, request };
}

describe('T996g · questions arrive as one set', () => {
  it('all three, in the order they were asked', async () => {
    const { request } = await raised();
    expect(request.openQuestions.map((q) => q.question)).toEqual([
      'does this affect the mobile client?',
      'who signs it off?',
      'is one hour measured from detection or from confirmation?',
    ]);
  });

  it('each unanswered, and distinguishably so', async () => {
    // `null` rather than an empty string: "nobody has answered" and "somebody
    // answered with nothing" are different facts, and a blank answer is refused
    // below precisely so the second can never be recorded.
    const { request } = await raised();
    for (const question of request.openQuestions) {
      expect(question.answer).toBeNull();
      expect(question.answeredBy).toBeNull();
    }
  });

  it('carried on the request itself, not fetched separately', async () => {
    // The whole set travels with the thing it is about. A second call to get
    // them is the shape that becomes a queue.
    const { store, request } = await raised();
    const reread = await store.findById('ws_1', request.id);
    expect(reread?.openQuestions).toHaveLength(3);
  });
});

describe('T996g · answerable in place', () => {
  it('answers the second without touching the first or third', async () => {
    const { intake, request } = await raised();
    const target = request.openQuestions[1]!;
    const updated = await intake.answer('ws_1', request.id, target.id, 'Priya signs it.', 'u_2');

    const answered = updated.openQuestions[1]!;
    expect(answered.answer).toBe('Priya signs it.');
    expect(answered.answeredBy).toBe('u_2');
    // In place: same id, same text, same position.
    expect(answered.id).toBe(target.id);
    expect(answered.question).toBe(target.question);
    expect(updated.openQuestions[0]?.answer).toBeNull();
    expect(updated.openQuestions[2]?.answer).toBeNull();
  });

  it('answers can be given in any order', async () => {
    // The point of one set rather than a queue.
    const { intake, request } = await raised();
    const [first, , third] = request.openQuestions;
    await intake.answer('ws_1', request.id, third!.id, 'From confirmation.', 'u_2');
    const updated = await intake.answer('ws_1', request.id, first!.id, 'No, web only.', 'u_3');

    expect(updated.openQuestions[0]?.answer).toBe('No, web only.');
    expect(updated.openQuestions[1]?.answer).toBeNull();
    expect(updated.openQuestions[2]?.answer).toBe('From confirmation.');
  });

  it('refuses a blank answer', async () => {
    const { intake, request } = await raised();
    await expect(
      intake.answer('ws_1', request.id, request.openQuestions[0]!.id, '   ', 'u_2'),
    ).rejects.toBeInstanceOf(ValidationFailedError);
  });

  it('a question that does not exist is absent, not forbidden', async () => {
    const { intake, request } = await raised();
    await expect(
      intake.answer('ws_1', request.id, 'q_nonexistent', 'yes', 'u_2'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('a request in another workspace is absent too', async () => {
    // `FR-002`. A caller learns nothing about a request it may not see —
    // including whether it exists.
    const { intake, request } = await raised();
    await expect(
      intake.answer('ws_other', request.id, request.openQuestions[0]!.id, 'yes', 'u_2'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('T996g · withdrawn, and retained', () => {
  it('withdrawal is a state change', async () => {
    const { intake, request } = await raised();
    const withdrawn = await intake.withdraw('ws_1', request.id);
    expect(withdrawn.state).toBe('withdrawn');
  });

  it('the request is still there afterwards', async () => {
    const { intake, store, request } = await raised();
    await intake.withdraw('ws_1', request.id);
    expect(await store.findById('ws_1', request.id)).not.toBeNull();
  });

  it('and so is its analysis', async () => {
    // `FR-CHR-023` says the request *and its analysis*. An answered question is
    // the cheapest analysis there is, and losing it would lose the reasoning
    // that led somebody to think better of the change.
    const { intake, request } = await raised();
    await intake.answer('ws_1', request.id, request.openQuestions[1]!.id, 'Priya signs it.', 'u_2');
    const withdrawn = await intake.withdraw('ws_1', request.id);

    expect(withdrawn.openQuestions).toHaveLength(3);
    expect(withdrawn.openQuestions[1]?.answer).toBe('Priya signs it.');
    expect(withdrawn.openQuestions[1]?.answeredBy).toBe('u_2');
  });

  it('withdrawn means no longer in flight, not gone', async () => {
    // The distinction the gate depends on. `openAgainst` feeds `RULE-02`, so a
    // withdrawn request must stop blocking; `listForBaseline` is the record, so
    // it must keep showing.
    const { intake, store, request } = await raised();
    expect(await intake.openAgainst('ws_1', 'b_1')).toHaveLength(1);

    await intake.withdraw('ws_1', request.id);

    expect(await intake.openAgainst('ws_1', 'b_1')).toHaveLength(0);
    expect(await store.listForBaseline('ws_1', 'b_1')).toHaveLength(1);
  });

  it('refuses to withdraw one that is not open', async () => {
    const { intake, request } = await raised();
    await intake.withdraw('ws_1', request.id);
    await expect(intake.withdraw('ws_1', request.id)).rejects.toThrow(/only an open/i);
  });
});

describe('T996g · retention is structural', () => {
  it('the store offers no way to delete a change request', async () => {
    // Not "nothing deleted it" — nothing *can*. `FR-CHR-023` is enforced by the
    // absence of the capability rather than by everyone remembering not to use
    // it.
    for (const verb of ['delete', 'remove', 'destroy', 'purge', 'drop']) {
      expect(
        new RegExp(`\\b${verb}\\w*\\s*\\(`, 'i').test(STORE_SOURCE),
        `the store exposes ${verb}`,
      ).toBe(false);
    }
  });

  it('the matcher can fire', async () => {
    // Anti-tautology: five absence assertions are worth nothing unless the
    // matcher is shown catching the thing it looks for.
    expect(/\bdelete\w*\s*\(/i.test('  delete(workspaceId: string, id: string): Promise<void>;')).toBe(
      true,
    );
  });

  it('every mutation the store offers is additive or a state change', async () => {
    // Enumerated rather than counted, so a new mutator has to be named here
    // before it can exist — which is what happened when `T996q` added impact
    // views, and is the point. Nothing in this list replaces or removes:
    // `create` and `saveImpactView` append, `setState`, `setQuestions` and
    // `retainForDecision` change a field on a row that stays.
    const store = new InMemoryChangeRoomStore();
    const mutators = Object.getOwnPropertyNames(Object.getPrototypeOf(store)).filter(
      (name) => name !== 'constructor' && !name.startsWith('find') && !name.startsWith('list'),
    );
    expect(mutators.sort()).toEqual([
      'create',
      'latestImpactViewFor',
      'retainForDecision',
      'saveImpactView',
      'setQuestions',
      'setState',
    ]);
  });
});
