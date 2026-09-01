/**
 * `T1248` (EPIC-038) — a superseded item is marked, and names its successor.
 *
 * `FR-CTX-043`.
 *
 * ## Why this is P1 rather than a nicety
 *
 * A superseded requirement quoted as current is **worse than one not quoted at
 * all**. Omitted, it is a gap somebody may notice. Included and unmarked, it is
 * authority: the model reasons from it, the reviewer reads it as the rule, and
 * nothing in the output distinguishes it from material that still holds.
 *
 * ## And why naming the successor is the load-bearing half
 *
 * *"This is out of date"* tells a reader to stop trusting the item. It does not
 * tell them what to trust instead, so the work stops rather than continuing
 * correctly. Marking without a successor is the half that produces a shrug.
 *
 * The type enforces this — the `superseded` arm cannot exist without
 * `supersededBy` (`T1225`) and the database `CHECK` refuses the row (`T1230`).
 * This file asserts the resolution actually populates it.
 */
import { describe, expect, it } from 'vitest';
import { ProvenanceService } from '../../src/modules/context/provenance.service.js';
import { baselines } from '../helpers/context-fixtures.js';

const source = { sourceType: 'requirement', sourceId: 'rq_1', sourceVersion: 'v3' };

describe('T1248 · superseded material says so', () => {
  it('marks the status superseded', async () => {
    const subject = new ProvenanceService(
      baselines({ 'rq_1@v3': { status: 'superseded', supersededBy: 'rq_1@v5' } }),
    );
    const resolved = await subject.resolve('ws_1', source);
    expect(resolved.authoritativeStatus).toBe('superseded');
  });

  it('and names what replaced it', async () => {
    const subject = new ProvenanceService(
      baselines({ 'rq_1@v3': { status: 'superseded', supersededBy: 'rq_1@v5' } }),
    );
    const resolved = await subject.resolve('ws_1', source);
    expect(resolved).toMatchObject({ supersededBy: 'rq_1@v5' });
  });

  it('and a successor the reader can actually follow', async () => {
    // An opaque token would satisfy the CHECK and tell a person nothing. The
    // successor is the identifier they would use to go and read it.
    const subject = new ProvenanceService(
      baselines({ 'rq_1@v3': { status: 'superseded', supersededBy: 'rq_1@v5' } }),
    );
    const resolved = await subject.resolve('ws_1', source);
    expect((resolved as { supersededBy: string }).supersededBy).toMatch(/rq_1/);
  });

  it('a reader that reports superseded with no successor is refused, not passed through', async () => {
    // The collaborator can be wrong. Accepting a superseded verdict with
    // nothing to point at would put a row into the package that the database
    // then rejects — failing at the write, far from the cause.
    const subject = new ProvenanceService({
      async statusOf() {
        return { status: 'superseded' } as never;
      },
    });
    await expect(subject.resolve('ws_1', source)).rejects.toThrow(/successor|supersededBy/i);
  });
});

describe('T1248 · and the control', () => {
  it('a current source is not marked superseded', async () => {
    // Without this, a resolver that marked everything superseded would satisfy
    // every assertion above.
    const subject = new ProvenanceService(baselines({ 'rq_1@v3': { status: 'current' } }));
    const resolved = await subject.resolve('ws_1', source);
    expect(resolved.authoritativeStatus).toBe('current');
    expect(resolved).not.toHaveProperty('supersededBy');
  });
});
