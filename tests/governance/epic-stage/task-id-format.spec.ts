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
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { taskIdentifierPattern, taskIdentifierRecogniser, unrecognisedIdentifiers } from './task-id-format.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * Every TypeScript source in the repository.
 *
 * `T1001`. This was a hand-listed array of three files, and **both faults the
 * convergence pass found were in files it did not name**: `task-id-format.ts`
 * itself, and `registry-documented.spec.ts` two projects away. A curated list
 * of places to look cannot report a place nobody thought to look — the same
 * shape `EPIC-014` `T153f` fixed, where the gap sat in exactly the file the
 * list omitted. So the set is derived, and the cost of that is having to
 * exempt honestly rather than quietly.
 */
function sourceFiles(dir: string = ROOT, found: string[] = []): string[] {
  const SKIP = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.claude', '.turbo']);
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, found);
    else if (/\.tsx?$/.test(entry.name)) found.push(relative(ROOT, full).split(sep).join('/'));
  }
  return found;
}

/**
 * Source with comments stripped — what actually executes.
 *
 * Without this the check fires on its own explanations. This file, the module,
 * and both files `T1002` fixed all **describe** the retired shape in prose, on
 * purpose, because the history is the reason the rule exists. A check that
 * cannot tell a sentence from a statement reports its own documentation and
 * gets switched off. `EPIC-014` `T153d` hit the mirror image of this and
 * solved it the same way.
 *
 * Template literals are deliberately left intact: a shape smuggled into one
 * would be a real violation, and stripping them to buy silence would be the
 * check paying for its own green.
 */
function liveCode(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

/** Live lines that write a literal task-identifier shape, as `line: text`. */
function inlineShapes(rel: string): string[] {
  const live = liveCode(readFileSync(join(ROOT, rel), 'utf8'));
  return live
    .split(/\r?\n/)
    .map((line, i) => [i + 1, line] as const)
    .filter(([, line]) => /T\\d/.test(line))
    .map(([n, line]) => `${rel}:${n}: ${line.trim()}`);
}

/**
 * Lines allowed to contain `T\d` because they are not identifiers at all.
 *
 * **Scoped to a line, never a file.** A file-scoped exemption would blind
 * every other line in that file — which is precisely how the `CONSUMERS` list
 * this replaced came to miss two real faults. Each entry names a substring
 * that must appear in the offending line, so it cannot quietly cover a second
 * violation that arrives later in the same file.
 *
 * There is exactly one, and it is not a judgement call: `T` is the date/time
 * separator in ISO 8601. The detector cried wolf on a timestamp on its first
 * run, which is worth recording — an allowlist that grows to silence a blunt
 * signal ends up covering the thing it was built to find.
 */
const ALLOWED: readonly { file: string; contains: string; why: string }[] = [
  {
    file: 'tests/governance/reachability-transcript.spec.ts',
    contains: '\\d{4}-\\d{2}-\\d{2}T\\d{2}',
    why: 'ISO 8601 date-time separator, not a task identifier',
  },
];

/** The historical shapes this check exists to catch — a positive control. */
const MUST_CATCH: readonly string[] = [
  'const x = /^- \\[[ xX]\\] (T\\d{3}[a-z]?)/gm;',
  'const y = /^\\s*-\\s*\\[[xX ]\\]\\s*(T\\d+[a-z]*)\\b/;',
  'const z = /\\bT\\d{3}[a-z]?\\b/g;',
  'const w = /^- \\[[ xX]\\] T\\d+/;',
];

describe('T864a · the identifier pattern is configuration, defined once', () => {
  const SOURCES = sourceFiles();

  it('reads a substantial number of sources, or this check proves nothing', () => {
    // The anti-vacuity guard this check needed and did not have: a walk that
    // silently returned nothing would report the whole repository clean.
    expect(SOURCES.length, 'no TypeScript sources were walked').toBeGreaterThan(200);
  });

  it('no source in the repository writes a task-identifier shape', () => {
    const offenders = SOURCES.flatMap(inlineShapes).filter(
      (hit) => !ALLOWED.some((a) => hit.startsWith(`${a.file}:`) && hit.includes(a.contains)),
    );
    expect(
      offenders,
      `a source writes its own task-identifier shape:\n  ${offenders.join('\n  ')}\n` +
        'The shape is configuration (FR-ESK-025) — compose it from ./task-id-format.js so no two ' +
        'sites can drift from each other or from governance/epic-stage.config.json.',
    ).toEqual([]);
  });

  it('WOULD CATCH the shapes it exists to catch, so it cannot be narrowed to nothing', () => {
    // The positive control. Every assertion above is satisfied by a detector
    // that matches nothing, and "no source writes the shape" reads identically
    // whether the rule holds or the signal is broken. These four are the
    // literal patterns `T1000` and `T1002` removed, from `task-id-format.ts`,
    // `registry-documented.spec.ts` and `test-completeness.spec.ts`.
    const missed = MUST_CATCH.filter((sample) => !/T\\d/.test(liveCode(sample)));
    expect(missed, `the detector no longer recognises a retired shape:\n  ${missed.join('\n  ')}`)
      .toEqual([]);
  });

  it('every allowance is load-bearing, so none outlives its reason', () => {
    // The other half of an allowlist. Without this an allowance survives the
    // fix it was written for and silently covers a later violation — which is
    // how `CONSUMERS` came to omit two real faults.
    const dead = ALLOWED.filter(
      (a) => !inlineShapes(a.file).some((hit) => hit.includes(a.contains)),
    ).map((a) => `${a.file} (${a.why})`);
    expect(dead, `allowed but no longer present — delete the entry: ${dead.join(', ')}`).toEqual(
      [],
    );
  });

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

/**
 * T1003 — the documented gate and the executable gate are the same gate.
 *
 * `V26-9` in `quickstart.md` is this requirement's stated exit criterion, and
 * for one convergence pass it **certified a file that was violating the
 * requirement on two lines**. Step 2 read
 * `grep -rn '...' tests/governance/epic-stage/*.ts` — a hand-picked directory,
 * searched for the pre-widening shape only. It found nothing because it could
 * not find anything, and "no matches" was read as "clean".
 *
 * `T150s` proves documented **container** commands runnable, but its document
 * list is `EPIC-014`-scoped, so nothing in the repository had ever read this
 * quickstart. That is why the rot was silent, and it is the Constitution V
 * gap this closes: a non-code output now has a check that can fail against it.
 */
describe('T1003 · V26-9 verifies by running the real check, not by grepping a directory', () => {
  const QUICKSTART = join(ROOT, 'specs', '026-epic-stage-kanban', 'quickstart.md');

  /**
   * Every scenario's commands, keyed by scenario — **not just `V26-9`**.
   *
   * `T1006`. This read one section of a nine-section document, which is the
   * curated scope the check itself was written to ban, one level up. The
   * lesson keeps arriving in the same shape: a check scoped to whatever its
   * author was looking at reports the rest of the world clean.
   *
   * The comment lines are kept, not stripped: `# expect: no matches` is what
   * makes a command a NEGATIVE assertion, and dropping it would discard the
   * one signal that distinguishes the banned pattern from a sound one.
   */
  const SCENARIOS: readonly { name: string; commands: string[]; raw: string }[] = (() => {
    const text = readFileSync(QUICKSTART, 'utf8');
    const parts = text.split(/^## (V26-\d+)/m);
    const found: { name: string; commands: string[]; raw: string }[] = [];
    for (let i = 1; i < parts.length; i += 2) {
      const body = parts[i + 1] ?? '';
      const commands = [...body.matchAll(/```bash\n([\s\S]*?)```/g)]
        .flatMap((m) => m[1]!.split(/\r?\n/))
        .map((line) => line.trim())
        .filter((line) => line !== '' && !line.startsWith('#'));
      found.push({ name: parts[i]!, commands, raw: body });
    }
    return found;
  })();

  const COMMANDS = SCENARIOS.flatMap((s) => s.commands);

  it('finds every scenario and its commands, or this proves nothing', () => {
    // The guard the old gate lacked. A parse returning zero would satisfy
    // every assertion below by having nothing to assess — the precise failure
    // being corrected here. Both numbers are guarded, because the scenario
    // split and the command extraction fail independently (`T1006`).
    expect(SCENARIOS.length, 'no scenarios parsed out of quickstart.md').toBeGreaterThan(7);
    expect(COMMANDS.length, 'no commands parsed out of any scenario').toBeGreaterThan(10);
  });

  it('runs the derived check in V26-9, which sets its own scope', () => {
    const v269 = SCENARIOS.find((s) => s.name === 'V26-9');
    const runsIt = (v269?.commands ?? []).some(
      (c) => c.includes('vitest') && c.includes('epic-stage/task-id-format.spec.ts'),
    );
    expect(
      runsIt,
      'V26-9 no longer invokes tests/governance/epic-stage/task-id-format.spec.ts — the gate a ' +
        'reader runs must be the gate CI runs, or the two drift and the weaker one gets believed.',
    ).toBe(true);
  });

  it('no scenario proves a NEGATIVE by grepping a bounded path', () => {
    // **The rule, stated as the fault rather than as one instance of it**
    // (`T1006`). The first version banned any grep touching `tests/` or
    // `src/`, which is both too narrow and the wrong idea: `V26-5` and `V26-8`
    // grep `governance/` and `specs/` to assert a match is PRESENT, and those
    // are sound — they fail when the thing is missing.
    //
    // The hazard is a grep that passes by finding NOTHING inside a scope
    // somebody typed. "No matches" and "cannot match" are the same output, so
    // such a command certifies every place nobody thought to list. That is
    // precisely how `V26-9` step 2 certified a file holding two inline copies.
    const negatives: string[] = [];
    for (const { name, raw } of SCENARIOS) {
      for (const block of raw.matchAll(/```bash\n([\s\S]*?)```/g)) {
        for (const line of block[1]!.split(/\r?\n/)) {
          if (!/^\s*grep\b/.test(line)) continue;
          if (/#.*\b(no matches|none|zero|nothing)\b/i.test(line)) {
            negatives.push(`${name}: ${line.trim()}`);
          }
        }
      }
    }
    expect(
      negatives,
      `a scenario verifies by expecting a grep to find nothing:\n  ${negatives.join('\n  ')}\n` +
        'Prove a negative with a check that derives its own scope, not a grep over a typed path.',
    ).toEqual([]);
  });

  it('names only files that exist, unless the scenario creates them', () => {
    // `V26-3` writes `specs/099-scratch-epic/spec.md`, runs the suite against
    // it, and removes it again — so it is CORRECT for that path to be absent
    // at rest. A naive existence check reports the one scenario that tests
    // creation, which is how a check earns its way into being ignored.
    const missing: string[] = [];
    for (const { name, commands } of SCENARIOS) {
      const created = commands.join('\n');
      for (const token of commands.flatMap((c) => c.split(/\s+/))) {
        if (!/^[A-Za-z0-9_./-]+\.(ts|tsx|json|md|yml)$/.test(token)) continue;
        if (existsSync(join(ROOT, token))) continue;
        // Created by its own scenario: redirected into, or made then removed.
        if (new RegExp(`>\\s*${token}|mkdir[^\n]*${token.split('/').slice(0, -1).join('/')}`).test(created)) continue;
        missing.push(`${name}: ${token}`);
      }
    }
    expect(missing, `a scenario names a file that does not exist: ${missing.join(', ')}`).toEqual(
      [],
    );
  });
});

/**
 * T1006 — no artifact states a consumer count that contradicts the code.
 *
 * `T1004` corrected `contracts/task-identifier-format.md` and stopped there,
 * so the same retired claim survived in `plan.md`'s **Constitution Check** —
 * the exit gate itself, instructing a reader to verify "all three checks" —
 * and in the `research.md` decision behind it. A count is the wrong thing to
 * write down: it is true on the day it is typed and silently wrong afterwards,
 * and when it appears in a gate it makes the gate verify the wrong scope.
 */
describe('T1006 · no Epic artifact claims a consumer count', () => {
  const EPIC = join(ROOT, 'specs', '026-epic-stage-kanban');

  /**
   * Append-only records, which describe what was true when written.
   *
   * Excluded on purpose and asserted below to still exist: rewriting a record
   * to match the present is the opposite of keeping one. Everything else in
   * the Epic is a live description of the system and must not carry a count.
   */
  const RECORDS: Record<string, string> = {
    'closure.md': 'append-only closure record — past tense by definition',
    'tasks.md': 'append-only task log, including prior convergence findings',
    'analysis.md': 'dated analysis record of a single run',
  };

  /**
   * Directories whose every file is a record **by construction**.
   *
   * `T1008`. Widening the walk surfaced `DEF-026-003`, titled *"two checks
   * forbid what their own contracts require"* — an accurate account of one
   * past incident, not a claim about consumers. Every file under `defects/`
   * is a Constitution VI intake record, so the category is the honest unit:
   * listing nine filenames would grow by one with every defect filed, which
   * is the allowlist-creep this file keeps arguing against.
   */
  const RECORD_DIRS: Record<string, string> = {
    defects: 'Constitution VI defect intake — each file records one defect as it was',
  };

  /**
   * The sources that actually consume the rule — derived, never counted.
   *
   * `T1007`. A source consumes it if it imports the module or reads the
   * `taskIdentifier*` keys from configuration. Comments are stripped first, so
   * a file that merely *discusses* the rule — as several do, at length — is
   * not mistaken for one that depends on it.
   */
  const CONSUMERS = sourceFiles().filter((rel) => {
    const live = liveCode(readFileSync(join(ROOT, rel), 'utf8'));
    return /task-id-format/.test(live) || /taskIdentifier(Pattern|Recogniser)/.test(live);
  });

  /**
   * Any assertion of a **numeric count** of consumers, whatever the number.
   *
   * `T1007`. This matched the literal word `three`, which meant the check
   * named "no artifact claims a consumer count" could not detect a consumer
   * count — only one particular one. Injecting *"read by all five checks"*
   * passed 34/34, and **five is the count that is true today**, so it was the
   * number most likely to be written next and the one it was blindest to.
   *
   * The lesson is the one `T1006` had already applied to greps in this same
   * file and then failed to apply here: **state the fault, not the instance
   * in front of you.** The fault is writing a number down at all — a count is
   * true the day it is typed and silently wrong afterwards.
   *
   * A number must sit directly against the noun. `V26-3`'s *"Two independent
   * checks catching one omission"* is about a specific pair of governance
   * checks, not a consumer count, and correctly does not match.
   */
  const CLAIM =
    /\b(all\s+)?(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(check|consumer)s?(\s+files?)?\b(?!\s+(run|runs|cycle|cycles|pass|passes)\b)/i;

  /** Phrasings the rule must catch, so it cannot be narrowed to one literal. */
  const MUST_FLAG = [
    'read by all three checks',
    'read by all five checks',
    'the six consumers import it',
    'one definition, 5 consumers',
    'four check files read it',
  ] as const;

  /**
   * Prose with quotations and block quotes removed.
   *
   * Every correction written this Epic quotes the wording it replaced — that
   * is what makes the record usable. A check that cannot tell a quotation from
   * a claim reports the notes documenting the fix, and gets switched off.
   * `EPIC-014` `T153d` named this `liveProse()`; same idea, same reason.
   */
  function liveProse(text: string): string {
    // `## Clarifications` is dropped for the same reason `closure.md` is: it
    // is a transcript, not a description. `FR-ESK-018` REQUIRES a dated
    // session recording what was asked, and one question here asked about a
    // four-digit id being "invisible to all three checks" — true on the day,
    // and the sentence that motivated the fix. Editing it to match the present
    // would destroy the record the requirement exists to keep.
    const clarifications = text.indexOf('\n## Clarifications');
    const withoutRecord =
      clarifications === -1
        ? text
        : text.slice(0, clarifications) +
          text.slice(clarifications + 1).replace(/^[\s\S]*?(?=\n## (?!Clarifications))/, '');
    return withoutRecord
      .split(/\r?\n/)
      .filter((line) => !/^\s*>/.test(line))
      .join('\n')
      .replace(/"[^"]*"/g, ' ')
      .replace(/`[^`]*`/g, ' ');
  }

  /**
   * Every markdown artifact in the Epic, found by walking it.
   *
   * `T1008`. This read the top level plus **one hand-named subdirectory**,
   * `contracts/` — so `checklists/` and `defects/` were never scanned. Nothing
   * false was sitting in them; the gap was that nothing would have noticed if
   * there had been. Naming the one subdirectory you happen to be thinking
   * about is the same fault as listing the three files you happen to be
   * thinking about, which is what `T1001` already had to undo once.
   */
  function epicArtifacts(dir: string = EPIC, prefix = '', found: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name in RECORD_DIRS) continue;
        epicArtifacts(join(dir, entry.name), rel, found);
      } else if (entry.name.endsWith('.md') && !(entry.name in RECORDS)) {
        found.push(rel);
      }
    }
    return found;
  }

  const ARTIFACTS = epicArtifacts();

  it('reads the Epic\u2019s live artifacts, or this proves nothing', () => {
    expect(ARTIFACTS.length, 'no artifacts scanned').toBeGreaterThan(4);
  });

  it('derives the consumer set, or the count below means nothing', () => {
    // Anti-vacuity for the derivation itself. If this returned nothing, the
    // failure message would advertise "there are currently 0 consumers" and
    // read as authoritative.
    expect(CONSUMERS.length, 'no consumers derived').toBeGreaterThan(3);
  });

  it('states no consumer count in live prose, whatever the number', () => {
    const claims: string[] = [];
    for (const rel of ARTIFACTS) {
      const prose = liveProse(readFileSync(join(EPIC, rel), 'utf8'));
      prose.split(/\r?\n/).forEach((line, i) => {
        if (CLAIM.test(line)) claims.push(`${rel}:${i + 1}: ${line.trim().slice(0, 96)}`);
      });
    }
    expect(
      claims,
      `an artifact claims a consumer count:\n  ${claims.join('\n  ')}\n` +
        `There are ${CONSUMERS.length} consumers today — and that is exactly why no document ` +
        'should say so. Describe the scope the check derives (the whole repository); a number is ' +
        'true the day it is typed. A count in a GATE makes the gate verify the wrong scope.',
    ).toEqual([]);
  });

  it('WOULD FLAG a count in any phrasing, so it cannot shrink back to one word', () => {
    // The positive control this check lacked. Every assertion above passes
    // for a predicate that matches nothing, and "no artifact claims a count"
    // reads identically whether the rule holds or the pattern is broken —
    // which is how it sat green over "all five checks" for a whole pass.
    const missed = MUST_FLAG.filter((sample) => !CLAIM.test(sample));
    expect(missed, `the rule no longer catches a count:\n  ${missed.join('\n  ')}`).toEqual([]);
  });

  it('does NOT flag prose that counts something other than consumers', () => {
    // The other half of the control. A predicate widened until everything
    // matches is as useless as one narrowed until nothing does, and this one
    // was widened in this task. `V26-3` legitimately says two governance
    // checks catch one omission; `research.md` counts occurrences and files.
    for (const benign of [
      'Two independent checks catching one omission is intended',
      'appears literally six times across three files',
      'the three posture kinds',
      // `spec.md` says drift is reported "within one check run" — a single
      // EXECUTION of the suite, not a count of consumers. The rule matched it
      // on its first run, which is why the head noun has to be the noun.
      'reported within one check run',
    ]) {
      expect(CLAIM.test(benign), `false positive on: ${benign}`).toBe(false);
    }
  });

  it('every excluded record still exists, so no exclusion outlives its file', () => {
    const gone = [...Object.keys(RECORDS), ...Object.keys(RECORD_DIRS)].filter(
      (f) => !existsSync(join(EPIC, f)),
    );
    expect(gone, `excluded as a record but absent — delete the entry: ${gone.join(', ')}`).toEqual(
      [],
    );
  });

  it('scans below the top level, or the walk is a directory listing', () => {
    // `T1008`'s whole point, asserted rather than assumed: before the walk,
    // `checklists/` and `defects/` were invisible. A regression to a flat
    // read would leave every assertion above green over a smaller world.
    expect(
      ARTIFACTS.filter((rel) => rel.includes('/')),
      'no nested artifact scanned — the walk has flattened back to one level',
    ).not.toEqual([]);
  });
});
