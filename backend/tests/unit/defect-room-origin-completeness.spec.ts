/**
 * `T999e` (EPIC-035) — the chart that lies by arithmetic.
 *
 * `FR-DFR-083`, `BR-0163`, `U-19`.
 *
 * ## The failure this exists to prevent
 *
 * The origin distribution shows four sources and their counts. Every number in
 * it is correct. Nobody is lying, no code is wrong, and the conclusion a reader
 * draws — *"almost nothing reaches production"* — is false, because
 * telemetry-originated linkage is unowned (`BR-0163`, `U-19`) and the defects
 * production would have contributed were never linked to anything.
 *
 * A chart does not have to contain a false number to mislead. It only has to
 * present a partial population as a whole one, and a distribution is read as a
 * whole one by default — that is what a percentage means.
 *
 * ## Why the note is a required field and not a caption
 *
 * `complete` is typed `false` with **no `true` arm**. Not a boolean somebody
 * sets, not an optional string a renderer might skip: a caller cannot construct
 * a complete distribution because the type has no such shape, and a renderer
 * cannot forget the note because the field is not optional.
 *
 * This is the shape `EPIC-034` used for `violationCheck: { status: 'not-run' }`,
 * for the same reason. When `BR-0163` gets an owner, adding the `true` arm is a
 * deliberate edit that shows up in review — rather than a `false` quietly
 * flipping in a config nobody reads.
 */
import { describe, expect, it } from 'vitest';
import {
  DefectAnalyticsService,
  InMemoryEscapeStore,
} from '../../src/modules/defect-room/analytics.service.js';

async function seeded(): Promise<DefectAnalyticsService> {
  const subject = new DefectAnalyticsService(new InMemoryEscapeStore());
  await subject.captureAtIntake({
    workspaceId: 'ws_1',
    defectId: 'df_1',
    origin: 'monitoring',
    severity: 'high',
  });
  await subject.captureAtIntake({
    workspaceId: 'ws_1',
    defectId: 'df_2',
    origin: 'automated-test',
    severity: 'low',
  });
  return subject;
}

describe('T999e · the distribution states what it cannot see', () => {
  it('carries a completeness note', async () => {
    const result = await (await seeded()).distribution('ws_1');
    expect(result.completeness).toBeDefined();
  });

  it('which says it is not complete', async () => {
    // `FR-DFR-083`. Not "may be incomplete" — it is incomplete, and the Room
    // knows exactly which source is missing.
    const result = await (await seeded()).distribution('ws_1');
    expect(result.completeness.complete).toBe(false);
  });

  it('naming telemetry-originated linkage as the missing source', async () => {
    const result = await (await seeded()).distribution('ws_1');
    expect(result.completeness.missing.join(' ')).toMatch(/telemetry/i);
  });

  it('and naming who owes it, so the gap is chaseable', async () => {
    // `BR-0163` and `U-19`. A note saying "some data may be missing" tells a
    // reader to distrust the chart and nothing else. Naming the unowned
    // capability turns it into something somebody can pick up.
    const result = await (await seeded()).distribution('ws_1');
    const text = `${result.completeness.missing.join(' ')} ${result.completeness.because}`;
    expect(text).toMatch(/BR-0163/);
    expect(text).toMatch(/U-19/);
  });

  it('in words a reader can act on, not a flag', async () => {
    const result = await (await seeded()).distribution('ws_1');
    expect(result.completeness.because.length).toBeGreaterThan(40);
  });
});

describe('T999e · the note cannot be lost', () => {
  it('is present even when the counts are', async () => {
    // The failure mode is not an empty chart — it is a full one. A note that
    // only appeared when there was nothing to show would be missing from every
    // chart anybody actually reads.
    const result = await (await seeded()).distribution('ws_1');
    expect(result.total).toBeGreaterThan(0);
    expect(result.byOrigin.length).toBeGreaterThan(0);
    expect(result.completeness.complete).toBe(false);
  });

  it('and on an empty workspace too', async () => {
    const subject = new DefectAnalyticsService(new InMemoryEscapeStore());
    const result = await subject.distribution('ws_empty');
    expect(result.completeness.complete).toBe(false);
  });

  it('and it is one note, not one per bucket a caller might filter away', async () => {
    // Attached to the distribution rather than to rows: a per-row note
    // disappears the moment somebody filters, sorts or slices — and slicing is
    // what people do with distributions.
    const result = await (await seeded()).distribution('ws_1');
    for (const bucket of result.byOrigin) {
      expect(Object.keys(bucket).sort()).toEqual(['count', 'key']);
    }
  });

  it('and every origin bucket is a real count, so the note is not standing in for data', async () => {
    // The control. A service that returned the note and no numbers would pass
    // every assertion above while answering nothing.
    const result = await (await seeded()).distribution('ws_1');
    expect(result.byOrigin.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(result.total);
  });
});

describe('T999e · what the note does NOT claim', () => {
  it('does not say the counts are wrong', async () => {
    // They are right. The population is partial — a different thing, and
    // saying "these numbers may be inaccurate" would be false and would teach
    // readers to ignore the note.
    const result = await (await seeded()).distribution('ws_1');
    expect(result.completeness.because).not.toMatch(/inaccurate|wrong|unreliable/i);
  });

  it('and does not guess how much is missing', async () => {
    // Nobody knows. An estimate here would be a number with no source, and it
    // would be quoted as though it had one.
    const result = await (await seeded()).distribution('ws_1');
    expect(result.completeness.because).not.toMatch(/\b\d+\s?%/);
    expect(Object.keys(result.completeness).sort()).toEqual(['because', 'complete', 'missing']);
  });
});
