/**
 * `T998x` (EPIC-035) — the edge that does not exist, and the type that does not
 * blur.
 *
 * `FR-DFR-001`, `FR-DFR-044`, `SC-DFR-011`, via `EPIC-030`'s `T944a`.
 *
 * ## Unrepresentable, not merely forbidden
 *
 * `ADR-0016` names the failure mode — *"Do NOT blindly classify every passing
 * reproduction test as a Change Request"* — and a service can be written to
 * refuse it. A service can also be edited. What this file asserts is stronger:
 * **the loop configuration has no transition to take.** A caller trying to
 * drive a passing run straight to a classification is not refused by a check it
 * could argue with; there is nowhere to go.
 *
 * ## And the Room is its own type
 *
 * `ADR-0018`'s decided constraint: *"A shared engine must not collapse three
 * governed surfaces into one."* `EPIC-030`'s `T944a` proves the engine keeps
 * types apart with synthetic configurations. This file asserts the same thing
 * about the **real three**, because a shared `Map<stage, handler>` or a
 * transition path resolving by stage rather than by workflow type would leave
 * every per-Room test green while a defect advanced under the Change Room's
 * rules.
 *
 * The differences are computed from the files rather than restated here: a
 * hardcoded stage list is a second recollection, and `DEF-034-001` is what
 * happens when one of those disagrees with the source.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadLoopConfig } from '../../src/modules/loop/loop-config.loader.js';
import { LoopConfigRegistry } from '../../src/modules/loop/config-registry.js';
import { DEFECT_ROOM_STAGES } from '../../src/modules/defect-room/stage-handlers.js';

const here = dirname(fileURLToPath(import.meta.url));
const WORKFLOWS = resolve(here, '../../../packages/loop-contract/workflows');

const read = (name: string): unknown =>
  JSON.parse(readFileSync(join(WORKFLOWS, `${name}.json`), 'utf8'));

/**
 * Every stage any of the three Rooms uses, so the loader accepts all three.
 *
 * `DEFECT_ROOM_STAGES` is this Room's own list, imported rather than retyped;
 * the union with the siblings' stages is what a deployment registering all
 * three actually has.
 */
function registry(): LoopConfigRegistry {
  const raws = ['requirement-room', 'change-room', 'defect-room'].map(read);
  const registeredStages = [
    ...new Set([
      ...DEFECT_ROOM_STAGES,
      ...raws.flatMap((raw) => (raw as { stages: string[] }).stages),
    ]),
  ];
  return new LoopConfigRegistry(raws.map((raw) => loadLoopConfig(raw, { registeredStages })));
}

describe('T998x · there is no edge from a passing run to a classification', () => {
  it('no transition returns from Verify to Decide', async () => {
    // `FR-DFR-044`. The passing reproduction run is observed in Verify; a
    // reclassification is a decision, and Decide is where decisions are made.
    // The absence of this edge is what makes the failure mode unrepresentable.
    expect(registry().require('defect-room').transitionFor('Verify', 'Decide')).toBeUndefined();
  });

  it('nor from Evidence to Decide', async () => {
    expect(registry().require('defect-room').transitionFor('Evidence', 'Decide')).toBeUndefined();
  });

  it('and nothing at all transitions INTO Decide except Analyze', async () => {
    // The assertion that survives somebody adding a second edge. One route back
    // into Decide from a passing run is the whole guarantee, gone — and it
    // would look like a convenience.
    const config = read('defect-room') as {
      transitions: { from: string; to: string }[];
    };
    const intoDecide = config.transitions.filter((t) => t.to === 'Decide').map((t) => t.from);
    expect(intoDecide).toEqual(['Analyze']);
  });

  it('while Decide → Execute does exist, so the check is not vacuous', async () => {
    // If `transitionFor` answered `undefined` for everything, all three
    // assertions above would pass while proving nothing.
    expect(registry().require('defect-room').transitionFor('Decide', 'Execute')).toBeDefined();
  });
});

describe('T998x · the Defect Room is its own workflow type', () => {
  it('all three Rooms load together', async () => {
    // The all-or-nothing registry: `buildConfigRegistry` refuses every workflow
    // file when any one names an unregistered stage, so a Room that loaded
    // while breaking its siblings would pass a test that only asked about
    // itself.
    const r = registry();
    for (const type of ['requirement-room', 'change-room', 'defect-room']) {
      expect(() => r.require(type)).not.toThrow();
    }
  });

  it('and each resolves its own configuration, not a shared one', async () => {
    const r = registry();
    expect(r.require('defect-room').workflowType).toBe('defect-room');
    expect(r.require('change-room').workflowType).toBe('change-room');
    expect(r.require('defect-room')).not.toBe(r.require('change-room'));
  });

  it('a stage this Room alone has is absent from the others', async () => {
    // Computed, not restated. `Execute` is the difference today; if that ever
    // changes, this test moves with the files instead of disagreeing with them.
    const r = registry();
    const defectOnly = r
      .require('defect-room')
      .stages.filter((stage) => !r.require('change-room').stages.includes(stage));

    expect(defectOnly.length).toBeGreaterThan(0);
    for (const stage of defectOnly) {
      expect(r.require('change-room').stages).not.toContain(stage);
      // And the sibling's configuration cannot resolve a transition out of it.
      expect(r.require('change-room').transitionFor(stage as never, 'Verify' as never)).toBeUndefined();
    }
  });

  it('and this Room cannot transition under a sibling’s stages', async () => {
    // `SC-DFR-011`: zero transitions succeed under another Room's stages,
    // authorities or gates. Read from the other direction — a stage the
    // Requirement Room has and this one does not.
    const r = registry();
    const requirementOnly = r
      .require('requirement-room')
      .stages.filter((stage) => !r.require('defect-room').stages.includes(stage));

    for (const stage of requirementOnly) {
      expect(r.require('defect-room').transitionFor(stage as never, 'Outcome')).toBeUndefined();
    }
    // Vacuity guard: if the two Rooms had identical stages the loop above would
    // assert nothing, and this file would report isolation it never tested.
    const defectOnly = r
      .require('defect-room')
      .stages.filter((stage) => !r.require('requirement-room').stages.includes(stage));
    expect(requirementOnly.length + defectOnly.length).toBeGreaterThan(0);
  });

  it('and its gates are its own', async () => {
    // A gate name resolving across types is how one Room's approval satisfies
    // another Room's decision. Read from the files rather than the registry:
    // the claim is about what the two configurations SAY, before anything
    // resolves them.
    const defectGates = new Set(
      (read('defect-room') as { transitions: { requiredGates: string[] }[] }).transitions.flatMap(
        (t) => t.requiredGates,
      ),
    );
    const changeGates = new Set(
      (read('change-room') as { transitions: { requiredGates: string[] }[] }).transitions.flatMap(
        (t) => t.requiredGates,
      ),
    );

    expect(defectGates.size).toBeGreaterThan(0);
    for (const gate of defectGates) {
      expect(gate.startsWith('defect-room.')).toBe(true);
      expect(changeGates.has(gate)).toBe(false);
    }
  });
});
