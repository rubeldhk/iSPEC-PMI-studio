/**
 * `T997q`, `T997r` (EPIC-035) — every outcome resolves, and nothing is recorded
 * as routed to a destination that refused.
 *
 * `FR-DFR-077`, `SC-DFR-010`.
 *
 * ## The second clause is the one with teeth
 *
 * Resolving an outcome to a destination is a lookup. The failure mode is what
 * happens **after**: the destination refuses — unbound, or it declined the
 * item — and the Room writes `routed` anyway because that is what it set out to
 * do.
 *
 * A defect recorded as routed to the Change Room, with nothing in the Change
 * Room, is the worst available state. The Defect Room believes it is somebody
 * else's problem; nobody else has it; and the record agrees with the Defect
 * Room. `SC-DFR-010` measures zero of those.
 *
 * So resolution and delivery are separate, and the routing record is written
 * from what the destination **answered**, never from what was attempted.
 */
import { describe, expect, it } from 'vitest';
import { CLASSIFICATION_OUTCOMES, DESTINATIONS } from '../../src/modules/defect-room/classification.types.js';
import {
  RoutingResolver,
  type DestinationPort,
} from '../../src/modules/defect-room/routing.service.js';

const accepting = (id = 'cr_9'): DestinationPort => ({
  async deliver() {
    return { accepted: true, referenceId: id };
  },
});

const declining: DestinationPort = {
  async deliver() {
    return { accepted: false, reason: 'the target baseline is superseded' };
  },
};

const resolver = (ports: Partial<Record<string, DestinationPort>> = {}) =>
  new RoutingResolver(ports);

const item = (outcome: (typeof CLASSIFICATION_OUTCOMES)[number]) => ({
  workspaceId: 'ws_1',
  defectId: 'df_1',
  outcome,
  summary: 'the notification fires twice',
});

describe('T997q · every outcome resolves to its mapped destination', () => {
  it.each([...CLASSIFICATION_OUTCOMES])('%s resolves', (outcome) => {
    expect(resolver().destinationFor(outcome)).toBe(DESTINATIONS[outcome]);
  });

  it('and the mapping is the one classification.types declares', () => {
    // Read from the shared constant rather than restated. Two mappings would
    // disagree eventually, and `FR-DFR-077` would then be true of one of them.
    for (const outcome of CLASSIFICATION_OUTCOMES) {
      expect(resolver().destinationFor(outcome)).toBe(DESTINATIONS[outcome]);
    }
  });

  it('an outcome nobody declared has no destination', () => {
    // The control. A resolver answering something for every string would make
    // the three assertions above meaningless.
    expect(() => resolver().destinationFor('invented' as never)).toThrow(/no destination/i);
  });
});

describe('T997q · routing is recorded from what the destination answered', () => {
  it('an accepted delivery records the reference it was given', async () => {
    const routed = await resolver({ 'change-request': accepting('cr_9') }).route(
      item('change-request'),
    );

    // Narrowed rather than cast: the discriminated union is the guarantee, and
    // a test that reached past it would be asserting against a shape the type
    // says cannot exist.
    expect(routed.routed).toBe(true);
    if (!routed.routed) throw new Error('expected a routed record');
    expect(routed.referenceId).toBe('cr_9');
    expect(routed.destination).toBe(DESTINATIONS['change-request']);
  });

  it('a declined delivery is NOT recorded as routed', async () => {
    // `SC-DFR-010`. The state this exists to prevent: the Defect Room believes
    // somebody else has it, nobody else does, and the record agrees with the
    // Defect Room.
    const routed = await resolver({ 'change-request': declining }).route(item('change-request'));

    expect(routed.routed).toBe(false);
    if (routed.routed) throw new Error('expected a refusal');
    expect(routed.reason).toContain('superseded');
    expect(routed).not.toHaveProperty('referenceId');
  });

  it('an unbound destination is not recorded as routed either', async () => {
    // Absent and declined are different causes with the same consequence, and
    // both are refusals. `FR-GEL-062`.
    const routed = await resolver({}).route(item('change-request'));

    expect(routed.routed).toBe(false);
    if (routed.routed) throw new Error('expected a refusal');
    expect(routed.reason).toMatch(/no destination is bound/i);
    expect(routed.reason).toContain('EPIC-034');
  });

  it('and a destination that throws is not recorded as routed', async () => {
    // The third cause. An exception is the one that would otherwise escape and
    // leave the caller to decide, which is where "record it anyway" lives.
    const broken: DestinationPort = {
      async deliver() {
        throw new Error('the intake is unreachable');
      },
    };
    const routed = await resolver({ 'change-request': broken }).route(item('change-request'));

    expect(routed.routed).toBe(false);
    if (routed.routed) throw new Error('expected a refusal');
    expect(routed.reason).toContain('unreachable');
  });

  it('a confirmed defect stays here, and that is a real routing outcome', async () => {
    // The control for the whole set: if every route refused, the assertions
    // above would pass against a resolver that never routes anything.
    const routed = await resolver().route(item('confirmed-defect'));
    expect(routed.routed).toBe(true);
    expect(routed.destination).toBe(DESTINATIONS['confirmed-defect']);
    if (!routed.routed) throw new Error('expected a routed record');
    // The defect is its own reference: it did not go anywhere to be given one.
    expect(routed.referenceId).toBe('df_1');
  });

  it('and it needs no port, because it goes nowhere', async () => {
    // Requiring a port for the outcome that stays would make this Room refuse
    // to keep its own defects.
    expect(await resolver({}).route(item('confirmed-defect'))).toMatchObject({ routed: true });
  });
});

describe('T997q · a requirement gap routes to EPIC-033', () => {
  it('and records the reference that Room gave back', async () => {
    // `T997d`: this stopped being a refusal waiting on nobody when `T338v`
    // landed. The route exists now, so the delivery has somewhere to arrive.
    const routed = await resolver({ 'requirement-gap': accepting('gap_3') }).route(
      item('requirement-gap'),
    );
    expect(routed.routed).toBe(true);
    if (!routed.routed) throw new Error('expected a routed record');
    expect(routed.referenceId).toBe('gap_3');
    expect(routed.destination).toContain('EPIC-033');
  });

  it('and refuses when that Room is unbound, naming it', async () => {
    const routed = await resolver({}).route(item('requirement-gap'));
    expect(routed.routed).toBe(false);
    if (routed.routed) throw new Error('expected a refusal');
    expect(routed.reason).toContain('EPIC-033');
  });
});
