/**
 * T741 — policy load-time refusal, written to fail first. `FR-DPE-011`,
 * `FR-DPE-012`.
 *
 * The approval burden is tunable per tenant — but **a policy that lowers
 * baseline change, release promotion or loop configuration change is refused
 * when read, naming the action**. Refused at load rather than at use, so a bad
 * policy fails in CI instead of on the first high-risk action in production.
 */
import { describe, expect, it } from 'vitest';
import { PLATFORM_DEFAULT_POLICY, loadPolicy } from '../../src/modules/decision/policy.loader.js';

const base = { ...PLATFORM_DEFAULT_POLICY, version: 3, approvedBy: 'owner' };

describe('T741 · FR-DPE-011 — the burden is tunable', () => {
  it('loads the platform default', () => {
    expect(loadPolicy(PLATFORM_DEFAULT_POLICY)).toMatchObject({ ok: true });
  });

  it('loads a stricter low band — tightening is always allowed', () => {
    expect(loadPolicy({ ...base, bandTreatment: { ...base.bandTreatment, low: 'human-approval' } })).toMatchObject({ ok: true });
  });

  it('loads self-approval for a named action class', () => {
    expect(loadPolicy({ ...base, selfApprovalAllowed: ['docs.*'] })).toMatchObject({ ok: true });
  });
});

describe('T741 · FR-DPE-012 — the high band is not configurable away', () => {
  it.each(['auto-execute', 'gates-required'])('refuses a high band treated as %s, naming the irreducible actions', (treatment) => {
    const loaded = loadPolicy({ ...base, bandTreatment: { ...base.bandTreatment, high: treatment } });
    expect(loaded).toMatchObject({ ok: false, reason: 'lowers-high-band' });
    if (!loaded.ok) {
      expect(loaded.message).toMatch(/release\.promote/);
      expect(loaded.message).toMatch(/loop\.configuration\.change/);
      expect(loaded.message).toMatch(/requirement-room\.baseline/);
    }
  });

  it.each(['release.promote', 'loop.configuration.change', 'release.*'])(
    'refuses an automated action covering %s, naming it',
    (actionPattern) => {
      const loaded = loadPolicy({ ...base, automatedActions: [{ actionPattern, ruleId: 'R-1' }] });
      expect(loaded).toMatchObject({ ok: false, reason: 'automates-high-band' });
      if (!loaded.ok) expect(loaded.message).toMatch(/release\.promote|loop\.configuration\.change/);
    },
  );

  it('refuses a medium band that executes without gates (FR-DPE-010)', () => {
    expect(loadPolicy({ ...base, bandTreatment: { ...base.bandTreatment, medium: 'auto-execute' } })).toMatchObject({
      ok: false,
      reason: 'lowers-medium-band',
    });
  });
});

describe('T741 · malformed policies refuse, never default', () => {
  it.each([
    ['not an object', 'policy'],
    ['no version', { ...base, version: undefined }],
    ['an unknown treatment', { ...base, bandTreatment: { ...base.bandTreatment, low: 'yolo' } }],
    ['no approver', { ...base, approvedBy: '' }],
  ])('refuses %s', (_label, candidate) => {
    expect(loadPolicy(candidate)).toMatchObject({ ok: false, reason: 'malformed' });
  });
});
