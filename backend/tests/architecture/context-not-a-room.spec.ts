/**
 * `T1270` (EPIC-038) — Context is an application area, not a Room.
 *
 * `FR-CTX-070`, `R-038-11`. The three Rooms exist because requirements, changes
 * and defects move through states a person decides on. A context package is
 * assembled, used and inspected — nobody decides anything about it — so a
 * workflow type would introduce stages and gates nobody needs.
 *
 * The absence is asserted, because an absence nobody checks is one somebody
 * adds later by analogy: three Rooms make a pattern, and a fourth screen that
 * looks like an inspection surface is exactly what gets fitted to it.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../../..');
const WORKFLOWS = resolve(ROOT, 'packages/loop-contract/workflows');
const PAGE = resolve(ROOT, 'frontend/src/pages/Context.tsx');

/** Comments stripped: a check that fires on its own explanatory prose catches nothing. */
const code = (path: string): string =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

describe('T1270 · no workflow type named context', () => {
  const files = readdirSync(WORKFLOWS).filter((f) => f.endsWith('.json'));

  it('reads the workflow declarations, or the assertions below are vacuous', () => {
    expect(files).toContain('defect-room.json');
  });

  it('no workflow file is named for context', () => {
    expect(files.filter((f) => /context/i.test(f))).toEqual([]);
  });

  it('no declared workflow type is context', () => {
    for (const file of files) {
      const declared = JSON.parse(readFileSync(resolve(WORKFLOWS, file), 'utf8')) as {
        workflowType?: string;
        type?: string;
        id?: string;
      };
      for (const name of [declared.workflowType, declared.type, declared.id]) {
        expect(String(name ?? ''), `${file} declares a context workflow`).not.toMatch(/context/i);
      }
    }
  });
});

describe('T1270 · the Context page is not a Room', () => {
  it('imports no RoomShell', () => {
    expect(/import[^;]*\bRoomShell\b/.test(code(PAGE))).toBe(false);
  });

  it('the import check can fire', () => {
    expect(/import[^;]*\bRoomShell\b/.test("import { RoomShell } from '../rooms/RoomShell';")).toBe(true);
  });

  it('and the Rooms do import it, so the check is looking at the right thing', () => {
    expect(/\bRoomShell\b/.test(code(resolve(ROOT, 'frontend/src/pages/DefectRoom.tsx')))).toBe(true);
  });
});
