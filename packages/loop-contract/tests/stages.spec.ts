/**
 * T993g — the stage vocabulary, written to fail first.
 *
 * `FR-GEL-001` fixes the loop at eight stages in model order, and `FR-GEL-002`
 * makes that order part of the contract rather than a convention. The tuple is
 * the single definition every consumer imports; a Room writing `'Decide'` as a
 * string literal is what `FR-GEL-060` exists to stop, and it can only be stopped
 * if there is one place the name comes from.
 */
import { describe, expect, it } from 'vitest';
import { LOOP_STAGES, isLoopStage, type LoopStage } from '../src/stages.js';

describe('FR-GEL-001 · the loop has exactly eight stages, in model order', () => {
  it('names them in the order the model states', () => {
    expect(LOOP_STAGES).toEqual([
      'Event',
      'Context',
      'Analyze',
      'Decide',
      'Execute',
      'Verify',
      'Evidence',
      'Outcome',
    ]);
  });

  it('has exactly eight, so a ninth is a contract change and not an addition', () => {
    expect(LOOP_STAGES).toHaveLength(8);
  });

  it('declares no duplicate stage', () => {
    expect(new Set(LOOP_STAGES).size).toBe(LOOP_STAGES.length);
  });
});

describe('FR-GEL-002 · the tuple is readonly at runtime as well as in the type', () => {
  it('refuses mutation', () => {
    // `as const` is erased at runtime; a consumer holding the array could
    // reorder the loop for every workflow type in the process. Object.freeze is
    // what makes the type's promise true after compilation.
    expect(Object.isFrozen(LOOP_STAGES)).toBe(true);
    expect(() => {
      (LOOP_STAGES as unknown as string[]).push('Rollback');
    }).toThrow();
    expect(LOOP_STAGES).toHaveLength(8);
  });
});

describe('isLoopStage · the narrowing a configuration loader needs', () => {
  it('accepts every declared stage', () => {
    for (const stage of LOOP_STAGES) expect(isLoopStage(stage)).toBe(true);
  });

  it('rejects a stage that is not in the vocabulary', () => {
    // The case `FR-GEL-007` turns into a load-time refusal: a configuration
    // naming `Triage` must not resolve to anything.
    expect(isLoopStage('Triage')).toBe(false);
    expect(isLoopStage('decide')).toBe(false);
    expect(isLoopStage('')).toBe(false);
  });

  it('narrows the type, so a caller need not cast', () => {
    const candidate: string = 'Verify';
    if (!isLoopStage(candidate)) throw new Error('unreachable');
    const stage: LoopStage = candidate;
    expect(stage).toBe('Verify');
  });
});
