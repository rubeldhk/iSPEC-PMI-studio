/**
 * T958 — transitions are the only way state moves. `FR-GEL-010`, `SC-GEL-002`.
 *
 * *"There is no other writer of `LoopObject.currentStage`."*
 *
 * A claim about **absence**, which is the hardest kind to keep true: nothing
 * fails when a second writer appears. A `setStage` helper added for one Room's
 * convenience would leave every other test in this Epic green while quietly
 * ending the guarantee that the history reconstructs the object.
 *
 * So this reads the source. The service and the store are scanned for any path
 * that could move `currentStage` outside `advanceObject`, and `advanceObject`
 * itself is asserted to be reachable only with a version to check against.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LOOP_STAGES, type StageHandler } from '@pmi/loop-contract';
import { InMemoryLoopStore } from '../../src/modules/loop/loop.store.js';
import { StageRegistry } from '../../src/modules/loop/stage-registry.js';

const here = dirname(fileURLToPath(import.meta.url));
const ENGINE_SRC = resolve(here, '../../src/modules/loop');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

/** Comments say "currentStage" constantly; the rule is about code. */
function code(body: string): string {
  return body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

const files = walk(ENGINE_SRC).map((p) => ({
  rel: relative(ENGINE_SRC, p),
  body: code(readFileSync(p, 'utf8')),
}));

describe('T958 · the store exposes exactly one way to move an object', () => {
  it('found engine sources, or the assertions below prove nothing', () => {
    expect(files.length).toBeGreaterThan(4);
  });

  it('writes an object row in exactly one file', () => {
    // The robust form of "there is no second writer".
    //
    // An earlier draft enumerated every `currentStage:` occurrence and checked
    // each against a whitelist. It misfired three times — on the declaration
    // path, on a type annotation, on an inline object type — because a regex
    // over source cannot tell an assignment from an annotation. A check that
    // needs four attempts to stop misfiring is measuring the wrong thing, so
    // this measures something a regex CAN see: which file mutates the object
    // collection.
    const mutators = files.filter((f) => /#objects\.set\(/.test(f.body));
    expect(mutators.map((m) => m.rel)).toEqual(['loop.store.ts']);
  });

  it('sets currentStage from a caller-chosen stage only inside the store', () => {
    const movers = files.filter((f) => /currentStage\s*:\s*input\.toStage/.test(f.body));
    expect(movers.map((m) => m.rel)).toEqual(['loop.store.ts']);
  });

  it('offers no setStage, moveTo, forceStage or similar', () => {
    const offenders = files.filter((f) =>
      /\b(setStage|moveTo|forceStage|updateStage|setCurrentStage)\b/.test(f.body),
    );
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('declares no store method that advances without a version to check', () => {
    // The realistic regression: `advanceObject` gaining an overload, or a
    // sibling `advanceObjectUnchecked` for a migration. Either ends OCC without
    // failing a behavioural test.
    const store = files.find((f) => f.rel === 'loop.store.ts');
    expect(store).toBeDefined();
    expect(store?.body).toMatch(/advanceObject\(input: AdvanceInput\)/);
    expect(/advanceObject\w+\s*\(/.test(store?.body ?? '')).toBe(false);
  });
});

describe('SC-GEL-002 · advanceObject cannot move an object without the right version', () => {
  const stages = new StageRegistry(
    LOOP_STAGES.map((stage): StageHandler => ({ stage, async enter() { return { ok: true }; } })),
  );

  it('has stages registered, so this suite is not measuring an empty registry', () => {
    expect(stages.registeredStages).toHaveLength(8);
  });

  it('refuses a stale version', async () => {
    const store = new InMemoryLoopStore();
    const object = await store.createObject({
      workspaceId: 'ws', projectId: 'p', workflowType: 't', configVersion: 1,
      subjectType: 'o', subjectId: 's', currentStage: 'Event',
    });
    await store.advanceObject({ id: object.id, expectedVersion: 0, toStage: 'Analyze' });
    // Second attempt with the version the caller originally read.
    const stale = await store.advanceObject({ id: object.id, expectedVersion: 0, toStage: 'Decide' });
    expect(stale).toBeNull();
    expect((await store.findObject(object.id))?.currentStage).toBe('Analyze');
  });

  it('refuses a version from the future, not only a stale one', async () => {
    // A caller guessing forward must not succeed either — `expectedVersion` is
    // a token the caller READ, not a number it may choose.
    const store = new InMemoryLoopStore();
    const object = await store.createObject({
      workspaceId: 'ws', projectId: 'p', workflowType: 't', configVersion: 1,
      subjectType: 'o', subjectId: 's', currentStage: 'Event',
    });
    expect(
      await store.advanceObject({ id: object.id, expectedVersion: 7, toStage: 'Analyze' }),
    ).toBeNull();
    expect((await store.findObject(object.id))?.currentStage).toBe('Event');
  });

  it('refuses an object that does not exist rather than creating one', async () => {
    const store = new InMemoryLoopStore();
    expect(
      await store.advanceObject({ id: 'nope', expectedVersion: 0, toStage: 'Analyze' }),
    ).toBeNull();
  });
});
