/**
 * `T998a`, `T998c`, `T998f` (EPIC-035) — triage. `BR-0052`, `FR-DFR-020`–
 * `FR-DFR-025`.
 *
 * The phase goal states the stake: *without the expectation-verification gate a
 * defect process is an unbudgeted change channel.* Every feature request that
 * arrives labelled "bug" gets built, and nobody ever decided to build it.
 *
 * ## The distinction this service exists to hold
 *
 * **"No approved behaviour exists" and "I could not look" are not the same
 * answer.**
 *
 * The first is a Requirement Gap — a real finding, routed to `EPIC-033`, and
 * often the most valuable thing triage produces. The second is an outage.
 * Treating it as the first files a gap against a requirement that may well
 * exist, and sends somebody to specify behaviour that was specified last year.
 *
 * They are one `catch` block apart, because a reader that is unbound and a
 * reader that found nothing both return nothing. So `BaselineReader` **refuses**
 * when absent, and a reader that throws propagates rather than degrading: this
 * service produces no classification at all rather than the wrong one.
 *
 * ## Reclassification is a new row
 *
 * `FR-DFR-025`, `ADR-0016`. An updated row destroys the same history a deleted
 * one does, more quietly — the record says what it says now, with nothing to
 * show it once said otherwise. That a defect was read differently before is
 * part of how the current reading earned its standing.
 *
 * Framework-free (PC-1).
 */
import { randomUUID } from 'node:crypto';
import { NotFoundError, ValidationFailedError } from '../../core/errors.js';
import {
  DESTINATIONS,
  type Classification,
  type ClassificationOutcome,
} from './classification.types.js';
import type { DefectRoomStore, DefectRow } from './defect-room.store.js';

/**
 * What `EPIC-033` answers.
 *
 * `found: false` is a **finding** — the reader looked and there is no approved
 * behaviour. It is not the shape an absent reader produces, and it must not be:
 * this port throwing or being unbound is a different outcome entirely.
 */
export type ApprovedBehaviour =
  | { readonly found: true; readonly behaviourRef: string; readonly baselineVersion: number }
  | { readonly found: false };

export interface BaselineReaderPort {
  approvedBehaviourFor(input: {
    workspaceId: string;
    artifactRef: string;
    artifactVersion: string;
  }): Promise<ApprovedBehaviour>;
}

export interface TriageInput {
  readonly workspaceId: string;
  readonly defectId: string;
  readonly classifiedBy: string;
  readonly classifiedByKind: string;
  readonly rationale: string;
  /**
   * What the triager judges this to be, when approved behaviour was found.
   *
   * Ignored when none was found: an absence is a requirement gap, and letting a
   * caller override that would make the finding a matter of opinion again.
   */
  readonly proposedOutcome?: ClassificationOutcome;
  readonly proposedByAgent?: boolean;
  // No `reclassifiedFrom` here, deliberately. It sat in this type unread while
  // reclassification had no implementation — an input a caller could set that
  // changed nothing, which is the quietest kind of wrong. Superseding an
  // earlier judgement is `reevaluateAgainstCurrent`, and it finds the row it
  // replaces rather than taking the caller's word for which one that is.
}

export interface TriageResult {
  readonly classification: Classification;
  readonly destination: string;
}

/**
 * `FR-DFR-024` — judge the same defect again, against a version that moved.
 *
 * `currentArtifactVersion` is supplied rather than read from the defect,
 * because the defect deliberately still says what was reported. The caller is
 * asserting *"the artifact is now at this version"*, and that assertion is
 * recorded on the new row so a later reader can tell v7 from v9.
 */
export interface ReevaluateInput {
  readonly workspaceId: string;
  readonly defectId: string;
  readonly currentArtifactVersion: string;
  readonly classifiedBy: string;
  readonly classifiedByKind: string;
  readonly rationale: string;
  readonly proposedOutcome?: ClassificationOutcome;
  readonly proposedByAgent?: boolean;
}

/**
 * The `destination` column's vocabulary, which is not the same as the
 * human-readable `DESTINATIONS` map.
 *
 * The column is CHECKed against three short values in SQL; `DESTINATIONS` names
 * the Epic so a reader knows where a thing went. Two spellings of one fact, and
 * this function is the only place they meet — a second mapping elsewhere is how
 * they would come to disagree.
 */
function destinationColumnFor(outcome: ClassificationOutcome): string {
  return { 'confirmed-defect': 'repair', 'change-request': 'change-room', 'requirement-gap': 'requirement-room' }[
    outcome
  ];
}

/** States in which implementation work has begun or finished. */
const WORK_STARTED = new Set(['repairing', 'verifying', 'closed', 'routed']);

export class TriageService {
  constructor(
    private readonly store: DefectRoomStore,
    private readonly baselines?: BaselineReaderPort | undefined,
  ) {}

  async triage(input: TriageInput): Promise<TriageResult> {
    const defect = await this.open(input);

    const behaviour = await this.readBaseline(
      input.workspaceId,
      defect.contestedArtifactRef,
      // `FR-DFR-024` — asked about the version REPORTED, not the current one.
      defect.contestedArtifactVersion,
    );

    // `null`: judged against the version on the defect, which is where that
    // answer lives.
    const classification = await this.write(defect, behaviour, input, null);
    await this.store.setDefectState(input.workspaceId, defect.id, 'triaged');

    return { classification, destination: DESTINATIONS[classification.outcome] };
  }

  /**
   * `T998f`, `FR-DFR-024`, `FR-DFR-025` — judge it again, against current.
   *
   * The reported version stays exactly where it was. This adds a **second**
   * classification, judged against a version the caller says is now current,
   * and marks the first superseded. Both facts survive: what was observed then,
   * and what is true now.
   *
   * The alternative — quietly re-reading the defect against whatever is current
   * — is `FR-DFR-024`'s "silently re-targeted". If the newer version happens to
   * have fixed the behaviour, that reading closes the defect as *cannot
   * reproduce* against a report that was accurate, and the reporter learns that
   * filing defects is pointless.
   */
  async reevaluateAgainstCurrent(input: ReevaluateInput): Promise<TriageResult> {
    const defect = await this.open(input);

    const previous = await this.store.currentClassification(input.workspaceId, defect.id);
    if (!previous) {
      // Nothing to supersede. Writing this as the first classification would
      // claim a history that did not happen — a re-evaluation of a judgement
      // nobody made.
      throw new ValidationFailedError(
        'this defect has never been classified, so there is nothing to re-evaluate: ' +
          'triage it first (FR-DFR-024)',
      );
    }

    // `null` on the previous row means it judged the reported version.
    const alreadyJudged = previous.evaluatedAgainstVersion ?? defect.contestedArtifactVersion;
    if (alreadyJudged === input.currentArtifactVersion) {
      throw new ValidationFailedError(
        `this defect was already judged against ${alreadyJudged}, so there is nothing to ` +
          're-evaluate: a re-evaluation is against a version that moved (FR-DFR-024)',
      );
    }

    const behaviour = await this.readBaseline(
      input.workspaceId,
      defect.contestedArtifactRef,
      // The whole point of the method: the version that is current NOW.
      input.currentArtifactVersion,
    );

    const classification = await this.write(defect, behaviour, input, input.currentArtifactVersion);

    // Only after the new row exists. A pointer written first would name an id
    // nothing had written, and a failure between the two would leave a row
    // superseded by nothing — which the database CHECK added alongside this
    // method refuses outright. In this order the worst case is two live rows,
    // which is visible and repairable.
    await this.store.markSuperseded(input.workspaceId, previous.id, classification.id, new Date());

    return { classification, destination: DESTINATIONS[classification.outcome] };
  }

  /**
   * What both judgements require before either may proceed: a stated rationale,
   * a defect the caller may see, and work that has not started.
   */
  private async open(input: {
    workspaceId: string;
    defectId: string;
    rationale: string;
  }): Promise<DefectRow> {
    if (input.rationale.trim() === '') {
      throw new ValidationFailedError('a triage states its rationale (FR-DFR-020)');
    }

    const defect = await this.store.findDefect(input.workspaceId, input.defectId);
    // Absent rather than forbidden — a caller learns nothing about a defect it
    // may not see.
    if (!defect) throw new NotFoundError('Not found.');

    if (WORK_STARTED.has(defect.state)) {
      // `SC-DFR-002`. A fix started before the judgement is a change nobody
      // costed, and the judgement afterwards is a formality: nobody unpicks a
      // working fix because triage later called it a change request.
      //
      // The same holds for a re-evaluation, which is why this guard is shared:
      // a second judgement arriving mid-repair is the same unbudgeted change
      // channel, a week later.
      throw new ValidationFailedError(
        `this defect is ${defect.state}: classification happens before implementation work ` +
          'begins (FR-DFR-020, SC-DFR-002)',
      );
    }

    return defect;
  }

  /** Ask `EPIC-033`, and refuse rather than degrade when it cannot be asked. */
  private async readBaseline(
    workspaceId: string,
    artifactRef: string,
    artifactVersion: string,
  ): Promise<ApprovedBehaviour> {
    if (!this.baselines) {
      // Refuse, never degrade. With nothing readable there is no approved
      // behaviour to judge against, and classifying anyway is the opinion
      // `FR-DFR-020` exists to refuse.
      throw new ValidationFailedError(
        'no baseline reader is bound (EPIC-033 supplies it), so there is no approved behaviour ' +
          'to judge this defect against — and "could not look" is not "none exists"',
      );
    }

    // Deliberately not wrapped in a try/catch. A reader that throws is an
    // outage, and swallowing it here would turn it into `found: false` — which
    // is the one mistake this whole service is arranged to prevent.
    return this.baselines.approvedBehaviourFor({ workspaceId, artifactRef, artifactVersion });
  }

  /** The one place a classification row is written, for both judgements. */
  private async write(
    defect: DefectRow,
    behaviour: ApprovedBehaviour,
    input: TriageInput | ReevaluateInput,
    evaluatedAgainstVersion: string | null,
  ): Promise<Classification> {
    const outcome = this.outcomeFor(behaviour, input);
    if (outcome === 'confirmed-defect' && input.classifiedByKind !== 'human') {
      // `FR-DFR-023`, `RULE-03`. An agent may propose; it may not confirm. The
      // database CHECK says the same thing, and this one gives the better
      // message. Shared, so it holds for a re-evaluation too — confirming is
      // confirming whenever it happens.
      throw new ValidationFailedError(
        'an agent may propose a classification and must not confirm a defect (FR-DFR-023); ' +
          `this one claims to be ${input.classifiedByKind}`,
      );
    }

    return this.store.recordClassification({
      id: randomUUID(),
      workspaceId: defect.workspaceId,
      defectId: defect.id,
      outcome,
      // Stored, not derived. A classification that had to be joined to a
      // mapping to say where it goes could rest with nowhere to go while
      // looking complete — which is what `FR-DFR-077` forbids.
      destination: destinationColumnFor(outcome),
      approvedBehaviourRef: behaviour.found ? behaviour.behaviourRef : null,
      // `FR-DFR-021` — the absence is a finding, written down.
      absenceRecorded: !behaviour.found,
      classifiedBy: input.classifiedBy,
      classifiedByKind: input.classifiedByKind,
      proposedByAgent: input.proposedByAgent ?? false,
      supersededByClassificationId: null,
      reclassifiedAt: null,
      evaluatedAgainstVersion,
      rationale: input.rationale.trim(),
      createdAt: new Date(),
    });
  }

  /**
   * `FR-DFR-022` — which of the three.
   *
   * An absence is a **requirement gap**, and the caller cannot override that.
   * Letting a proposed outcome win over a found absence would make the finding
   * a matter of opinion again, which is the whole thing `BR-0052` refuses.
   */
  private outcomeFor(
    behaviour: ApprovedBehaviour,
    input: TriageInput | ReevaluateInput,
  ): ClassificationOutcome {
    if (!behaviour.found) return 'requirement-gap';
    return input.proposedOutcome === 'change-request' ? 'change-request' : 'confirmed-defect';
  }
}
