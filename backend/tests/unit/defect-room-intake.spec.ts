/**
 * `T999` (EPIC-035) — defects arrive from everywhere, and every one links.
 *
 * `FR-DFR-010`, `FR-DFR-011`, `FR-DFR-013`, `SC-DFR-006`. `BR-0051`'s stake:
 * *an unlinked defect is invisible to per-Epic quality accounting.*
 *
 * ## Why six origins and not one text field
 *
 * A free-text `source` column would accept all six and answer none of the
 * questions the Room exists to answer. "Which of our defects were caught by a
 * test and which reached production" is `SC-DFR-008`'s whole subject, and it is
 * unanswerable over a column holding `prod`, `production`, `Production incident`
 * and `PagerDuty`.
 *
 * The vocabulary is read out of the migration rather than restated here.
 * `DEF-034-001` is what a restated vocabulary costs: a constant and a test
 * written minutes apart from one misreading, agreeing with each other and with
 * nothing else. **A second recollection is not a second source.**
 *
 * ## And why `agent` is among them
 *
 * The specification's edge cases accept an AI-filed defect, so `agent` is an
 * origin like the other five. It grants nothing: `FR-DFR-023` still forbids an
 * agent confirming one, which `T999b` proves by composing the two services
 * rather than by asserting it twice.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DefectIntakeService,
  DEFECT_ORIGINS,
  type IntakeInput,
} from '../../src/modules/defect-room/intake.service.js';
import { InMemoryDefectRoomStore } from '../../src/modules/defect-room/defect-room.store.js';
import {
  DefectAnalyticsService,
  InMemoryEscapeStore,
} from '../../src/modules/defect-room/analytics.service.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATION = resolve(
  here,
  '../../prisma/migrations/20260831000000_epic035_defect_room/migration.sql',
);

function room(): {
  store: InMemoryDefectRoomStore;
  escapes: InMemoryEscapeStore;
  subject: DefectIntakeService;
} {
  const store = new InMemoryDefectRoomStore();
  const escapes = new InMemoryEscapeStore();
  return {
    store,
    escapes,
    subject: new DefectIntakeService(store, new DefectAnalyticsService(escapes)),
  };
}

const report = (over: Partial<IntakeInput> = {}): IntakeInput => ({
  workspaceId: 'ws_1',
  projectId: 'pr_1',
  epicId: 'EPIC-999',
  origin: 'manual-report',
  contestedArtifactRef: 'spec_1',
  contestedArtifactVersion: 'v3',
  severity: 'high',
  reportedBy: 'u_1',
  ...over,
});

describe('T999 · all six origins are accepted', () => {
  it.each([...DEFECT_ORIGINS])('accepts %s', async (origin) => {
    // `FR-DFR-010`. Five are named in the requirement; `agent` comes from the
    // specification's edge cases. A Room that accepted only the convenient ones
    // would push the rest into a comment field.
    const { subject } = room();
    const result = await subject.report(report({ origin }));
    expect(result.defect.origin).toBe(origin);
  });

  it('and the six are the six the database will accept', () => {
    // Read from the migration, not restated. The constant and the CHECK are two
    // spellings of one vocabulary, and this is the only place they meet —
    // `DEF-034-001` began as two that never did.
    const sql = readFileSync(MIGRATION, 'utf8');
    const clause = /defect_records_origin_is_known" CHECK \("origin" IN \(([^)]*)\)/s.exec(sql);
    expect(clause, 'the origin CHECK is no longer where this test looks').not.toBeNull();
    const fromSql = [...clause![1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
    expect([...DEFECT_ORIGINS].sort()).toEqual(fromSql.sort());
  });

  it('and refuses one nobody declared', async () => {
    const { subject } = room();
    await expect(subject.report(report({ origin: 'slack-thread' }))).rejects.toThrow(
      /origin/i,
    );
  });

  it('the origin check can fire', () => {
    // The control. Without it, a service refusing every origin would satisfy
    // the assertion above while failing all six of the ones above that.
    expect((DEFECT_ORIGINS as readonly string[]).includes('slack-thread')).toBe(false);
  });
});

describe('T999 · every defect links to an Epic and a project', () => {
  it('records both', async () => {
    // `FR-DFR-011`, `SC-DFR-006`.
    const { subject } = room();
    const result = await subject.report(report());
    expect(result.defect.epicId).toBe('EPIC-999');
    expect(result.defect.projectId).toBe('pr_1');
  });

  it('and a linked defect is not held for triage', async () => {
    const { subject } = room();
    const result = await subject.report(report());
    expect(result.defect.state).toBe('triaged');
    expect(result.heldFor).toBeNull();
  });

  it('but refuses a report with no project at all', async () => {
    // Not held — refused. A defect with no project cannot be stored, let alone
    // found: `projectId` is NOT NULL, and holding it would mean claiming to
    // have recorded something that was never written. The Epic is the link that
    // can legitimately be missing at intake; the project is the context the
    // report arrived in.
    const { subject } = room();
    await expect(subject.report(report({ projectId: '  ' }))).rejects.toThrow(/project/i);
  });

  it.each(['contestedArtifactRef', 'contestedArtifactVersion', 'severity', 'reportedBy'] as const)(
    'and refuses a blank %s',
    async (field) => {
      const { subject } = room();
      await expect(subject.report(report({ [field]: '   ' }))).rejects.toThrow(
        new RegExp(field.replace(/([A-Z])/g, ' $1').split(' ')[0]!, 'i'),
      );
    },
  );
});

describe('T999 · the origin is recorded, and so is the escape row', () => {
  it('writes the escape record at intake', async () => {
    // `FR-DFR-082`, and the reason it happens here: origin and severity are
    // known now. A row written at closure loses every defect still open, which
    // is the first quarter of any real dataset.
    const { escapes, subject } = room();
    const result = await subject.report(report({ origin: 'production-incident' }));
    const row = await escapes.findForDefect('ws_1', result.defect.id);
    expect(row?.origin).toBe('production-incident');
    expect(row?.severity).toBe('high');
  });

  it('with no escape point yet, which is a state somebody can act on', async () => {
    const { escapes, subject } = room();
    const result = await subject.report(report());
    expect((await escapes.findForDefect('ws_1', result.defect.id))?.escapePoint).toBeNull();
  });

  it('and the defect is readable afterwards', async () => {
    const { store, subject } = room();
    const result = await subject.report(report());
    expect((await store.findDefect('ws_1', result.defect.id))?.id).toBe(result.defect.id);
  });

  it('two reports are two defects, never one deduplicated by guess', async () => {
    // Nothing here decides that two reports are the same defect. A Room that
    // merged them on a matching artifact reference would silently discard the
    // second reporter's account of it.
    const { subject } = room();
    const a = await subject.report(report());
    const b = await subject.report(report());
    expect(a.defect.id).not.toBe(b.defect.id);
  });
});
