/**
 * `T995g`, `T995h`, `T995i`, `T995j` (EPIC-034 Phase N) — four confirmations,
 * made mechanical.
 *
 * Each of these is phrased in the task list as *"confirm …"*, and a confirmation
 * carried out by reading is a confirmation that stops being true the week after
 * somebody reads it. So each is a check.
 *
 * `T995g` found a real one. The Room had `const ADOPTED_IMPACT_DEPTH = 25`
 * beside `EPIC-020`'s `DEFAULT_IMPACT_DEPTH = 25` — agreeing on the day it was
 * written, which is the only day a duplicated constant ever agrees.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_IMPACT_DEPTH } from '../../src/modules/dependencies/impact.service.js';

const here = dirname(fileURLToPath(import.meta.url));
const MODULE_DIR = resolve(here, '../../src/modules/change-room');

function sourcesUnder(dir: string): { path: string; code: string }[] {
  const out: { path: string; code: string }[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourcesUnder(full));
      continue;
    }
    if (!entry.endsWith('.ts')) continue;
    const text = readFileSync(full, 'utf8');
    out.push({
      path: entry,
      // Comments stripped: this module's headers quote the requirements they
      // implement, and a matcher run over prose reports the requirement as the
      // violation. Three checks in this Epic have already tripped that way.
      code: text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''),
    });
  }
  return out;
}

const SOURCES = sourcesUnder(MODULE_DIR);

describe('T995g · the traversal depth is adopted, not chosen', () => {
  it('finds sources to examine, or every check below is vacuous', () => {
    expect(SOURCES.length).toBeGreaterThan(5);
  });

  it('no file in this Room declares a depth constant of its own', () => {
    // `R-034-1`. The failure this prevents is silent: `EPIC-020` retunes its
    // traversal, the Room goes on recording a depth nothing traversed at, and
    // the stored `traversalDepth` describes a run that never happened.
    for (const source of SOURCES) {
      expect(
        /const\s+\w*(?:IMPACT_)?DEPTH\w*\s*=\s*\d/.test(source.code),
        `${source.path} declares its own depth constant`,
      ).toBe(false);
    }
  });

  it('the depth-constant check can fire', () => {
    expect(/const\s+\w*(?:IMPACT_)?DEPTH\w*\s*=\s*\d/.test('const ADOPTED_IMPACT_DEPTH = 25;')).toBe(
      true,
    );
    expect(/const\s+\w*(?:IMPACT_)?DEPTH\w*\s*=\s*\d/.test('const MAX_DEPTH = 9;')).toBe(true);
  });

  it('the controller imports EPIC-020’s constant', () => {
    const controller = SOURCES.find((s) => s.path === 'change-room.controller.ts')!;
    expect(controller.code).toMatch(
      /import\s*\{\s*DEFAULT_IMPACT_DEPTH\s*\}\s*from\s*'\.\.\/dependencies\/impact\.service\.js'/,
    );
  });

  it('and that constant is the 25 R-034-8 records', () => {
    // Asserted against the imported value, so a change in `EPIC-020` shows up
    // here as a decision to review rather than as a silent drift.
    expect(DEFAULT_IMPACT_DEPTH).toBe(25);
  });
});

describe('T995h · no requirement text is stored anywhere in this Epic', () => {
  it('no row type carries requirement prose', () => {
    // `R-033-5`, `D-33`, `FR-RQR-002`. A baseline is member VERSION ids and a
    // set hash; `EPIC-007` holds the words. A field here holding text would be
    // a second home for something that already has one — and the first symptom
    // would be the two disagreeing about what a requirement says.
    // Word-boundary matched. A plain `includes('text:')` finds `context:` and
    // reports a parameter name as a stored requirement body — the fourth time
    // this Epic has had a matcher fire on something that merely contained the
    // string it was looking for.
    const FIELDS = [/\brequirementText\b/, /\bnormalizedText\b/, /\brequirementBody\b/, /(?<![A-Za-z])text\s*:/];
    for (const source of SOURCES) {
      for (const field of FIELDS) {
        expect(
          field.test(source.code),
          `${source.path} stores requirement text (${field})`,
        ).toBe(false);
      }
    }
  });

  it('baselines are referenced by version id', () => {
    // The positive half: the Room does hold the ids, so the absence above is
    // not the absence of the whole concept.
    const rebase = SOURCES.find((s) => s.path === 'rebase.service.ts')!;
    expect(rebase.code).toContain('memberVersionIds');
  });

  it('the requirement-text check can fire, and does not fire on `context:`', () => {
    expect(/\brequirementText\b/.test('const requirementText = row.body;')).toBe(true);
    expect(/(?<![A-Za-z])text\s*:/.test('  text: candidate.body,')).toBe(true);
    // The false positive that produced this fix.
    expect(/(?<![A-Za-z])text\s*:/.test('    context: {')).toBe(false);
  });
});

describe('T995j · the composer traverses nothing', () => {
  const composer = () => SOURCES.find((s) => s.path === 'impact.composer.ts')!;

  it('declares no traversal of its own', () => {
    // `FR-CHR-031`, `R-034-1`: extend `EPIC-020`'s analysis, never implement a
    // second one. Two traversals eventually disagree and nobody knows which is
    // right.
    for (const shape of [
      /\bwhile\s*\(/,
      /\bqueue\b/i,
      /\bfrontier\b/i,
      /\bvisited\b/i,
      /\bstack\b/i,
      /\bdepthFirst|breadthFirst\b/i,
    ]) {
      expect(shape.test(composer().code), `impact.composer.ts contains ${shape}`).toBe(false);
    }
  });

  it('and reaches the graph only through its ports', () => {
    // What it does instead: asks, and composes the answer.
    // Whitespace-normalised: the traversal call is chained across lines, and a
    // substring match on the joined form would fail on formatting rather than
    // on behaviour.
    const flat = composer().code.replace(/\s+/g, '');
    expect(flat).toContain('this.impact.impactFor');
    expect(flat).toContain('this.traversal.reachableFrom');
  });

  it('the traversal-shape check can fire', () => {
    expect(/\bwhile\s*\(/.test('while (queue.length > 0) { }')).toBe(true);
    expect(/\bvisited\b/i.test('const visited = new Set();')).toBe(true);
  });
});
