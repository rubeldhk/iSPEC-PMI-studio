/**
 * T338q — clarifications are one set, answerable in place, and retained.
 * `FR-RQR-012`, `FR-RQR-013`, `BR-0022`.
 *
 * *"Clarification questions MUST be presented as one set rather than one at a
 * time, and MUST be answerable in place."*
 * *"Answers MUST be retained as part of the requirement record, not discarded
 * once resolved."*
 *
 * **One set is a behaviour, not a rendering choice.** Asking one question at a
 * time is how a clarification pass becomes six round trips, each one costing
 * the reader the context of the last. So `ask` takes the whole set and writes
 * it together; there is no method that asks one.
 *
 * **Retained is asserted as an absence.** `FR-RQR-013` is not "the answer is
 * saved" — it is "the answer is not discarded once resolved". The
 * `clarifications_are_retained` trigger refuses a `DELETE` outright while
 * permitting the `UPDATE` that carries an answer, and this port mirrors that:
 * it has **no delete at all**. The question somebody had to ask is evidence
 * about the requirement's clarity, and it stops being evidence the moment it
 * can be tidied away.
 *
 * **`blocksBaseline` is derived, and the derivation is the interesting part.**
 * The column records that a question is *of a blocking kind*; whether it still
 * blocks is read from the answer. Storing "no longer blocking" as a second flag
 * would create an invalidation path — a row that says open and a flag that says
 * clear, disagreeing after the one code path that forgot to update both.
 */
import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../src/core/errors.js';
import { ClarificationService } from '../../src/modules/requirement-room/clarification.service.js';
import { IntakeService } from '../../src/modules/requirement-room/intake.service.js';
import { InMemoryRequirementRoomStore } from '../../src/modules/requirement-room/requirement-room.store.js';

async function fixture() {
  const store = new InMemoryRequirementRoomStore();
  const [candidate] = await new IntakeService(store).intake({
    workspaceId: 'ws_1',
    projectId: 'pr_1',
    roomObjectId: 'ro_1',
    sourceRef: 'direct:2026-08-23',
    text: 'A baseline must be approved by an authorized role.',
  });
  return { store, clarifications: new ClarificationService(store), candidate: candidate! };
}

const THREE = [
  { question: 'Which role may approve a baseline?' },
  { question: 'Does an exception need the same authority?' },
  { question: 'What happens to an open question at approval time?' },
];

describe('T338q · questions are asked as one set', () => {
  it('writes the whole set in one call', async () => {
    const { clarifications } = await fixture();

    const asked = await clarifications.ask({
      workspaceId: 'ws_1',
      roomObjectId: 'ro_1',
      askedBy: 'user_1',
      questions: THREE,
    });

    expect(asked).toHaveLength(3);
  });

  it('returns them as one set, in the order they were asked', async () => {
    const { clarifications } = await fixture();
    await clarifications.ask({
      workspaceId: 'ws_1',
      roomObjectId: 'ro_1',
      askedBy: 'user_1',
      questions: THREE,
    });

    const set = await clarifications.list('ws_1', 'ro_1');

    expect(set.map((c) => c.question)).toEqual(THREE.map((q) => q.question));
  });

  it('refuses an empty set rather than recording that questions were asked', async () => {
    const { clarifications } = await fixture();

    // `200 []` reads as "the AI had no questions", which is a finding. An empty
    // request is not that finding; it is a malformed call.
    await expect(
      clarifications.ask({
        workspaceId: 'ws_1',
        roomObjectId: 'ro_1',
        askedBy: 'user_1',
        questions: [],
      }),
    ).rejects.toThrow(ValidationFailedError);
  });

  it('refuses a blank question inside an otherwise valid set, naming its position', async () => {
    const { clarifications } = await fixture();

    await expect(
      clarifications.ask({
        workspaceId: 'ws_1',
        roomObjectId: 'ro_1',
        askedBy: 'user_1',
        questions: [{ question: 'Which role?' }, { question: '   ' }],
      }),
    ).rejects.toThrow(/2/);
  });

  it('writes nothing when any question in the set is refused', async () => {
    const { clarifications } = await fixture();
    await clarifications
      .ask({
        workspaceId: 'ws_1',
        roomObjectId: 'ro_1',
        askedBy: 'user_1',
        questions: [{ question: 'Which role?' }, { question: '' }],
      })
      .catch(() => undefined);

    // A set that half-landed is worse than one that did not: the reader
    // answers what they can see and never learns what was dropped.
    expect(await clarifications.list('ws_1', 'ro_1')).toEqual([]);
  });

  it('records an AI-generated question against its AgentExecutionRecord', async () => {
    const { clarifications } = await fixture();

    const [asked] = await clarifications.ask({
      workspaceId: 'ws_1',
      roomObjectId: 'ro_1',
      // BR-0104 — data-model §2: an actor id, or an AgentExecutionRecord id
      // when AI-generated. Attributable without this Room inventing a log.
      askedBy: 'exec_7f3c',
      questions: [{ question: 'Which role may approve a baseline?' }],
    });

    expect(asked?.askedBy).toBe('exec_7f3c');
  });

  it('is the clarifications column set exactly', async () => {
    const { clarifications, candidate } = await fixture();
    const [asked] = await clarifications.ask({
      workspaceId: 'ws_1',
      roomObjectId: 'ro_1',
      askedBy: 'user_1',
      questions: [{ question: 'Which role?', candidateId: candidate.id }],
    });

    expect(Object.keys(asked ?? {}).sort()).toEqual([
      'answer',
      'answeredAt',
      'answeredBy',
      'askedBy',
      'blocksBaseline',
      'candidateId',
      'createdAt',
      'id',
      'question',
      'roomObjectId',
      'workspaceId',
    ]);
  });
});

describe('T338q · a question is answered in place', () => {
  it('keeps the same row and the same id', async () => {
    const { clarifications } = await fixture();
    const [asked] = await clarifications.ask({
      workspaceId: 'ws_1',
      roomObjectId: 'ro_1',
      askedBy: 'user_1',
      questions: [{ question: 'Which role may approve a baseline?' }],
    });

    const answered = await clarifications.answer({
      workspaceId: 'ws_1',
      id: asked!.id,
      answer: 'The product owner.',
      answeredBy: 'user_2',
    });

    expect(answered.id).toBe(asked!.id);
    expect(answered.answer).toBe('The product owner.');
    expect(answered.answeredBy).toBe('user_2');
    expect(answered.answeredAt).toBeInstanceOf(Date);
  });

  it('leaves the question text untouched', async () => {
    const { clarifications } = await fixture();
    const [asked] = await clarifications.ask({
      workspaceId: 'ws_1',
      roomObjectId: 'ro_1',
      askedBy: 'user_1',
      questions: [{ question: 'Which role may approve a baseline?' }],
    });

    const answered = await clarifications.answer({
      workspaceId: 'ws_1',
      id: asked!.id,
      answer: 'The product owner.',
      answeredBy: 'user_2',
    });

    expect(answered.question).toBe('Which role may approve a baseline?');
    expect(answered.askedBy).toBe('user_1');
  });

  it('refuses a second answer rather than overwriting the first', async () => {
    const { clarifications } = await fixture();
    const [asked] = await clarifications.ask({
      workspaceId: 'ws_1',
      roomObjectId: 'ro_1',
      askedBy: 'user_1',
      questions: [{ question: 'Which role?' }],
    });
    await clarifications.answer({
      workspaceId: 'ws_1',
      id: asked!.id,
      answer: 'The product owner.',
      answeredBy: 'user_2',
    });

    // An answer replaced in place discards the first one, which FR-RQR-013
    // forbids as squarely as deleting it would.
    await expect(
      clarifications.answer({
        workspaceId: 'ws_1',
        id: asked!.id,
        answer: 'Actually, the architect.',
        answeredBy: 'user_3',
      }),
    ).rejects.toThrow(/already answered/i);
  });

  it('refuses an empty answer — an answered question with no answer is worse than an open one', async () => {
    const { clarifications } = await fixture();
    const [asked] = await clarifications.ask({
      workspaceId: 'ws_1',
      roomObjectId: 'ro_1',
      askedBy: 'user_1',
      questions: [{ question: 'Which role?' }],
    });

    await expect(
      clarifications.answer({
        workspaceId: 'ws_1',
        id: asked!.id,
        answer: '   ',
        answeredBy: 'user_2',
      }),
    ).rejects.toThrow(ValidationFailedError);
  });

  it('refuses to answer a clarification in another workspace, opaquely', async () => {
    const { clarifications } = await fixture();
    const [asked] = await clarifications.ask({
      workspaceId: 'ws_1',
      roomObjectId: 'ro_1',
      askedBy: 'user_1',
      questions: [{ question: 'Which role?' }],
    });

    await expect(
      clarifications.answer({
        workspaceId: 'ws_other',
        id: asked!.id,
        answer: 'The product owner.',
        answeredBy: 'user_2',
      }),
    ).rejects.toThrow(/Not found/);
  });
});

describe('T338q · answers are retained, not discarded', () => {
  it('still lists an answered question with the whole exchange', async () => {
    const { clarifications } = await fixture();
    const [asked] = await clarifications.ask({
      workspaceId: 'ws_1',
      roomObjectId: 'ro_1',
      askedBy: 'user_1',
      questions: [{ question: 'Which role may approve a baseline?' }],
    });
    await clarifications.answer({
      workspaceId: 'ws_1',
      id: asked!.id,
      answer: 'The product owner.',
      answeredBy: 'user_2',
    });

    const set = await clarifications.list('ws_1', 'ro_1');

    // The question somebody had to ask is evidence about the requirement's
    // clarity. Listing only the open ones would leave that evidence unreachable
    // through the only method that reads them.
    expect(set).toHaveLength(1);
    expect(set[0]?.question).toBe('Which role may approve a baseline?');
    expect(set[0]?.answer).toBe('The product owner.');
  });

  it('offers no way to delete one', () => {
    // The `clarifications_are_retained` trigger refuses a DELETE at the row.
    // A port that offered one would let the service do what the database
    // refuses, and the two would disagree only in production.
    const surface = Object.getOwnPropertyNames(ClarificationService.prototype);
    expect(surface.filter((m) => /delete|remove|discard|purge/i.test(m))).toEqual([]);
  });
});

describe('T338q · what blocks a baseline is derived from the answer', () => {
  it('counts an open question on a candidate as blocking', async () => {
    const { clarifications, candidate } = await fixture();
    await clarifications.ask({
      workspaceId: 'ws_1',
      roomObjectId: 'ro_1',
      askedBy: 'user_1',
      questions: [{ question: 'Which role?', candidateId: candidate.id }],
    });

    expect(await clarifications.blockers('ws_1', 'ro_1')).toHaveLength(1);
  });

  it('does not count a question attached to no candidate', async () => {
    const { clarifications } = await fixture();
    await clarifications.ask({
      workspaceId: 'ws_1',
      roomObjectId: 'ro_1',
      askedBy: 'user_1',
      questions: [{ question: 'A general question about the project.' }],
    });

    expect(await clarifications.blockers('ws_1', 'ro_1')).toEqual([]);
  });

  it('stops blocking once answered, without any flag being rewritten', async () => {
    const { clarifications, candidate } = await fixture();
    const [asked] = await clarifications.ask({
      workspaceId: 'ws_1',
      roomObjectId: 'ro_1',
      askedBy: 'user_1',
      questions: [{ question: 'Which role?', candidateId: candidate.id }],
    });
    const answered = await clarifications.answer({
      workspaceId: 'ws_1',
      id: asked!.id,
      answer: 'The product owner.',
      answeredBy: 'user_2',
    });

    expect(await clarifications.blockers('ws_1', 'ro_1')).toEqual([]);
    // The stored column still says this is a blocking KIND of question. What
    // changed is the answer. Rewriting the flag as well would be the second
    // source of truth, and the two would eventually disagree.
    expect(answered.blocksBaseline).toBe(true);
  });
});
