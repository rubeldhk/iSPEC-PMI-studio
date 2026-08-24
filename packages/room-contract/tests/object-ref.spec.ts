/**
 * T337j — `workflowType` is an open string. `FR-RQR-003`, `FR-GEL-061`,
 * `BR-0064`.
 *
 * The temptation this test exists to refuse: making `workflowType` a union of
 * the three Rooms. It would be tidier, it would catch typos, and it would be
 * wrong twice.
 *
 *   - **It makes the shared contract know its consumers.** `FR-RQR-003` forbids
 *     this Epic implementing the Change or Defect Room, and a union naming them
 *     is a weaker form of the same coupling — `packages/room-contract` would
 *     have to change to add a Room.
 *   - **It breaks the moment a fourth governed workflow is configured**, which
 *     `BR-0064` explicitly permits. A closed union would make *"configurable per
 *     workflow type"* true only for three values somebody enumerated.
 *
 * `EPIC-030` drew the same line in `loop-contract`, and for the same reason.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { RoomObjectRef } from '../src/object-ref.js';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../src/object-ref.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '');

describe('FR-RQR-003 · the contract does not know its consumers', () => {
  it('accepts the three Rooms', () => {
    const rooms: RoomObjectRef[] = [
      { workflowType: 'requirement-room', objectId: 'o1' },
      { workflowType: 'change-room', objectId: 'o2' },
      { workflowType: 'defect-room', objectId: 'o3' },
    ];
    expect(rooms.map((r) => r.workflowType)).toEqual([
      'requirement-room',
      'change-room',
      'defect-room',
    ]);
  });

  it('accepts a fourth governed workflow nobody has built (BR-0064)', () => {
    // The assertion a closed union would fail. `BR-0064` says governed workflows
    // are configurable instances of the common model — a shared contract that
    // enumerated three would make that sentence false on the day someone
    // configured a fourth.
    const fourth: RoomObjectRef = { workflowType: 'procurement-approval', objectId: 'o4' };
    expect(fourth.workflowType).toBe('procurement-approval');
  });

  it('names no Room in the type itself', () => {
    // The shape of this rule is an ABSENCE, and absences do not throw. A union
    // added later would satisfy every assertion above for the three Rooms and
    // quietly break the fourth — so the source is read, not just the behaviour.
    expect(source).not.toMatch(/'requirement-room'/);
    expect(source).not.toMatch(/'change-room'/);
    expect(source).not.toMatch(/'defect-room'/);
    expect(source).toMatch(/workflowType:\s*string/);
  });
});

describe('the reference is a reference, and nothing more', () => {
  it('carries the loop object id and the type, and no Room payload', () => {
    const ref: RoomObjectRef = { workflowType: 'requirement-room', objectId: 'o1' };
    expect(Object.keys(ref).sort()).toEqual(['objectId', 'workflowType']);
  });

  it.each(['baseline', 'requirement', 'defect', 'triage', 'changeRequest'])(
    'names no %s field — that would be Room vocabulary in the shared contract',
    (word) => {
      expect(source).not.toMatch(new RegExp(`\\b\\w*${word}\\w*\\b`, 'i'));
    },
  );
});
