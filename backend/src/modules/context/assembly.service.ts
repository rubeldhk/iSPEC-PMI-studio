/**
 * `T1242`, `T1307` (EPIC-038) — assembling a Context Package.
 *
 * `FR-CTX-030`–`FR-CTX-039`, `FR-CTX-064`.
 *
 * ## The order of operations is the design
 *
 * Every check runs, and every candidate is resolved to **either an item or an
 * exclusion**, before anything is written. Two consequences follow, and both
 * are requirements rather than tidiness:
 *
 * - A refused assembly leaves no half-formed package. `FR-CTX-039` refuses when
 *   an essential item was excluded, and that is only knowable after every
 *   candidate has been judged — so the write cannot begin until judging ends.
 * - **Items + exclusions = candidates**, always. That arithmetic is what makes
 *   silent dropping detectable, and a candidate that could vanish between the
 *   two would make every guarantee in this Epic unenforceable.
 *
 * ## The refusals, and why each is a refusal rather than a smaller package
 *
 * | Condition | Why not just proceed |
 * |---|---|
 * | Index unavailable (`FR-CTX-012`) | An unranked package is a different thing, not a degraded one |
 * | Budget admits nothing (`FR-CTX-037`) | *"Nothing relevant"* and *"nothing affordable"* are different facts |
 * | An essential item excluded (`FR-CTX-039`) | The session would run and read normally on material somebody said was insufficient |
 *
 * A refusal is written as a `ContextPackage` row with `state = 'refused'`
 * (`FR-CTX-065`), because a refusal that left no trace makes *"no context was
 * assembled"* and *"assembly was never attempted"* the same absence.
 *
 * Framework-free (PC-1).
 */
import { randomUUID } from 'node:crypto';
import {
  ConflictError,
  NotFoundError,
  PlatformError,
  ValidationFailedError,
} from '../../core/errors.js';
import type { BudgetPolicy, ContextStore } from './context.store.js';
import type { ContextPackage, PackageItem } from './package.types.js';
import type { ProvenanceService, ResolvedProvenance } from './provenance.service.js';
import type {
  Candidate,
  ExclusionRecord,
  ExclusionReason,
  RetrievalOutcome,
} from './retrieval/outcome.types.js';
import { shortfallOf } from './retrieval/outcome.types.js';
import { judgeBoundary, type AuthorisationReader, type OwnedSource } from './isolation.js';
import {
  LIVE_STATE_KINDS,
  type ExecutionHistoryStatus,
  type ExecutionProjections,
  type LiveStateReader,
  type LiveStateReading,
  type LiveStateStatus,
} from './live-state.js';
import { APPROVED_SOURCE_TYPES, KNOWLEDGE_ENTRY_SOURCE_TYPE } from './retrieval/index.service.js';

/** One source, named the way a caller names it. */
export interface SourceRef {
  readonly sourceType: string;
  readonly sourceId: string;
}

export interface AssembleInput {
  readonly workspaceId: string;
  readonly projectId: string;
  /**
   * `FR-CTX-062` — the execution this package feeds. Absent while assembly
   * runs ahead of registration, and then stored as `null` rather than a
   * placeholder: an invented id is a binding to nothing that looks like one.
   */
  readonly executionId?: string;
  readonly objective: string;
  readonly actorId: string;
  readonly actorRole: string;
  readonly budgetTokens: number;
  readonly budgetCost: number;
  /** `FR-CTX-038` — sources whose exclusion refuses the whole assembly. */
  readonly essentialSources: readonly SourceRef[];
  /** `FR-CTX-020` — live state is opt-in. Absent means not requested. */
  readonly includeLiveState?: boolean;
}

export interface AssemblyPorts {
  /** `FR-CTX-010`–`FR-CTX-012`. Throws when the index cannot answer. */
  readonly retrieval: {
    search(input: {
      workspaceId: string;
      objective: string;
      /** `FR-CTX-036` — from the workspace's budget policy, when one is read. */
      limit?: number;
    }): Promise<RetrievalOutcome & { modelId: string }>;
  };
  /** `FR-CTX-054`, `R-038-7` — `EPIC-024` adjudicates; this Epic only asks. */
  readonly access: {
    /**
     * `source` names its owning workspace and `requestingWorkspaceId` names the
     * package's, so the adjudicator can tell own material from an authorised
     * crossing without re-deriving what `judgeBoundary` already decided.
     */
    mayRead(actorId: string, source: OwnedSource, requestingWorkspaceId: string): Promise<boolean>;
  };
  /**
   * `FR-CTX-034`, `FR-CTX-015` — two distinct exclusions live here.
   *
   * `null` means the type is **not classified**, which excludes. A class with
   * `indexable: false` means the type is classified and deliberately **outside
   * the corpus**, which also excludes — and for a different reason a reader
   * needs to be able to tell apart: one is *nobody registered this*, the other
   * is *somebody decided against it*.
   */
  readonly sourceClasses: {
    classify(
      workspaceId: string,
      sourceType: string,
    ): Promise<{ securityClassification: string; indexable: boolean } | null>;
  };
  /**
   * `FR-CTX-050`–`FR-CTX-053` — who may cross a tenant boundary.
   *
   * Separate from `access` deliberately, and `T1257` is the test that keeps
   * them separate: this decides whether the **material** may appear here at
   * all, `access` decides whether the **actor** may read it, and an item needs
   * both (`R-038-7`).
   */
  readonly authorisations: AuthorisationReader;
  /**
   * What one candidate costs against the budget.
   *
   * Injected so the rule under test is the budget rule rather than a
   * tokeniser's judgement. Defaults to a flat estimate; a real cost model is
   * `EPIC-038`'s to refine and nobody else's to guess.
   */
  readonly costOf?: (candidate: Candidate) => number;
  /**
   * `FR-CTX-020`–`FR-CTX-023` — **degrades**. Absent or `null` means unbound,
   * and a package that asked for live state records it as unavailable.
   */
  readonly liveState?: LiveStateReader | null;
  /**
   * `FR-CTX-015`, `R-038-8` — `EPIC-037`'s projections. **Degrades**: with it
   * absent, execution history drops out and the package records that it did.
   */
  readonly executions?: ExecutionProjections | null;
  /**
   * `FR-CTX-040`–`FR-CTX-044` — `EPIC-033`'s baselines, through
   * `ProvenanceService`. Absent or `null` makes every item `undetermined`
   * with a reason naming the owner: never `current` by default.
   */
  readonly provenance?: ProvenanceService | null;
  /**
   * `FR-CTX-031`, `FR-CTX-036` — where the workspace's budget policy is read.
   * Bound by the module always; when bound, a workspace with no policy
   * refuses. Unit tests that leave it out exercise the rules under an injected
   * `costOf` instead.
   */
  readonly budgetPolicy?: { budgetPolicyFor(workspaceId: string): Promise<BudgetPolicy | null> };
  /**
   * `T1808`, `FR-CTX-050` — whether a project is in this workspace, asked of
   * the projects module. Bound by the module always.
   */
  readonly projects?: { inWorkspace(workspaceId: string, projectId: string): Promise<boolean> };
}

export interface AssembleResult {
  readonly packageId: string;
  readonly state: 'assembled';
  readonly itemCount: number;
  readonly exclusionCount: number;
  /** `R-038-3` — present when retrieval returned fewer than it was asked for. */
  readonly shortfall: ReturnType<typeof shortfallOf>;
  /** `T1833`, `FR-CTX-035` — the budget excluded something. Said, not left to inference. */
  readonly bounded: boolean;
  /** `T1869` — the rows as stored, so the `201` carries what was assembled (contract). */
  readonly items: readonly PackageItem[];
  readonly exclusions: readonly ExclusionRecord[];
}

/** A candidate that did not make it, before it becomes a row. */
interface Rejected {
  readonly candidate: Candidate;
  readonly reason: ExclusionReason;
  readonly detail: string;
  /** A live-state element rather than a ranked candidate. */
  readonly live?: true;
}

/** What the package records about its two degrading ports. */
interface Recorded {
  readonly liveState: LiveStateStatus;
  readonly liveStateReason: string | null;
  readonly executionHistory: ExecutionHistoryStatus;
  readonly executionHistoryReason: string | null;
}

/** Judges `execution-history` candidates against `EPIC-037`'s projections. */
interface HistoryJudge {
  judge(candidate: Candidate): Promise<{ reason: ExclusionReason; detail: string } | null>;
  status(): ExecutionHistoryStatus;
  reason(): string | null;
}

/** `T1849` — what `context_packages.budgetTokens` (INTEGER) can hold. */
const MAX_BUDGET_TOKENS = 2_147_483_647;
/** `T1849` — what `context_packages.budgetCost` (NUMERIC(12,4)) can hold. */
const MAX_BUDGET_COST = 99_999_999.9999;

export class AssemblyService {
  constructor(
    private readonly store: ContextStore,
    private readonly ports: AssemblyPorts,
  ) {}

  async assemble(input: AssembleInput): Promise<AssembleResult> {
    // `T1859` — text fields are text. `String({})` stored "[object Object]" as an
    // objective; a numeric execution id was dropped and the package assembled
    // unbound, though the caller had named one.
    if (typeof input.objective !== 'string') {
      throw new ValidationFailedError('objective must be text (FR-CTX-032)');
    }
    if (input.projectId !== undefined && typeof input.projectId !== 'string') {
      throw new ValidationFailedError('projectId must be text (FR-CTX-050)');
    }
    if (
      input.executionId !== undefined &&
      input.executionId !== null &&
      typeof input.executionId !== 'string'
    ) {
      throw new ValidationFailedError('executionId must be text when given (FR-CTX-062)');
    }
    if (input.objective.trim() === '') {
      throw new ValidationFailedError(
        'a context package is assembled for a stated objective (FR-CTX-032)',
      );
    }

    // `T1843`, `FR-CTX-031`, `FR-CTX-035` — a budget is a whole number of tokens
    // and a non-negative cost. Anything else is a request that cannot be
    // honoured: `NaN` trips no comparison and would admit everything.
    // `T1849` — typed as numbers, never coerced, and within what the row can
    // hold: a budget beyond the column would pass here and fail at the write.
    if (
      typeof input.budgetTokens !== 'number' ||
      !Number.isInteger(input.budgetTokens) ||
      input.budgetTokens < 0 ||
      input.budgetTokens > MAX_BUDGET_TOKENS
    ) {
      throw new ValidationFailedError(
        `the token budget must be a whole number of tokens from 0 to ${MAX_BUDGET_TOKENS}; got ` +
          `${JSON.stringify(input.budgetTokens) ?? 'nothing'} (FR-CTX-031)`,
      );
    }
    if (
      typeof input.budgetCost !== 'number' ||
      !Number.isFinite(input.budgetCost) ||
      input.budgetCost < 0 ||
      input.budgetCost > MAX_BUDGET_COST
    ) {
      throw new ValidationFailedError(
        `the cost budget must be an amount from 0 to ${MAX_BUDGET_COST}; got ` +
          `${JSON.stringify(input.budgetCost) ?? 'nothing'} (FR-CTX-031)`,
      );
    }
    if (
      !Array.isArray(input.essentialSources) ||
      !input.essentialSources.every(
        (s) =>
          typeof s === 'object' &&
          s !== null &&
          typeof s.sourceType === 'string' &&
          typeof s.sourceId === 'string' &&
          s.sourceType.trim() !== '' &&
          s.sourceId.trim() !== '',
      )
    ) {
      throw new ValidationFailedError(
        'essentialSources must be a list of { sourceType, sourceId } (FR-CTX-038)',
      );
    }

    // `T1847`, `FR-CTX-050`, `FR-CTX-062` — the execution must be this
    // workspace's. The foreign key to `executions(id)` knows nothing of
    // workspaces, so it would bind a package to another tenant's execution and
    // answer "does that id exist?" by whether the write failed. Asked of
    // `EPIC-037` in the requester's workspace, and refused with one message
    // whether the id is someone else's or nobody's.
    const executionId = typeof input.executionId === 'string' ? input.executionId.trim() : '';
    if (
      executionId !== '' &&
      this.ports.executions &&
      (await this.ports.executions.projectedVersion(input.workspaceId, executionId)) === null
    ) {
      throw new ValidationFailedError(
        `execution ${executionId} is not registered in this workspace, so no package can be bound to it (FR-CTX-062)`,
      );
    }

    // `T1808`, `FR-CTX-050` — the project is the second boundary, so it must be
    // a real one: named, and in this workspace. The refusal does not say
    // whether the id exists elsewhere (`FR-002`).
    if (typeof input.projectId !== 'string' || input.projectId.trim() === '') {
      throw new ValidationFailedError(
        'projectId is required: a package is assembled for one project, and the project is a ' +
          'boundary context must not cross (FR-CTX-050)',
      );
    }
    if (
      this.ports.projects &&
      !(await this.ports.projects.inWorkspace(input.workspaceId, input.projectId))
    ) {
      await this.#refuseEarly(
        input,
        new ValidationFailedError(
          `there is no project ${input.projectId} in this workspace, so no package can be assembled for it (FR-CTX-050)`,
        ),
      );
    }

    // `FR-CTX-036` — the budget policy is configuration. Read first: without it
    // there is no retrieval limit, no estimate and no price, and running on
    // numbers somebody typed into the code is what the requirement forbids.
    let policy: BudgetPolicy | null = null;
    if (this.ports.budgetPolicy) {
      policy = await this.ports.budgetPolicy.budgetPolicyFor(input.workspaceId);
      if (policy === null) {
        await this.#refuseEarly(
          input,
          new ValidationFailedError(
            'no budget policy is configured for this workspace, so there is no retrieval limit, ' +
              'per-candidate estimate or price to assemble under (FR-CTX-036)',
          ),
        );
      }
    }

    // `FR-CTX-012` — an unranked package is a different thing, not a degraded
    // one. A retrieval error is an outage, never "nothing was relevant": it is
    // recorded as a refusal (`T1820`) and then thrown as itself.
    let outcome: RetrievalOutcome & { modelId: string };
    try {
      outcome = await this.ports.retrieval.search({
        workspaceId: input.workspaceId,
        objective: input.objective,
        ...(policy ? { limit: policy.retrievalLimit } : {}),
      });
    } catch (error) {
      return this.#refuseEarly(input, error);
    }

    const configured = policy;
    const costOf =
      this.ports.costOf ??
      (configured
        ? (): number => configured.tokensPerCandidate
        : // The unit-test path only: the module always binds a policy.
          (): number => 500);
    // `FR-CTX-031` — tokens priced by the policy. With no policy there is no
    // price, so cost is not compared rather than compared against a guess.
    const priceOf = (tokens: number): number | null =>
      configured ? (tokens * configured.costPerThousandTokens) / 1000 : null;
    let spentCost = 0;
    const essential = new Set(input.essentialSources.map((s) => `${s.sourceType}:${s.sourceId}`));
    const isEssential = (c: Candidate): boolean => essential.has(`${c.sourceType}:${c.sourceId}`);

    const kept: {
      candidate: Candidate;
      reason: string;
      /** `T1863` — the classification it was admitted under. */
      securityClassification: string;
      crossing: { crossBoundary: boolean; authorisationRef?: string };
    }[] = [];
    const rejected: Rejected[] = [];
    /** `T1871` — passed every check about the material; the budget is applied after. */
    const eligible: (typeof kept)[number][] = [];
    let spent = 0;

    const history = this.#historyJudge();

    // Ranked order, so the budget keeps the best matches rather than whichever
    // arrived first.
    const ranked = [...outcome.candidates].sort((a, b) => b.relevanceScore - a.relevanceScore);

    // `T1877`, `FR-CTX-065` — an outage in a per-candidate port (classes,
    // authorisations, access) is recorded as a refusal and then thrown as
    // itself, exactly as a retrieval outage is. Rethrown unrecorded, the
    // execution had nothing to inspect.
    try {
      for (const candidate of ranked) {
        // `T1867`, `FR-CTX-034` — classified by the workspace that OWNS the
        // material. Classification is the owner's statement about its own
        // sources; the requester's class for the type says nothing about them.
        const classified = await this.ports.sourceClasses.classify(
          candidate.workspaceId,
          candidate.sourceType,
        );
        if (!classified) {
          // `FR-CTX-034`, `SC-CTX-007`. Excluding is visible and takes a minute to
          // fix; admitting is invisible and may be a customer export.
          rejected.push({
            candidate,
            reason: 'classification',
            detail: `no source class is registered for '${candidate.sourceType}' in this workspace`,
          });
          continue;
        }

        if (!classified.indexable) {
          // `FR-CTX-015` — classified, and deliberately outside the corpus.
          // Distinct from the case above: somebody decided this, and the detail
          // says so, because "nobody registered it" sends a reader to a different
          // action than "we chose not to index it".
          rejected.push({
            candidate,
            reason: 'classification',
            detail:
              `'${candidate.sourceType}' is registered as ` +
              `${classified.securityClassification} and marked not indexable — it is outside the ` +
              'approved source set (FR-CTX-015)',
          });
          continue;
        }

        if (!APPROVED_SOURCE_TYPES.has(candidate.sourceType)) {
          // `FR-CTX-015`, `T1274` — enforced here regardless of what the ranker
          // returned. A ranker is one implementation of a port, and the approved
          // set must not depend on every implementation remembering it.
          rejected.push({
            candidate,
            reason: 'classification',
            detail:
              `'${candidate.sourceType}' is outside the approved source set — governed documents, ` +
              'execution history and knowledge entries only (FR-CTX-015)',
          });
          continue;
        }

        // `FR-CTX-050`. Asked BEFORE the actor's permission, because the two
        // answer different questions and this one is about whether the material
        // may be here at all. `R-038-7`: the partition is not the permission, and
        // a permissive `AccessPolicy` must never become a route around the tenant
        // boundary.
        const boundary = await judgeBoundary(
          candidate,
          input.workspaceId,
          this.ports.authorisations,
          input.projectId,
        );
        if (!boundary.allowed) {
          rejected.push({ candidate, reason: 'boundary', detail: boundary.reason });
          continue;
        }

        if (candidate.sourceType === KNOWLEDGE_ENTRY_SOURCE_TYPE) {
          // `T2523`, `A-038-1` — `knowledge-entry` is approved, but only
          // `EPIC-048`'s `KnowledgeAdmission` may say whether one entry may be
          // supplied here, and that port (`A-038-2`) is not bound. Absent, it
          // fails closed: never admitted by default (`learning-contract.md` §3).
          rejected.push({
            candidate,
            reason: 'permission',
            detail:
              `admission port unbound — ${candidate.sourceType} ${candidate.sourceId} is not supplied ` +
              'until EPIC-048 judges it (A-038-1, FR-CTX-015)',
          });
          continue;
        }

        if (!(await this.ports.access.mayRead(input.actorId, candidate, input.workspaceId))) {
          rejected.push({
            candidate,
            reason: 'permission',
            detail: `${input.actorId} (${input.actorRole}) may not read ${candidate.sourceType} ${candidate.sourceId}`,
          });
          continue;
        }

        // `T1853` — execution history is judged only once the actor may see it.
        // Before the boundary and permission, an execution nobody cleared had its
        // projection version looked up and written into a `stale` detail — and
        // counted toward the all-stale refusal it never reached.
        if (candidate.sourceType === 'execution-history') {
          const verdict = await history.judge(candidate);
          if (verdict !== null) {
            rejected.push({ candidate, reason: verdict.reason, detail: verdict.detail });
            continue;
          }
        }

        if (candidate.stale) {
          // `FR-CTX-017`, `SC-CTX-009` — a stale entry is never ranked as current.
          // After the boundary and permission, so a reader is never told the
          // version history of material they could not have seen.
          rejected.push({
            candidate,
            reason: 'stale',
            detail:
              `indexed at ${candidate.sourceVersion}; the source is now at ` +
              `${candidate.stale.currentVersion}, so the ranking described a version that is not ` +
              'current (FR-CTX-017)',
          });
          continue;
        }

        // Eligible: every check that is about the material has passed. The budget
        // is applied below, in a second pass (`T1871`).
        eligible.push({
          candidate,
          securityClassification: classified.securityClassification,
          // `FR-CTX-052` — the marking travels with the item, and names the
          // authorisation. A boolean alone would say somebody decided this was
          // fine without saying who.
          crossing: boundary.crossBoundary
            ? { crossBoundary: true, authorisationRef: boundary.authorisationRef }
            : { crossBoundary: false },
          // `FR-CTX-064`, `PP-016` — recorded at the moment of selection, because
          // a reason reconstructed later is a guess about what this loop was
          // thinking. An essential item was not chosen by relevance, and saying
          // it was would misdescribe the package.
          reason: isEssential(candidate)
            ? `marked essential for this objective by the requester`
            : `objective relevance ${candidate.relevanceScore.toFixed(2)} against: ${input.objective}`,
        });
      }
    } catch (error) {
      return this.#refuseEarly(input, error, outcome);
    }

    // `T1865`, `T1871`, `FR-CTX-015`, `R-038-8` — history is all in or all out,
    // settled BEFORE the budget. If the projection reader failed partway,
    // history judged current before the failure is excluded naming the failure
    // — and, because the budget has not been applied yet, it never held budget
    // another candidate needed.
    if (history.status() === 'unavailable') {
      for (let i = eligible.length - 1; i >= 0; i -= 1) {
        const e = eligible[i]!;
        if (e.candidate.sourceType !== 'execution-history') continue;
        eligible.splice(i, 1);
        rejected.push({
          candidate: e.candidate,
          reason: 'classification',
          detail: history.reason()!,
        });
      }
    }

    // `FR-CTX-031`, `FR-CTX-035` — the budget, over what is eligible, in ranked
    // order so the best matches are the ones it keeps. `T1875`, `FR-CTX-039` —
    // essential material is charged first: assembly refuses only when the
    // budget cannot fit it, never because more relevant items spent it first.
    const charging = [
      ...eligible.filter((e) => isEssential(e.candidate)),
      ...eligible.filter((e) => !isEssential(e.candidate)),
    ];
    for (const e of charging) {
      const cost = costOf(e.candidate);
      const price = priceOf(cost);
      if (price !== null && spentCost + price > input.budgetCost) {
        rejected.push({
          candidate: e.candidate,
          reason: 'budget',
          detail:
            `excluded at a cost of ${(spentCost + price).toFixed(4)} against a cost budget of ` +
            `${input.budgetCost} (FR-CTX-031)`,
        });
        continue;
      }
      if (spent + cost > input.budgetTokens) {
        rejected.push({
          candidate: e.candidate,
          reason: 'budget',
          detail: `excluded at ${spent + cost} of a ${input.budgetTokens}-token budget`,
        });
        continue;
      }
      spent += cost;
      spentCost += price ?? 0;
      kept.push(e);
    }
    // Items are presented in ranked order, whatever order they were charged in.
    kept.sort((a, b) => eligible.indexOf(a) - eligible.indexOf(b));

    // `FR-CTX-020`–`FR-CTX-023`. Read after the ranked material and before any
    // write, so a refused package still records what live state it had.
    const live = await this.#readLiveState(input);
    const recorded: Recorded = {
      liveState: live.status,
      liveStateReason: live.reason,
      executionHistory: history.status(),
      executionHistoryReason: history.reason(),
    };
    rejected.push(...live.rejected);

    // `FR-CTX-039` — knowable only now, which is why nothing is written above.
    const blockedEssential = rejected.find((r) => isEssential(r.candidate));
    if (blockedEssential) {
      const refusedId = await this.#recordRefusal(
        input,
        outcome,
        rejected,
        recorded,
        `an essential source was excluded: ${blockedEssential.candidate.sourceType} ` +
          `${blockedEssential.candidate.sourceId} (${blockedEssential.reason}) — ` +
          `${blockedEssential.detail} (FR-CTX-039)`,
      );
      throw new ValidationFailedError(
        `an essential source was excluded by ${blockedEssential.reason}: ` +
          `${blockedEssential.candidate.sourceId} — ${blockedEssential.detail}. ` +
          'Assembly refuses rather than proceeding without material somebody deemed ' +
          'essential (FR-CTX-039)',
        { packageId: refusedId },
      );
    }

    // `T1818`, `FR-CTX-039`, `SC-CTX-004` — an essential source retrieval
    // never returned. Not kept and not excluded, so neither check above saw it;
    // the package would assemble without it and look complete.
    const judged = new Set(
      [...kept.map((k) => k.candidate), ...rejected.map((r) => r.candidate)].map(
        (c) => `${c.sourceType}:${c.sourceId}`,
      ),
    );
    const unretrieved = input.essentialSources.find(
      (s) => !judged.has(`${s.sourceType}:${s.sourceId}`),
    );
    if (unretrieved) {
      const why =
        `the essential source ${unretrieved.sourceType} ${unretrieved.sourceId} was not among the ` +
        `candidates retrieval returned — ranked below the limit, or not indexed (FR-CTX-039)`;
      const refusedId = await this.#recordRefusal(input, outcome, rejected, recorded, why);
      throw new ValidationFailedError(
        `${why}. Assembly refuses rather than proceeding without material somebody deemed essential`,
        { packageId: refusedId },
      );
    }

    // `FR-CTX-037`, `T1824` — a budget that admitted nothing that got as far as
    // the budget. Candidates removed by permission or boundary never reached
    // it; if every one that did was refused by the budget, that is a fact about
    // the budget, whatever else was excluded alongside.
    if (kept.length === 0 && rejected.some((r) => !r.live && r.reason === 'budget')) {
      const refusedId = await this.#recordRefusal(
        input,
        outcome,
        rejected,
        recorded,
        `the budget of ${input.budgetTokens} tokens and ${input.budgetCost} cost admitted no ` +
          'candidate (FR-CTX-037)',
      );
      throw new ValidationFailedError(
        `the budget of ${input.budgetTokens} tokens and ${input.budgetCost} cost admits nothing; ` +
          'assembly refuses rather ' +
          'than returning an empty package, because "nothing was relevant" and "nothing was ' +
          'affordable" are different facts (FR-CTX-037)',
        { packageId: refusedId },
      );
    }

    // `T1814`, `SC-CTX-008`, `SC-CTX-009` — a corpus that is stale throughout.
    // One stale candidate is excluded; every one of them stale is a fact about
    // the index, and an empty package would report it as "nothing was relevant".
    // `T1841` — among what reached the staleness check. Candidates removed by
    // classification, boundary or permission never did; of what the actor could
    // have been given, if all of it was stale, that is the corpus refusing.
    const ranked_ = rejected.filter((r) => !r.live && r.reason === 'stale');
    if (kept.length === 0 && ranked_.length > 0) {
      const refusedId = await this.#recordRefusal(
        input,
        outcome,
        rejected,
        recorded,
        `every candidate that reached the staleness check (${ranked_.length}) is stale — the index was built from ` +
          'versions that have since moved (SC-CTX-008, SC-CTX-009)',
      );
      throw new ValidationFailedError(
        `every candidate that reached the staleness check (${ranked_.length}) is stale, so assembly refuses rather ` +
          'than returning an empty package that would read as "nothing was relevant". Re-index the ' +
          'changed sources (FR-CTX-018) and assemble again (SC-CTX-008, SC-CTX-009)',
        { packageId: refusedId },
      );
    }

    // `FR-CTX-042` — resolved before anything is written. A reader that answers
    // malformedly throws here, and a throw here leaves no half-written package.
    const provenance = await Promise.all(kept.map(({ candidate }) => this.#provenance(candidate)));

    const packageId = randomUUID();
    await this.store.createPackage({
      ...this.#packageRow(packageId, input, outcome, 'assembled', null, recorded),
      // `T1822`, `SC-CTX-009` — items whose staleness nobody could determine.
      // `T1879` — kept execution history was read by the history judge and
      // found current, whatever search could not check; its staleness is known.
      stalenessUnknown: kept.filter(
        (k) =>
          k.candidate.stalenessUnknown !== undefined &&
          k.candidate.sourceType !== 'execution-history',
      ).length,
    });

    const items: PackageItem[] = [];
    for (const [i, { candidate, reason, crossing, securityClassification }] of kept.entries()) {
      items.push(
        await this.store.addItem({
          ...this.#item(input.workspaceId, packageId, candidate, reason, crossing, provenance[i]!),
          securityClassification,
        }),
      );
    }
    const exclusions: ExclusionRecord[] = [];
    for (const r of rejected) {
      exclusions.push(
        await this.store.addExclusion(
          this.#exclusion(input.workspaceId, packageId, r, isEssential(r.candidate)),
        ),
      );
    }
    for (const reading of live.kept) {
      await this.store.addLiveState({
        id: randomUUID(),
        workspaceId: input.workspaceId,
        packageId,
        ...reading,
      });
    }

    return {
      packageId,
      state: 'assembled',
      itemCount: kept.length,
      exclusionCount: rejected.length,
      // `R-038-3` — a short read is carried onto the result rather than
      // absorbed. An unknown set and an empty set must not behave alike.
      shortfall: shortfallOf(outcome),
      bounded: rejected.some((r) => r.reason === 'budget'),
      items,
      exclusions,
    };
  }

  /**
   * `T1830`, `FR-CTX-062`, `FR-CTX-066` — bind a package assembled ahead of its
   * execution, once. A package that fed one execution did not feed another, so
   * a bound package is never re-pointed; `EPIC-037` must know the execution.
   */
  async bindExecution(
    workspaceId: string,
    packageId: string,
    executionId: string,
  ): Promise<ContextPackage> {
    const id = typeof executionId === 'string' ? executionId.trim() : '';
    if (id === '') {
      throw new ValidationFailedError('executionId is required to bind a package (FR-CTX-062)');
    }
    const existing = await this.store.findPackage(workspaceId, packageId);
    if (existing === null) throw new NotFoundError('Not found.');
    if (existing.executionId !== null) {
      if (existing.executionId === id) return existing;
      throw new ConflictError(
        `package ${packageId} is already bound to execution ${existing.executionId}; a package that ` +
          'fed one execution did not feed another (FR-CTX-062)',
      );
    }
    if (
      this.ports.executions &&
      (await this.ports.executions.projectedVersion(workspaceId, id)) === null
    ) {
      throw new ValidationFailedError(
        `execution ${id} is not registered in this workspace, so no package can be bound to it (FR-CTX-062)`,
      );
    }
    const bound = await this.store.bindExecution(workspaceId, packageId, id);
    if (bound === null) {
      throw new ConflictError(`package ${packageId} was bound by another request (FR-CTX-062)`);
    }
    return bound;
  }

  /**
   * `T1820`, `FR-CTX-065` — a refusal made before anything was ranked is a row
   * too. It names no model, because none ranked anything, and it records the
   * two degrading ports as not reached. If the row itself cannot be written,
   * the original refusal is still what the caller receives.
   */
  async #refuseEarly(
    input: AssembleInput,
    error: unknown,
    outcome: (RetrievalOutcome & { modelId: string }) | null = null,
  ): Promise<never> {
    const why = error instanceof Error ? error.message : 'assembly was refused before ranking';
    const packageId = randomUUID();
    let stored = false;
    try {
      await this.store.createPackage({
        ...this.#packageRow(packageId, input, outcome, 'refused', why, {
          liveState: input.includeLiveState === true ? 'unavailable' : 'not-requested',
          liveStateReason:
            input.includeLiveState === true
              ? 'assembly was refused before live state was read'
              : null,
          executionHistory: 'unavailable',
          executionHistoryReason: 'assembly was refused before execution history was considered',
        }),
        stalenessUnknown: null,
      });
      stored = true;
    } catch {
      // The refusal stands whether or not its record could be written.
    }
    // `T1835` — the refusal names the row that records it, so it can be opened
    // by id. Same class, same status: only the details gain the id.
    if (stored && error instanceof PlatformError) {
      const Same = error.constructor as new (message: string, details?: unknown) => PlatformError;
      const base = typeof error.details === 'object' && error.details !== null ? error.details : {};
      throw new Same(error.message, { ...base, packageId });
    }
    throw error;
  }

  /**
   * `FR-CTX-015`, `R-038-8` — degrade, and say so.
   *
   * Unbound, or failing once, makes history unavailable for the whole
   * assembly: every `execution-history` candidate is excluded and the package
   * records why. Bound, each candidate is compared with its projection's
   * version — moved on is `stale`, gone is `stale` too.
   */
  #historyJudge(): HistoryJudge {
    const port = this.ports.executions ?? null;
    let unavailable: string | null =
      port === null
        ? 'no ExecutionProjections reader is bound — EPIC-037 supplies it — so execution history ' +
          'dropped out of this package (FR-CTX-015, R-038-8)'
        : null;
    return {
      judge: async (candidate) => {
        if (unavailable === null && port !== null) {
          let projected: string | null;
          try {
            // `T1839` — the owner's projection: authorised history from another
            // workspace is not in the requester's registry.
            projected = await port.projectedVersion(candidate.workspaceId, candidate.sourceId);
          } catch (error) {
            unavailable =
              `EPIC-037's projections could not be read (${error instanceof Error ? error.message : 'unknown fault'}), ` +
              'so execution history dropped out of this package (FR-CTX-015)';
            projected = null;
          }
          if (unavailable === null) {
            if (projected === null) {
              return {
                reason: 'stale',
                detail: `execution ${candidate.sourceId} has no current projection in EPIC-037 (R-038-8)`,
              };
            }
            if (projected !== candidate.sourceVersion) {
              return {
                reason: 'stale',
                detail:
                  `indexed at projection ${candidate.sourceVersion}; EPIC-037 has since projected ` +
                  `${projected} (FR-CTX-017)`,
              };
            }
            return null;
          }
        }
        return { reason: 'classification', detail: unavailable! };
      },
      status: () => (unavailable === null ? 'available' : 'unavailable'),
      reason: () => unavailable,
    };
  }

  /**
   * `FR-CTX-020`–`FR-CTX-023` — degrade, and say so.
   *
   * A reading with no read instant makes the whole reading unusable rather than
   * being stamped with *now*: the instant is the claim `FR-CTX-021` requires,
   * and inventing it would turn "was green at 09:15" into "is green".
   */
  async #readLiveState(input: AssembleInput): Promise<{
    status: LiveStateStatus;
    reason: string | null;
    kept: LiveStateReading[];
    rejected: Rejected[];
  }> {
    const none = { kept: [], rejected: [] };
    if (input.includeLiveState !== true) return { status: 'not-requested', reason: null, ...none };
    const reader = this.ports.liveState ?? null;
    if (reader === null) {
      return {
        status: 'unavailable',
        reason: 'no LiveStateReader is bound, so live state could not be read (FR-CTX-022)',
        ...none,
      };
    }
    let readings: readonly LiveStateReading[];
    try {
      readings = await reader.read(input.workspaceId, input.projectId);
    } catch (error) {
      return {
        status: 'unavailable',
        reason: `the live-state reader failed: ${error instanceof Error ? error.message : 'unknown fault'} (FR-CTX-022)`,
        ...none,
      };
    }
    const unusable = readings.find(
      (r) =>
        !(r.readAt instanceof Date) ||
        Number.isNaN(r.readAt.getTime()) ||
        !(LIVE_STATE_KINDS as readonly string[]).includes(r.kind) ||
        typeof r.ref !== 'string' ||
        r.ref.trim() === '',
    );
    if (unusable !== undefined) {
      return {
        status: 'unavailable',
        reason:
          `the live-state reader returned ${String(unusable.kind)} ${String(unusable.ref)} without a ` +
          'usable read instant, kind or reference, so the reading was not used (FR-CTX-021)',
        ...none,
      };
    }

    const kept: LiveStateReading[] = [];
    const rejected: Rejected[] = [];
    for (const r of readings) {
      const source = {
        sourceType: `live:${r.kind}`,
        sourceId: r.ref,
        workspaceId: input.workspaceId,
      };
      // `FR-CTX-023`, `FR-CTX-054` — the same adjudicator as documents.
      if (await this.ports.access.mayRead(input.actorId, source, input.workspaceId)) {
        kept.push({ kind: r.kind, ref: r.ref, state: r.state, readAt: r.readAt });
      } else {
        rejected.push({
          candidate: { ...source, sourceVersion: r.state, relevanceScore: 0 },
          reason: 'permission',
          detail: `${input.actorId} (${input.actorRole}) may not read ${r.kind} ${r.ref} (FR-CTX-023)`,
          live: true,
        });
      }
    }
    return { status: 'read', reason: null, kept, rejected };
  }

  async #recordRefusal(
    input: AssembleInput,
    outcome: RetrievalOutcome & { modelId: string },
    rejected: readonly Rejected[],
    recorded: Recorded,
    why: string,
  ): Promise<string> {
    // `FR-CTX-065`. The refusal is a row, and it keeps the exclusions that
    // caused it — a refusal nobody can inspect is indistinguishable from an
    // assembly nobody attempted.
    const packageId = randomUUID();
    const essential = new Set(input.essentialSources.map((s) => `${s.sourceType}:${s.sourceId}`));
    await this.store.createPackage(
      this.#packageRow(packageId, input, outcome, 'refused', why, recorded),
    );
    for (const r of rejected) {
      await this.store.addExclusion(
        this.#exclusion(
          input.workspaceId,
          packageId,
          r,
          essential.has(`${r.candidate.sourceType}:${r.candidate.sourceId}`),
        ),
      );
    }
    return packageId;
  }

  #packageRow(
    id: string,
    input: AssembleInput,
    outcome: { modelId: string; requested: number; returned: number } | null,
    state: ContextPackage['state'],
    refusalReason: string | null,
    recorded: Recorded,
  ): ContextPackage {
    return {
      id,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      // `FR-CTX-062`. The database's foreign key to `executions` is what
      // makes the binding real, and what makes retention follow it (`T1267`).
      executionId: input.executionId?.trim() ? input.executionId.trim() : null,
      // Stored verbatim: a normalised objective is a second description of the
      // task, and the two would disagree the moment anybody tuned the rewriting.
      objective: input.objective.trim(),
      actorId: input.actorId,
      actorRole: input.actorRole,
      budgetTokens: input.budgetTokens,
      budgetCost: input.budgetCost,
      state,
      refusalReason,
      embeddingModelId: outcome?.modelId ?? null,
      // `T1281`, `R-038-3` — written onto the row, so the short read survives
      // the response that first reported it. Null when nothing was ranked.
      retrievalRequested: outcome?.requested ?? null,
      retrievalReturned: outcome?.returned ?? null,
      ...recorded,
      stalenessUnknown: null,
      assembledAt: new Date(),
    };
  }

  /**
   * `FR-CTX-042`–`FR-CTX-044`. Asked of the material's **owning** workspace —
   * an authorised crossing's baseline lives where the source does.
   */
  async #provenance(candidate: Candidate): Promise<ResolvedProvenance> {
    const service = this.ports.provenance ?? null;
    if (service === null) {
      // Never `current`: `FR-CTX-044` forbids it, and a default would supply it.
      return {
        sourceType: candidate.sourceType,
        sourceId: candidate.sourceId,
        sourceVersion: candidate.sourceVersion,
        authoritativeStatus: 'undetermined',
        undeterminedReason:
          'no baseline reader is bound — EPIC-033 owns authoritative status — so whether this ' +
          'version still holds is not known (FR-CTX-044)',
      };
    }
    return candidate.sourceType === 'execution-history'
      ? service.resolveExecution(candidate)
      : service.resolve(candidate.workspaceId, candidate);
  }

  #item(
    workspaceId: string,
    packageId: string,
    candidate: Candidate,
    inclusionReason: string,
    crossing: { crossBoundary: boolean; authorisationRef?: string },
    provenance: ResolvedProvenance,
  ): PackageItem {
    const base = {
      id: randomUUID(),
      workspaceId,
      packageId,
      sourceType: candidate.sourceType,
      sourceId: candidate.sourceId,
      sourceVersion: candidate.sourceVersion,
      sourceWorkspaceId: candidate.workspaceId,
      inclusionReason,
      relevanceScore: candidate.relevanceScore,
      ...(crossing.crossBoundary
        ? { crossBoundary: true as const, authorisationRef: crossing.authorisationRef }
        : { crossBoundary: false as const }),
    };
    switch (provenance.authoritativeStatus) {
      case 'superseded':
        return {
          ...base,
          authoritativeStatus: 'superseded',
          supersededBy: provenance.supersededBy,
        };
      case 'undetermined':
        return {
          ...base,
          authoritativeStatus: 'undetermined',
          undeterminedReason: provenance.undeterminedReason,
        };
      default:
        return { ...base, authoritativeStatus: 'current' };
    }
  }

  #exclusion(
    workspaceId: string,
    packageId: string,
    r: Rejected,
    wasEssential: boolean,
  ): ExclusionRecord {
    return {
      id: randomUUID(),
      workspaceId,
      packageId,
      sourceType: r.candidate.sourceType,
      sourceId: r.candidate.sourceId,
      reason: r.reason,
      detail: r.detail,
      wasEssential,
    };
  }
}
