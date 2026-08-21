/**
 * T279 — an engine without `reviewSpecification` (contract rule E-R5):
 * registration SUCCEEDS; the gate fails AT GATE TIME with a named reason.
 * Written to FAIL before T280 exists (Constitution V). Asserts case C-20 at
 * unit level, per this epic's conformance note.
 */
import { describe, expect, it } from 'vitest';
import {
  PHASE_1_CAPABILITIES,
  assertPhase1Capabilities,
  type EngineDescriptor,
} from '@pmi/engine-contract';
import {
  GateConfigService,
  InMemoryGateStore,
  ReviewCapabilityUnavailableError,
} from '../../../src/modules/reviews/gate-config.service.js';

const NO_REVIEW: EngineDescriptor = {
  name: 'no-review-engine',
  version: '1.0.0',
  capabilities: [...PHASE_1_CAPABILITIES],
};

const WITH_REVIEW: EngineDescriptor = {
  ...NO_REVIEW,
  name: 'reviewing-engine',
  capabilities: [...PHASE_1_CAPABILITIES, 'review_specification'],
};

function build(): GateConfigService {
  return new GateConfigService(new InMemoryGateStore());
}

describe('T279 · E-R5 — review is not a Phase 1 capability', () => {
  it('an engine WITHOUT reviewSpecification still registers successfully (C-20)', () => {
    // The same validation FR-021 registration runs — review is not required.
    expect(() => assertPhase1Capabilities(NO_REVIEW)).not.toThrow();
  });

  it('the gate refuses that engine AT GATE TIME with a named reason', () => {
    const err = (() => {
      try {
        build().assertEngineCanReview(NO_REVIEW);
        return null;
      } catch (e) {
        return e as ReviewCapabilityUnavailableError;
      }
    })();
    expect(err).toBeInstanceOf(ReviewCapabilityUnavailableError);
    expect(err?.message).toMatch(/no-review-engine/);
    expect(err?.message).toMatch(/review_specification/);
  });

  it('an engine WITH the capability passes the gate-time check', () => {
    expect(() => build().assertEngineCanReview(WITH_REVIEW)).not.toThrow();
  });
});
