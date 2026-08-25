/**
 * T864a / T864b / T864c (EPIC-026 F-26.9) — the task-identifier format.
 *
 * `FR-ESK-025`, clarified 2026-08-25. Design in
 * `specs/026-epic-stage-kanban/contracts/task-identifier-format.md`; decisions in
 * `research.md` `R-026-8`–`R-026-10`.
 *
 * ## Why this file exists
 *
 * **999 of 999 three-digit prefixes were allocated.** `EPIC-034` `T995y` measured
 * the shortage at 992 and `EPIC-036` `T441n` re-raised it at 999, calling it
 * *"a blocker on `EPIC-037`, not a warning"*. Neither Epic chose between the two
 * fixes; both worked around needing to.
 *
 * Two things had to change together, and this file holds the checks for both:
 *
 * 1. **The pattern widens** to four-or-more digits, and lives in **one place** —
 *    it was hand-copied into six sites across three files, so widening it by
 *    hand meant editing six correctly with nothing to notice a miss.
 * 2. **An unrecognised identifier fails.** This is the half that is easy to
 *    skip, and the half `T441n` warned about in as many words: a four-digit id
 *    *"is currently invisible to all three [checks] … silently unchecked,
 *    **which is worse than a collision**."* Uniqueness, pairing and path checks
 *    all pass such an id **by never seeing it**.
 *
 * `governance/epic-stage.config.json` is a **non-code output**, so Constitution V
 * requires a check that can fail against it. These are those checks.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { taskIdentifierPattern, taskIdentifierRecogniser, unrecognisedIdentifiers } from './task-id-format.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** The checks that read a task identifier, and must not define one themselves. */
const CONSUMERS = [
  'tests/governance/epic-stage/task-ids.spec.ts',
  'tests/governance/epic-stage/dor.ts',
  'tests/governance/epic-stage/task-paths.spec.ts',
] as const;

describe('T864a · the identifier pattern is configuration, defined once', () => {
  it.each(CONSUMERS.map((rel) => [rel] as const))(
    '%s defines no task-identifier pattern of its own',
    (rel) => {
      // RED on its first run: `T\d{3}[a-z]?` appears six times across these
      // three files — four of them in `dor.ts` alone, which is the
      // concentration most likely to be partly missed by a hand edit.
      //
      // `DEF-\d{3}-\d{3}` is a DEFECT identifier, a different shape with its
      // own rule, and is deliberately not matched here.
      const source = readFileSync(join(ROOT, rel), 'utf8');
      const inline = source
        .split(/\r?\n/)
        .map((line, i) => [i + 1, line] as const)
        .filter(([, line]) => /T\\d\{3/.test(line))
        .map(([n, line]) => `${n}: ${line.trim()}`);

      expect(
        inline,
        `${rel} writes its own task-identifier pattern:\n  ${inline.join('\n  ')}\n` +
          'The pattern is configuration (FR-ESK-015) — import it from ./task-id-format.js so the ' +
          'three consumers cannot drift from each other or from the file.',
      ).toEqual([]);
    },
  );

  it('the config file holds both patterns, with a note saying what the letter means', () => {
    const config = JSON.parse(
      readFileSync(join(ROOT, 'governance', 'epic-stage.config.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(config['taskIdentifierPattern'], 'taskIdentifierPattern is missing').toBeTypeOf('string');
    expect(config['taskIdentifierRecogniser'], 'taskIdentifierRecogniser is missing').toBeTypeOf(
      'string',
    );
    // The retirement has to be written where the rule lives, or it is a
    // decision nobody can find (`R-026-9`).
    expect(
      String(config['_taskIdentifierNote'] ?? ''),
      'no note explains that a trailing letter carries no adjacency claim',
    ).toMatch(/adjacen/i);
  });
});

describe('T864b · the pattern admits what it should, and the recogniser is broader', () => {
  const ADMITTED = ['T001', 'T864', 'T999', 'T150a', 'T442v', 'T1000', 'T1000a', 'T99999'] as const;
  const REJECTED = ['T99', 'T150ab', 'T150A', 'T', 'T1', 'TT150'] as const;

  it.each(ADMITTED.map((id) => [id] as const))('admits %s', (id) => {
    expect(taskIdentifierPattern().test(id), `${id} should be a valid identifier`).toBe(true);
  });

  it.each(REJECTED.map((id) => [id] as const))('rejects %s', (id) => {
    expect(taskIdentifierPattern().test(id), `${id} should not be valid`).toBe(false);
  });

  it('T1000 is the widening — four digits, which nothing accepted before', () => {
    // The single assertion this whole function exists for.
    expect(taskIdentifierPattern().test('T1000')).toBe(true);
  });

  it('has no upper digit bound, because a cap is a second exhaustion date', () => {
    expect(taskIdentifierPattern().test('T123456')).toBe(true);
  });

  it('the recogniser is STRICTLY broader than the pattern', () => {
    // **The load-bearing relationship.** If the recogniser ever narrowed to
    // match the pattern, an unrecognised id would become invisible again and
    // every other assertion here would stay green. Asserted in both
    // directions: everything valid is recognised, and something recognised is
    // not valid.
    for (const id of ADMITTED) {
      expect(
        taskIdentifierRecogniser().test(id),
        `${id} is a valid identifier the recogniser does not recognise`,
      ).toBe(true);
    }
    expect(
      taskIdentifierRecogniser().test('T99'),
      'the recogniser no longer sees malformed ids — unrecognised ones would be skipped again',
    ).toBe(true);
    expect(taskIdentifierPattern().test('T99')).toBe(false);
  });

  it('the recogniser ignores things that are not task identifiers at all', () => {
    // A check that cried wolf on ordinary prose would be switched off.
    for (const token of ['TASK-150', 'EPIC-026', 'DEF-026-001', 'The']) {
      expect(taskIdentifierRecogniser().test(token), `${token} is not a task identifier`).toBe(
        false,
      );
    }
  });
});

describe('T864c · an unrecognised identifier fails, and is never skipped', () => {
  it('reports a malformed id, naming the token and the line', () => {
    const found = unrecognisedIdentifiers('- [ ] T99 do a thing in `src/x.ts`\n- [ ] T150a fine\n');
    expect(found.map((f) => f.id), 'T99 was not reported').toEqual(['T99']);
    expect(found[0]!.line, 'the reporting does not name the line').toContain('T99');
  });

  it('reports NOTHING for a file of valid identifiers, including four-digit ones', () => {
    expect(
      unrecognisedIdentifiers('- [ ] T001 a\n- [ ] T864l b\n- [ ] T1000 c\n'),
    ).toEqual([]);
  });

  it('ignores tokens that are not identifier-shaped at all', () => {
    expect(unrecognisedIdentifiers('- [ ] TASK-1 a\nsee EPIC-026 and DEF-026-001\n')).toEqual([]);
  });

  it('MUTATION — the whole corpus is recognised, or the build fails naming what is not', () => {
    // The retroactive half (`T864k`): widening is additive, but
    // *unrecognised-fails* applies to every Epic at once. This is where that
    // surfaces, and it names the owner rather than reporting a bare count.
    const specs = join(ROOT, 'specs');
    const offenders: string[] = [];
    for (const dir of readdirSync(specs, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      let tasks: string;
      try {
        tasks = readFileSync(join(specs, dir.name, 'tasks.md'), 'utf8');
      } catch {
        continue;
      }
      for (const found of unrecognisedIdentifiers(tasks)) {
        offenders.push(`${dir.name}: ${found.id}`);
      }
    }
    expect(
      offenders,
      `identifiers no rule admits:\n  ${offenders.join('\n  ')}\n` +
        'Each belongs to the Epic named beside it. FR-ESK-025 makes these fail rather than be ' +
        'skipped — which is the point, and may surface work in Epics already closed.',
    ).toEqual([]);
  });
});
