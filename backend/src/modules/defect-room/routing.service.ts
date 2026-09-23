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
import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError, ValidationFailedError } from '../../core/errors.js';
import {
  CLASSIFICATION_OUTCOMES,
  DESTINATIONS,
  type Classification,
  type ClassificationOutcome,
} from './classification.types.js';
import type { DefectRoomStore, RoutingRow } from './defect-room.store.js';

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

/**
 * `T998p`, `T998r` — the transfer half. `BR-0057`, `FR-DFR-070` to
 * `FR-DFR-077`.
 *
 * ## Why this is one service and not two
 *
 * `FR-DFR-077` requires **every** classification outcome to reach a
 * destination, and an item must not be able to rest in a classified state with
 * nowhere to go. Two services — one for the Change Room, one for the
 * Requirement Room — would let one of them quietly not, and the missing half
 * would be invisible: each would pass its own tests, and the outcome neither
 * handled would simply never appear anywhere.
 *
 * ## The offer, and why its reason is required
 *
 * `UX-0034`: *an unexplained transfer button is a reclassification nobody
 * decided.* The person being transferred away from the Defect Room is usually
 * the one who reported the problem, and an offer arriving with no reason
 * teaches them that reports get moved elsewhere. The next one is not filed.
 *
 * ## Nothing is recorded as routed on the strength of having tried
 *
 * `SC-DFR-010`. A defect recorded as routed to the Change Room, with nothing in
 * the Change Room, is the worst state available: this Room believes somebody
 * else has it, nobody does, and nobody is looking, because everybody who could
 * has been told it is handled.
 */

/** `FR-DFR-071` — what `EPIC-034` is handed. Names match `DefectTransferInput`. */
export interface DefectTransferRequest {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly roomObjectId: string;
  readonly targetBaselineId: string;
  readonly targetBaselineVersion: number;
  readonly requestedOutcome: string;
  readonly reason: string;
  readonly requester: string;
  /** `FR-DFR-071` — the origin, visible from the resulting Change Request. */
  readonly originDefectRef: string;
  readonly evidenceRefs: readonly string[];
  readonly contextRefs: readonly string[];
}

/**
 * `EPIC-034`'s intake, named after its own method.
 *
 * A port invented with different words is one that has to be re-agreed the day
 * the real surface is bound. The joint test in `defect-room-transfer.spec.ts`
 * passes this Room's payload straight into
 * `ChangeIntakeService.fromDefectTransfer`, so a divergence fails to compile
 * rather than being discovered by somebody wiring it up later.
 */
export interface ChangeIntakePort {
  fromDefectTransfer(input: DefectTransferRequest): Promise<{ readonly id: string }>;
}

/** `FR-DFR-076` — `EPIC-033`'s gap intake, named after `GapIntakeCommand`. */
export interface GapIntakeRequest {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly roomObjectId: string;
  /** The retained, reclassified defect. Context and evidence hang off it. */
  readonly defectId: string;
  readonly text: string;
}

export interface RequirementIntakePort {
  gapIntake(input: GapIntakeRequest): Promise<{ readonly id: string }>;
}

export interface RoutingPorts {
  readonly changeIntake?: ChangeIntakePort | undefined;
  readonly requirementIntake?: RequirementIntakePort | undefined;
}

/** The state in which an offer is still awaiting an answer. */
const OPEN_STATES = new Set(['offered']);

/**
 * `FR-DFR-075` — outcomes that may not be fixed as defects.
 *
 * Exported so the rule has one definition and the enforcement can live where
 * fixes are accepted. A second copy in `defect-test.service.ts` would be the
 * `DEF-034-001` shape: two artifacts agreeing until one of them is edited.
 */
export const NOT_FIXABLE_AS_A_DEFECT: readonly ClassificationOutcome[] = [
  'change-request',
  'requirement-gap',
];

/**
 * Why a fix must be refused, or `null` when it may proceed.
 *
 * `FR-DFR-075`, `SC-DFR-003`: zero items whose requested behaviour alters
 * intent are closed as defect fixes. The check reads the **current**
 * classification, so a reclassification resolving the item back to a confirmed
 * defect unblocks it — which is what reclassifying is for.
 */
export function fixBlockFor(current: Classification | null): string | null {
  if (!current) return null;
  if (!NOT_FIXABLE_AS_A_DEFECT.includes(current.outcome)) return null;
  return current.outcome === 'change-request'
    ? 'this defect was classified as a change request, and a change to intent is not fixed here ' +
        '— transfer it at POST /rooms/defect/:id/transfer (FR-DFR-075, SC-DFR-003)'
    : 'this defect was classified as a requirement gap: there is no approved behaviour to ' +
        'restore, so there is nothing here to fix — route it at POST /rooms/defect/:id/route-gap ' +
        '(FR-DFR-075, FR-DFR-076)';
}

export interface DeclineTransferInput {
  readonly workspaceId: string;
  readonly defectId: string;
  readonly routingId: string;
  readonly declinedReason: string;
  readonly declinedBy: string;
  readonly now?: Date;
}

export interface DeliverTransferInput {
  readonly workspaceId: string;
  readonly defectId: string;
  readonly projectId: string;
  readonly roomObjectId: string;
  readonly targetBaselineId: string;
  readonly targetBaselineVersion: number;
  readonly requestedOutcome: string;
  readonly requester: string;
  /** Defaults to the offer's stated reason, which is the same fact. */
  readonly reason?: string;
  readonly now?: Date;
}

export interface RecordReturnInput {
  readonly workspaceId: string;
  readonly defectId: string;
  readonly routingId: string;
  readonly refusalDetail: string;
  readonly returnedBy: string;
}

export interface RouteGapInput {
  readonly workspaceId: string;
  readonly defectId: string;
  readonly projectId: string;
  readonly roomObjectId: string;
  /** The behaviour that has no requirement, as new intent. */
  readonly text: string;
  readonly routedBy: string;
  readonly now?: Date;
}

export interface OfferTransferInput {
  readonly workspaceId: string;
  readonly defectId: string;
  readonly offeredReason: string;
  readonly offeredBy: string;
  readonly evidenceRefs?: readonly string[];
  readonly now?: Date;
}

export class DefectRoutingService {
  constructor(
    private readonly store: DefectRoomStore,
    private readonly ports: RoutingPorts = {},
  ) {}

  /** `FR-DFR-070`, `FR-DFR-072` — offer the transfer, and say why. */
  async offerTransfer(input: OfferTransferInput): Promise<RoutingRow> {
    const classification = await this.classified(input.workspaceId, input.defectId);

    if (classification.outcome !== 'change-request') {
      throw new ValidationFailedError(
        classification.outcome === 'requirement-gap'
          ? 'a requirement gap has no approved baseline to change, and that absence is what ' +
            'makes it a gap — route it to EPIC-033 instead (FR-DFR-076)'
          : `this defect is classified ${classification.outcome}, which stays in this Room; only ` +
            'a change request transfers (FR-DFR-070)',
      );
    }

    const reason = input.offeredReason.trim();
    if (reason === '') {
      throw new ValidationFailedError(
        'a transfer states why it is being offered — an unexplained transfer button is a ' +
          'reclassification nobody decided (FR-DFR-072, UX-0034)',
      );
    }

    const open = await this.openOffer(input.workspaceId, input.defectId);
    if (open) {
      // Two open offers for one defect are two people being asked the same
      // question, and the answers can disagree.
      throw new ConflictError(
        `this defect already has an open transfer offer (${open.id}) awaiting an answer`,
      );
    }

    return this.store.recordRouting({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      defectId: input.defectId,
      classificationId: classification.id,
      destination: 'change-room',
      offeredReason: reason,
      // An offer is a question put to a person, not a delivery. Recording it as
      // routed would leave this Room believing the Change Room has an item it
      // has never been shown (`SC-DFR-010`).
      state: 'offered',
      declinedAt: null,
      declinedReason: null,
      refusalDetail: null,
      carriedEvidenceRefs: input.evidenceRefs ?? [],
      targetRef: null,
      createdAt: input.now ?? new Date(),
    });
  }

  /**
   * `FR-DFR-073` — the offer stands, and the decline is recorded beside it.
   *
   * Both halves. Keeping only the decline loses why anyone thought a transfer
   * was right; keeping only the offer loses that somebody looked and said no.
   * Six months later the difference between *"nobody considered this"* and
   * *"we considered it and declined"* is the entire content of the record.
   */
  async declineTransfer(input: DeclineTransferInput): Promise<RoutingRow> {
    const routing = await this.openRouting(input.workspaceId, input.defectId, input.routingId);

    const reason = input.declinedReason.trim();
    if (reason === '') {
      throw new ValidationFailedError(
        'a declined transfer states why, so the decline is an answer rather than the offer ' +
          'disappearing (FR-DFR-073)',
      );
    }

    return this.store.declineRouting(
      input.workspaceId,
      routing.id,
      reason,
      input.now ?? new Date(),
    );
  }

  /**
   * `FR-DFR-071`, `FR-DFR-074`, `SC-DFR-010` — hand it to `EPIC-034`.
   *
   * The record is written from what the Change Room **answered**, never from
   * what was attempted. A refusal is recorded before it is re-thrown, so the
   * item is not lost even if nothing catches the error: the state reached by
   * doing nothing is a defect sitting there saying "transferred", with nothing
   * at the other end.
   */
  async deliverTransfer(input: DeliverTransferInput): Promise<RoutingRow> {
    const open = await this.openOffer(input.workspaceId, input.defectId);
    if (!open) {
      // The offer is the record that a person was asked. Delivering without one
      // makes the transfer something the system did rather than something
      // somebody decided.
      throw new ConflictError(
        'there is no open transfer offer for this defect; offer one at ' +
          'POST /rooms/defect/:id/transfer first (FR-DFR-072)',
      );
    }

    if (input.targetBaselineId.trim() === '') {
      // Not defaulted from the defect's contested artifact. A change raised
      // against a baseline nobody named is one nobody chose, and the Change
      // Room would record it as though somebody had.
      throw new ValidationFailedError(
        'a transfer names the baseline the change is against (FR-CHR-010); it is not inferred ' +
          'from the artifact the defect contested',
      );
    }

    if (!this.ports.changeIntake) {
      throw new ValidationFailedError(
        'no change intake is bound (EPIC-034 supplies it at POST /rooms/change/requests), so ' +
          'this transfer has nowhere to arrive and is not recorded as routed (SC-DFR-010)',
      );
    }

    const transfer: DefectTransferRequest = {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      roomObjectId: input.roomObjectId,
      targetBaselineId: input.targetBaselineId.trim(),
      targetBaselineVersion: input.targetBaselineVersion,
      requestedOutcome: input.requestedOutcome,
      // The offer already stated why. Restating it in a second field is how the
      // two come to disagree.
      reason: input.reason ?? open.offeredReason,
      requester: input.requester,
      originDefectRef: input.defectId,
      evidenceRefs: open.carriedEvidenceRefs,
      // References into this Epic. The reproduction context stays here and is
      // reached through them, rather than copied into another Epic's register.
      contextRefs: await this.contextRefs(input.workspaceId, input.defectId),
    };

    let created: { readonly id: string };
    try {
      created = await this.ports.changeIntake.fromDefectTransfer(transfer);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown error';
      // Recorded first, then re-thrown. `FR-DFR-074`: the item returns carrying
      // the refusal and is not lost between two Rooms.
      await this.store.refuseRouting(input.workspaceId, open.id, detail);
      throw new ConflictError(
        `the Change Room refused this transfer and it has returned here with the refusal ` +
          `attached: ${detail} (FR-DFR-074)`,
      );
    }

    const accepted = await this.store.acceptRouting(input.workspaceId, open.id, created.id);
    await this.store.setDefectState(input.workspaceId, input.defectId, 'routed');
    return accepted;
  }

  /**
   * `FR-DFR-074` — a refusal raised elsewhere, brought back here.
   *
   * `EPIC-034`'s `TransferRefusedError` carries `returnTo: 'EPIC-035'` and the
   * defect id for exactly this: the Change Room can refuse a transfer this Room
   * did not deliver in-process, and the refusal still has to land somewhere.
   */
  async recordReturn(input: RecordReturnInput): Promise<RoutingRow> {
    const routing = await this.requireRouting(
      input.workspaceId,
      input.defectId,
      input.routingId,
    );

    const detail = input.refusalDetail.trim();
    if (detail === '') {
      throw new ValidationFailedError(
        'a returned transfer carries the refusal detail; without it the Defect Room knows only ' +
          'that something went wrong somewhere else (FR-DFR-074)',
      );
    }

    return this.store.returnRouting(input.workspaceId, routing.id, detail);
  }

  /**
   * `FR-DFR-076`, `SC-DFR-010` — a Requirement Gap reaches `EPIC-033` as new
   * intent.
   *
   * No offer step, and that asymmetry is deliberate: a transfer asks somebody
   * whether the item should leave, because declining is a real answer. A gap
   * has nowhere else to go — there is no approved baseline to change, and that
   * absence is what makes it a gap.
   *
   * The defect record is retained and its context stays here; `EPIC-033`
   * reaches the reproduction and evidence through the defect id rather than
   * receiving copies that drift from the record this Epic maintains.
   */
  async routeGap(input: RouteGapInput): Promise<RoutingRow> {
    const classification = await this.classified(input.workspaceId, input.defectId);

    if (classification.outcome !== 'requirement-gap') {
      throw new ValidationFailedError(
        `this defect is classified ${classification.outcome}, and only a requirement gap routes ` +
          'to the Requirement Room as new intent (FR-DFR-076)',
      );
    }

    const text = input.text.trim();
    if (text === '') {
      throw new ValidationFailedError(
        'a routed gap arrives as new intent, so it states the behaviour that has no requirement ' +
          '(FR-DFR-076)',
      );
    }

    if (!this.ports.requirementIntake) {
      // `R-035-4`, `SC-DFR-010`. The item stays visibly unrouted rather than
      // being marked routed to a destination that never received it.
      throw new ValidationFailedError(
        'no requirement intake is bound (EPIC-033 supplies it at ' +
          'POST /rooms/requirement/gap-intake), so this gap has nowhere to arrive and is not ' +
          'recorded as routed (SC-DFR-010)',
      );
    }

    // Delivered first, recorded after. Deliberately no try/catch: an intake
    // that throws is an outage, and swallowing it here would leave a gap
    // recorded as routed to a Room that never received it.
    const created = await this.ports.requirementIntake.gapIntake({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      roomObjectId: input.roomObjectId,
      defectId: input.defectId,
      text,
    });

    const row = await this.store.recordRouting({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      defectId: input.defectId,
      classificationId: classification.id,
      destination: 'requirement-room',
      // The gap's own reason for leaving. `offeredReason` is NOT NULL, and a
      // routing that could not say why it happened is the same defect
      // `UX-0034` names, one Room over.
      offeredReason:
        'no approved behaviour exists for the contested artifact, so this is new intent rather ' +
        'than a defect (FR-DFR-076)',
      state: 'accepted',
      declinedAt: null,
      declinedReason: null,
      refusalDetail: null,
      carriedEvidenceRefs: await this.evidenceRefs(input.workspaceId, input.defectId),
      targetRef: created.id,
      createdAt: input.now ?? new Date(),
    });

    // `ADR-0016` — retained and marked reclassified, never deleted.
    await this.store.setDefectState(input.workspaceId, input.defectId, 'routed');
    return row;
  }

  /** `FR-DFR-071` — references into this Epic, through which context is reached. */
  private async contextRefs(workspaceId: string, defectId: string): Promise<readonly string[]> {
    const reproductions = await this.store.reproductionsFor(workspaceId, defectId);
    return [defectId, ...reproductions.map((row) => row.id)];
  }

  private async evidenceRefs(workspaceId: string, defectId: string): Promise<readonly string[]> {
    const reproductions = await this.store.reproductionsFor(workspaceId, defectId);
    return reproductions.flatMap((row) => [...row.evidenceRefs]);
  }

  private async requireRouting(
    workspaceId: string,
    defectId: string,
    routingId: string,
  ): Promise<RoutingRow> {
    const routing = (await this.store.routingsFor(workspaceId, defectId)).find(
      (row) => row.id === routingId,
    );
    if (!routing) throw new NotFoundError('Not found.');
    return routing;
  }

  private async openRouting(
    workspaceId: string,
    defectId: string,
    routingId: string,
  ): Promise<RoutingRow> {
    const routing = await this.requireRouting(workspaceId, defectId, routingId);
    if (!OPEN_STATES.has(routing.state)) {
      throw new ConflictError(
        `this transfer is not open: it is already ${routing.state}, and answering it twice ` +
          'would overwrite the answer somebody gave (FR-DFR-073)',
      );
    }
    return routing;
  }

  protected async openOffer(workspaceId: string, defectId: string): Promise<RoutingRow | undefined> {
    return (await this.store.routingsFor(workspaceId, defectId)).find((row) =>
      OPEN_STATES.has(row.state),
    );
  }

  /** The current classification, or a refusal naming what is missing. */
  protected async classified(workspaceId: string, defectId: string): Promise<Classification> {
    const defect = await this.store.findDefect(workspaceId, defectId);
    // Absent rather than forbidden — a caller learns nothing about a defect it
    // may not see.
    if (!defect) throw new NotFoundError('Not found.');

    const classification = await this.store.currentClassification(workspaceId, defectId);
    if (!classification) {
      // Routing is a consequence of a judgement, so it cannot precede one.
      throw new ValidationFailedError(
        'this defect has not been classified, so there is no outcome to route (FR-DFR-077)',
      );
    }
    return classification;
  }
}
