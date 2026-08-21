/**
 * T908 — a FAIL is a FAIL however it is marked (`DEF-026-009`).
 * Written to FAIL before T910 exists (Constitution V).
 *
 * ## What went wrong
 *
 * `DOR-06` decided with `/\|\s*(?:❌\s*)?FAIL\b/i` — one permitted marker, `❌`.
 * `\s*` does not match `⚠️`, so a row written
 *
 *     | — | No other Claude session is active on this checkout | ⚠️ FAIL — see Complexity Tracking |
 *
 * scored as *"Constitution Check clean"*. EPIC-029 carried exactly that row —
 * a genuine, unresolved failure — and reached `Ready` with next command
 * `/speckit-implement`, against the instruction in the very document `DOR-06`
 * had just read.
 *
 * ## Scope, and what is deliberately NOT fixed here
 *
 * The defect record proposed a closed status vocabulary, and the sweep that
 * followed argued against taking it now: **17 distinct status phrasings** exist
 * across 28 plans — `CANNOT ASSERT` (15), `PASS WITH DEBT` (4), `PASS WITH GAP`
 * (3), `NOT VERIFIED`, `DEVIATION`, `CONDITIONAL`, `PARTIAL`. Rejecting
 * everything outside a three-word set would fail some forty rows at once and
 * move several Epics out of `Ready` — real work, with a real judgement in it
 * about which of those phrasings are failures. That is `D-43`, not this defect.
 *
 * So these assertions cover **one thing**: the word FAIL is seen whatever
 * decorates it. Undeclared statuses keep today's behaviour, and the cases below
 * pin that down so the narrower scope is deliberate rather than forgotten.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { join } from 'node:path';
import { evaluateCondition } from './dor';
import { buildEpicTree, DOR_READY_SPEC, type FixtureTree } from './fixtures';

let tree: FixtureTree | undefined;

afterEach(() => {
  tree?.cleanup();
  tree = undefined;
});

/** Evaluate `DOR-06` against a plan whose Constitution Check holds one row with this status. */
function dor06(status: string): { passed: boolean; detail: string } {
  const plan = [
    '# Implementation Plan: Fixture',
    '',
    '## Constitution Check',
    '',
    '| # | Gate | Status |',
    '|---|------|--------|',
    `| I | Some gate that must hold | ${status} |`,
    '',
  ].join('\n');
  tree = buildEpicTree({ '999-fixture': { spec: DOR_READY_SPEC, plan } });
  const result = evaluateCondition('DOR-06', {
    epicPath: join(tree.specsDir, '999-fixture'),
    directory: '999-fixture',
    declarations: {},
  });
  return { passed: result.passed, detail: result.detail };
}

describe('DOR-06 · a FAIL is a FAIL however it is marked (DEF-026-009)', () => {
  it.each([
    ['⚠️ FAIL — see Complexity Tracking', 'the EPIC-029 case'],
    ['⚠️ FAIL', 'warning marker, no trailing prose'],
    ['FAIL', 'bare'],
    ['❌ FAIL', 'cross marker — the only one that ever worked'],
    ['**FAIL**', 'bold'],
    ['🔴 FAIL', 'a marker nobody has used yet'],
    ['fail', 'lower case'],
  ])('fails on %s (%s)', (status) => {
    expect(dor06(status).passed).toBe(false);
  });

  it.each([
    ['PASS'],
    ['**PASS**'],
    ['✅ PASS'],
    ['QUALIFIED'],
    ['⚠️ QUALIFIED — recorded deviation'],
  ])('passes on %s', (status) => {
    expect(dor06(status).passed).toBe(true);
  });

  // Why the STATUS CELL is read rather than the row. A gate whose status
  // explains that nothing failed must not be read as a failure.
  it('passes on a status that merely mentions the word', () => {
    expect(dor06('PASS — no FAIL conditions remain').passed).toBe(true);
  });

  it('fails on a real FAIL even when later prose is reassuring', () => {
    expect(dor06('⚠️ FAIL — mitigated, see Complexity Tracking').passed).toBe(false);
  });

  // Deliberately unchanged pending D-43. If a later change makes these fail,
  // the closed vocabulary arrived — which is a decision, and this file is where
  // it should be noticed.
  it.each([['⚠️ PARTIAL'], ['CANNOT ASSERT'], ['PASS WITH DEBT'], ['⚠️ CONDITIONAL']])(
    'still passes on the undeclared status %s (scope: D-43, not this defect)',
    (status) => {
      expect(dor06(status).passed).toBe(true);
    },
  );
});
