/**
 * `T2382` (EPIC-048, `FR-LRN-070`, `UX-0003`; T2383 folded in, analysis `V1`) —
 * governed learning adds no navigation area and declares no workflow.
 *
 * Candidate review lives in `EPIC-031`'s Decision Inbox; the knowledge browser
 * inside `EPIC-038`'s Context area (clarified 2026-10-09). Both absences are
 * design decisions, and an absence nobody checks is one somebody adds later by
 * analogy — so they are asserted, along with where the two views do live.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../../..');
const AREAS = join(ROOT, 'frontend', 'src', 'shell', 'areas.ts');
const LEARNING = join(ROOT, 'backend', 'src', 'modules', 'learning');

function strip(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => (statSync(join(dir, e)).isDirectory() ? files(join(dir, e)) : [join(dir, e)]));
}

describe('T2382 · no navigation area (FR-LRN-070)', () => {
  const areas = strip(readFileSync(AREAS, 'utf8'));

  it('areas.ts has no entry owned by EPIC-048', () => {
    expect(areas).not.toMatch(/epic:\s*'[^']*EPIC-048/);
  });

  it('and none for learning or knowledge under another name', () => {
    expect(areas).not.toMatch(/id:\s*'(learning|knowledge)[^']*'/);
    expect(areas).not.toMatch(/path:\s*'\/(learning|knowledge)/);
  });

  it('the two hosts it relies on are areas of their own Epics', () => {
    expect(areas).toMatch(/id:\s*'decision-inbox'[\s\S]*?epic:\s*'EPIC-031'/);
    expect(areas).toMatch(/id:\s*'context'[\s\S]*?epic:\s*'EPIC-038'/);
  });
});

describe('T2382 · no workflow type (FR-LRN-070)', () => {
  it('the learning module declares no workflow type and registers none', () => {
    const offenders = files(LEARNING)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => /workflowType|registerWorkflow|WORKFLOW_TYPE/.test(strip(readFileSync(f, 'utf8'))));
    expect(offenders).toEqual([]);
  });
});

describe('T2382 · the views are where the plan puts them (T2383, folded)', () => {
  it('the candidate detail is an Inbox detail renderer', () => {
    expect(existsSync(join(ROOT, 'frontend', 'src', 'pages', 'inbox-details', 'LearningCandidateDetail.tsx'))).toBe(true);
  });

  it('the knowledge browser is a page the Context area hosts', () => {
    expect(existsSync(join(ROOT, 'frontend', 'src', 'pages', 'KnowledgeBrowser.tsx'))).toBe(true);
  });
});
