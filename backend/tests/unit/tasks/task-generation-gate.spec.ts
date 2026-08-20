/**
 * T095 — task generation is refused unless the specification is approved.
 * Written to FAIL before T099 exists (Constitution V).
 *
 * FR-020 / US4 scenario 2. The gate is a property of the lifecycle machine:
 * whoever orchestrates generation asks the machine, so the rule cannot fork.
 */
import { describe, expect, it } from 'vitest';
import {
  SPEC_LIFECYCLE_STATES,
  assertTaskGenerationPermitted,
} from '../../../src/modules/specifications/lifecycle.machine.js';
import { SpecificationNotApprovedError } from '../../../src/core/errors.js';

describe('task generation gate (FR-020)', () => {
  it('permits generation from approved — and ONLY approved', () => {
    expect(() => assertTaskGenerationPermitted('approved')).not.toThrow();
  });

  it.each(SPEC_LIFECYCLE_STATES.filter((s) => s !== 'approved'))(
    'refuses generation from %s, naming the required state',
    (state) => {
      const err = ((): unknown => {
        try {
          assertTaskGenerationPermitted(state);
          return null;
        } catch (e) {
          return e;
        }
      })();
      expect(err).toBeInstanceOf(SpecificationNotApprovedError);
      const details = (err as SpecificationNotApprovedError).details as {
        currentState: string;
        requiredState: string;
      };
      expect(details.currentState).toBe(state);
      expect(details.requiredState).toBe('approved');
    },
  );

  it('is the contract error shape — code specification_not_approved (FR-026)', () => {
    try {
      assertTaskGenerationPermitted('draft');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as SpecificationNotApprovedError).code).toBe('specification_not_approved');
    }
  });
});
