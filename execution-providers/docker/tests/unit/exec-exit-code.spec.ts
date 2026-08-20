/**
 * T692 — an unknown exit status is not success (`DEF-028-011`).
 *
 * `exec` read the status as `ExitCode ?? 0`. Docker reports `ExitCode: null`
 * while an exec has not finished, so the default turned **unknown** into
 * **succeeded**. On 2026-08-19 that reported a failing agent as a succeeding
 * one: `claude` exited 1 with *"Invalid API key"*, the adapter recorded
 * `agent_finished`, and the real cause surfaced three steps later as
 * *"the engine produced no output"* — sending a reader to the parser, the image
 * and the scaffold, every place except the one that was wrong.
 *
 * `ExitCode` appeared exactly once in this repository — in that expression — and
 * in no test at all. The status was therefore never asserted, which is why a
 * defaulted failure could not be noticed. Parsing is extracted here for the same
 * reason `demultiplex` is: a thing worth getting right is a thing worth testing.
 *
 * Written to fail first: `parseExecExitCode` does not exist yet.
 */
import { describe, expect, it } from 'vitest';
import { parseExecExitCode } from '../../src/index';

describe('T692 · a finished exec reports its real status', () => {
  it('returns 0 when the process succeeded', () => {
    expect(parseExecExitCode(JSON.stringify({ ExitCode: 0, Running: false }))).toBe(0);
  });

  it('returns the non-zero status, which is the case that was being lost', () => {
    // The exact shape of the 2026-08-19 run: `claude` exits 1 on an invalid key.
    expect(parseExecExitCode(JSON.stringify({ ExitCode: 1, Running: false }))).toBe(1);
    expect(parseExecExitCode(JSON.stringify({ ExitCode: 127, Running: false }))).toBe(127);
  });
});

describe('T692 · an unknown status is refused, never defaulted to success', () => {
  it('refuses a null ExitCode — the exec has not finished', () => {
    expect(() => parseExecExitCode(JSON.stringify({ ExitCode: null, Running: true }))).toThrow(
      /no exit status/i,
    );
  });

  it('refuses a null ExitCode even when Running is already false', () => {
    // Do not require BOTH signals to agree. Docker has reported a null status on
    // a stopped exec; requiring `Running === true` as well would reinstate the
    // defaulting through the narrower door.
    expect(() => parseExecExitCode(JSON.stringify({ ExitCode: null, Running: false }))).toThrow(
      /no exit status/i,
    );
  });

  it('refuses a response with no ExitCode field at all', () => {
    expect(() => parseExecExitCode(JSON.stringify({ Running: false }))).toThrow(/no exit status/i);
  });

  it('names the defect in the message, so the next reader lands on the record', () => {
    let message = '';
    try {
      parseExecExitCode(JSON.stringify({ ExitCode: null }));
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain('DEF-028-011');
  });

  it('does not swallow a malformed response into a status', () => {
    // A parse failure is a different fault from a missing status, and must not
    // be answered with a number either.
    expect(() => parseExecExitCode('not json at all')).toThrow();
  });
});
