/**
 * T626 · Checks `G-27-07`, `G-27-08`, `G-27-10` — ADRs, research and decisions.
 *
 * These three enforce one rule from three directions: **nothing is answered by
 * assumption.** Native §26 says it outright — *"Do not make unsupported
 * assumptions where research is required"* — and §27 requires an ADR to exist
 * even when its decision cannot yet be taken, because *an ADR that exists as an
 * open question is what stops someone assuming the answer later*.
 *
 * The sharpest assertion here is the cross-check: **no decision may be `decided`
 * while the research it depends on is unanswered.** That is the one a motivated
 * author trips over, because deciding feels like progress and the dependency is
 * recorded in a different file.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './helpers';

const PROJECTION = join(REPO_ROOT, 'specs/027-ai-native-amendment/register/register.json');
const ADR_DIR = join(REPO_ROOT, 'adr');

interface Adr {
  subject: string;
  status: string;
  awaits: string | null;
  supersedes: string | null;
  superseded_reasoning: string | null;
}
interface Research {
  id: string;
  question: string;
  blocks: string[];
  owner: string;
  status: string;
}
interface Decision {
  id: string;
  question: string;
  options: { label: string; consequence: string }[];
  recommendation: string | null;
  owner: string;
  status: string;
  blocking_research: string[];
}

const present = existsSync(PROJECTION);
const projection = present
  ? (JSON.parse(readFileSync(PROJECTION, 'utf8')) as {
      adrs: Adr[];
      research: Research[];
      decisions: Decision[];
    })
  : { adrs: [], research: [], decisions: [] };

const adrs = projection.adrs ?? [];
const research = projection.research ?? [];
const decisions = projection.decisions ?? [];

/** Native §27 names twelve; Cosmos §9 names five more. D-35: all created now. */
const EXPECTED_ADRS = 17;

/** Native §26 names exactly fourteen. */
const R_AI_IDS = Array.from({ length: 14 }, (_, i) => `R-AI-${String(i + 1).padStart(3, '0')}`);

describe('G-27-07 · all seventeen ADR subjects exist (SC-AMD-007)', () => {
  it(`the register records ${EXPECTED_ADRS} ADR subjects`, () => {
    expect(
      adrs.length,
      `Native §27 names 12 and Cosmos §9 names 5 more; the register has ${adrs.length}`,
    ).toBe(EXPECTED_ADRS);
  });

  it('every ADR has a status of decided or open', () => {
    const bad = adrs
      .filter((a) => !['decided', 'open'].includes(a.status))
      .map((a) => `${a.subject}: "${a.status}"`);
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('every OPEN ADR names what it awaits', () => {
    // §26 forbids answering by assumption. An ADR marked open with no stated
    // blocker is an ADR that will be closed by whoever next needs an answer.
    const vague = adrs
      .filter((a) => a.status === 'open' && (!a.awaits || String(a.awaits).trim().length < 3))
      .map((a) => a.subject);
    expect(
      vague.slice(0, 10),
      'an open ADR must name what it awaits, or it is an invitation to assume',
    ).toEqual([]);
  });

  it('every supersession carries its reasoning', () => {
    // Native §27: "Preserve existing ADRs unless explicitly superseded with
    // documented reasoning."
    const unreasoned = adrs
      .filter((a) => a.supersedes && !a.superseded_reasoning)
      .map((a) => `${a.subject} supersedes ${a.supersedes}`);
    expect(unreasoned).toEqual([]);
  });

  it('the ADR files exist on disk, not merely in the register', () => {
    // A register row is a claim; the file is the artifact. ADR-0006..ADR-0022.
    const files = existsSync(ADR_DIR) ? readdirSync(ADR_DIR) : [];
    const missing: string[] = [];
    for (let n = 6; n <= 22; n++) {
      const id = `ADR-${String(n).padStart(4, '0')}`;
      if (!files.some((f) => f.startsWith(id))) missing.push(id);
    }
    expect(missing, 'ADR subjects are registered but the records do not exist').toEqual([]);
  });

  it('ADR-0001 to ADR-0005 are preserved', () => {
    // Native §28 and D-36. ADR-0002 is EXTENDED by the egress change, never
    // superseded — the amendment's only direct conflict with a built control.
    const files = existsSync(ADR_DIR) ? readdirSync(ADR_DIR) : [];
    for (let n = 1; n <= 5; n++) {
      const id = `ADR-${String(n).padStart(4, '0')}`;
      expect(
        files.some((f) => f.startsWith(id)),
        `${id} was removed; Native §28 preserves existing ADRs`,
      ).toBe(true);
    }
  });
});

describe('G-27-08 · research is registered, not assumed (SC-AMD-008)', () => {
  it.each(R_AI_IDS)('%s is registered', (id) => {
    expect(
      research.some((r) => r.id === id),
      `Native §26 names ${id} and the register does not carry it`,
    ).toBe(true);
  });

  it('every research item names what it blocks', () => {
    const silent = research.filter((r) => (r.blocks ?? []).length === 0).map((r) => r.id);
    expect(
      silent.slice(0, 10),
      'a research item that blocks nothing is not a research item, it is a note',
    ).toEqual([]);
  });

  it('every research item names an owner', () => {
    const ownerless = research
      .filter((r) => !r.owner || String(r.owner).trim() === '')
      .map((r) => r.id);
    expect(ownerless.slice(0, 10)).toEqual([]);
  });

  it('every research item carries a status', () => {
    const allowed = ['uninvestigated', 'in-progress', 'answered', 'superseded'];
    const bad = research
      .filter((r) => !allowed.includes(r.status))
      .map((r) => `${r.id}: "${r.status}"`);
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('the register admits how much is uninvestigated', () => {
    // The honest number matters more than a tidy one. If every item were
    // marked answered, the register would be claiming research nobody did.
    const uninvestigated = research.filter((r) => r.status === 'uninvestigated');
    expect(
      uninvestigated.length,
      'every research item is marked resolved, which would mean the research was actually done',
    ).toBeGreaterThan(0);
  });
});

describe('G-27-10 · decisions carry options and an owner (SC-AMD-012)', () => {
  it('the decision register is not empty', () => {
    expect(decisions.length).toBeGreaterThan(0);
  });

  it('every decision offers at least two options', () => {
    // FR-AMD-008: a conflict must be raised as a decision WITH OPTIONS, never
    // resolved silently in favour of either side. One option is a conclusion.
    const thin = decisions
      .filter((d) => (d.options ?? []).length < 2)
      .map((d) => `${d.id} (${(d.options ?? []).length} option(s))`);
    expect(thin.slice(0, 10)).toEqual([]);
  });

  it('every option states its consequence', () => {
    const bare: string[] = [];
    for (const d of decisions) {
      for (const o of d.options ?? []) {
        if (!o.consequence || o.consequence.trim().length < 5) bare.push(`${d.id}: "${o.label}"`);
      }
    }
    expect(
      bare.slice(0, 10),
      'options without consequences present a choice without its trade-offs',
    ).toEqual([]);
  });

  it('every decision names an owner', () => {
    const ownerless = decisions.filter((d) => !d.owner || d.owner.trim() === '').map((d) => d.id);
    expect(ownerless.slice(0, 10)).toEqual([]);
  });

  it('every decision carries a status', () => {
    const allowed = ['open', 'decided', 'blocked', 'subsumed'];
    const bad = decisions
      .filter((d) => !allowed.includes(d.status))
      .map((d) => `${d.id}: "${d.status}"`);
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('NO decision is decided while its blocking research is unanswered', () => {
    // The sharpest assertion in this file. Deciding feels like progress, and
    // the dependency lives in a different register — so this is the one that
    // catches an answer given by assumption rather than by evidence.
    const answered = new Set(
      research.filter((r) => r.status === 'answered').map((r) => r.id),
    );
    const premature: string[] = [];
    for (const d of decisions) {
      if (d.status !== 'decided') continue;
      for (const blocker of d.blocking_research ?? []) {
        if (!answered.has(blocker)) premature.push(`${d.id} decided while ${blocker} is unanswered`);
      }
    }
    expect(
      premature.slice(0, 10),
      'Native §26: do not make unsupported assumptions where research is required',
    ).toEqual([]);
  });

  it('every blocking_research reference points at a registered item', () => {
    const ids = new Set(research.map((r) => r.id));
    const dangling: string[] = [];
    for (const d of decisions) {
      for (const b of d.blocking_research ?? []) {
        if (!ids.has(b)) dangling.push(`${d.id} → ${b}`);
      }
    }
    expect(dangling.slice(0, 10)).toEqual([]);
  });
});
