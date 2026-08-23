/**
 * T941 — the stage handler registry refuses by default. `R-030-5`,
 * `FR-GEL-007`, `FR-GEL-062`.
 *
 * The registry's whole job is to have **no fallback**. Every other registry in
 * this repository defaults sensibly — an in-memory store, a null metric sink —
 * and that is right for those. It is wrong here, for one reason stated in the
 * contract: *a no-op `Decide` handler is an auto-approval wearing a
 * placeholder's name.*
 *
 * So the assertions below are mostly about what the registry will **not** do.
 */
import { describe, expect, it } from 'vitest';
import type { StageHandler, TransitionContext } from '@pmi/loop-contract';
import { StageRegistry, UnhandledStageError } from '../../src/modules/loop/stage-registry.js';

function handler(stage: StageHandler['stage'], mark: string[] = []): StageHandler {
  return {
    stage,
    async enter(_ctx: TransitionContext) {
      mark.push(stage);
      return { ok: true };
    },
  };
}

describe('T941 · the registry resolves what was registered', () => {
  it('returns a registered handler', () => {
    const registry = new StageRegistry([handler('Decide')]);
    expect(registry.handlerFor('Decide').stage).toBe('Decide');
  });

  it('reports which stages it can run, for the loader to check (FR-GEL-007)', () => {
    const registry = new StageRegistry([handler('Event'), handler('Outcome')]);
    expect(registry.registeredStages).toEqual(['Event', 'Outcome']);
  });

  it('runs the handler it resolved, rather than something shaped like one', async () => {
    const marks: string[] = [];
    const registry = new StageRegistry([handler('Analyze', marks)]);
    await registry.handlerFor('Analyze').enter({} as TransitionContext);
    expect(marks).toEqual(['Analyze']);
  });
});

describe('R-030-5 · an unregistered stage refuses, and never defaults', () => {
  it('throws for a stage nothing registered', () => {
    const registry = new StageRegistry([handler('Event')]);
    expect(() => registry.handlerFor('Decide')).toThrow(UnhandledStageError);
  });

  it('names the stage, so the refusal is actionable', () => {
    const registry = new StageRegistry([handler('Event')]);
    expect(() => registry.handlerFor('Decide')).toThrow(/Decide/);
  });

  it('has no no-op fallback to find', () => {
    // The failure this prevents: a registry that returned a handler resolving
    // `{ ok: true }` for anything unregistered would let a workflow advance
    // through Decide with nobody deciding, and every test above would pass.
    const registry = new StageRegistry([]);
    expect(registry.registeredStages).toEqual([]);
    for (const stage of ['Event', 'Decide', 'Evidence'] as const) {
      expect(() => registry.handlerFor(stage)).toThrow(UnhandledStageError);
    }
  });

  it('refuses to register two handlers for one stage', () => {
    // Otherwise "which Decide ran?" has no answer, and the last registration
    // wins by accident of module load order.
    expect(() => new StageRegistry([handler('Decide'), handler('Decide')])).toThrow(/Decide/);
  });
});

describe('FR-GEL-062 · an empty registry is a refusal, not a permissive default', () => {
  it('constructs, so the application can boot and refuse at use rather than at start', () => {
    // Deliberate: refusing at construction would take the whole API down
    // because one seam is unfilled, and FR-GEL-062 asks for a refusal on the
    // path that needs the seam, which a caller can read and a record can keep.
    expect(() => new StageRegistry([])).not.toThrow();
  });
});
