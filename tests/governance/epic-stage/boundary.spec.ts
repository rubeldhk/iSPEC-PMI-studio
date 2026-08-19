/**
 * T515 · Check `G-26-10` — the register stops where the journey does.
 * Written to FAIL before T518 exists (Constitution V).
 *
 * **`FR-ESK-009`.** The register covers the journey **up to and including Ready
 * to Implement**, and stops. Convergence, defects, closure and promotion are
 * already governed — by Constitution IV, VI and VII, with their own artifacts:
 * `closure.md`, `defects/`, EPIC-014's promotion gate.
 *
 * Restating any of it here would recreate the exact problem this epic exists to
 * remove, one layer along. A register showing "closed" would be a second answer
 * to a question `closure.md` already answers, and the two would disagree the
 * first time one was updated without the other — which is the story of the
 * EPIC-018 task count, told again with different nouns.
 *
 * `DOR-11` reads `defects/` to decide readiness, and that is the boundary
 * working as designed: the register may **consume** governed state to compute a
 * verdict, and may not **restate** it as a column.
 */
import { describe, expect, it } from 'vitest';
import { buildRegister } from './build';
import { renderRegister, type StageRow } from './render';

const REGISTER = buildRegister();

const ROW: StageRow = {
  epic: 'EPIC-014',
  directory: '014-devops-release',
  title: 'DevOps & Release',
  kind: 'delivery',
  stage: 'Tasked',
  posture: null,
  readiness: 'Not ready',
  next: '/speckit-analyze',
};

describe('G-26-10 · the register carries no governed state (FR-ESK-009)', () => {
  it('states no convergence result', () => {
    // Constitution IV owns this, and `closure.md` records it.
    expect(REGISTER).not.toMatch(/\bconverge/i);
    expect(REGISTER).not.toMatch(/unbuilt work/i);
  });

  it('states no defect STATUS, though it may cite a defect (DEF-026-003)', () => {
    // Constitution VI owns defect state; `defects/` is the record. But
    // `FR-ESK-009` requires the register to **reference** the governing artifact
    // where that state is relevant — and a waiver citing the defect that
    // justifies it is exactly such a reference.
    //
    // So: no counts, no status. A bare identifier in a Stage, Posture or
    // Readiness cell is still refused by the render-time guard below.
    expect(REGISTER).not.toMatch(/\bopen defects?\b/i);
    expect(REGISTER).not.toMatch(/\bDEF-\d{3}-\d{3}\b[^\n]*\b(?:is\s+)?(?:OPEN|CLOSED)\b/i);

    // Any citation that does appear must sit in a waivers-table row.
    for (const citation of REGISTER.matchAll(/\bDEF-\d{3}-\d{3}\b/g)) {
      const line = REGISTER.slice(0, citation.index ?? 0).split('\n').pop() ?? '';
      expect(line, `a defect is cited outside a waiver reason: ${citation[0]}`).toMatch(/^\| EPIC-/);
    }
  });

  it('states no closure or release-eligibility', () => {
    // Constitution IX owns this. "CLOSED" in the register would be a second
    // answer to a question `closure.md` already answers.
    expect(REGISTER).not.toMatch(/\bCLOSED\b/);
    expect(REGISTER).not.toMatch(/release-eligible/i);
    expect(REGISTER).not.toMatch(/closing report/i);
  });

  it('states no promotion state', () => {
    // Constitution VII owns this, gated separately by EPIC-014 F-11.2.
    expect(REGISTER).not.toMatch(/\blocal\s*→\s*dev\b/);
    expect(REGISTER).not.toMatch(/\bpromot/i);
  });

  it('stops at Ready to Implement', () => {
    // The last thing the register says about an Epic is that implementation may
    // begin. What happens afterwards is somebody else's artifact.
    const stages = [...REGISTER.matchAll(/^\| \[EPIC-\d{3}\][^|]*\|[^|]*\|[^|]*\| ([^|]+) \|/gm)].map(
      (match) => match[1]?.trim(),
    );
    const permitted = [
      'Specified',
      'Clarified',
      'Checklisted',
      'Planned',
      'Tasked',
      'Analyzed',
      'Ready',
      'Unspecified',
    ];
    for (const stage of stages) {
      expect(permitted, `stage "${stage}" is past Ready to Implement`).toContain(stage);
    }
  });

  it('references the governing artifact rather than restating it', () => {
    // FR-ESK-009's second half. A reader who wants closure state must be able
    // to find where it lives.
    expect(REGISTER).toMatch(/specs\/026-epic-stage-kanban\//);
  });
});

describe('G-26-10 · the renderer refuses governed state at source (RF-6)', () => {
  it('refuses a row whose stage is a closure state', () => {
    // Enforced in the renderer, not only asserted about the output: a check on
    // the output alone would pass for as long as nobody tried, and fail on the
    // day somebody did — after the fact.
    expect(() =>
      renderRegister([{ ...ROW, stage: 'CLOSED' }], [], []),
    ).toThrow(/governed state/i);
  });

  it('refuses a posture that restates a promotion or closure verdict', () => {
    expect(() =>
      renderRegister([{ ...ROW, posture: 'promoted to dev' }], [], []),
    ).toThrow(/governed state/i);
  });

  it('refuses a finding that restates a defect record', () => {
    expect(() =>
      renderRegister([ROW], [{ epic: 'EPIC-014', finding: 'DEF-014-001 is open', severity: 'report' }], []),
    ).toThrow(/governed state/i);
  });

  it('permits ordinary content', () => {
    // The guard must not be so broad that it blocks the register from doing its
    // job — a rule nobody can satisfy gets deleted rather than obeyed.
    expect(() => renderRegister([ROW], [], [])).not.toThrow();
  });
});
