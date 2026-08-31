/**
 * `T997r` (EPIC-035) — where a classification goes, and what gets recorded.
 *
 * `FR-DFR-077`, `SC-DFR-010`.
 *
 * ## Resolution and delivery are separate on purpose
 *
 * Resolving an outcome to a destination is a lookup and always succeeds —
 * `DESTINATIONS` is total over the union, so there is no outcome without a
 * place to go.
 *
 * Delivery is the part that can fail, and the failure mode is what happens
 * next: the destination refuses — unbound, or it declined the item — and the
 * Room writes `routed` anyway, because that is what it set out to do.
 *
 * A defect recorded as routed to the Change Room, with nothing in the Change
 * Room, is the worst available state. This Room believes somebody else has it,
 * nobody else does, and the record agrees with this Room. Nobody is looking for
 * it, because everyone who could has been told it is handled.
 *
 * So the routing record is written from what the destination **answered**,
 * never from what was attempted. `SC-DFR-010` measures zero items routed to a
 * destination that refused or was absent.
 *
 * Framework-free (PC-1).
 */
import {
  CLASSIFICATION_OUTCOMES,
  DESTINATIONS,
  type ClassificationOutcome,
} from './classification.types.js';

/** What a destination answers. Never a boolean: a refusal carries its reason. */
export type DeliveryOutcome =
  | { readonly accepted: true; readonly referenceId: string }
  | { readonly accepted: false; readonly reason: string };

export interface DestinationPort {
  deliver(item: RoutableItem): Promise<DeliveryOutcome>;
}

export interface RoutableItem {
  readonly workspaceId: string;
  readonly defectId: string;
  readonly outcome: ClassificationOutcome;
  readonly summary: string;
}

export type RoutingRecord =
  | {
      readonly routed: true;
      readonly destination: string;
      /** What the destination called the thing it created. */
      readonly referenceId: string;
    }
  | {
      readonly routed: false;
      readonly destination: string;
      readonly reason: string;
    };

/**
 * The one outcome that needs no port: it does not leave.
 *
 * Requiring a destination port for the outcome that stays would make this Room
 * refuse to keep its own defects — which is the opposite of what routing is
 * for.
 */
const STAYS_HERE: ClassificationOutcome = 'confirmed-defect';

export class RoutingResolver {
  constructor(private readonly ports: Partial<Record<string, DestinationPort>> = {}) {}

  /**
   * `FR-DFR-077` — the destination an outcome maps to.
   *
   * Throws for an outcome nobody declared rather than answering something. A
   * resolver that had an answer for every string would make the mapping
   * decorative.
   */
  destinationFor(outcome: ClassificationOutcome): string {
    if (!(CLASSIFICATION_OUTCOMES as readonly string[]).includes(outcome)) {
      throw new Error(`no destination for outcome "${String(outcome)}" (FR-DFR-077)`);
    }
    return DESTINATIONS[outcome];
  }

  /**
   * Deliver, and record what came back.
   *
   * Three ways delivery fails — unbound, declined, threw — and all three
   * produce `routed: false` with the reason. They are different causes with the
   * same consequence, and the consequence is what the record has to say.
   */
  async route(item: RoutableItem): Promise<RoutingRecord> {
    const destination = this.destinationFor(item.outcome);

    if (item.outcome === STAYS_HERE) {
      return { routed: true, destination, referenceId: item.defectId };
    }

    const port = this.ports[item.outcome];
    if (!port) {
      return {
        routed: false,
        destination,
        reason: `no destination is bound for ${item.outcome} (${destination} supplies it), so ` +
          'this item has not been routed anywhere and is not recorded as routed (SC-DFR-010)',
      };
    }

    let outcome: DeliveryOutcome;
    try {
      outcome = await port.deliver(item);
    } catch (error) {
      // Caught here rather than left to the caller. An exception escaping is
      // exactly where "record it anyway and move on" gets written.
      return {
        routed: false,
        destination,
        reason: `the destination could not be reached: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      };
    }

    return outcome.accepted
      ? { routed: true, destination, referenceId: outcome.referenceId }
      : { routed: false, destination, reason: outcome.reason };
  }
}
