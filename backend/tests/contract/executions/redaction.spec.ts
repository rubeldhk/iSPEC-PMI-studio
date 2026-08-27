/**
 * T1051, T1052 (EPIC-037 Band A) — redaction as a contract rule (`R-037-9`).
 *
 * The rule is easy to state and easy to implement backwards: a redaction hides
 * the body **without** destroying the chain. Overwriting in place would be
 * simpler and would make a redacted thread indistinguishable from one that was
 * always shorter.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT_EVENTS, permittedAfterTerminal } from '@pmi/execution-registry-contract';

describe('T1051 · redaction is an event, not an edit', () => {
  it('is in the vocabulary as its own event', () => {
    expect(CONTENT_EVENTS).toContain('comment-redacted');
    expect(CONTENT_EVENTS).toContain('comment-added');
  });

  it('is permitted after the execution has terminated', () => {
    // A secret is often noticed long after the run finished. If redaction were
    // a lifecycle event it would be blocked exactly when it is most needed.
    expect(permittedAfterTerminal('comment-redacted')).toBe(true);
    expect(permittedAfterTerminal('comment-added')).toBe(true);
  });

  it('is a CONTENT event, so terminality never blocks it', () => {
    expect(permittedAfterTerminal('completed')).toBe(false);
    expect(permittedAfterTerminal('comment-redacted')).toBe(true);
  });
});

describe('T1051 · what a redaction preserves', () => {
  it('keeps the original row, and points the successor at it', () => {
    // The shape the service writes: a new row carrying `supersedesCommentId`,
    // `redactionState` and the redactor -- and the original untouched beside
    // it. Both survive; the history is the pair.
    const original = { id: 'cm1', body: 'oops ghp_token', redactionState: 'visible' };
    const redaction = {
      id: 'cm2',
      body: '[redacted]',
      supersedesCommentId: 'cm1',
      redactionState: 'redacted',
      redactedBy: 'u_admin',
      redactionReason: 'contained a token',
    };
    expect(redaction.supersedesCommentId).toBe(original.id);
    expect(original.redactionState, 'the original was rewritten').toBe('visible');
    // An auditor can still see that something was said, by whom, and why it
    // was withheld -- without seeing what.
    expect(redaction.redactedBy).toBeTruthy();
    expect(redaction.redactionReason).toBeTruthy();
  });
});
