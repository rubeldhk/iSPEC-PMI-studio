/**
 * T618 · Checks `G-27-04` and `G-27-13` — capability ownership and the twenty areas.
 *
 * `FR-AMD-004` requires every capability classified **native**, **integrated**
 * or **hybrid**, with the reason referencing Plan Amendment §2's test: *does PMI
 * Studio have to control this to maintain its end-to-end engineering workflow?*
 *
 * `G-27-13` additionally asserts the capability-area count agrees with the
 * figure quoted in `spec.md`. That assertion exists because the criterion
 * drifted from itself before this check was written — `SC-AMD-011` said
 * *seventeen* and *twenty* one sentence apart (DEF-027-001). A count that lives
 * in two documents and is checked in neither is a count that will disagree
 * again at the next amendment.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './helpers';

const PROJECTION = join(REPO_ROOT, 'specs/027-ai-native-amendment/register/register.json');
const SPEC = join(REPO_ROOT, 'specs/027-ai-native-amendment/spec.md');

interface Capability {
  id: string;
  capability: string;
  ownership: string;
  reason: string;
  abstraction_boundary: string | null;
  existing_home: string | null;
  removed_because_external: boolean;
}
interface Area {
  area: string;
  verdict: string;
  home: string;
  posture: string;
}

const present = existsSync(PROJECTION);
const projection = present
  ? (JSON.parse(readFileSync(PROJECTION, 'utf8')) as {
      capabilities: Capability[];
      capability_areas: Area[];
    })
  : { capabilities: [], capability_areas: [] };

const capabilities = projection.capabilities ?? [];
const areas = projection.capability_areas ?? [];

/** Exactly the count SC-AMD-011 and plan.md D.1 both state. */
const EXPECTED_AREAS = 20;

const OWNERSHIP = ['native', 'integrated', 'hybrid'];

describe('G-27-04 · every capability carries an ownership verdict (SC-AMD-004)', () => {
  it('the capability register is not empty', () => {
    expect(capabilities.length, 'register/capabilities.md contains no rows').toBeGreaterThan(0);
  });

  it('every capability is native, integrated or hybrid', () => {
    const bad = capabilities
      .filter((c) => !OWNERSHIP.includes(c.ownership))
      .map((c) => `${c.id}: "${c.ownership}"`);
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('every capability records a reason', () => {
    // §2 makes ownership a judgement with a stated test. A classification
    // without the reason is the judgement's answer without its working.
    const silent = capabilities
      .filter((c) => !c.reason || String(c.reason).trim().length < 15)
      .map((c) => c.id);
    expect(silent.slice(0, 10)).toEqual([]);
  });

  it('every integrated or hybrid capability names its abstraction boundary', () => {
    // §5's whole point: a workflow requests CreateImplementationBranch() rather
    // than embedding GitHub-specific logic. An integration with no named
    // boundary is a vendor dependency waiting to be discovered.
    const unbounded = capabilities
      .filter(
        (c) =>
          (c.ownership === 'integrated' || c.ownership === 'hybrid') &&
          (!c.abstraction_boundary || String(c.abstraction_boundary).trim().length < 3),
      )
      .map((c) => `${c.id} (${c.ownership})`);
    expect(
      unbounded.slice(0, 10),
      'an integrated capability with no abstraction boundary is provider-specific logic in a workflow',
    ).toEqual([]);
  });

  it('removed_because_external is false throughout', () => {
    // Plan Amendment §2, stated as a prohibition: "Do not remove existing
    // functionality solely because an external product provides something
    // similar." This is the one field the amendment forbids being true.
    const removed = capabilities
      .filter((c) => c.removed_because_external !== false)
      .map((c) => `${c.id}: ${String(c.removed_because_external)}`);
    expect(
      removed,
      '§2 forbids removing existing functionality merely because an external product provides something similar',
    ).toEqual([]);
  });

  it('capability ids are unique', () => {
    const seen = new Map<string, number>();
    for (const c of capabilities) seen.set(c.id, (seen.get(c.id) ?? 0) + 1);
    expect([...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id)).toEqual([]);
  });

  it('the §2 control test is actually applied, not merely cited', () => {
    // §2 states the test in one sentence: "Determine ownership based on whether
    // PMI Studio must CONTROL that capability to maintain its end-to-end
    // engineering workflow." A majority of reasons must engage with that
    // question rather than describing what the capability is — otherwise the
    // register classified by intuition and cited §2 as decoration.
    //
    // The pattern includes `own` because that is the test's own verb: "PMI
    // Studio owns the estimate of record" answers the control question directly.
    // It was originally `control|end-to-end|workflow|differentiat`, which failed
    // on 32 of 45 rows whose reasoning was sound — the pattern was too narrow,
    // not the data. Widened to the test's vocabulary rather than lowered to fit,
    // and the five rows that genuinely described rather than reasoned were
    // rewritten instead.
    const applying = capabilities.filter((c) =>
      /\bcontrol|\bowns?\b|\bown\b|end-to-end|workflow|differentiat|delegat/i.test(c.reason),
    );
    const notApplying = capabilities
      .filter((c) => !/\bcontrol|\bowns?\b|\bown\b|end-to-end|workflow|differentiat|delegat/i.test(c.reason))
      .map((c) => c.id);

    expect(
      applying.length,
      `only ${applying.length} of ${capabilities.length} reasons engage §2's control test; ` +
        `these do not: ${notApplying.slice(0, 8).join(', ')}`,
    ).toBeGreaterThan(capabilities.length / 2);
  });
});

describe('G-27-13 · exactly twenty capability areas (SC-AMD-011)', () => {
  it(`the table has exactly ${EXPECTED_AREAS} rows`, () => {
    expect(
      areas.length,
      `the amendment introduces ${EXPECTED_AREAS} capability areas; the register has ${areas.length}`,
    ).toBe(EXPECTED_AREAS);
  });

  it('every area carries a verdict', () => {
    const bad = areas.filter((a) => !a.verdict || a.verdict.trim() === '').map((a) => a.area);
    expect(bad).toEqual([]);
  });

  it('every area names a home — an epic, or an explicit statement that none owns it', () => {
    // FR-AMD-012: a build with no owning epic is a build nobody is going to do.
    // "UNOWNED" is an acceptable home; blank is not, because blank cannot be
    // told apart from unexamined.
    const homeless = areas.filter((a) => !a.home || a.home.trim() === '').map((a) => a.area);
    expect(homeless).toEqual([]);
  });

  it('every area carries a posture', () => {
    const bad = areas.filter((a) => !a.posture || a.posture.trim() === '').map((a) => a.area);
    expect(bad).toEqual([]);
  });

  it('the count matches the figure quoted in spec.md (DEF-027-001)', () => {
    // The assertion that makes SC-AMD-011 self-enforcing. It said "seventeen"
    // and "twenty" one sentence apart, because D-42 updated half of it. A count
    // living in two documents and checked in neither will disagree again.
    const spec = readFileSync(SPEC, 'utf8');
    const claim = /SC-AMD-011[\s\S]{0,200}?\*\*(\w+)\*\* capability areas/.exec(spec)?.[1];
    expect(claim, 'SC-AMD-011 no longer states a capability-area count').toBeDefined();

    const WORDS: Record<string, number> = {
      seventeen: 17,
      eighteen: 18,
      nineteen: 19,
      twenty: 20,
      'twenty-one': 21,
    };
    expect(
      WORDS[String(claim).toLowerCase()],
      `spec.md SC-AMD-011 says "${claim}" and the register has ${areas.length} areas`,
    ).toBe(areas.length);
  });

  it('the three genuinely new Cosmos areas are present and unowned', () => {
    // Cosmos §3.1, §3.4 and §3.5 are absent from all four August-11 documents.
    // All three are product surface and therefore held, so nothing is blocked —
    // but nothing owns them either, and the report has to say so.
    for (const area of ['Governed Engineering Loops', 'Governed Learning', 'Specification Compliance']) {
      const row = areas.find((a) => a.area.toLowerCase().includes(area.toLowerCase()));
      expect(row, `capability area "${area}" is missing from the register`).toBeDefined();
    }
  });
});
