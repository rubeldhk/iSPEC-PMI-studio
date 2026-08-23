/**
 * T337y — the Requirement Room's service seam.
 *
 * PC-1: framework-free. The module wires it; it stays callable without HTTP so
 * an MCP surface can be added in Phase 3 without redesign.
 *
 * **What this is at T338l**: intake, the routed Requirement Gap and the
 * governed baseline are implemented; the rest still refuse. `T337y` built the
 * skeleton so `T337x`'s reachability test had a real graph to resolve and real
 * routes to reach, and Phases 4–7 fill the remainder.
 *
 * A stub returning a plausible success would be the defect this Epic's own
 * reachability test exists to catch, one level down. So each unbuilt operation
 * throws, **naming the task that will implement it** — and those names are
 * maintained: four of them were stale by `T338l` (`clarifications` pointed at
 * `T338j`, which by then meant the concurrent-approval test), and a pointer
 * that resolves to the wrong task is worse than none, because it reads as
 * answered.
 */
import { randomUUID } from 'node:crypto';
import { ValidationFailedError } from '../../core/errors.js';
import type { AnalysisResult, AnalysisService } from './analysis.service.js';
import type {
  ApproveBaselineInput,
  BaselineApproval,
  BaselineService,
} from './baseline.service.js';
import type { AskedQuestion, ClarificationService } from './clarification.service.js';
import type { DecisionService } from './decision.service.js';
import type { OptionsService, PresentedOption, ProposedOption } from './options.service.js';
import { projectReadiness } from './readiness.projection.js';
import type { BaselineReadiness, EvidenceStatus } from './readiness.projection.js';
import type { EvidenceContractSource } from './baseline.service.js';
import type { RequirementRoomStore } from './requirement-room.store.js';
import type {
  GapIntakeCommand,
  IntakeCommand,
  IntakeService,
} from './intake.service.js';
import type { CandidateRow, ClarificationRow, DecisionRow } from './requirement-room.store.js';
import type { ActorRef } from '@pmi/loop-contract';
import type { Labelled } from '@pmi/room-contract';

/** `POST /rooms/requirement/:id/clarifications` — ask a set, or answer one. */
export interface ClarificationRequest {
  readonly workspaceId: string;
  readonly askedBy?: string;
  readonly questions?: readonly AskedQuestion[];
  readonly answer?: { readonly id: string; readonly answer: string; readonly answeredBy: string };
}

/** `GET /rooms/requirement/:id/analysis` — scope from the query, not a body. */
export interface AnalysisQuery {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly correlationId?: string;
}

/** `POST /rooms/requirement/:id/options`. */
export interface OptionsRequest {
  readonly options?: readonly ProposedOption[];
}

/** `POST /rooms/requirement/:id/decide`. */
export interface DecideRequest {
  readonly workspaceId: string;
  readonly objectVersion?: number;
  readonly actor: ActorRef;
  readonly options?: readonly ProposedOption[];
  readonly chosenOptionId: string;
  readonly rationale: string;
}

/** `GET /rooms/requirement/:id/readiness`. */
export interface ReadinessQuery {
  readonly workspaceId: string;
  readonly projectId?: string;
  /**
   * Omit and the Evidence Contract reads as **not evaluated**, which blocks.
   * There is no value meaning "no contract applies" on purpose — that would be
   * a way to report ready by leaving a parameter off.
   */
  readonly evidenceContractRef?: string;
}

export class NotYetImplementedError extends Error {
  constructor(operation: string, task: string) {
    super(`requirement-room.${operation} is declared and not yet implemented — ${task}`);
    this.name = 'NotYetImplementedError';
  }
}

/** Retained as the transport's body type; `IntakeCommand` is the real one. */
export type IntakeInput = IntakeCommand;

export class RequirementRoomService {
  constructor(
    private readonly intakeService: IntakeService,
    private readonly baselines: BaselineService,
    private readonly analysisService: AnalysisService,
    private readonly clarificationService: ClarificationService,
    private readonly optionsService: OptionsService,
    private readonly decisionService: DecisionService,
    private readonly store: RequirementRoomStore,
    /** Absent ⇒ readiness reports the Contract as unevaluated, which blocks. */
    private readonly evidence?: EvidenceContractSource | undefined,
  ) {}

  /** T338b — `FR-RQR-010`. Multi-source intake becomes labelled candidates. */
  intake(input: IntakeCommand): Promise<CandidateRow[]> {
    return this.intakeService.intake(input);
  }

  /**
   * T338v — `EPIC-035` `FR-DFR-076`. A Requirement Gap arrives as new intent.
   *
   * The inbound half of the Defect Room's third classification outcome, and the
   * task `EPIC-035`'s Exit Criterion 5 waits on.
   */
  gapIntake(input: GapIntakeCommand): Promise<CandidateRow[]> {
    return this.intakeService.gapIntake(input);
  }

  /**
   * T338r — `FR-RQR-012`, `FR-RQR-013`. Ask a set, or answer one in place.
   *
   * **Both shapes return the whole set**, not just what changed. `FR-RQR-012`
   * asks for questions *presented as one set*; a response carrying only the row
   * the caller touched would put the job of reassembling the set back on every
   * client, and one of them would get it wrong.
   *
   * *Wired here at `T338t`, which owns Phase 4's controller work. No task names
   * this route on its own, and `contracts/room-contract.md` §5 lists it — a
   * `ClarificationService` nothing can reach would be the unwired-capability
   * defect this Epic cites `EPIC-031`'s `C2` for.*
   */
  async clarifications(
    roomObjectId: string,
    input: ClarificationRequest,
  ): Promise<ClarificationRow[]> {
    if (!roomObjectId) {
      throw new ValidationFailedError('clarifications require a Room object id in the path');
    }
    if (input?.questions) {
      await this.clarificationService.ask({
        workspaceId: input.workspaceId,
        roomObjectId,
        askedBy: input.askedBy ?? '',
        questions: input.questions,
      });
    } else if (input?.answer) {
      await this.clarificationService.answer({
        workspaceId: input.workspaceId,
        id: input.answer.id,
        answer: input.answer.answer,
        answeredBy: input.answer.answeredBy,
      });
    } else {
      throw new ValidationFailedError(
        'a clarification request carries either `questions` to ask or an `answer` to record',
      );
    }
    return this.clarificationService.list(input.workspaceId, roomObjectId);
  }

  /**
   * T338t — `FR-RQR-014`, `FR-RQR-015`. Labelled elements, conflicts and
   * duplicates.
   *
   * Answers whether or not an analysis provider is bound: the deterministic
   * half always runs, and `aiAvailable` says whether the other half did. See
   * `analysis.service.ts` for why that is this Room's one degrading seam.
   */
  analysis(roomObjectId: string, query: AnalysisQuery): Promise<AnalysisResult> {
    if (!roomObjectId) {
      throw new ValidationFailedError('analysis requires a Room object id in the path');
    }
    if (!query?.workspaceId || !query.projectId) {
      throw new ValidationFailedError('analysis requires: workspaceId, projectId');
    }
    return this.analysisService.analyze({
      workspaceId: query.workspaceId,
      projectId: query.projectId,
      roomObjectId,
      correlationId: query.correlationId ?? randomUUID(),
    });
  }

  /**
   * T339r — `FR-RQR-020`–`FR-RQR-022`. Two or more, each a recommendation,
   * none pre-selected.
   *
   * Returns the labelled set. Options are not persisted: `RequirementDecision`
   * records the chosen one and the declined ones, which is what `FR-RQR-023`
   * asks to retain (data-model §4).
   */
  async options(
    roomObjectId: string,
    input: OptionsRequest,
  ): Promise<Labelled<PresentedOption>[]> {
    if (!roomObjectId) {
      throw new ValidationFailedError('options require a Room object id in the path');
    }
    return this.optionsService.present(input?.options ?? []);
  }

  /**
   * T339r — `FR-RQR-040`–`FR-RQR-044`. An authorized human decision.
   *
   * The options are re-presented before deciding, so a decision cannot be taken
   * against a set that would have been refused at `POST .../options` — a
   * single-option "choice", or one whose declined half was never analysed.
   *
   * A policy refusal surfaces as `403` carrying `EPIC-031`'s decision id and
   * explanation, which is what `UX-0033` renders (`FR-RQR-043`).
   */
  async decide(roomObjectId: string, input: DecideRequest): Promise<DecisionRow> {
    if (!roomObjectId) {
      throw new ValidationFailedError('a decision requires a Room object id in the path');
    }
    if (!input?.workspaceId) {
      throw new ValidationFailedError('a decision requires: workspaceId');
    }
    return this.decisionService.decide({
      workspaceId: input.workspaceId,
      roomObjectId,
      objectVersion: input.objectVersion ?? 0,
      actor: input.actor,
      options: this.optionsService.present(input.options ?? []),
      chosenOptionId: input.chosenOptionId,
      rationale: input.rationale,
    });
  }

  /**
   * T338l — `FR-RQR-050`. Freeze the set, through the governed path.
   *
   * `roomObjectId` addresses the Room instance; it is **not** a column on
   * `baselines`. The trace from a baseline back to the intent it came from runs
   * `Baseline.decisionId` → `RequirementDecision.roomObjectId` → the candidates
   * of that Room object, and forward through `Handoff` (`SC-RQR-006`, both
   * directions). Adding a second path from the baseline row would give the same
   * question two answers that can disagree.
   *
   * A refusal comes back as a **value**, not a thrown error — see
   * `BaselineApproval`. The caller gets `{ outcome: 'refused', reason, detail }`
   * and can record it, which is what a governed refusal is for.
   */
  baseline(roomObjectId: string, input: ApproveBaselineInput): Promise<BaselineApproval> {
    if (!roomObjectId) {
      throw new ValidationFailedError('a baseline requires a Room object id in the path');
    }
    return this.baselines.approve(input);
  }

  /** FR-RQR-060 — select a baselined set as specification input. Lands at T403b. */
  handoff(_version: string): Promise<unknown> {
    throw new NotYetImplementedError('handoff', 'T403b');
  }

  /**
   * T339h — `FR-RQR-073`, `UX-0032`. What is blocking, derived on every read.
   *
   * **The decision is `null` until `T339p` records one**, so a set with nothing
   * else outstanding still reports `pending-decision`. That is accurate rather
   * than a placeholder: `FR-RQR-040` requires an authorized human decision, and
   * none has been taken. Reporting `ready` here would be the plausible-success
   * stub this Room's own reachability test exists to catch.
   */
  async readiness(roomObjectId: string, query: ReadinessQuery): Promise<BaselineReadiness> {
    if (!roomObjectId) {
      throw new ValidationFailedError('readiness requires a Room object id in the path');
    }
    if (!query?.workspaceId) {
      throw new ValidationFailedError('readiness requires: workspaceId');
    }
    const [candidates, clarifications] = await Promise.all([
      this.store.listCandidates(query.workspaceId, roomObjectId),
      this.store.listClarifications(query.workspaceId, roomObjectId),
    ]);
    return projectReadiness({
      candidates,
      clarifications,
      // Null when EPIC-032 is unbound or no Contract was named — which BLOCKS.
      // "Cannot tell" is never "ready".
      evidence: await this.evidenceStatus(query),
      decision: null,
    });
  }

  private async evidenceStatus(query: ReadinessQuery): Promise<EvidenceStatus | null> {
    if (!this.evidence || !query.evidenceContractRef || !query.projectId) return null;
    return this.evidence.isSatisfied(query.evidenceContractRef, {
      workspaceId: query.workspaceId,
      projectId: query.projectId,
    });
  }
}
