/**
 * T614 · Check `G-27-05` — every "existing capability" claim was verified.
 *
 * `FR-AMD-006`: where the amendment refers to a capability as *existing*, the
 * reconciliation MUST verify that claim against the corpus and record the
 * evidence — occurrence count and locations — **rather than accepting or
 * rejecting the premise by assertion**.
 *
 * This is the check behind Finding A, and Finding A is the largest single
 * finding in the epic: the amendment says *"maintain and enhance the existing
 * Change Room"* and the corpus contains no Change Room. That resizes the
 * programme, so the evidence has to be reproducible by anyone who doubts it —
 * which is why `search_performed` records the query as run rather than a
 * description of it.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './helpers';

const PROJECTION = join(REPO_ROOT, 'specs/027-ai-native-amendment/register/register.json');

interface Premise {
  id: string;
  claimed_capability: string;
  claim_source: string;
  search_performed: string;
  occurrence_count: number;
  locations: string[];
  verdict: string;
}

const present = existsSync(PROJECTION);
const projection = present
  ? (JSON.parse(readFileSync(PROJECTION, 'utf8')) as {
      premises: Premise[];
      clauses: { id: string }[];
    })
  : { premises: [], clauses: [] };

const premises = projection.premises ?? [];
const clauseIds = new Set((projection.clauses ?? []).map((c) => c.id));

/** The capabilities the amendment calls existing. Finding A's subject. */
const CLAIMED_EXISTING = [
  'Change Room',
  'Defect Room',
  'Requirement Room',
  'Decision Room',
  'Agent Gateway',
  'Integration Hub',
  'Context Engine',
  'Evidence Package',
];

describe('G-27-05 · the premise register is populated (SC-AMD-005)', () => {
  it('records at least one premise check', () => {
    // Zero premises would pass every assertion below it, which is the failure
    // shape this repository hit four times this week.
    expect(premises.length, 'register/premises.md contains no rows').toBeGreaterThan(0);
  });

  it.each(CLAIMED_EXISTING)('the "%s" claim was verified', (capability) => {
    const found = premises.some((p) =>
      p.claimed_capability.toLowerCase().includes(capability.toLowerCase()),
    );
    expect(
      found,
      `the amendment refers to "${capability}" as existing and no premise check records whether it does`,
    ).toBe(true);
  });
});

describe('G-27-05 · every premise records reproducible evidence', () => {
  it('every premise names the query as run', () => {
    // "I searched the corpus" is an assertion. A query is evidence, because the
    // next reader can run it.
    const vague = premises
      .filter((p) => !p.search_performed || p.search_performed.trim().length < 8)
      .map((p) => p.id);
    expect(vague.slice(0, 10)).toEqual([]);
  });

  it('every premise records an occurrence count', () => {
    const missing = premises
      .filter((p) => typeof p.occurrence_count !== 'number')
      .map((p) => p.id);
    expect(missing.slice(0, 10)).toEqual([]);
  });

  it('a non-zero count names its locations', () => {
    // A count without locations cannot be checked; a count of zero has no
    // locations by definition, which is why the rule is conditional.
    const unlocated = premises
      .filter((p) => p.occurrence_count > 0 && (p.locations ?? []).length === 0)
      .map((p) => `${p.id} (count ${p.occurrence_count})`);
    expect(unlocated.slice(0, 10)).toEqual([]);
  });

  it('a zero count claims no locations', () => {
    const contradictory = premises
      .filter((p) => p.occurrence_count === 0 && (p.locations ?? []).length > 0)
      .map((p) => p.id);
    expect(contradictory).toEqual([]);
  });

  it('every premise carries a verdict of confirmed, refuted or partial', () => {
    const allowed = ['confirmed', 'refuted', 'partial'];
    const bad = premises
      .filter((p) => !allowed.includes(p.verdict))
      .map((p) => `${p.id}: "${p.verdict}"`);
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('a refuted premise has a zero count, and a confirmed one does not', () => {
    // The verdict must follow the evidence rather than the author's expectation.
    // This is the assertion that would catch a premise recorded as refuted
    // because someone believed it, against a count that says otherwise.
    const inconsistent = premises
      .filter(
        (p) =>
          (p.verdict === 'refuted' && p.occurrence_count !== 0) ||
          (p.verdict === 'confirmed' && p.occurrence_count === 0),
      )
      .map((p) => `${p.id}: ${p.verdict} with count ${p.occurrence_count}`);
    expect(
      inconsistent,
      'a premise verdict must follow its evidence, not the other way round',
    ).toEqual([]);
  });

  it('every premise cites the clause that made the claim', () => {
    const dangling = premises
      .filter((p) => !p.claim_source || !clauseIds.has(p.claim_source))
      .map((p) => `${p.id} → ${p.claim_source}`);
    expect(
      dangling.slice(0, 10),
      'a premise must name the clause it is checking, so the claim and its verification stay linked',
    ).toEqual([]);
  });
});

describe('G-27-05 · Finding A is recorded as evidence, not as a conclusion', () => {
  it('the three Rooms are all refuted', () => {
    // If any of these ever flips to confirmed, the programme got smaller and
    // someone must notice. That is the whole reason this is a check.
    for (const room of ['Change Room', 'Defect Room', 'Requirement Room']) {
      const premise = premises.find((p) =>
        p.claimed_capability.toLowerCase().includes(room.toLowerCase()),
      );
      expect(premise, `no premise check for ${room}`).toBeDefined();
      expect(premise?.verdict, `${room} is no longer refuted — the programme just changed size`).toBe(
        'refuted',
      );
    }
  });

  it('the product Defect Room is distinguished from the defects/ convention (FR-AMD-007)', () => {
    // One name, two concepts. The word "defect" appears in all 26 specs and
    // always as the Constitution VI obligation, which is a repository process
    // convention and not a product capability. Conflating them would have made
    // Finding A look wrong.
    const text = readFileSync(
      join(REPO_ROOT, 'specs/027-ai-native-amendment/register/premises.md'),
      'utf8',
    );
    expect(text).toMatch(/defects\//);
    expect(text).toMatch(/Constitution VI/i);
  });

  it('the EPIC-007 name collision is recorded with both scopes (Finding B)', () => {
    const text = readFileSync(
      join(REPO_ROOT, 'specs/027-ai-native-amendment/register/premises.md'),
      'utf8',
    );
    expect(text).toMatch(/EPIC-007/);
    expect(text).toMatch(/D-33/);
  });
});
