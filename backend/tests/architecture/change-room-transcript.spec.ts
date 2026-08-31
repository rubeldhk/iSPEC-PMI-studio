/**
 * `T995p` (EPIC-034 Phase Z) — the Tier 2 transcript conforms.
 *
 * Constitution XI Tier 2, and the quickstart's own wording: *"hand-written
 * evidence is a constitution violation of the first order."*
 *
 * ## What a check can and cannot establish
 *
 * Nothing here can prove a file was produced by a run rather than typed. What
 * it can do is make typing one **as much work as running it, and easier to get
 * wrong** — every row must carry a distinct ISO timestamp, the times must be
 * ordered and close together, ids must look generated, and every stage of the
 * journey must appear. A person fabricating that has to invent a plausible
 * millisecond sequence for twelve steps and four UUIDs, which is harder than
 * running the walk.
 *
 * That is the honest limit of the check, and it is stated rather than implied.
 *
 * ## The stage list is read from the task, not restated
 *
 * `T995o` names the chain: request → impact → decision → re-baseline. Four
 * stages, and the failure mode it warns about is *"a Room whose regions each
 * work and whose flow does not"* — so a transcript covering three of them is
 * exactly the artifact that would hide it.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SPEC_DIR = resolve(here, '..', '..', '..', 'specs', '034-change-room');
const TRANSCRIPT = readFileSync(resolve(SPEC_DIR, 'tier2-transcript.md'), 'utf8');

/**
 * Every ISO instant in the **step table**, in the order they appear.
 *
 * Scoped to table rows deliberately. The header's `**Run**:` instant is the
 * same moment as the first step returned at — legitimately so — and counting it
 * made the distinctness assertion fail on a duplicate that is not one.
 */
const STAMPS = TRANSCRIPT.split('\n')
  .filter((line) => line.startsWith('| 2'))
  // Split on the cell boundary rather than matching the instant with a regex.
  // An ISO 8601 pattern contains `T` followed by digits, which `T864a` reads as
  // a hand-written task-identifier shape — correctly, by its own rules: it
  // cannot tell one from the other, and the one it exists to catch is the one
  // that matters. Taking the first cell says what is meant anyway.
  .map((line) => line.split('|')[1]?.trim())
  .filter((stamp): stamp is string => stamp !== undefined && stamp.length > 0);

describe('T995p · the transcript exists and names its run', () => {
  it('is not empty', () => {
    expect(TRANSCRIPT.length).toBeGreaterThan(1000);
  });

  it('names the task and the run instant', () => {
    expect(TRANSCRIPT).toMatch(/\*\*Task\*\*:\s*`T995k`/);
    expect(TRANSCRIPT).toMatch(/\*\*Run\*\*:\s*\d{4}-\d{2}-\d{2}T/);
  });

  it('names the application it ran against', () => {
    // A transcript that does not say what it walked is a transcript of
    // nothing in particular.
    expect(TRANSCRIPT).toMatch(/\*\*Application\*\*:\s*`http/);
  });

  it('names the build under test', () => {
    // `EPIC-033`'s transcript records this too. A run against a stale container
    // proves the container, not the code.
    expect(TRANSCRIPT).toMatch(/\*\*Build under test\*\*/);
  });
});

describe('T995p · it covers the whole chain', () => {
  it.each([
    ['request', /\*\*raise\*\*/],
    ['impact', /\*\*impact\*\*/],
    ['decision', /\*\*decide\*\*/],
    ['re-baseline', /\*\*apply\*\*/],
  ])('records the %s stage', (_stage, pattern) => {
    // `T995o`: the failure mode is a Room whose regions each work and whose
    // flow does not. A transcript covering three of four would hide exactly
    // that.
    expect(pattern.test(TRANSCRIPT)).toBe(true);
  });

  it('and records what each stage returned, not merely that it ran', () => {
    // A step listed with no outcome is a claim that something happened.
    for (const status of ['201', '400', '404']) {
      expect(TRANSCRIPT.includes(status), `no ${status} anywhere in the transcript`).toBe(true);
    }
  });

  it('states what it does NOT establish', () => {
    // The clause that keeps a partial walk from reading as a complete one.
    // `EPIC-034`'s journey stops at three unbound seams by design, and a
    // transcript that did not say so would be the more dangerous artifact.
    expect(TRANSCRIPT).toMatch(/does NOT establish|not establish/i);
  });
});

describe('T995p · it was generated, not authored', () => {
  it('carries a timestamp for every step', () => {
    // Twelve steps, twelve distinct instants. Typing this is harder than
    // running the walk, which is the whole mechanism.
    expect(STAMPS.length).toBeGreaterThanOrEqual(12);
  });

  it('and every one of them is distinct', () => {
    // A repeated instant is the signature of a copied row.
    expect(new Set(STAMPS).size).toBe(STAMPS.length);
  });

  it('in ascending order', () => {
    const sorted = [...STAMPS].sort();
    expect(STAMPS).toEqual(sorted);
  });

  it('within a single run rather than spread over hours', () => {
    // A walk takes seconds. Instants minutes apart would mean the file was
    // assembled from several sittings — which is authorship, whatever the
    // rows say.
    const first = Date.parse(STAMPS[0]!);
    const last = Date.parse(STAMPS[STAMPS.length - 1]!);
    expect(last - first).toBeLessThan(60_000);
    // And not all identical, which would be a single stamp pasted twelve times.
    expect(last - first).toBeGreaterThan(0);
  });

  it('and names generated identifiers rather than round ones', () => {
    // UUIDs the run produced. `cr_1` and `iv_1` are what a person types.
    const uuids = TRANSCRIPT.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g);
    expect(uuids?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(new Set(uuids).size).toBeGreaterThanOrEqual(3);
  });

  it('the ordering check can fail', () => {
    // Anti-tautology: the assertions above are worth nothing unless the
    // comparison they use can distinguish an ordered list from an unordered
    // one.
    const jumbled = ['2026-08-31T04:15:36.361Z', '2026-08-31T04:15:36.233Z'];
    expect(jumbled).not.toEqual([...jumbled].sort());
  });
});

describe('T995p · and it is verified beyond the responses', () => {
  it('records what was found in the database', () => {
    // `T1178`'s lesson at the transcript level: an API that answered 201 and a
    // row that exists are different claims.
    expect(TRANSCRIPT).toMatch(/psql|PostgreSQL/);
    expect(TRANSCRIPT).toMatch(/change_requests|change_impact_areas/);
  });
});
