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
import type { RequirementRegister } from './register.adapter.js';
import { NotFoundError, UnauthenticatedError, ValidationFailedError } from '../../core/errors.js';
import type { AnalysisResult, AnalysisService } from './analysis.service.js';
import type {
  ApproveBaselineInput,
  BaselineApproval,
  BaselineService,
} from './baseline.service.js';
import type { AskedQuestion, ClarificationService } from './clarification.service.js';
import type { DecisionService } from './decision.service.js';
import type { HandoffService } from './handoff.service.js';
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
import type {
  BaselineRow,
  CandidateRow,
  ClarificationRow,
  DecisionRow,
  HandoffRow,
} from './requirement-room.store.js';
import type { ActorRef } from '@pmi/loop-contract';
import type { Labelled } from '@pmi/room-contract';

/**
 * Who is acting, as established by the **session** — never by a request body.
 *
 * `DEF-033-001`: every route used to take its workspace, its approver and its
 * actor kind from the caller. The service checked them and the database
 * constrained them, and both were checking a value the caller had chosen. The
 * fix is not a stronger check; it is a different source.
 */
export interface ActingPrincipal {
  readonly workspaceId: string;
  readonly userId: string;
}

/**
 * The authoritative directory this Room resolves callers against.
 *
 * Structurally satisfied by `EPIC-024`'s `WorkspaceBoundaryService`, which is
 * consumed rather than re-implemented — it already refuses an actor that is
 * unknown, in another workspace, suspended or revoked, and it returns the
 * record rather than echoing what it was handed.
 */
export interface PrincipalResolver {
  requireWithinWorkspace(
    workspaceId: string,
    actorId: string,
  ): Promise<{
    readonly id: string;
    readonly workspaceId: string;
    readonly kind?: 'human' | 'agent' | 'service';
    readonly state?: 'active' | 'suspended' | 'revoked';
  }>;
}

/** What the Room uses after resolution. Nothing here came from a body. */
export interface ResolvedActor {
  readonly workspaceId: string;
  readonly id: string;
  readonly kind: 'human' | 'agent' | 'service';
}

/**
 * `ActorRecord.kind` → `ActorRef.kind`.
 *
 * The two vocabularies differ by one member: the directory says `service`
 * where the loop contract says `automation`. Mapping it to `automation` rather
 * than dropping it keeps a service account **non-human**, which is the only
 * property the decision refusal depends on.
 */
function asActorRef(actor: ResolvedActor): ActorRef {
  const kind = actor.kind === 'service' ? 'automation' : actor.kind;
  return { kind, id: actor.id };
}

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

/** `POST /baselines/:version/handoff`. */
export interface HandoffRequest {
  readonly workspaceId: string;
  /** `(projectId, version)` is the baseline's key; a version alone is ambiguous. */
  readonly projectId: string;
  /** Opaque — this Room does not parse it (`FR-RQR-062`). */
  readonly specificationWorkflowRef: string;
  readonly selectedBy: string;
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


/**
 * `T1167` — the one verb this Room needs from `EPIC-030`.
 *
 * A narrow port rather than `LoopService` itself: the Room declares objects and
 * must not acquire the ability to transition them, which is the authority
 * `DEF-030-003` spent a fix keeping away from callers.
 */
export interface LoopDeclarer {
  declareObject(
    principal: ActingPrincipal,
    input: {
      projectId: string;
      workflowType: string;
      subjectType: string;
      subjectId: string;
    },
  ): Promise<{ objectId: string; workflowType: string }>;
  /**
   * `T1171` — `X20`. Note there is **no workspace parameter**: `EPIC-030`
   * resolves it from the principal, so this Room cannot ask for another
   * workspace's Rooms even by mistake.
   */
  listObjects(
    principal: ActingPrincipal,
    workflowType: string,
  ): Promise<readonly RoomObjectRow[]>;
}

/** The subset of `EPIC-030`'s row the index renders. */
export interface RoomObjectRow {
  readonly id: string;
  readonly projectId: string;
  readonly subjectId: string;
  readonly currentStage: string;
  readonly createdAt: Date;
}

export class RequirementRoomService {
  constructor(
    private readonly intakeService: IntakeService,
    private readonly baselines: BaselineService,
    private readonly analysisService: AnalysisService,
    private readonly clarificationService: ClarificationService,
    private readonly optionsService: OptionsService,
    private readonly decisionService: DecisionService,
    private readonly handoffService: HandoffService,
    private readonly store: RequirementRoomStore,
    /**
     * **Required, not optional** (`T1148`). An absent resolver would mean every
     * route silently falling back to caller-supplied identity — the default-open
     * that `DEF-033-001` is. If it cannot be wired, the Room must not start.
     */
    private readonly principals: PrincipalResolver,
    /** Absent ⇒ readiness reports the Contract as unevaluated, which blocks. */
    private readonly evidence?: EvidenceContractSource | undefined,
    /**
     * `T1167` — `EPIC-030`'s loop, for `openRoom` only.
     *
     * Optional so every existing construction site keeps working, and **refused
     * when absent** rather than skipped: a Room opened without a loop object
     * would be a Room outside the governed loop, which `FR-RQR-001` forbids
     * outright.
     */
    private readonly loop?: LoopDeclarer | undefined,
    /**
     * `T1206` — `EPIC-007`'s register, for promotion only.
     *
     * Optional so existing construction sites keep working, and refused when
     * absent: a candidate promoted without the register would get a
     * `promotedTo` pointing at nothing.
     */
    private readonly register?: RequirementRegister | undefined,
  ) {}

  /**
   * `T1148` — establish who is acting, authoritatively.
   *
   * Every entry point begins here, before any validation of the body. The order
   * matters: validating first would tell an unauthenticated caller which fields
   * a route wants, and `DEF-037-001` showed how readily a route that merely
   * *reaches* its handler is mistaken for one that authenticated its caller.
   *
   * The returned `workspaceId` is the directory's, not the session's copy and
   * not the body's, so nothing downstream can widen scope by naming another.
   */
  private async acting(principal: ActingPrincipal | undefined): Promise<ResolvedActor> {
    if (!principal?.workspaceId || !principal.userId) {
      throw new UnauthenticatedError('No valid session.');
    }
    const actor = await this.principals.requireWithinWorkspace(
      principal.workspaceId,
      principal.userId,
    );
    return { workspaceId: actor.workspaceId, id: actor.id, kind: actor.kind ?? 'human' };
  }

  /** T338b — `FR-RQR-010`. Multi-source intake becomes labelled candidates. */
  /**
   * `T1167` — open a Room and take its first intent, in one call.
   *
   * The endpoint `T1164` found missing. `IntakeCommand` **requires** a
   * `roomObjectId`, so intake has only ever been able to join a Room that
   * already existed; nothing created one, and no screen could start the journey
   * `SC-RQR-008` measures.
   *
   * **The order is the rule.** The intent is validated *before* anything is
   * declared, because `LoopStore` has no delete: a Room declared for intent that
   * then fails to land would exist, contain nothing, and be impossible for the
   * user to act on or clear. There is no compensating transaction available
   * here, so the only safe design is to refuse first.
   *
   * The workflow type is fixed. A caller naming it would be choosing its own
   * rules, which is the thing `FR-GEL-004` and `DEF-030-003` both refuse.
   */
  async openRoom(
    principal: ActingPrincipal,
    input: { projectId: string; text: string; sourceRef?: string },
  ): Promise<{ roomObjectId: string; candidates: CandidateRow[] }> {
    const actor = await this.acting(principal);

    // Before the declaration, deliberately — see above.
    const text = (input.text ?? '').trim();
    if (text.length === 0) {
      throw new ValidationFailedError('openRoom requires: text');
    }
    if (!input.projectId) {
      throw new ValidationFailedError('openRoom requires: projectId');
    }

    if (!this.loop) {
      // `FR-RQR-001` — this Room is an instance of the governed loop. Opening
      // one without declaring its loop object would create a Room the loop does
      // not know about, which is worse than refusing.
      throw new ValidationFailedError('openRoom requires the governed loop');
    }

    const ref = await this.loop.declareObject(principal, {
      projectId: input.projectId,
      workflowType: 'requirement-room',
      // The Room's subject is the requirement set it is forming. It has no
      // specification yet — that is what `EPIC-033` produces — so the object is
      // its own subject until a baseline hands one over (`FR-RQR-054`).
      subjectType: 'requirement-set',
      // A fresh identity for the set this Room will form. Minted here rather
      // than derived from the project, so two Rooms opened in one project are
      // two subjects rather than one contested one.
      subjectId: randomUUID(),
    });

    const candidates = await this.intakeService.intake({
      workspaceId: actor.workspaceId,
      projectId: input.projectId,
      roomObjectId: ref.objectId,
      sourceRef: input.sourceRef?.trim() || 'direct-input',
      text,
    });

    return { roomObjectId: ref.objectId, candidates };
  }

  /**
   * `T1171` — the Rooms in this workspace, for the index.
   *
   * Reads `EPIC-030`, not this Room's tables. A list built from
   * `requirement_candidates.roomObjectId` would omit a Room opened a moment ago
   * and would have to source the stage from somewhere other than the loop —
   * a Room-local translation of loop progress, which `FR-RQR-074` forbids.
   *
   * Filtered to the caller's projects is **not** done here: `EPIC-030` already
   * scopes to the workspace, and a second filter on top would be a second
   * answer to a question `EPIC-024` owns.
   */
  async listRooms(principal: ActingPrincipal): Promise<readonly RoomObjectRow[]> {
    await this.acting(principal);
    if (!this.loop) {
      throw new ValidationFailedError('listRooms requires the governed loop');
    }
    return this.loop.listObjects(principal, 'requirement-room');
  }

  async intake(principal: ActingPrincipal, input: IntakeCommand): Promise<CandidateRow[]> {
    const actor = await this.acting(principal);
    return this.intakeService.intake({ ...input, workspaceId: actor.workspaceId });
  }

  /**
   * T338v — `EPIC-035` `FR-DFR-076`. A Requirement Gap arrives as new intent.
   *
   * The inbound half of the Defect Room's third classification outcome, and the
   * task `EPIC-035`'s Exit Criterion 5 waits on.
   */
  async gapIntake(
    principal: ActingPrincipal,
    input: GapIntakeCommand,
  ): Promise<CandidateRow[]> {
    const actor = await this.acting(principal);
    return this.intakeService.gapIntake({ ...input, workspaceId: actor.workspaceId });
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
  /**
   * `T1184` — the candidates a Room holds.
   *
   * The store has listed these since `T338b`; nothing exposed them, so no screen
   * could show a person what their intent became. Scoped by the session's
   * workspace **in the query**, not filtered afterwards.
   */
  async candidates(principal: ActingPrincipal, roomObjectId: string): Promise<CandidateRow[]> {
    const actor = await this.acting(principal);
    if (!roomObjectId) {
      throw new ValidationFailedError('candidates require a Room object id in the path');
    }
    return this.store.listCandidates(actor.workspaceId, roomObjectId);
  }

  /**
   * `T1184` — `FR-RQR-030`. Measurable criteria, or the baseline gate refuses.
   *
   * `null` and `[]` are the same state and both block, so both are accepted
   * here: clearing criteria is a legitimate act, not a malformed request.
   */
  async setCriteria(
    principal: ActingPrincipal,
    roomObjectId: string,
    candidateId: string,
    input: {
      acceptanceCriteria?: readonly string[] | null;
      intendedForImplementation?: boolean;
    },
  ): Promise<CandidateRow> {
    const actor = await this.acting(principal);
    const candidate = await this.store.findCandidateById(candidateId);
    // The Room in the path must own the candidate, and both must be the
    // caller's. Absent rather than forbidden — a caller learns nothing about a
    // candidate it may not see (`FR-ACC-024`).
    if (
      !candidate ||
      candidate.workspaceId !== actor.workspaceId ||
      candidate.roomObjectId !== roomObjectId
    ) {
      throw new NotFoundError('Not found.');
    }
    return this.store.setCandidateCriteria(candidateId, {
      acceptanceCriteria: input.acceptanceCriteria ?? null,
      intendedForImplementation: input.intendedForImplementation ?? true,
    });
  }

  /**
   * `T1206` — promote a candidate into `EPIC-007`'s register and freeze it.
   *
   * The missing link the browser walk found. `RequirementRegister.promote` and
   * `.freeze` have existed since `T338d` and **nothing called either**: a
   * candidate could be labelled, given criteria and decided, and still had no
   * requirement version for a baseline to freeze.
   *
   * Two steps, one call, deliberately. A promotion that created the requirement
   * and stopped would leave a candidate pointing at something with no version,
   * which is a state the baseline gate cannot use and nobody would notice until
   * approval refused.
   *
   * `FR-RQR-002`, `D-33` — the register is `EPIC-007`'s. This writes **through**
   * the adapter and keeps only the reference (`promotedTo`).
   */
  async promote(
    principal: ActingPrincipal,
    roomObjectId: string,
    candidateId: string,
    input: { type?: string; priority?: string },
  ): Promise<{ requirementId: string; requirementVersionId: string; contentHash: string }> {
    const actor = await this.acting(principal);
    const candidate = await this.store.findCandidateById(candidateId);
    if (
      !candidate ||
      candidate.workspaceId !== actor.workspaceId ||
      candidate.roomObjectId !== roomObjectId
    ) {
      throw new NotFoundError('Not found.');
    }
    if (!this.register) {
      throw new ValidationFailedError('promotion requires the requirement register');
    }

    const ctx = { workspaceId: actor.workspaceId, userId: actor.id };
    const promoted = await this.register.promote(ctx, candidate.projectId, {
      text: candidate.normalizedText,
      // `EPIC-007`'s vocabularies, not guesses: `business | functional |
      // constraint` and `p1 | p2 | p3`. The first walk through this path sent
      // `should` and was refused by the register, which is the validation doing
      // its job — the Room does not get to invent the register's terms.
      type: (input.type ?? 'functional') as never,
      priority: (input.priority ?? 'p2') as never,
    });
    const frozen = await this.register.freeze(ctx, promoted.requirementId);
    // The reference, never a copy.
    await this.store.markPromoted(candidateId, promoted.requirementId);
    return {
      requirementId: promoted.requirementId,
      requirementVersionId: frozen.requirementVersionId,
      contentHash: promoted.contentHash,
    };
  }

  /**
   * `T1213` — the baseline members this Room can currently freeze.
   *
   * `T1212`'s walk found the screen keeping promoted versions in component
   * state: after a reload the approve form sent none and the baseline was
   * refused for freezing nothing. The promotions survived in `promotedTo`; the
   * version and hash did not, because the page never re-read them.
   *
   * **Resolved fresh, and that is a correction rather than a convenience.** A
   * client remembering a version from promotion time would freeze a stale one if
   * the requirement moved afterwards. Reading the current version at the moment
   * of asking is the only answer that is true when it is used.
   */
  async baselineMembers(
    principal: ActingPrincipal,
    roomObjectId: string,
  ): Promise<{ requirementVersionId: string; contentHash: string; candidateId: string }[]> {
    const actor = await this.acting(principal);
    if (!this.register) {
      throw new ValidationFailedError('baseline members require the requirement register');
    }
    const candidates = await this.store.listCandidates(actor.workspaceId, roomObjectId);
    const ctx = { workspaceId: actor.workspaceId, userId: actor.id };

    const members: { requirementVersionId: string; contentHash: string; candidateId: string }[] =
      [];
    for (const candidate of candidates) {
      if (candidate.promotedTo === null) continue;
      const frozen = await this.register.currentVersion(ctx, candidate.promotedTo);
      // A candidate whose requirement has no version yet is skipped rather than
      // guessed at — an invented version id would be refused by the gate anyway,
      // and less legibly.
      if (frozen === null) continue;
      members.push({
        requirementVersionId: frozen.requirementVersionId,
        contentHash: frozen.contentHash,
        candidateId: candidate.id,
      });
    }
    return members;
  }

  /**
   * `T1211` — the baselines approved for this project.
   *
   * `T1208`: a person approved a baseline and the screen still said *"Nothing is
   * outstanding"* with the approve control still offered, because readiness is
   * unchanged by approval and nothing rendered the baseline that now existed.
   *
   * **Superseded ones are included.** `FR-RQR-052` keeps a superseded baseline
   * readable and pointing at what replaced it; hiding them would make version 2
   * look like the only thing that ever happened.
   */
  async listBaselines(principal: ActingPrincipal, projectId: string): Promise<BaselineRow[]> {
    const actor = await this.acting(principal);
    if (!projectId) {
      throw new ValidationFailedError('baselines require a projectId');
    }
    return this.store.listBaselines(actor.workspaceId, projectId);
  }

  /** `T1193` — the decisions recorded for a Room, so the screen can show them. */
  async listDecisions(principal: ActingPrincipal, roomObjectId: string): Promise<DecisionRow[]> {
    const actor = await this.acting(principal);
    if (!roomObjectId) {
      throw new ValidationFailedError('decisions require a Room object id in the path');
    }
    return this.store.listDecisions(actor.workspaceId, roomObjectId);
  }

  /** `T1184` — the questions raised for a Room, answered or not. */
  async listClarifications(
    principal: ActingPrincipal,
    roomObjectId: string,
  ): Promise<ClarificationRow[]> {
    const actor = await this.acting(principal);
    if (!roomObjectId) {
      throw new ValidationFailedError('clarifications require a Room object id in the path');
    }
    return this.store.listClarifications(actor.workspaceId, roomObjectId);
  }

  /**
   * `T1184` — `FR-RQR-012`, `FR-RQR-013`.
   *
   * Answerable in place, and the answer is **retained** as part of the record.
   * Who answered is the session, never a name the body chose — the same rule
   * `DEF-033-001` was raised over.
   */
  async answerClarification(
    principal: ActingPrincipal,
    roomObjectId: string,
    clarificationId: string,
    input: { answer?: string },
  ): Promise<ClarificationRow> {
    const actor = await this.acting(principal);
    const answer = (input?.answer ?? '').trim();
    if (answer === '') {
      throw new ValidationFailedError('an answer requires: answer');
    }
    const existing = await this.store.findClarificationById(clarificationId);
    if (
      !existing ||
      existing.workspaceId !== actor.workspaceId ||
      existing.roomObjectId !== roomObjectId
    ) {
      throw new NotFoundError('Not found.');
    }
    return this.store.answerClarification(clarificationId, {
      answer,
      answeredBy: actor.id,
      answeredAt: new Date(),
    });
  }

  async clarifications(
    principal: ActingPrincipal,
    roomObjectId: string,
    input: ClarificationRequest,
  ): Promise<ClarificationRow[]> {
    const actor = await this.acting(principal);
    if (!roomObjectId) {
      throw new ValidationFailedError('clarifications require a Room object id in the path');
    }
    if (input?.questions) {
      await this.clarificationService.ask({
        workspaceId: actor.workspaceId,
        roomObjectId,
        // Who asked is the session, not a name the request chose.
        askedBy: actor.id,
        questions: input.questions,
      });
    } else if (input?.answer) {
      await this.clarificationService.answer({
        workspaceId: actor.workspaceId,
        id: input.answer.id,
        answer: input.answer.answer,
        answeredBy: actor.id,
      });
    } else {
      throw new ValidationFailedError(
        'a clarification request carries either `questions` to ask or an `answer` to record',
      );
    }
    return this.clarificationService.list(actor.workspaceId, roomObjectId);
  }

  /**
   * T338t — `FR-RQR-014`, `FR-RQR-015`. Labelled elements, conflicts and
   * duplicates.
   *
   * Answers whether or not an analysis provider is bound: the deterministic
   * half always runs, and `aiAvailable` says whether the other half did. See
   * `analysis.service.ts` for why that is this Room's one degrading seam.
   */
  async analysis(
    principal: ActingPrincipal,
    roomObjectId: string,
    query: AnalysisQuery,
  ): Promise<AnalysisResult> {
    const actor = await this.acting(principal);
    if (!roomObjectId) {
      throw new ValidationFailedError('analysis requires a Room object id in the path');
    }
    if (!query?.projectId) {
      throw new ValidationFailedError('analysis requires: projectId');
    }
    return this.analysisService.analyze({
      workspaceId: actor.workspaceId,
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
    principal: ActingPrincipal,
    roomObjectId: string,
    input: OptionsRequest,
  ): Promise<Labelled<PresentedOption>[]> {
    // Presenting options reveals what a Room object is deliberating over, so it
    // is authenticated like the rest even though it persists nothing.
    await this.acting(principal);
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
  async decide(
    principal: ActingPrincipal,
    roomObjectId: string,
    input: DecideRequest,
  ): Promise<DecisionRow> {
    const actor = await this.acting(principal);
    if (!roomObjectId) {
      throw new ValidationFailedError('a decision requires a Room object id in the path');
    }
    return this.decisionService.decide({
      workspaceId: actor.workspaceId,
      roomObjectId,
      objectVersion: input.objectVersion ?? 0,
      // `S4`'s load-bearing line. `actor.kind` is now what the directory says
      // the caller IS, so `decision.service`'s human-only refusal and the
      // `requirement_decisions_decided_by_a_human` constraint are checking a
      // resolved fact rather than a self-declaration.
      actor: asActorRef(actor),
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
  async baseline(
    principal: ActingPrincipal,
    roomObjectId: string,
    input: ApproveBaselineInput,
  ): Promise<BaselineApproval> {
    const actor = await this.acting(principal);
    if (!roomObjectId) {
      throw new ValidationFailedError('a baseline requires a Room object id in the path');
    }
    // `S1` acceptance scenario 2 — the baseline carries its approver. A
    // baseline is immutable, so an unverified approver cannot be corrected
    // later, only superseded. It is taken from the session.
    return this.baselines.approve({
      ...input,
      workspaceId: actor.workspaceId,
      approvedBy: actor.id,
      exceptions: input.exceptions?.map((exception) => ({
        ...exception,
        // `FR-RQR-032` — a waiver's authorizer is the caller who waived it.
        authorizedBy: actor.id,
      })),
    });
  }

  /**
   * T403f — `FR-RQR-060`, `FR-RQR-061`. Select a baselined set as input to a
   * specification workflow.
   *
   * The route addresses the baseline by **version**, which is the thing
   * `FR-RQR-061` requires be recorded. `projectId` comes from the body because
   * `(projectId, version)` is the baseline's key and a version alone would
   * resolve to another project's set.
   */
  async handoff(
    principal: ActingPrincipal,
    version: string,
    input: HandoffRequest,
  ): Promise<HandoffRow> {
    const actor = await this.acting(principal);
    const baselineVersion = Number.parseInt(version, 10);
    if (!Number.isInteger(baselineVersion) || baselineVersion < 1) {
      throw new ValidationFailedError(
        `"${version}" is not a baseline version — versions are whole numbers from 1`,
      );
    }
    if (!input?.projectId) {
      throw new ValidationFailedError('a handoff requires: projectId');
    }
    return this.handoffService.select({
      workspaceId: actor.workspaceId,
      projectId: input.projectId,
      baselineVersion,
      specificationWorkflowRef: input.specificationWorkflowRef,
      selectedBy: actor.id,
    });
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
  async readiness(
    principal: ActingPrincipal,
    roomObjectId: string,
    query: ReadinessQuery,
  ): Promise<BaselineReadiness> {
    const actor = await this.acting(principal);
    if (!roomObjectId) {
      throw new ValidationFailedError('readiness requires a Room object id in the path');
    }
    const [candidates, clarifications, decisions] = await Promise.all([
      this.store.listCandidates(actor.workspaceId, roomObjectId),
      this.store.listClarifications(actor.workspaceId, roomObjectId),
      this.store.listDecisions(actor.workspaceId, roomObjectId),
    ]);
    // `T1200` — the recorded decision, which this read `null`ed until `T1199`.
    // That was right while `PolicyProvider` was unbound and nothing could record
    // one; the moment a decision could exist, hardcoding its absence made the
    // `pending-decision` blocker permanent and invisible.
    const decided = decisions[decisions.length - 1];
    return projectReadiness({
      candidates,
      clarifications,
      // Null when EPIC-032 is unbound or no Contract was named — which BLOCKS.
      // "Cannot tell" is never "ready".
      evidence: await this.evidenceStatus(actor.workspaceId, query),
      decision: decided ? { decisionId: decided.decisionId } : null,
    });
  }

  private async evidenceStatus(
    workspaceId: string,
    query: ReadinessQuery,
  ): Promise<EvidenceStatus | null> {
    if (!this.evidence || !query.evidenceContractRef || !query.projectId) return null;
    return this.evidence.isSatisfied(query.evidenceContractRef, {
      workspaceId,
      projectId: query.projectId,
    });
  }
}
