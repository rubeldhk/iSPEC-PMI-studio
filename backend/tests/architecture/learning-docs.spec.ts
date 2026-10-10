/**
 * `T2410` (EPIC-048, Constitution V for document outputs; analysis `V2`) — the
 * Epic's documents agree with each other.
 *
 * - every `FR-LRN-0xx` in `spec.md` (62) is cited by at least one task;
 * - every `SC-LRN-00x` (9) by a quickstart scenario or a task;
 * - the plan's merge order and its list of prerequisites owned by other Epics
 *   match `tasks.md`'s;
 * - once `closure.md` exists (`T2417`), PMI-DOC-004 §6.12 names `EPIC-048` as the
 *   owner of `BR-0114`–`BR-0118` and `ADR-0021` reads Decided — **skipped, not
 *   passed,** before then.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '../../..');
const DIR = resolve(REPO, 'specs/048-governed-learning');
const read = (name: string): string => readFileSync(resolve(DIR, name), 'utf8');

const spec = read('spec.md');
const tasks = read('tasks.md');
const plan = read('plan.md');
const quickstart = read('quickstart.md');

/** Each numbered step of a "Required merge order" list → the EPIC and A-ids it names. */
function mergeOrder(doc: string, heading: RegExp): string[][] {
  const start = doc.search(heading);
  expect(start, 'no merge order section').toBeGreaterThanOrEqual(0);
  const body = doc.slice(start).split(/\n#{2,3} /)[0]!.split(/\n(?=\d\. )/).slice(1);
  // A step ends at the first blank line: the prose after the list is not part of step 5.
  return body.map((step) => [...new Set(step.split(/\n\s*\n/)[0]!.match(/EPIC-0\d\d|A-0\d\d-\d/g) ?? [])].sort());
}

describe('T2410 · requirements are all planned', () => {
  const frs = [...new Set(spec.match(/^- \*\*FR-LRN-0\d\d/gm)!.map((s) => s.replace('- **', '')))];

  it('the spec states 62 functional requirements', () => {
    expect(frs).toHaveLength(62);
  });

  it('every FR-LRN is cited by at least one task', () => {
    expect(frs.filter((id) => !tasks.includes(id))).toEqual([]);
  });

  it('every SC-LRN (9) is cited by a quickstart scenario or a task', () => {
    const scs = [...new Set(spec.match(/SC-LRN-00\d/g)!)].sort();
    expect(scs).toHaveLength(9);
    expect(scs.filter((id) => !tasks.includes(id) && !quickstart.includes(id))).toEqual([]);
  });
});

describe('T2410 · plan and tasks agree on what this Epic waits for', () => {
  it('the merge order is the same five steps naming the same Epics and prerequisites', () => {
    const fromPlan = mergeOrder(plan, /## Required merge order/);
    const fromTasks = mergeOrder(tasks, /### Required merge order/);
    expect(fromPlan).toHaveLength(5);
    expect(fromTasks).toEqual(fromPlan);
  });

  it('the prerequisites owned by other Epics are the same five', () => {
    const planned = [...new Set(plan.match(/The five owned by other Epics \(([^)]*)\)/)![1]!.match(/A-0\d\d-\d/g)!)].sort();
    const table = tasks.split('## Prerequisites owned by other Epics')[1]!.split('\n---')[0]!;
    const listed = [...new Set([...table.matchAll(/^\| \*\*`(A-0\d\d-\d)`\*\*/gm)].map((m) => m[1]!))].sort();
    expect(listed).toEqual(planned);
    expect(planned).toEqual(['A-031-1', 'A-031-2', 'A-038-1', 'A-047-1', 'A-047-2']);
  });
});

describe('T2410 · after closure, the owner annotations say EPIC-048 (analysis V2)', () => {
  const closed = existsSync(resolve(DIR, 'closure.md'));

  it.skipIf(!closed)('PMI-DOC-004 §6.12 names EPIC-048 as the owner of BR-0114–BR-0118', () => {
    const brs = readFileSync(resolve(REPO, 'SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md'), 'utf8');
    for (const br of ['BR-0114', 'BR-0115', 'BR-0116', 'BR-0117', 'BR-0118']) {
      const line = brs.split('\n').find((l) => l.includes(br)) ?? '';
      expect(line, br).toMatch(/EPIC-048/);
    }
  });

  it.skipIf(!closed)('ADR-0021 reads Decided', () => {
    expect(readFileSync(resolve(REPO, 'adr/ADR-0021-governed-learning.md'), 'utf8')).toMatch(/Status\W+Decided/i);
  });
});
