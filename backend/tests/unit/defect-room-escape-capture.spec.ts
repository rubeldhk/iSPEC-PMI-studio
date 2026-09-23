/**
 * `T997y`, `T997z` (EPIC-035) — the escape record is written at intake.
 *
 * `FR-DFR-082`. *"The fields must exist from the first defect or the first
 * quarter of data is lost."*
 *
 * ## Why intake and not closure
 *
 * Escape analysis asks *where did this get through?* — and the obvious place to
 * answer it is at closure, when somebody knows. That is also the moment the
 * data stops being collectable for every defect that was closed before the
 * feature shipped, and for every defect still open.
 *
 * Writing the row at intake with `escapePoint` null costs nothing and means the
 * population is complete from the first defect. Adding the column later means
 * the first quarter's defects are permanently outside the analysis, and no
 * amount of care afterwards recovers them.
 *
 * ## `escapePoint` may be null; the row may not
 *
 * The distinction the requirement turns on. A null `escapePoint` says *nobody
 * has determined this yet* — a real, answerable state. A missing row says
 * nothing at all, and is indistinguishable from a defect that escaped nowhere.
 */
import { describe, expect, it } from 'vitest';
import {
  DefectAnalyticsService,
  ESCAPE_POINTS,
  InMemoryEscapeStore,
} from '../../src/modules/defect-room/analytics.service.js';

const intake = (over: Record<string, unknown> = {}) => ({
  workspaceId: 'ws_1',
  defectId: 'df_1',
  origin: 'production-incident',
  severity: 'high',
  ...over,
});

const service = () => {
  const store = new InMemoryEscapeStore();
  return { store, subject: new DefectAnalyticsService(store) };
};

describe('T997y · a row exists from the first defect', () => {
  it('capture writes one', async () => {
    const { store, subject } = service();
    await subject.captureAtIntake(intake());
    expect(await store.findForDefect('ws_1', 'df_1')).not.toBeNull();
  });

  it('with escapePoint null, because nobody has determined it yet', async () => {
    // The state the requirement is about: answerable, and distinguishable from
    // a defect that escaped nowhere.
    const { subject } = service();
    const record = await subject.captureAtIntake(intake());
    expect(record.escapePoint).toBeNull();
  });

  it('carrying the origin and severity the defect was reported with', async () => {
    // `FR-DFR-080`, `FR-DFR-082` — denormalised at intake so the analysis does
    // not depend on the defect record still saying what it said then.
    const { subject } = service();
    const record = await subject.captureAtIntake(intake());
    expect(record.origin).toBe('production-incident');
    expect(record.severity).toBe('high');
  });

  it('and stamped with when it was captured', async () => {
    const { subject } = service();
    const record = await subject.captureAtIntake(intake());
    expect(record.capturedAt).toBeInstanceOf(Date);
  });
});

describe('T997y · what it refuses', () => {
  it('a capture with no origin', async () => {
    // The whole point of capturing at intake is that origin is known then. A
    // blank one would leave a row that cannot answer the question it exists for.
    const { subject } = service();
    await expect(subject.captureAtIntake(intake({ origin: '' }))).rejects.toThrow(/origin/i);
  });

  it('a capture with no severity', async () => {
    const { subject } = service();
    await expect(subject.captureAtIntake(intake({ severity: '  ' }))).rejects.toThrow(/severity/i);
  });

  it('and writes nothing when it refuses', async () => {
    const { store, subject } = service();
    await expect(subject.captureAtIntake(intake({ origin: '' }))).rejects.toThrow();
    expect(await store.findForDefect('ws_1', 'df_1')).toBeNull();
  });

  it('a second capture for one defect', async () => {
    // One-to-one. Two rows would double-count the defect in every escape
    // metric, which is the quietest way to make an analysis wrong.
    const { subject } = service();
    await subject.captureAtIntake(intake());
    await expect(subject.captureAtIntake(intake())).rejects.toThrow(/already/i);
  });
});

describe('T997y · the escape point is set later, and only to a known value', () => {
  it('records one when somebody determines it', async () => {
    const { subject } = service();
    await subject.captureAtIntake(intake());
    const updated = await subject.recordEscapePoint('ws_1', 'df_1', 'review', 'u_1');
    expect(updated.escapePoint).toBe('review');
  });

  it('refuses a point nobody declared', async () => {
    const { subject } = service();
    await subject.captureAtIntake(intake());
    await expect(
      subject.recordEscapePoint('ws_1', 'df_1', 'somewhere' as never, 'u_1'),
    ).rejects.toThrow(/escape point/i);
  });

  it('names eight', () => {
    expect([...ESCAPE_POINTS]).toEqual([
      'requirements',
      'specification',
      'design',
      'implementation',
      'review',
      'test',
      'release',
      'production',
    ]);
  });

  it('and refuses to set one on a defect with no row', async () => {
    // Which cannot happen if capture runs at intake — asserted so that if it
    // ever does, it surfaces rather than creating a row at closure and
    // reintroducing the gap this task exists to close.
    const { subject } = service();
    await expect(subject.recordEscapePoint('ws_1', 'df_missing', 'test', 'u_1')).rejects.toThrow(
      /no escape record/i,
    );
  });
});
