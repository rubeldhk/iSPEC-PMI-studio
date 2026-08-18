/**
 * T505 — waiver validation (`FR-ESK-022`, `DF-5`, `DF-6`).
 * Written to FAIL before T511 exists (Constitution V).
 *
 * **Why waivers exist at all.** The clarification session put it plainly: *"a
 * gate with no legitimate exception path is the kind that gets edited rather
 * than obeyed."* Faced with one unresolvable condition and no way through, the
 * realistic response is to weaken the check — quietly, permanently, and for
 * every Epic at once. A waiver makes the exception **narrow, owned, expiring and
 * visible**, which is strictly better than the alternative it replaces.
 *
 * Every rule below exists to stop the exception becoming a second, weaker DOR:
 *
 * - **exactly one condition** — *"waiving one named condition is a decision
 *   someone can review; waiving a gate is a decision nobody can"*;
 * - **an owning role**, from the three governance already defines;
 * - **an expiry**, enforced, because an exception with no end is a rule change
 *   wearing a costume.
 */
import { describe, expect, it } from 'vitest';
import { validateWaiver, type WaiverDeclaration } from './dor';

const TODAY = '2026-08-18';

const VALID: WaiverDeclaration = {
  epic: '014-devops-release',
  condition: 'DOR-09',
  owner: 'tech-lead',
  reason: 'Analysis blocked on the CI rebuild; tasks and tests are complete and reviewed.',
  expires: '2026-09-30',
};

function problems(waiver: unknown, today = TODAY): string[] {
  return validateWaiver(waiver as WaiverDeclaration, { today, epicsOnDisk: ['014-devops-release'] })
    .problems;
}

describe('T505 · a valid waiver', () => {
  it('is accepted', () => {
    expect(problems(VALID)).toEqual([]);
  });

  it('is not expired when its date is in the future', () => {
    const result = validateWaiver(VALID, { today: TODAY, epicsOnDisk: ['014-devops-release'] });
    expect(result.expired).toBe(false);
    expect(result.grantsCover).toBe(true);
  });
});

describe('T505 · DF-5 · exactly one condition', () => {
  it('rejects an array of conditions', () => {
    // "No arrays, no wildcard, no waiver of the DOR."
    expect(problems({ ...VALID, condition: ['DOR-09', 'DOR-08'] }).join(' ')).toMatch(/one condition/i);
  });

  it('rejects a wildcard', () => {
    // Rejected for the same reason as `DOR-99`: it is not a condition in the
    // set. Asserting on the rejection rather than on the wording, so the
    // message can be improved without the test objecting.
    const found = problems({ ...VALID, condition: '*' });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/not in the current DOR set/);
  });

  it('rejects a condition outside the current DOR set', () => {
    // A waiver against `DOR-99` grants cover for nothing and would sit in the
    // register looking like an authorised exception.
    expect(problems({ ...VALID, condition: 'DOR-99' }).join(' ')).toMatch(/DOR-99/);
  });

  it('rejects a missing condition', () => {
    const { condition: _dropped, ...without } = VALID;
    expect(problems(without).join(' ')).toMatch(/condition/i);
  });
});

describe('T505 · the owner is one of the three programme roles', () => {
  it('accepts each role governance already defines', () => {
    for (const owner of ['tech-lead', 'product-owner', 'project-owner']) {
      expect(problems({ ...VALID, owner }), `${owner} was rejected`).toEqual([]);
    }
  });

  it('rejects an owner outside the three', () => {
    expect(problems({ ...VALID, owner: 'me' }).join(' ')).toMatch(/owner/i);
  });

  it('rejects a missing owner', () => {
    const { owner: _dropped, ...without } = VALID;
    expect(problems(without).join(' ')).toMatch(/owner/i);
  });

  it('reads the roles from governance.config.json rather than restating them', () => {
    // `DF-5` is explicit: "read from governance.config.json, not restated here."
    // A second list would drift and authorise owners governance did not.
    const source = readSelf();
    expect(source).not.toMatch(/const\s+ROLES\s*=\s*\[/);
  });
});

describe('T505 · reason and expiry', () => {
  it('rejects a missing or empty reason', () => {
    expect(problems({ ...VALID, reason: '   ' }).join(' ')).toMatch(/reason/i);
  });

  it('rejects a missing expiry', () => {
    // An exception with no end is a rule change wearing a costume.
    const { expires: _dropped, ...without } = VALID;
    expect(problems(without).join(' ')).toMatch(/expir/i);
  });

  it('rejects a malformed expiry', () => {
    expect(problems({ ...VALID, expires: 'next quarter' }).join(' ')).toMatch(/expir/i);
  });

  it('rejects an epic that does not exist on disk', () => {
    expect(problems({ ...VALID, epic: '999-phantom' }).join(' ')).toMatch(/999-phantom/);
  });
});

describe('T505 · DF-6 · expiry is enforced', () => {
  it('marks a past expiry as expired', () => {
    const result = validateWaiver(
      { ...VALID, expires: '2026-08-01' },
      { today: TODAY, epicsOnDisk: ['014-devops-release'] },
    );
    expect(result.expired).toBe(true);
  });

  it('grants NO cover once expired', () => {
    // The Epic ceases to be Ready by any reading.
    const result = validateWaiver(
      { ...VALID, expires: '2026-08-01' },
      { today: TODAY, epicsOnDisk: ['014-devops-release'] },
    );
    expect(result.grantsCover).toBe(false);
  });

  it('treats the expiry date itself as still valid', () => {
    // A waiver expiring today has not yet expired. The alternative makes the
    // last day of an exception unusable and surprises whoever relied on it.
    const result = validateWaiver(
      { ...VALID, expires: TODAY },
      { today: TODAY, epicsOnDisk: ['014-devops-release'] },
    );
    expect(result.expired).toBe(false);
  });

  it('grants no cover when the waiver is invalid, even if unexpired', () => {
    // Invalid and expired are different faults with the same consequence:
    // reported, and granting nothing.
    const result = validateWaiver(
      { ...VALID, owner: 'nobody' },
      { today: TODAY, epicsOnDisk: ['014-devops-release'] },
    );
    expect(result.expired).toBe(false);
    expect(result.grantsCover).toBe(false);
  });
});

/** Read this suite's implementation, to assert a rule about how it is written. */
function readSelf(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { join, dirname } = require('node:path') as typeof import('node:path');
  const { fileURLToPath } = require('node:url') as typeof import('node:url');
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'dor.ts'), 'utf8');
}
