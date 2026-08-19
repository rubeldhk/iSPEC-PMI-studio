/**
 * T481 · Check `G-26-06` — the two skills that must leave evidence say so.
 * Written to FAIL before T486 and T487 exist (Constitution V).
 *
 * ## What this check proves, and what it does not — `R-026-4`
 *
 * It proves **the instruction is present in the skill file**. It does **not**
 * prove an agent followed it. Nothing in a static check can: the skill is a
 * prompt, the agent is a model, and whether a given run wrote the file is a fact
 * about that run.
 *
 * This distinction is stated in the file header rather than buried, because this
 * repository has now recorded eleven separate instances of *a check that names
 * the right condition and cannot observe it* — `DEF-001-001`, `DEF-018-001`,
 * `DEF-028-001` and `DEF-028-004` through `DEF-028-010` among them. A check
 * asserting "the analysis step records its findings" would be the twelfth. What
 * it can honestly assert is "the analysis step is *told* to record its findings",
 * and the difference belongs in writing.
 *
 * The complementary half is `T480`, which validates the records that do exist,
 * and the register itself, where an Epic stuck at `Tasked` is visible to anyone
 * reading it. Neither replaces the other.
 *
 * The `.claude/skills/speckit-` tree is exempt from Constitution I's command
 * gate, which is what permits `T486` and `T487` to edit these files at all.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../helpers';

const ANALYZE = join(REPO_ROOT, '.claude/skills/speckit-analyze/SKILL.md');
const CLARIFY = join(REPO_ROOT, '.claude/skills/speckit-clarify/SKILL.md');

function read(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

describe('G-26-06 · the analyze skill is told to record its findings (FR-ESK-019)', () => {
  it('the skill file exists', () => {
    expect(existsSync(ANALYZE), `${ANALYZE} is absent`).toBe(true);
  });

  it('instructs the step to write a record to specs/<epic>/analysis.md', () => {
    const text = read(ANALYZE);
    expect(text).toMatch(/analysis\.md/);
    expect(text).toMatch(/FR-ESK-019/);
  });

  it('requires the record to carry a dated session', () => {
    // Without a date, two runs are indistinguishable, and nobody can tell
    // whether the analysis predates the spec it analysed.
    expect(read(ANALYZE)).toMatch(/dated|Session/i);
  });

  it('requires a record even when the run finds nothing (FR-ESK-017)', () => {
    // The general rule: an artifact records that a step RAN, not that it found
    // something. A step that writes only when it has news leaves an Epic
    // indistinguishable from one where the step never ran.
    expect(read(ANALYZE)).toMatch(/even (?:when|if)|no findings|nothing/i);
  });

  it('does not have its read-only constraint silently contradicted', () => {
    // The skill says "STRICTLY READ-ONLY". Writing one record is a deliberate,
    // narrow exception and must be visible as one — otherwise the next reader
    // finds two rules and no way to tell which governs.
    const text = read(ANALYZE);
    if (/STRICTLY READ-ONLY/i.test(text)) {
      expect(
        /exception|except\b/i.test(text),
        'the skill claims to be strictly read-only and also writes a record, with no exception recorded',
      ).toBe(true);
    }
  });
});

describe('G-26-06 · the clarify skill is told to record every session (FR-ESK-018)', () => {
  it('the skill file exists', () => {
    expect(existsSync(CLARIFY), `${CLARIFY} is absent`).toBe(true);
  });

  it('instructs the step to record a dated session on every run', () => {
    const text = read(CLARIFY);
    expect(text).toMatch(/FR-ESK-018/);
    expect(text).toMatch(/### Session/);
  });

  it('requires the session to be written even when nothing was asked', () => {
    // The exact phrase matters: deriving `Clarified` from the absence of
    // `[NEEDS CLARIFICATION]` markers would mark every freshly written spec as
    // clarified before the step ever ran.
    expect(read(CLARIFY)).toMatch(/no questions required/i);
  });
});

describe('G-26-06 · the honesty of this check', () => {
  it('states in its own header that it cannot observe compliance', () => {
    // Self-referential on purpose. The claim "the instruction exists, not that
    // an agent followed it" is the check's entire scope, and a future reader
    // deleting this note would be deleting the caveat, not the limitation.
    const self = readFileSync(
      join(REPO_ROOT, 'tests/governance/epic-stage/skill-instructions.spec.ts'),
      'utf8',
    );
    // Tolerant of the comment's line wrapping — the claim matters, not where
    // the line happens to break.
    expect(self.replace(/\s*\n\s*\*\s*/g, ' ')).toMatch(/does \*\*not\*\* prove an agent followed it/);
    expect(self).toMatch(/R-026-4/);
  });
});
