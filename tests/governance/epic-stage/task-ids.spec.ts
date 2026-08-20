/**
 * G-26-15 — a task identifier means one task.
 *
 * Every `tasks.md` in this repository states that **task IDs are global and
 * invariant**, and cross-Epic references like `(unit test: T011a)` rely on it: a
 * reference resolves to exactly one line, or it resolves to nothing useful.
 *
 * Nothing checked it. On 2026-08-19 an appended convergence task reused `T696` —
 * once as an open placeholder and once as the completed work — so the same
 * identifier was simultaneously done and not done, and `/speckit-implement`
 * reading the file would have found work that no longer existed. It was noticed
 * by eye while answering "what next", which is not a control.
 *
 * Cheap to check, and the failure mode is silent: two lines that each look
 * correct on their own.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { enumerateEpics } from './derive';

interface TaskLine {
  readonly id: string;
  readonly epic: string;
  readonly text: string;
}

/** Every checklist task line across the corpus, with the Epic that declares it. */
function allTaskLines(): TaskLine[] {
  const found: TaskLine[] = [];
  for (const epic of enumerateEpics()) {
    const path = join('specs', epic.directory, 'tasks.md');
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = /^\s*- \[[xX ]\]\s*(T\d{3}[a-z]?)\b/.exec(line);
      if (match?.[1]) found.push({ id: match[1], epic: epic.id, text: line.trim().slice(0, 90) });
    }
  }
  return found;
}

const EPICS = enumerateEpics();
const TASKS = allTaskLines();

describe('G-26-15 · task identifiers are unique across the corpus (DEF-028-014)', () => {
  it('reads a substantial number of tasks, or this check proves nothing', () => {
    // Anti-vacuity: a regex that silently matched nothing would make the
    // assertion below pass over an empty list forever.
    expect(TASKS.length, 'no task lines were read at all').toBeGreaterThan(200);
  });

  it('declares each task identifier exactly once', () => {
    const seen = new Map<string, TaskLine[]>();
    for (const task of TASKS) {
      seen.set(task.id, [...(seen.get(task.id) ?? []), task]);
    }
    const duplicated = [...seen.entries()].filter(([, lines]) => lines.length > 1);

    expect(
      duplicated.map(([id]) => id),
      duplicated
        .map(
          ([id, lines]) =>
            `${id} declared ${lines.length}× — ${lines.map((l) => `${l.epic}: ${l.text}`).join(' | ')}`,
        )
        .join('\n'),
    ).toEqual([]);
  });

  it('would notice a duplicate that differs only in its checkbox state', () => {
    // The exact shape of the fault: the same id open in one line and complete in
    // another. Asserted directly, because a check keyed on the whole line would
    // treat these as two different tasks and report nothing.
    const sample: TaskLine[] = [
      { id: 'T999', epic: 'EPIC-000', text: '- [ ] T999 do the thing' },
      { id: 'T999', epic: 'EPIC-000', text: '- [X] T999 do the thing, differently worded' },
    ];
    const ids = sample.map((task) => task.id);
    expect(new Set(ids).size, 'the duplicate detection keys on something other than the id').toBe(1);
  });
});

describe('G-26-15 · defect identifiers are unique within their Epic (DEF-028-014)', () => {
  // The same fault as the duplicate task id, and worse: on 2026-08-19 four new
  // defect records were filed as DEF-028-004 … 007 when all four already
  // existed. A reference like `DEF-028-005` then resolved to two different
  // defects — one about a missing entry point, one about a model never
  // requested — and those references live in source comments, task lines and
  // test headers, not just in the folder.
  //
  // Filed under G-26-15 with the task ids because it is one rule: an identifier
  // names one thing.
  const records = EPICS.flatMap((epic) => {
    const dir = join('specs', epic.directory, 'defects');
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((name) => /^DEF-\d{3}-\d{3}/.test(name))
      .map((name) => ({ epic: epic.id, file: name, id: name.slice(0, 11) }));
  });

  it('finds defect records to check, or this proves nothing', () => {
    expect(records.length, 'no defect records were read').toBeGreaterThan(10);
  });

  it('never files two records under one identifier', () => {
    const seen = new Map<string, string[]>();
    for (const record of records) {
      seen.set(record.id, [...(seen.get(record.id) ?? []), record.file]);
    }
    const duplicated = [...seen.entries()].filter(([, files]) => files.length > 1);
    expect(
      duplicated.map(([id]) => id),
      duplicated.map(([id, files]) => `${id} filed ${files.length}× — ${files.join(' | ')}`).join('\n'),
    ).toEqual([]);
  });
});
