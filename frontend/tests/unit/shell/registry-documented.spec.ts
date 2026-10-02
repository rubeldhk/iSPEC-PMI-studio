/**
 * T442t (EPIC-036) — the documents that define the registry must say what the
 * registry says.
 *
 * **Why this exists.** `C1`'s remediation set *"six delivered, three
 * declared-not-delivered"* across every artifact. `N1` then moved `Plan &
 * Tasks` to `declared-not-delivered` during the Phase 2 implementation, and
 * only `areas.ts`, `handovers.md`, `closure.md` and the tests followed. **Six
 * specification documents went on describing a product with six navigable
 * areas for eight convergence passes** — including `contracts/shell-contract.md`
 * §2, whose route table presented `/specifications/:id/tasks` as a delivered
 * area, which is the exact shape `N1` ruled out.
 *
 * Every one of those passes checked `data-model.md` for the **existence** of
 * the `status` union. The union was there. Nobody read the number beside it.
 *
 * `T436f` asserts the registry's internal invariants; Constitution V requires a
 * non-code output to carry an executable check that can fail, and **the
 * registry had one while its specification did not**. This is that check.
 *
 * It is deliberately literal — it reads the committed markdown rather than a
 * generated summary — because the failure mode is a human writing a number in
 * prose and nothing disagreeing with them.
 *
 * ## What it does NOT check, and why
 *
 * **Free-prose totals**, like *"When any of the twelve ships"* or *"None of the
 * other thirteen appears"*. `T442v` tried, and every matcher wide enough to
 * catch them also caught *"the other two sections"* and *"for the other two
 * there is nothing to point it at"* — neither about areas. A checker cannot
 * reliably tell those apart, and one that fires on correct prose gets disabled.
 *
 * **The status table's sum stands in for them.** Three per-status counts that
 * each match the registry *and* add up to eighteen leave no arithmetic for a
 * prose total to get right on its own — and unlike a prose matcher, the table
 * is a structured statement with exactly one meaning.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AREAS, deliveredAreas, reachableAreas, type AreaStatus } from '../../../src/shell/areas';

// T1002 — the identifier shape is configuration (`EPIC-026` `FR-ESK-025`), not
// something this file may restate. It held the PRE-WIDENING three-digit shape in
// two places, in the very file whose `T441n` raised the exhaustion.
//
// **This file cannot import the shared module, established by compiling rather
// than assumed**: this package's tsconfig sets `rootDir` to `frontend/`, so a
// repository-root `.ts` import fails with TS6059. Vitest resolves it happily —
// only `tsc` says no, which is why an import that ran green was still wrong.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const SPECS = join(ROOT, 'specs', '036-application-shell');

/** The identifier shape, unanchored, from governance configuration. */
function identifierShape(): string {
  const config = JSON.parse(
    readFileSync(join(ROOT, 'governance', 'epic-stage.config.json'), 'utf8'),
  ) as { taskIdentifierRecogniser: string };
  return config.taskIdentifierRecogniser.replace(/^\^/, '').replace(/\$$/, '');
}

/** Identifier-shaped tokens cited in prose, as a FRESH global regex each call. */
function citedIdentifiers(): RegExp {
  return new RegExp(`\\b${identifierShape()}\\b`, 'g');
}

/** The identifiers a tasks.md declares, by checkbox line. */
function declaredIdentifiers(tasks: string): string[] {
  return [...tasks.matchAll(new RegExp(`^- \\[[ xX]\\] (${identifierShape()})`, 'gm'))].map(
    (m) => m[1]!,
  );
}

function doc(...parts: string[]): string {
  return readFileSync(join(SPECS, ...parts), 'utf8');
}

/** The registry's own counts — the thing every document below must agree with. */
const ACTUAL: Record<AreaStatus, number> = {
  delivered: AREAS.filter((a) => a.status === 'delivered').length,
  // T1016 — `partly-delivered` joined the vocabulary with Constitution XII
  // Step B. Omitting it here would leave two areas uncounted while the sum
  // still looked deliberate.
  'partly-delivered': AREAS.filter((a) => a.status === 'partly-delivered').length,
  'declared-not-delivered': AREAS.filter((a) => a.status === 'declared-not-delivered').length,
  undeclared: AREAS.filter((a) => a.status === 'undeclared').length,
};

const WORDS: Readonly<Record<string, number>> = Object.freeze({
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
});

/** A number written as a word or a digit, in either case. */
function value(token: string): number | null {
  const word = WORDS[token.toLowerCase()];
  if (word !== undefined) return word;
  const digits = Number(token);
  return Number.isInteger(digits) ? digits : null;
}

/**
 * Markdown with emphasis and backticks flattened, and **correction notes
 * removed**.
 *
 * These documents record what they used to say — *"This said six delivered and
 * three awaiting an owner"* — and quoted history is not a claim. Without this,
 * every correction would trip the check that motivated it, and the only way to
 * stay green would be to delete the history.
 *
 * Deliberately narrow: a blockquote line is skipped **only** when it says
 * `Corrected`. A wrong number in body text, or in any other blockquote, is
 * still caught — asserted below.
 */
function flat(text: string): string {
  const body = text
    .split(/\r?\n/)
    .filter((line) => !(line.trimStart().startsWith('>') && /Corrected/i.test(line)))
    .join('\n');
  return body.replace(/[*`]/g, '').replace(/\s+/g, ' ');
}

const NUMBER = '(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|\\d+)';

/**
 * Every "<n> delivered" / "<n> routed areas" style claim in a document.
 *
 * **Three shapes are deliberately not claims**, and all three appear in these
 * files:
 *
 *   - `` `EPIC-033` delivered MUST be adopted `` — the number is an Epic
 *     identifier and `delivered` is a verb, so a preceding `EPIC-` rejects it.
 *   - `Remove one delivered area's route` — a single instance, not a count, so
 *     a following **singular** `area` rejects it. The plural `areas` does not,
 *     because `\barea\b` cannot match inside it.
 *   - `marking these four undeclared would claim…` — an action performed on
 *     four areas, not a statement that four exist. The demonstrative is what
 *     says so, and a preceding `these`/`those` rejects it.
 *
 * Each was a false positive on the first run of this check (`T442v`). **A check
 * that cried wolf on ordinary prose would be read once and then ignored**,
 * which is worse than no check at all — so every exemption is asserted from
 * both sides below rather than trusted.
 */
function claims(text: string, subject: RegExp): { token: string; n: number }[] {
  const found: { token: string; n: number }[] = [];
  const pattern = new RegExp(
    `(these|those|EPIC-)?\\s*${NUMBER}\\s+(?:are\\s+|of\\s+the\\s+)?(?:${subject.source})(\\s+area\\b)?`,
    'gi',
  );
  for (const match of flat(text).matchAll(pattern)) {
    // `EPIC-033 delivered` — an identifier. `marking these four undeclared
    // would claim…` — an ACTION on four areas, not a statement that four
    // exist; the demonstrative is what says so.
    if (match[1] !== undefined) continue;
    if (match[3] !== undefined) continue; // "one delivered area's" — an instance
    const n = value(match[2]!);
    if (n !== null) found.push({ token: match[2]!, n });
  }
  return found;
}

/**
 * Every markdown file under the feature directory, as a `/`-joined path.
 *
 * **Read, not listed** (`T442y`). This was a hand-maintained array of six paths
 * while the directory held eleven, and nothing said which five were missing or
 * why — so `analysis.md` was omitted by nobody in particular, and `analysis.md`
 * was the one that had drifted. That is `DEF-010-001`'s shape at the document
 * level: a list that must agree with a directory, and no check that it does.
 */
function featureDocuments(dir: string = SPECS, prefix = ''): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) found.push(...featureDocuments(join(dir, entry.name), rel));
    else if (entry.name.endsWith('.md')) found.push(rel);
  }
  return found.sort();
}

/**
 * Documents whose counts are **not** checked, and why.
 *
 * Every line here is a decision somebody made, not a file somebody forgot.
 * That is the entire difference between this map and the array it replaced:
 * the omission is now readable, arguable and wrong-able.
 *
 * **`analysis.md`'s exemption is the load-bearing one.** It is a dated session
 * record — its Remediation table opens *"Applied 2026-08-24"* and describes
 * what that remediation did, which was true when written and was superseded by
 * `N1` an hour later. Count-checking a history document would demand that
 * history be rewritten to stay green, which is the opposite of what a record is
 * for. **The cost is real and is stated rather than hidden**: its numbers are
 * not machine-checked, `T442x` had to correct three of them by hand, and the
 * only guard on the next drift is a person reading it.
 */
const EXEMPT: Readonly<Record<string, string>> = Object.freeze({
  'analysis.md':
    'a dated session record — its resolution notes and Remediation table describe what was true when applied, and N1 superseded C1 the same day. Corrected by hand at T442x.',
  'closure.md':
    'a dated snapshot that quotes superseded figures on purpose, so the drift it describes stays legible.',
  'tasks.md':
    'task descriptions quote the wrong numbers verbatim — that is what a remediation task is.',
  'handovers.md':
    'states obligations and owners rather than area totals; its one count is prose the parser cannot scope.',
  'research.md': 'records decisions and alternatives; it states no area counts.',
});

const ARTIFACTS: readonly (readonly string[])[] = featureDocuments()
  .filter((rel) => EXEMPT[rel] === undefined)
  .map((rel) => rel.split('/'));

describe('T442t · the registry and the documents that define it agree', () => {
  it('reads a registry with all four states, or this check proves nothing', () => {
    // Anti-vacuity. A regex that matched nothing, or a registry that lost a
    // state, would let every assertion below pass over an empty list — which
    // is precisely how the divergence survived eight passes.
    expect(AREAS.length).toBe(18);
    const summed = Object.values(ACTUAL).reduce((a, b) => a + b, 0);
    expect(summed, 'the four states do not account for every area').toBe(18);

    // T1016 — `undeclared` is deliberately EMPTY after Step B: every area names
    // its Epic. The old guard required every status to have members, which
    // would now force a false entry to satisfy it. The state is retained for a
    // future area declared before its Epic exists, so assert the zero and its
    // reason rather than demanding it be non-zero.
    expect(ACTUAL.undeclared, 'an area names no owning Epic').toBe(0);
    for (const status of ['delivered', 'partly-delivered', 'declared-not-delivered'] as const) {
      expect(ACTUAL[status], `no areas are ${status}`).toBeGreaterThan(0);
    }
  });

  it('checks every document in the feature directory, or says why not', () => {
    // The list is derived, so the only way to omit a file is to declare it —
    // and the only way to declare a file that is gone is to be wrong.
    const documents = featureDocuments();
    const unaccounted = documents.filter(
      (rel) => EXEMPT[rel] === undefined && !ARTIFACTS.some((parts) => parts.join('/') === rel),
    );
    expect(unaccounted, `${unaccounted.join(', ')} is neither checked nor exempt`).toEqual([]);

    const orphaned = Object.keys(EXEMPT).filter((rel) => !documents.includes(rel));
    expect(orphaned, `EXEMPT names ${orphaned.join(', ')}, which no longer exists`).toEqual([]);

    // An exemption with no reason is an omission with better manners.
    for (const [rel, reason] of Object.entries(EXEMPT)) {
      expect(reason.length, `${rel} is exempt with no reason given`).toBeGreaterThan(30);
    }
  });

  it("every task this Epic's records cite is a task this Epic has", () => {
    // `T442z`: `closure.md` credited `T442w`, which existed nowhere. A record
    // that attributes work to a task nobody can look up is a dead end for the
    // next reader, and `G-26-14` guards the reverse direction only.
    //
    // **This catches a DANGLING id, not a WRONG one.** `T442w` was allocated by
    // the very phase that fixed the reference, so this assertion would have
    // gone green on the bad line the moment the id existed. Green here means
    // "these ids resolve", never "these ids are the right ones" — reading the
    // sentence is still somebody's job.
    // **The letter is required.** Every task this Epic owns is `T436a`–`T442z`
    // — the sub-lettered blocks the header explains, because 999 of 999
    // three-digit prefixes were already allocated. So a bare `T436` in prose
    // names the *block*, not a task, and `handovers.md` uses it that way three
    // times. Treating those as ids would make the check cry wolf on correct
    // writing, which is how a check stops being read.
    const OWN_BLOCK = /^T(43[6-9]|44[0-2])[a-z]$/;
    const defined = new Set(
      declaredIdentifiers(doc('tasks.md')),
    );
    expect(defined.size, 'no tasks parsed out of tasks.md').toBeGreaterThan(50);

    const dangling: string[] = [];
    const examined = new Set<string>();
    for (const rel of featureDocuments()) {
      if (rel === 'tasks.md') continue;
      for (const match of doc(...rel.split('/')).matchAll(citedIdentifiers())) {
        const id = match[0];
        // Ids outside this Epic's allocated blocks belong to other Epics —
        // `T200e` is `EPIC-010`'s, `T884` is `EPIC-029`'s — and this file has
        // no standing to say whether those exist.
        if (!OWN_BLOCK.test(id)) continue;
        examined.add(id);
        if (!defined.has(id)) dangling.push(`${rel} cites ${id}`);
      }
    }
    // Anti-vacuity: a scan that found no citations would report every record
    // clean forever, which is the failure mode this whole file exists to name.
    expect(examined.size, 'no task citations were found to check').toBeGreaterThan(20);
    expect([...new Set(dangling)], 'a record names a task that tasks.md does not define').toEqual(
      [],
    );
  });

  it('finds count claims to check, in every artifact that makes them', () => {
    const withClaims = ARTIFACTS.filter(
      (parts) => claims(doc(...parts), /delivered|routed areas/).length > 0,
    );
    expect(
      withClaims.length,
      'no artifact stated a count — the parser found nothing to disagree with',
    ).toBeGreaterThanOrEqual(4);
  });

  it.each(ARTIFACTS.map((parts) => [parts.join('/'), parts] as const))(
    '%s states the delivered count the registry has',
    (name, parts) => {
      const wrong = claims(doc(...parts), /delivered(?!-not-delivered)|routed areas/)
        .filter((claim) => claim.n !== ACTUAL.delivered)
        .map((claim) => claim.token);
      expect(
        wrong,
        `${name} claims ${wrong.join(', ')} delivered areas; the registry has ${ACTUAL.delivered}`,
      ).toEqual([]);
    },
  );

  it.each(ARTIFACTS.map((parts) => [parts.join('/'), parts] as const))(
    '%s states the declared-not-delivered count the registry has',
    (name, parts) => {
      const wrong = claims(doc(...parts), /declared-not-delivered|awaiting their owners/)
        .filter((claim) => claim.n !== ACTUAL['declared-not-delivered'])
        .map((claim) => claim.token);
      expect(
        wrong,
        `${name} claims ${wrong.join(', ')} areas awaiting an owner; the registry has ${ACTUAL['declared-not-delivered']}`,
      ).toEqual([]);
    },
  );

  it.each(ARTIFACTS.map((parts) => [parts.join('/'), parts] as const))(
    '%s states the undeclared count the registry has',
    (name, parts) => {
      const wrong = claims(doc(...parts), /undeclared/)
        .filter((claim) => claim.n !== ACTUAL.undeclared)
        .map((claim) => claim.token);
      expect(
        wrong,
        `${name} claims ${wrong.join(', ')} undeclared areas; the registry has ${ACTUAL.undeclared}`,
      ).toEqual([]);
    },
  );

  it('data-model.md’s status table sums to the whole registry', () => {
    // **The assertion that closes the shape rather than moving it.**
    //
    // Three times in this Epic a fix was asserted at exactly the level the
    // previous fault sat, and the gap moved one step sideways: `T441v` left
    // *failed* undriven, `T441s` left `hostRoom` unrendered, and `T442t`
    // checked two of four counts — which is how the stale "twelve" on line 93
    // survived `T442s` correcting the heading four lines above it.
    //
    // A **total** cannot be right while a part is wrong. Whatever phrasing a
    // future edit invents, this reads the table itself and compares every
    // number, so a part and the whole have to agree at once.
    const table = flat(doc('data-model.md'));
    const stated: Partial<Record<AreaStatus, number>> = {};
    for (const status of Object.keys(ACTUAL) as AreaStatus[]) {
      const match = new RegExp(`\\|\\s*${status}\\s*\\|[^|]*\\|\\s*(\\d+)\\s*\\|`, 'i').exec(table);
      if (match) stated[status] = Number(match[1]);
    }
    expect(Object.keys(stated), 'the status table was not parsed at all').toHaveLength(4);
    expect(stated).toEqual(ACTUAL);
    expect(
      Object.values(stated).reduce((a, b) => a + b, 0),
      'the stated counts do not account for all eighteen areas',
    ).toBe(AREAS.length);
  });

  it('the contract route table lists exactly the REACHABLE areas', () => {
    // The worst site of the `N1` divergence: the table marked
    // `/specifications/:id/tasks` as a delivered area — a parameterised path
    // presented as a navigable destination, which is the bug `N1` ruled out.
    const table = doc('contracts', 'shell-contract.md');
    const routed = [...table.matchAll(/^(\/\S*)\s+→\s+.*?\bdelivered\b/gm)].map((m) => m[1]!);
    expect(routed.length, 'no delivered routes were parsed from the table').toBeGreaterThan(0);
    // T1016 — reachable, not strictly delivered. A partly-delivered area is
    // routed, and comparing against `deliveredAreas()` would demand the table
    // omit two screens a user can open.
    expect(routed.sort()).toEqual(reachableAreas().map((area) => area.path).sort());
  });

  it('no artifact presents a parameterised path as a delivered area', () => {
    // The general form of the same fault. A path with a `:param` cannot be a
    // navigation destination — `Area.path` is what navigation links to.
    const table = doc('contracts', 'shell-contract.md');
    const parameterised = [...table.matchAll(/^(\/\S*:\S*)\s+→\s+.*?\bdelivered\b/gm)].map(
      (m) => m[1]!,
    );
    expect(parameterised, 'a parameterised path is marked delivered').toEqual([]);
    expect(deliveredAreas().every((area) => !area.path.includes(':'))).toBe(true);
  });

  it('would notice a wrong number', () => {
    // The mutation, asserted rather than performed by hand: the parser has to
    // be able to disagree, or the six assertions above are decoration.
    expect(claims('**Six delivered**, three awaiting their owners', /delivered/)).toEqual([
      { token: 'Six', n: 6 },
    ]);
    expect(claims('five are delivered today', /delivered/)).toEqual([{ token: 'five', n: 5 }]);
    expect(claims('nothing to see here', /delivered/)).toEqual([]);
    // And the two shapes that are NOT counts, both taken from these documents.
    expect(claims('`EPIC-033` delivered MUST be adopted', /delivered/)).toEqual([]);
    expect(claims("Remove one delivered area's route", /delivered/)).toEqual([]);
    expect(claims('marking these four undeclared would be false', /undeclared/)).toEqual([]);
    expect(claims('nine undeclared.', /undeclared/)).toEqual([{ token: 'nine', n: 9 }]);
    expect(claims('each of the six delivered areas', /delivered/)).toEqual([
      { token: 'six', n: 6 },
    ]);
  });

  it('skips quoted history without letting a claim hide in a blockquote', () => {
    // The narrow exemption, asserted from both sides. A correction note has to
    // be able to say what the document used to say; anything else in a
    // blockquote is still a claim.
    expect(claims('> **Corrected 2026-08-24.** This said six delivered areas.', /delivered/)).toEqual(
      [],
    );
    expect(claims('> This Epic has six delivered areas.', /delivered/)).toEqual([
      { token: 'six', n: 6 },
    ]);
    expect(claims('The Epic has six delivered areas. Corrected elsewhere.', /delivered/)).toEqual([
      { token: 'six', n: 6 },
    ]);
  });
});
