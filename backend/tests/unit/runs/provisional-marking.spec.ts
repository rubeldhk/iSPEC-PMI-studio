/**
 * T342 — every artifact derived from a provisional answer is marked, names
 * the governing question, and loses the marking once that question is
 * answered (FR-RUN-005, FR-RUN-017, SC-004). A marking is a LINK, not a flag
 * (R-002-5) — clearing is SELECTIVE.
 */
import { describe, expect, it } from 'vitest';
import { WS, harness, startUnattended, ask } from '../review/helpers.js';

const SPEC = { artifactType: 'specification', artifactId: 'spec_1' };

describe('T342 · provisional marking and its clearing rule', () => {
  it('marks an artifact derived from a provisional answer, naming the question', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q] = await ask(h, run.id, 1);
    await h.provisional.mark(WS, SPEC, q!.id);
    expect(await h.provisional.isProvisional(WS, SPEC)).toBe(true);
    const markings = await h.provisional.markingsFor(WS, SPEC);
    expect(markings).toHaveLength(1);
    expect(markings[0]!.questionId).toBe(q!.id);
  });

  it('an artifact with no provisional answer carries no marking at all', async () => {
    const h = harness();
    expect(await h.provisional.isProvisional(WS, SPEC)).toBe(false);
    expect(await h.provisional.markingsFor(WS, SPEC)).toHaveLength(0);
  });

  it('clears SELECTIVELY: answering one question clears only its markings (SC-004)', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q1, q2] = await ask(h, run.id, 2);
    await h.provisional.mark(WS, SPEC, q1!.id);
    await h.provisional.mark(WS, SPEC, q2!.id);

    await h.provisional.clearForQuestion(WS, q1!.id);

    // q1's marking cleared; q2's still stands — the artifact stays provisional.
    expect(await h.provisional.isProvisional(WS, SPEC)).toBe(true);
    const markings = await h.provisional.markingsFor(WS, SPEC);
    expect(markings.find((m) => m.questionId === q1!.id)?.clearedAt).not.toBeNull();
    expect(markings.find((m) => m.questionId === q2!.id)?.clearedAt).toBeNull();

    // Only when ALL clear does the artifact stop being provisional.
    await h.provisional.clearForQuestion(WS, q2!.id);
    expect(await h.provisional.isProvisional(WS, SPEC)).toBe(false);
  });

  it('clearing one question leaves other artifacts under other questions marked', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q1, q2] = await ask(h, run.id, 2);
    const other = { artifactType: 'task', artifactId: 'task_9' };
    await h.provisional.mark(WS, SPEC, q1!.id);
    await h.provisional.mark(WS, other, q2!.id);

    await h.provisional.clearForQuestion(WS, q1!.id);
    expect(await h.provisional.isProvisional(WS, SPEC)).toBe(false);
    expect(await h.provisional.isProvisional(WS, other)).toBe(true);
  });
});
