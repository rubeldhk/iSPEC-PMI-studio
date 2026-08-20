/**
 * T711–T715 · the epic's record agrees with the epic's evidence (Phase 9).
 *
 * Constitution V: these convergence tasks output documents, so this is their
 * executable conformance check. Constitution VI is why it exists at all: the
 * defect records and status documents are the audit trail, and the 2026-08-20
 * convergence run found them CONTRADICTING the delivered, verified code —
 * DEF-028-015 "OPEN, D-28 unowned" after D-28 was delivered; closure.md
 * declaring SC-AGT-001 unmet over a committed PASSED transcript.
 *
 * The rule is coherence, not celebration: every assertion is CONDITIONAL on
 * the transcript's own outcome. If the transcript were regenerated FAILED
 * tomorrow, these assertions go quiet and the documents may honestly say
 * unmet again — the check never forces the record to claim success, only
 * forbids it contradicting the evidence either way.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../..');
const EPIC = 'specs/028-agent-execution-seam';
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');

const transcriptPassed = /\*\*Outcome\*\*:\s*PASSED/.test(read(`${EPIC}/v6-transcript.md`));

/**
 * Strikethrough is the record DISOWNING a claim — the project's convention is
 * "struck rather than deleted", so superseded statements stay visible inside
 * `~~…~~`. Only live text can contradict the evidence.
 */
const live = (text: string): string => text.replace(/~~[\s\S]*?~~/g, '');

describe('T711/T712 · defect records carry their resolution (Constitution VI)', () => {
  it('DEF-028-015 is not OPEN while its fix is delivered and tested', () => {
    if (!transcriptPassed) return;
    const record = read(
      `${EPIC}/defects/DEF-028-015-egress-network-is-checked-for-existence-not-for-what-it-permits.md`,
    );
    expect(
      /\*\*Status\*\*:\s*\*\*OPEN\*\*/.test(record),
      'DEF-028-015 says OPEN, but D-28 was decided and T706 shipped the conformance preflight — ' +
        'a record that stays open after its fix lands breaks the audit trail it exists to keep',
    ).toBe(false);
    expect(record).toMatch(/T706/);
  });

  it('DEF-028-013 is not partially open while both halves are fixed', () => {
    if (!transcriptPassed) return;
    const record = read(
      `${EPIC}/defects/DEF-028-013-read-only-home-and-the-egress-scaffold-tension.md`,
    );
    expect(/the egress tension is open/i.test(record)).toBe(false);
    expect(record).toMatch(/\*\*Status\*\*:\s*\*\*(FIXED|CLOSED|RESOLVED)\*\*/);
  });
});

describe('T713/T714 · status documents do not contradict the transcript', () => {
  it('closure.md does not declare SC-AGT-001 unmet over a PASSED transcript', () => {
    if (!transcriptPassed) return;
    const closure = live(read(`${EPIC}/closure.md`));
    expect(
      /SC-AGT-001`? (is )?(still )?(unmet|NOT satisfied)/i.test(closure),
      'closure.md still declares SC-AGT-001 unmet in LIVE (unstruck) text; the committed ' +
        'transcript says PASSED',
    ).toBe(false);
  });

  it('quickstart-results does not report V6 as NOT RUN over a committed transcript', () => {
    if (!transcriptPassed) return;
    const results = live(read(`${EPIC}/quickstart-results.md`));
    const v6Row = results.split('\n').find((l) => l.startsWith('| **V6**')) ?? '';
    expect(/NOT RUN/.test(v6Row), 'the V6 results row still reads NOT RUN').toBe(false);
    expect(/PASS/.test(v6Row), 'the V6 results row does not record the PASS').toBe(true);
    expect(/SC-AGT-001`?\s*\*?\*?\s*is UNVERIFIED/i.test(results)).toBe(false);
  });
});

describe('T715 · research risks answered by evidence are closed', () => {
  it('R-028-5 is not "not investigated" after two real runs answered it', () => {
    if (!transcriptPassed) return;
    const research = read(`${EPIC}/research.md`);
    const row = research.split('\n').find((l) => l.includes('R-028-5')) ?? '';
    expect(
      /not investigated/i.test(row),
      'R-028-5 still says "not investigated"; the transcript is the investigation',
    ).toBe(false);
  });
});
