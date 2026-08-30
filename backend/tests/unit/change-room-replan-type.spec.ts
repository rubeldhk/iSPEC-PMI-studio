/**
 * `T406j`, `T406k` (EPIC-034) — the re-plan obligation is recorded, never run.
 *
 * `R-034-2`. `TaskRegenerationService.regenerate()` would satisfy `FR-CHR-062`'s
 * wording in one call and violate `BR-0154` in the same call, because it
 * **replaces** a task list and `BR-0154` requires revision without destroying
 * completed-work history. `FR-CHR-065` forbids the shortcut in as many words.
 *
 * These assert the two halves that keep it forbidden: the state vocabulary
 * cannot express *executed*, and the module exports nothing that could execute.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  REPLAN_STATES,
  type RePlanObligation,
} from '../../src/modules/change-room/replan.types.js';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(
  join(here, '..', '..', 'src', 'modules', 'change-room', 'replan.types.ts'),
  'utf8',
);

describe('T406j · the state names U-12, and cannot name execution', () => {
  it('has exactly two states', () => {
    expect([...REPLAN_STATES]).toEqual(['recorded', 'discharged-by-U-12']);
  });

  it('names `U-12` as the discharger, so the owner is legible', () => {
    expect(REPLAN_STATES[1]).toMatch(/U-12/);
  });

  it('has no `executed` state', () => {
    // A third state would imply a transition nothing in this Epic can make.
    expect(REPLAN_STATES).not.toContain('executed');
    expect(REPLAN_STATES).not.toContain('regenerated');
  });

  it('rejects a state outside the two', () => {
    const wrong: RePlanObligation = {
      id: 'ro_1',
      changeDecisionId: 'cd_1',
      affectedSpecificationId: 'spec_1',
      whatMustChange: 'the task list needs a step for the new constraint',
      why: 'the approved change adds one',
      // @ts-expect-error — `executed` is not a re-plan state here.
      state: 'executed',
    };
    void wrong;
    expect(true).toBe(true);
  });
});

describe('T406j · there is no execute path', () => {
  it('exports no function at all', () => {
    // Asserted on the source because the property is an ABSENCE, and an absence
    // cannot be proved by calling something.
    const declared = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(declared.includes('export function')).toBe(false);
    expect(declared.includes('export class')).toBe(false);
  });

  it('never mentions TaskRegenerationService outside its own explanation', () => {
    const declared = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(declared.includes('TaskRegeneration')).toBe(false);
    expect(declared.includes('regenerate')).toBe(false);
  });

  it('the absence check can actually fail', () => {
    // Anti-tautology.
    expect('export function regenerate() {}'.includes('export function')).toBe(true);
  });

  it('records what must change and why, so U-12 has something to read', () => {
    const obligation: RePlanObligation = {
      id: 'ro_1',
      changeDecisionId: 'cd_1',
      affectedSpecificationId: 'spec_1',
      whatMustChange: 'add a verification step for the new constraint',
      why: 'the approved change introduces one',
      state: 'recorded',
    };
    expect(obligation.state).toBe('recorded');
    expect(obligation.whatMustChange.length).toBeGreaterThan(0);
    expect(obligation.why.length).toBeGreaterThan(0);
  });
});
