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
import { ValidationFailedError } from '../../core/errors.js';
import type { ContextStore } from './context.store.js';
import type { ContextPackage, PackageItem } from './package.types.js';
import type {
  Candidate,
  ExclusionRecord,
  ExclusionReason,
  RetrievalOutcome,
} from './retrieval/outcome.types.js';
import { shortfallOf } from './retrieval/outcome.types.js';

/** One source, named the way a caller names it. */
export interface SourceRef {
  readonly sourceType: string;
  readonly sourceId: string;
}

export interface AssembleInput {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly objective: string;
  readonly actorId: string;
  readonly actorRole: string;
  readonly budgetTokens: number;
  readonly budgetCost: number;
  /** `FR-CTX-038` — sources whose exclusion refuses the whole assembly. */
  readonly essentialSources: readonly SourceRef[];
}

export interface AssemblyPorts {
  /** `FR-CTX-010`–`FR-CTX-012`. Throws when the index cannot answer. */
  readonly retrieval: {
    search(input: {
      workspaceId: string;
      objective: string;
    }): Promise<RetrievalOutcome & { modelId: string }>;
  };
  /** `FR-CTX-054`, `R-038-7` — `EPIC-024` adjudicates; this Epic only asks. */
  readonly access: {
    mayRead(actorId: string, source: SourceRef): Promise<boolean>;
  };
  /** `FR-CTX-034` — `null` means NOT classified, which excludes. */
  readonly sourceClasses: {
    classify(
      workspaceId: string,
      sourceType: string,
    ): Promise<{ classification: string } | null>;
  };
  /**
   * What one candidate costs against the budget.
   *
   * Injected so the rule under test is the budget rule rather than a
   * tokeniser's judgement. Defaults to a flat estimate; a real cost model is
   * `EPIC-038`'s to refine and nobody else's to guess.
   */
  readonly costOf?: (candidate: Candidate) => number;
}

export interface AssembleResult {
  readonly packageId: string;
  readonly state: 'assembled';
  readonly itemCount: number;
  readonly exclusionCount: number;
  /** `R-038-3` — present when retrieval returned fewer than it was asked for. */
  readonly shortfall: ReturnType<typeof shortfallOf>;
}

/** A candidate that did not make it, before it becomes a row. */
interface Rejected {
  readonly candidate: Candidate;
  readonly reason: ExclusionReason;
  readonly detail: string;
}

export class AssemblyService {
  constructor(
    private readonly store: ContextStore,
    private readonly ports: AssemblyPorts,
  ) {}

  async assemble(input: AssembleInput): Promise<AssembleResult> {
    if (input.objective.trim() === '') {
      throw new ValidationFailedError(
        'a context package is assembled for a stated objective (FR-CTX-032)',
      );
    }

    // `FR-CTX-012` — an unranked package is a different thing, not a degraded
    // one. Deliberately not wrapped: a retrieval error is an outage, and
    // swallowing it here would turn it into "nothing was relevant".
    const outcome = await this.ports.retrieval.search({
      workspaceId: input.workspaceId,
      objective: input.objective,
    });

    const costOf = this.ports.costOf ?? ((): number => 500);
    const essential = new Set(
      input.essentialSources.map((s) => `${s.sourceType}:${s.sourceId}`),
    );
    const isEssential = (c: Candidate): boolean =>
      essential.has(`${c.sourceType}:${c.sourceId}`);

    const kept: { candidate: Candidate; reason: string }[] = [];
    const rejected: Rejected[] = [];
    let spent = 0;

    // Ranked order, so the budget keeps the best matches rather than whichever
    // arrived first.
    const ranked = [...outcome.candidates].sort((a, b) => b.relevanceScore - a.relevanceScore);

    for (const candidate of ranked) {
      const classified = await this.ports.sourceClasses.classify(
        input.workspaceId,
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

      if (!(await this.ports.access.mayRead(input.actorId, candidate))) {
        rejected.push({
          candidate,
          reason: 'permission',
          detail: `${input.actorId} (${input.actorRole}) may not read ${candidate.sourceType} ${candidate.sourceId}`,
        });
        continue;
      }

      const cost = costOf(candidate);
      if (spent + cost > input.budgetTokens) {
        rejected.push({
          candidate,
          reason: 'budget',
          detail: `excluded at ${spent + cost} of a ${input.budgetTokens}-token budget`,
        });
        continue;
      }

      spent += cost;
      kept.push({
        candidate,
        // `FR-CTX-064`, `PP-016` — recorded at the moment of selection, because
        // a reason reconstructed later is a guess about what this loop was
        // thinking. An essential item was not chosen by relevance, and saying
        // it was would misdescribe the package.
        reason: isEssential(candidate)
          ? `marked essential for this objective by the requester`
          : `objective relevance ${candidate.relevanceScore.toFixed(2)} against: ${input.objective}`,
      });
    }

    // `FR-CTX-039` — knowable only now, which is why nothing is written above.
    const blockedEssential = rejected.find((r) => isEssential(r.candidate));
    if (blockedEssential) {
      await this.#recordRefusal(
        input,
        outcome,
        rejected,
        `an essential source was excluded: ${blockedEssential.candidate.sourceType} ` +
          `${blockedEssential.candidate.sourceId} (${blockedEssential.reason}) — ` +
          `${blockedEssential.detail} (FR-CTX-039)`,
      );
      throw new ValidationFailedError(
        `an essential source was excluded by ${blockedEssential.reason}: ` +
          `${blockedEssential.candidate.sourceId} — ${blockedEssential.detail}. ` +
          'Assembly refuses rather than proceeding without material somebody deemed ' +
          'essential (FR-CTX-039)',
      );
    }

    // `FR-CTX-037` — a budget nobody could spend is a fact about the budget.
    if (kept.length === 0 && ranked.length > 0 && rejected.every((r) => r.reason === 'budget')) {
      await this.#recordRefusal(
        input,
        outcome,
        rejected,
        `the budget of ${input.budgetTokens} tokens admitted no candidate (FR-CTX-037)`,
      );
      throw new ValidationFailedError(
        `the budget of ${input.budgetTokens} tokens admits nothing; assembly refuses rather ` +
          'than returning an empty package, because "nothing was relevant" and "nothing was ' +
          'affordable" are different facts (FR-CTX-037)',
      );
    }

    const packageId = randomUUID();
    await this.store.createPackage(this.#packageRow(packageId, input, outcome, 'assembled', null));

    for (const { candidate, reason } of kept) {
      await this.store.addItem(this.#item(packageId, candidate, reason));
    }
    for (const r of rejected) {
      await this.store.addExclusion(this.#exclusion(packageId, r, isEssential(r.candidate)));
    }

    return {
      packageId,
      state: 'assembled',
      itemCount: kept.length,
      exclusionCount: rejected.length,
      // `R-038-3` — a short read is carried onto the result rather than
      // absorbed. An unknown set and an empty set must not behave alike.
      shortfall: shortfallOf(outcome),
    };
  }

  async #recordRefusal(
    input: AssembleInput,
    outcome: RetrievalOutcome & { modelId: string },
    rejected: readonly Rejected[],
    why: string,
  ): Promise<void> {
    // `FR-CTX-065`. The refusal is a row, and it keeps the exclusions that
    // caused it — a refusal nobody can inspect is indistinguishable from an
    // assembly nobody attempted.
    const packageId = randomUUID();
    const essential = new Set(input.essentialSources.map((s) => `${s.sourceType}:${s.sourceId}`));
    await this.store.createPackage(
      this.#packageRow(packageId, input, outcome, 'refused', why),
    );
    for (const r of rejected) {
      await this.store.addExclusion(
        this.#exclusion(packageId, r, essential.has(`${r.candidate.sourceType}:${r.candidate.sourceId}`)),
      );
    }
  }

  #packageRow(
    id: string,
    input: AssembleInput,
    outcome: { modelId: string },
    state: ContextPackage['state'],
    refusalReason: string | null,
  ): ContextPackage {
    return {
      id,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      // Bound by the caller once the execution exists (`FR-CTX-062`).
      executionId: 'ex_1',
      // Stored verbatim: a normalised objective is a second description of the
      // task, and the two would disagree the moment anybody tuned the rewriting.
      objective: input.objective.trim(),
      actorId: input.actorId,
      actorRole: input.actorRole,
      budgetTokens: input.budgetTokens,
      budgetCost: input.budgetCost,
      state,
      refusalReason,
      embeddingModelId: outcome.modelId,
      assembledAt: new Date(),
    };
  }

  #item(packageId: string, candidate: Candidate, inclusionReason: string): PackageItem {
    return {
      id: randomUUID(),
      packageId,
      sourceType: candidate.sourceType,
      sourceId: candidate.sourceId,
      sourceVersion: candidate.sourceVersion,
      // Resolved properly by `provenance.service.ts` in Phase 4. Until then the
      // honest value is `undetermined` with a reason — never `current`, which
      // `FR-CTX-044` forbids and which a default would quietly supply.
      authoritativeStatus: 'undetermined',
      undeterminedReason: 'provenance resolution is not yet bound (FR-CTX-042, T1250)',
      inclusionReason,
      relevanceScore: candidate.relevanceScore,
      crossBoundary: false,
    };
  }

  #exclusion(packageId: string, r: Rejected, wasEssential: boolean): ExclusionRecord {
    return {
      id: randomUUID(),
      packageId,
      sourceType: r.candidate.sourceType,
      sourceId: r.candidate.sourceId,
      reason: r.reason,
      detail: r.detail,
      wasEssential,
    };
  }
}
