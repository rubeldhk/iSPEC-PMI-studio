/**
 * `T1249` (EPIC-038) — an unresolvable status reads *undetermined with a
 * reason*, and there is no path that produces `current` without one.
 *
 * `FR-CTX-044`.
 *
 * ## Two different undetermineds, and why one field holds both
 *
 * *"Nobody has decided whether this is still authoritative"* and *"the baseline
 * reader was unreachable"* are different facts, and `EPIC-035` spent a whole
 * service keeping the equivalent pair apart — *"no approved behaviour exists"*
 * versus *"I could not look"*.
 *
 * Here they collapse into one status **on purpose**, because `FR-CTX-044` asks
 * only that the item not claim to be current, and both cases satisfy that
 * identically. What must not collapse is the *reason*: it is what tells a
 * reader whether to go and ask somebody or go and fix a service.
 *
 * So the reason is required, and the two produce visibly different ones.
 *
 * ## The assertion that matters most
 *
 * Not that `undetermined` appears — that a **default of `current` cannot**.
 * `FR-CTX-044`'s failure mode is silent: an item nobody could resolve, marked
 * current because that was the convenient fallback, read as authority by
 * everything downstream.
 */
import { describe, expect, it } from 'vitest';
import { ProvenanceService } from '../../src/modules/context/provenance.service.js';
import { baselines } from '../helpers/context-fixtures.js';

const source = { sourceType: 'requirement', sourceId: 'rq_1', sourceVersion: 'v3' };

describe('T1249 · a source the reader cannot place is undetermined', () => {
  it('reads undetermined rather than current', async () => {
    const subject = new ProvenanceService(baselines({}));
    const resolved = await subject.resolve('ws_1', source);
    expect(resolved.authoritativeStatus).toBe('undetermined');
  });

  it('with a reason saying nobody has decided', async () => {
    const subject = new ProvenanceService(baselines({}));
    const resolved = await subject.resolve('ws_1', source);
    expect((resolved as { undeterminedReason: string }).undeterminedReason).toMatch(
      /no baseline|not recorded|nobody/i,
    );
  });
});

describe('T1249 · a reader that fails is undetermined too, and says so differently', () => {
  it('does not propagate the outage as a refusal of the whole package', async () => {
    // One unreachable lookup should not lose the other nine items. The package
    // is still worth having; the item is marked and the reader is told.
    const subject = new ProvenanceService({
      async statusOf() {
        throw new Error('the baseline service is unreachable');
      },
    });
    const resolved = await subject.resolve('ws_1', source);
    expect(resolved.authoritativeStatus).toBe('undetermined');
  });

  it('and the reason names the outage rather than a decision nobody made', async () => {
    // The distinction `EPIC-035` built a service around. Here both are
    // undetermined, and only the reason tells a reader whether to chase a
    // person or a service.
    const subject = new ProvenanceService({
      async statusOf() {
        throw new Error('the baseline service is unreachable');
      },
    });
    const resolved = await subject.resolve('ws_1', source);
    const reason = (resolved as { undeterminedReason: string }).undeterminedReason;
    expect(reason).toMatch(/unreachable|could not/i);
    expect(reason).not.toMatch(/nobody has decided/i);
  });

  it('and the two reasons are distinguishable, which is the whole point', async () => {
    const unknown = await new ProvenanceService(baselines({})).resolve('ws_1', source);
    const broken = await new ProvenanceService({
      async statusOf() {
        throw new Error('the baseline service is unreachable');
      },
    }).resolve('ws_1', source);

    expect((unknown as { undeterminedReason: string }).undeterminedReason).not.toBe(
      (broken as { undeterminedReason: string }).undeterminedReason,
    );
  });
});

describe('T1249 · FR-CTX-044 — nothing produces `current` by default', () => {
  it('an empty reader answer never yields current', async () => {
    const subject = new ProvenanceService(baselines({}));
    expect((await subject.resolve('ws_1', source)).authoritativeStatus).not.toBe('current');
  });

  it('a failing reader never yields current', async () => {
    const subject = new ProvenanceService({
      async statusOf() {
        throw new Error('down');
      },
    });
    expect((await subject.resolve('ws_1', source)).authoritativeStatus).not.toBe('current');
  });

  it('and an undetermined result always carries its reason', async () => {
    // A blank reason would satisfy the union's shape and tell a reader nothing,
    // which is the state `FR-CTX-044` is written against.
    for (const reader of [
      baselines({}),
      { async statusOf(): Promise<never> { throw new Error('down'); } },
    ]) {
      const resolved = await new ProvenanceService(reader).resolve('ws_1', source);
      expect((resolved as { undeterminedReason: string }).undeterminedReason.trim().length)
        .toBeGreaterThan(10);
    }
  });

  it('the control: a reader that says current DOES yield current', async () => {
    // Without this, a resolver that returned undetermined for everything would
    // satisfy every assertion in this file.
    const subject = new ProvenanceService(baselines({ 'rq_1@v3': { status: 'current' } }));
    expect((await subject.resolve('ws_1', source)).authoritativeStatus).toBe('current');
  });
});
