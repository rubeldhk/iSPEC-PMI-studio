/**
 * `T995i` (EPIC-034 Phase N) — an unused stage is **omitted**, never absent.
 *
 * `FR-GEL-008`. The Change Room declares seven of the loop's stages and does
 * not use `Execute`. That stage must still appear in the progress projection,
 * marked omitted.
 *
 * ## Why absent and omitted must not look alike
 *
 * A person reading a Room's progress is asking *"where has this got to?"*. A
 * stage that is simply missing reads as one the object has not reached yet —
 * so an omitted `Execute` would look like work still to come, on a Room that
 * will never do it. The reader waits for something that is never going to
 * happen, and the projection told them to.
 *
 * The reverse mistake is worse in the other direction: rendering an omitted
 * stage as `done` would claim work nobody did.
 */
import { describe, expect, it } from 'vitest';
import { LOOP_STAGES } from '@pmi/loop-contract';
import { buildConfigRegistry } from '../../src/modules/loop/workflow-files.js';
import { CHANGE_ROOM_STAGES } from '../../src/modules/change-room/stage-handlers.js';

/**
 * Every loop stage registered, so no configuration is refused for a missing
 * handler. This file is about which stages a Room DECLARES, not about which
 * have behaviour — `FR-GEL-007` is asserted elsewhere.
 */
const registry = buildConfigRegistry([...LOOP_STAGES]);

describe('T995i · the Change Room omits a stage, and says so', () => {
  it('declares the seven stages it uses', () => {
    expect(registry.require('change-room').stages).toEqual([...CHANGE_ROOM_STAGES]);
  });

  it('and names Execute as omitted rather than leaving it out', () => {
    // `FR-GEL-008`. The whole point: a reader can see the stage exists and that
    // this Room does not use it.
    const config = registry.require('change-room');
    expect(config.omittedStages).toContain('Execute');
  });

  it('every loop stage is either used or omitted — none is simply missing', () => {
    // The completeness half. A stage in neither list would be invisible, which
    // is the state `FR-GEL-008` exists to make impossible.
    const config = registry.require('change-room');
    const accounted = new Set([...config.stages, ...config.omittedStages]);
    // Read from the loop contract's own vocabulary rather than restated here.
    for (const stage of LOOP_STAGES) {
      expect(accounted.has(stage), `${stage} is neither used nor omitted`).toBe(true);
    }
    expect(config.omittedStages.length).toBeGreaterThan(0);
  });

  it('an omitted stage is not among the used ones', () => {
    // The two lists are disjoint, or "omitted" would mean nothing.
    const config = registry.require('change-room');
    for (const omitted of config.omittedStages) {
      expect(config.stages).not.toContain(omitted);
    }
  });

  it('and the Requirement Room omits a different set — this is per-type', () => {
    // `FR-CHR-001`. If both Rooms omitted the same stages, the projection would
    // be describing the loop rather than the Room.
    const change = [...registry.require('change-room').omittedStages].sort();
    const requirement = [...registry.require('requirement-room').omittedStages].sort();
    expect(change).not.toEqual(requirement);
  });

  it('the Change Room uses Verify and the Requirement Room omits it', () => {
    // The specific difference, so the previous assertion cannot pass on an
    // unrelated one.
    expect(registry.require('change-room').stages).toContain('Verify');
    expect(registry.require('requirement-room').omittedStages).toContain('Verify');
  });
});
