/**
 * `T1559` (EPIC-044) — readiness and waiver validation, moved from
 * `tests/governance/epic-stage/dor.ts` and made pure: the known conditions and
 * the permitted owners are INPUTS, because the package knows no repository.
 * The governance shim supplies them from `governance/`; the product supplies an
 * empty condition set (`FR-EPB-046`). Written to FAIL before `T1560`.
 */
import { describe, expect, it } from 'vitest';
import { resolveReadiness, validateWaiver, type WaiverDeclaration, type WaiverValidation } from '../src/index.js';

const RULES = { knownConditions: ['DOR-01', 'DOR-02', 'DOR-03'], permittedOwners: ['product-owner', 'project-owner', 'tech-lead'] };
const CTX = { today: '2026-09-05', epicsOnDisk: ['007-intake'], ...RULES };
const good: WaiverDeclaration = { epic: '007-intake', condition: 'DOR-02', owner: 'tech-lead', reason: 'the vendor file lands next week', expires: '2026-12-31' };

describe('T1559 · validateWaiver (pure)', () => {
  it('accepts a valid, unexpired waiver and grants cover', () => {
    expect(validateWaiver(good, CTX)).toEqual({ problems: [], expired: false, grantsCover: true });
  });

  it('is not expired on its expiry date, and expired the day after', () => {
    expect(validateWaiver({ ...good, expires: '2026-09-05' }, CTX).expired).toBe(false);
    const late = validateWaiver({ ...good, expires: '2026-09-04' }, CTX);
    expect(late.expired).toBe(true);
    expect(late.grantsCover).toBe(false);
  });

  it('rejects a list of conditions, a wildcard, an unknown condition and a missing one (DF-5)', () => {
    expect(validateWaiver({ ...good, condition: ['DOR-01', 'DOR-02'] as unknown as string }, CTX).problems).toEqual(['a waiver covers exactly one condition, never a list (DF-5)']);
    expect(validateWaiver({ ...good, condition: '*' }, CTX).problems[0]).toMatch(/not in the current DOR set/);
    expect(validateWaiver({ ...good, condition: 'DOR-99' }, CTX).problems[0]).toMatch(/not in the current DOR set/);
    expect(validateWaiver({ ...good, condition: '' }, CTX).problems).toEqual(['waiver names no condition']);
  });

  it('rejects an owner outside the permitted roles, a missing reason, a bad date and an unknown Epic', () => {
    expect(validateWaiver({ ...good, owner: 'intern' }, CTX).problems[0]).toMatch(/not one of product-owner, project-owner, tech-lead/);
    expect(validateWaiver({ ...good, reason: '  ' }, CTX).problems).toEqual(['waiver carries no reason']);
    expect(validateWaiver({ ...good, expires: 'soon' }, CTX).problems[0]).toMatch(/not a YYYY-MM-DD date/);
    expect(validateWaiver({ ...good, epic: '099-nowhere' }, CTX).problems[0]).toMatch(/not an Epic directory on disk/);
    expect(validateWaiver(undefined, CTX)).toEqual({ problems: ['waiver is absent'], expired: false, grantsCover: false });
  });
});

describe('T1559 · resolveReadiness (pure, validator injected)', () => {
  const validate = (waiver: WaiverDeclaration): WaiverValidation => validateWaiver(waiver, CTX);
  const base = { directory: '007-intake', kind: 'delivery' as const, today: '2026-09-05', epicsOnDisk: ['007-intake'] };

  it('a parent design is never evaluated: n/a', () => {
    expect(resolveReadiness({ ...base, kind: 'parent-design', failures: ['DOR-01'], waivers: [] }, validate)).toEqual({ readiness: 'n/a', uncovered: [], blocking: [], reported: [] });
  });

  it('no failures → Ready — which is what an empty customer condition set yields (FR-EPB-046)', () => {
    expect(resolveReadiness({ ...base, failures: [], waivers: [] }, validate).readiness).toBe('Ready');
  });

  it('a failure covered by a valid waiver → Ready (waived); never an unqualified Ready while a waiver is active', () => {
    const result = resolveReadiness({ ...base, failures: ['DOR-02'], waivers: [good] }, validate);
    expect(result.readiness).toBe('Ready (waived)');
    expect(result.uncovered).toEqual([]);
  });

  it('an uncovered failure → Not ready', () => {
    expect(resolveReadiness({ ...base, failures: ['DOR-01', 'DOR-02'], waivers: [good] }, validate)).toMatchObject({ readiness: 'Not ready', uncovered: ['DOR-01'] });
  });

  it('an expired waiver blocks the build (DF-6) and covers nothing', () => {
    const result = resolveReadiness({ ...base, failures: ['DOR-02'], waivers: [{ ...good, expires: '2026-01-01' }] }, validate);
    expect(result.readiness).toBe('Not ready');
    expect(result.blocking[0]).toMatch(/expired 2026-01-01/);
  });

  it('a malformed waiver is reported, not fatal, and covers nothing', () => {
    const result = resolveReadiness({ ...base, failures: ['DOR-02'], waivers: [{ ...good, owner: 'intern' }] }, validate);
    expect(result.readiness).toBe('Not ready');
    expect(result.reported).toHaveLength(1);
    expect(result.blocking).toEqual([]);
  });
});
