/**
 * T338b — multi-source intake. `FR-RQR-010`, `R-033-1`, `D-33`.
 * Unit test: `T338a`.
 *
 * Intake turns submitted intent into **candidates**: normalized, labelled, and
 * not requirements. Promotion into `EPIC-007`'s register is a separate step
 * behind a separate seam (`register.adapter.ts`, `T338d`), and this service
 * cannot reach it — it is constructed with the Room's store and nothing else.
 * That is `FR-RQR-002` held by construction rather than by discipline: a
 * service with no register cannot write to one by mistake.
 *
 * **Direct input and a document are the same code path.** A document is
 * segmented on blank lines and each segment becomes a candidate; direct input
 * is one segment. Nothing branches on the kind except the segmentation, so a
 * fix to normalization or labelling cannot land on one and miss the other.
 *
 * **The label is computed, never accepted.** `IntakeCommand` has no `epistemic`
 * member. Intake *records* what a source said — it infers nothing and
 * recommends nothing — so the label is `fact`, always, from one line of code. A
 * caller-supplied label would make intake the way to enter an inference already
 * dressed as a fact, which is `RULE-03` inverted through a parameter.
 *
 * Framework-free (PC-1).
 */
import { randomUUID } from 'node:crypto';
import { NotFoundError, ValidationFailedError } from '../../core/errors.js';
import type { CandidateRow, RequirementRoomStore } from './requirement-room.store.js';

/**
 * How the submitted text is segmented. Not a stored column: `sourceRef` is what
 * identifies the source afterwards (data-model §1).
 */
export type IntakeSourceKind = 'direct' | 'document';

export interface IntakeCommand {
  readonly workspaceId: string;
  readonly projectId: string;
  /** The `EPIC-030` loop object this Room instance governs. */
  readonly roomObjectId: string;
  /** The intake this came from — a document id, an upload ref, a direct entry. */
  readonly sourceRef: string;
  readonly sourceKind?: IntakeSourceKind;
  readonly text: string;
  // No `epistemic`. See the note above.
}

const REQUIRED = ['workspaceId', 'projectId', 'roomObjectId', 'sourceRef', 'text'] as const;

/**
 * T338v — a Requirement Gap routed from the Defect Room. `EPIC-035`
 * `FR-DFR-076`.
 *
 * **No reproduction steps, no evidence, and that is the design.** `FR-DFR-076`
 * requires the defect record to be *retained and marked reclassified, never
 * deleted* — so it still exists, and it is where the reproduction context and
 * the evidence live. `defectId` is the reference through which all of it is
 * reachable. Copying any of it here would be a second copy of another Epic's
 * record, drifting from the one `EPIC-035` maintains, which is `D-33`'s
 * reasoning pointed at a different register.
 */
export interface GapIntakeCommand {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly roomObjectId: string;
  /** `EPIC-035`'s retained, reclassified defect record. */
  readonly defectId: string;
  /** The behaviour that has no requirement — as new intent. */
  readonly text: string;
}

const GAP_REQUIRED = ['workspaceId', 'projectId', 'roomObjectId', 'defectId', 'text'] as const;

/** The scheme that makes a routed gap's origin visible from the candidate. */
const DEFECT_ORIGIN = 'defect-room:';

export function defectOriginRef(defectId: string): string {
  return `${DEFECT_ORIGIN}${defectId}`;
}

/** The defect this candidate came from, or null for intent entered directly. */
export function defectOriginOf(sourceRef: string): string | null {
  return sourceRef.startsWith(DEFECT_ORIGIN) ? sourceRef.slice(DEFECT_ORIGIN.length) : null;
}

/**
 * The same rule `requirement-hash.ts` applies, for the same reason: an
 * incidental re-wrap of a source document is not different intent. Casing is
 * preserved — "SHALL" and "shall" can be a real difference in requirement
 * language.
 */
function normalise(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Blank lines only.
 *
 * Splitting on single newlines would turn every wrapped sentence in a pasted
 * document into its own candidate, and a Room full of sentence fragments is
 * worse than one wall of text: each fragment looks like a requirement somebody
 * can decide on.
 */
function segment(text: string, kind: IntakeSourceKind): string[] {
  const parts = kind === 'document' ? text.split(/\n[ \t]*\n+/) : [text];
  return parts.map(normalise).filter((part) => part.length > 0);
}

export class IntakeService {
  constructor(private readonly store: RequirementRoomStore) {}

  /**
   * `FR-RQR-010` — submitted intent becomes candidates.
   *
   * Refuses rather than returning an empty list for a source that normalized to
   * nothing: `200 []` reads as "your intent is in the Room" to every caller who
   * does not check the length.
   */
  async intake(command: IntakeCommand): Promise<CandidateRow[]> {
    assertComplete(command);
    const kind = command.sourceKind ?? 'direct';
    const segments = segment(command.text, kind);
    if (segments.length === 0) {
      throw new ValidationFailedError(
        `intake from "${command.sourceRef}" produced no text — nothing was recorded`,
      );
    }
    return this.store.createCandidates(
      segments.map((normalizedText) => this.candidate(command, normalizedText)),
    );
  }

  /**
   * T338v — `EPIC-035` `FR-DFR-076`. The inbound half of the Defect Room's
   * third classification outcome.
   *
   * **A gap enters exactly where raw intent enters**, through the same
   * `intake` below, because that is what *"routed to the Requirement Room as
   * new intent"* means: a gap needs a requirement written, not a baseline
   * amended. It is not a special kind of candidate and carries no label of its
   * own — `EPISTEMIC_KINDS` has four members and no fifth (`R-033-4`).
   *
   * The only thing that distinguishes it is `sourceRef`, which names the defect
   * it came from. That is the origin being visible from the candidate, and it
   * is the reference through which the reproduction context and evidence stay
   * reachable without being copied.
   *
   * **Refuses rather than dropping.** `SC-DFR-010` requires zero items resting
   * in a classified state with no destination. An empty success here is exactly
   * that state: `EPIC-035` marks the defect reclassified, nothing is recorded
   * here, and the item is gone with both Epics believing the other has it.
   */
  async gapIntake(command: GapIntakeCommand): Promise<CandidateRow[]> {
    assertGapComplete(command);
    return this.intake({
      workspaceId: command.workspaceId,
      projectId: command.projectId,
      roomObjectId: command.roomObjectId,
      sourceRef: defectOriginRef(command.defectId),
      // Direct: a gap is one statement of missing behaviour, not a document to
      // be segmented. Segmenting it would turn one classified item into several
      // candidates, and `SC-DFR-010` counts items, not candidates.
      sourceKind: 'direct',
      text: command.text,
    });
  }

  private candidate(command: IntakeCommand, normalizedText: string): CandidateRow {
    return {
      id: randomUUID(),
      workspaceId: command.workspaceId,
      projectId: command.projectId,
      roomObjectId: command.roomObjectId,
      sourceRef: command.sourceRef,
      normalizedText,
      // Computed, not read. One line, one value, no branch — see the note above.
      epistemic: 'fact',
      aiAnalysis: null,
      // FR-RQR-002: a candidate is not a requirement until something decides.
      promotedTo: null,
      // FR-RQR-030 — nothing stated yet, and presumed to need something. Both
      // defaults fail closed: the baseline gate blocks on this candidate until
      // somebody either states its criteria or says it is not for
      // implementation. The other way round, a candidate nobody looked at would
      // sail through the gate.
      acceptanceCriteria: null,
      intendedForImplementation: true,
      createdAt: new Date(),
    };
  }

  /**
   * T339b — state a candidate's acceptance criteria, or say it needs none.
   *
   * **Here because intake owns the candidate before anything decides it**, and
   * criteria are part of shaping intent rather than of approving it. The gate
   * that reads them lives in `baseline.service.ts` (`T339b`), which is where
   * `FR-RQR-031`'s refusal belongs.
   *
   * **`measurable` is not decided here, and pretending otherwise would be
   * worse than not checking.** `FR-RQR-030` asks for *measurable* criteria;
   * what a rule can check exactly is that criteria were **stated**, and that is
   * what this enforces. Judging measurability is the analysis half's job and a
   * reviewer's, and `FR-RQR-032`'s recorded exception is the escape for the
   * cases where the judgement goes the other way. A regex claiming to detect
   * measurability would put a heuristic between a requirement and its baseline
   * and call the result a guarantee.
   *
   * No HTTP route yet: `contracts/room-contract.md` §5 does not list one, and
   * this service is callable without one by design (PC-1). Phase 8's Room page
   * is the first thing that needs a transport for it.
   */
  async declareCriteria(input: DeclareCriteriaInput): Promise<CandidateRow> {
    const candidate = await this.store.findCandidateById(input.candidateId);
    // FR-002 / SC-004 — another workspace is indistinguishable from absent.
    if (!candidate || candidate.workspaceId !== input.workspaceId) {
      throw new NotFoundError('Not found.');
    }
    if (input.intendedForImplementation === false) {
      return this.store.setCandidateCriteria(input.candidateId, {
        acceptanceCriteria: null,
        intendedForImplementation: false,
      });
    }
    const stated = (input.acceptanceCriteria ?? []).map((c) => c.trim()).filter((c) => c.length > 0);
    if (stated.length === 0) {
      throw new ValidationFailedError(
        'a candidate intended for implementation states at least one acceptance criterion, or ' +
          'is declared not intended for implementation (FR-RQR-030)',
      );
    }
    return this.store.setCandidateCriteria(input.candidateId, {
      acceptanceCriteria: stated,
      intendedForImplementation: true,
    });
  }
}

export interface DeclareCriteriaInput {
  readonly workspaceId: string;
  readonly candidateId: string;
  /** Omit or pass true for a candidate that will be built. */
  readonly intendedForImplementation?: boolean;
  readonly acceptanceCriteria?: readonly string[];
}

/** Names every missing field at once, so a caller fixes the request in one go. */
export function assertComplete(command: IntakeCommand): void {
  const record = command as unknown as Record<string, unknown> | null | undefined;
  const missing = REQUIRED.filter((field) => {
    const value = record?.[field];
    return typeof value !== 'string' || value.length === 0;
  });
  if (missing.length > 0) {
    throw new ValidationFailedError(`intake requires: ${missing.join(', ')}`);
  }
}

/** T338v — the same refusal shape, naming the Defect Room's fields. */
function assertGapComplete(command: GapIntakeCommand): void {
  const record = command as unknown as Record<string, unknown> | null | undefined;
  const missing = GAP_REQUIRED.filter((field) => {
    const value = record?.[field];
    return typeof value !== 'string' || value.length === 0;
  });
  if (missing.length > 0) {
    throw new ValidationFailedError(
      `a routed Requirement Gap requires: ${missing.join(', ')} — the item was NOT admitted ` +
        '(EPIC-035 FR-DFR-076)',
    );
  }
}
