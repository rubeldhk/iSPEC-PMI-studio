/**
 * `T998n` (EPIC-035) — verification and closure. **Requests runs, owns no
 * runner.**
 *
 * `FR-DFR-060` to `FR-DFR-064`, `BR-0056`, `BR-0144`, `R-035-1`.
 *
 * ## The sentence this service enforces
 *
 * **"We could not run the tests" must never resolve to "the tests passed."**
 *
 * That is why `TestExecution` refuses when absent while `EPIC-034`'s
 * `ImpactSource` degrades. A missing analysis is a missing input a
 * decision-maker can weigh; a missing test run is the absence of the only thing
 * that distinguishes a fix from a claim.
 *
 * `R-035-1` establishes that the port has **no owner**: `BR-0080` is a gate on
 * promotion, `EPIC-015` built that gate and not a service, and nothing in the
 * programme exposes a callable runner. So in this deployment every verification
 * and every closure refuses with `503`, naming the seam — which is the honest
 * state, not a gap to be papered over. `FR-DFR-062` forbids building a second
 * runner here, in the words of the requirement a runner would be trying to
 * satisfy.
 *
 * ## Applicable is derived, never chosen
 *
 * `FR-DFR-060` defines *applicable* as the **transitive test set reachable from
 * the artifacts the fix touched**, through `EPIC-011`'s chain. A selected set is
 * one the person closing the defect can make small, and they will not mean
 * anything by it — they will simply not know about the Epic downstream.
 * `FR-DFR-061` says the same thing from the other side: the walk knows nothing
 * about Epic boundaries, so it cannot stop at one.
 *
 * ## An unknown set and an empty one must not behave alike
 *
 * `FR-DFR-064`. Where the chain cannot place an artifact the fix touched,
 * closure is **refused** and does not fall back to the defect test alone. That
 * fallback is the tempting one — it reads as graceful degradation, and it is how
 * a fix that broke another Epic gets closed with a green tick.
 *
 * ## What is deliberately not here
 *
 * `FR-DFR-031`'s rule that a single passing run must not close an intermittent
 * defect belongs to `T998w`, in the evidence-check service where intermittency
 * is handled. It is named here so its absence is a boundary rather than an
 * omission.
 *
 * Framework-free (PC-1).
 */
import { ConflictError, GovernanceSeamUnboundError, NotFoundError, ValidationFailedError } from '../../core/errors.js';
import {
  traverseChain,
  type ChainLinkShape,
  type ChainLinkSource,
  type ChainNode,
} from '../traceability/chain-traversal.service.js';
import type { DefectRoomStore } from './defect-room.store.js';
import type { DefectTestService } from './defect-test.service.js';

/** One test's result, as `EPIC-015`'s eventual surface would report it. */
export interface TestRunResult {
  readonly testRef: string;
  readonly outcome: 'pass' | 'fail';
  /**
   * The attestation in `EPIC-032` that backs this result.
   *
   * Nullable so a runner **can** report a result with nothing behind it — and
   * so this service can refuse it. `FR-DFR-063`: a declaration of completion is
   * not evidence, and a result asserting "pass" with no reference is a
   * declaration wearing the shape of a run.
   */
  readonly evidenceRef: string | null;
}

/**
 * `FR-DFR-062` — runs are **requested**, never performed here.
 *
 * `R-035-1`: unowned. The port exists so that the day somebody builds the
 * surface `BR-0080` implies, this Room has a place to bind it — and so that
 * until then the refusal is specific rather than a feature that quietly does
 * nothing.
 */
export interface TestExecutionPort {
  run(input: {
    workspaceId: string;
    testRefs: readonly string[];
  }): Promise<readonly TestRunResult[]>;
}

/**
 * `FR-DFR-060`, `FR-DFR-064` — the derived set, or a stated inability to derive
 * it.
 *
 * A discriminated union rather than an array that might be empty, because the
 * two cases must not be representable by the same value. An empty array meaning
 * both "no regressions apply" and "nobody could tell" is precisely the
 * conflation `FR-DFR-064` forbids.
 */
export type RegressionScope =
  | { readonly known: true; readonly testRefs: readonly string[] }
  | { readonly known: false; readonly because: string };

/**
 * Walk **down** from each artifact the fix touched and collect the tests.
 *
 * Down, because `EPIC-011` records a link from the derived artifact to the one
 * it derives from: `test → code` means *this test covers that code*, so the
 * tests are found by following incoming edges. Pure over a link list, so the
 * rule is testable without a database.
 */
export function applicableRegressionScope(
  links: readonly ChainLinkShape[],
  touched: readonly ChainNode[],
): RegressionScope {
  const testRefs = new Set<string>();

  for (const node of touched) {
    const appears = links.some(
      (link) =>
        (link.sourceType === node.artifactType && link.sourceId === node.artifactId) ||
        (link.targetType === node.artifactType && link.targetId === node.artifactId),
    );
    if (!appears) {
      // Not "zero tests" — no answer. The fix touched something the chain
      // cannot place, so what it might break is unknown, and `FR-DFR-064` says
      // an unknown set and an empty one must not behave alike.
      return {
        known: false,
        because:
          `the traceability chain has no link touching ${node.artifactType} ${node.artifactId}, ` +
          'so the set of tests reachable from it cannot be computed (FR-DFR-064)',
      };
    }

    for (const link of traverseChain(links, node, 'down').links) {
      if (link.sourceType === 'test') testRefs.add(link.sourceId);
    }
  }

  return { known: true, testRefs: [...testRefs] };
}

export interface CloseInput {
  readonly workspaceId: string;
  readonly defectId: string;
  /** `FR-DFR-060` — what the fix touched, from which the set is derived. */
  readonly touchedArtifacts: readonly ChainNode[];
  readonly closedBy: string;
}

export interface VerificationOutcome {
  readonly testRefs: readonly string[];
  readonly results: readonly TestRunResult[];
}

export class VerificationService {
  constructor(
    private readonly store: DefectRoomStore,
    private readonly tests: DefectTestService,
    private readonly execution?: TestExecutionPort | undefined,
    private readonly links?: ChainLinkSource | undefined,
  ) {}

  /**
   * `FR-DFR-041`, `FR-DFR-062` — run what applies, and record what came back.
   *
   * Verification does not close anything. It is the step that produces the
   * evidence closure then requires, and separating them means a run that
   * happened is recorded even when the outcome refuses closure.
   */
  async verify(input: CloseInput): Promise<VerificationOutcome> {
    const outcome = await this.runApplicable(input);
    await this.store.setDefectState(input.workspaceId, input.defectId, 'verifying');
    return outcome;
  }

  /** `FR-DFR-060`, `FR-DFR-063`, `FR-DFR-064` — close, or refuse and say why. */
  async close(input: CloseInput): Promise<VerificationOutcome> {
    const outcome = await this.runApplicable(input);

    const failed = outcome.results.filter((result) => result.outcome !== 'pass');
    if (failed.length > 0) {
      throw new ConflictError(
        `closure requires the defect test and every applicable regression test to pass; these ` +
          `failed: ${failed.map((r) => r.testRef).join(', ')} (FR-DFR-060)`,
      );
    }

    await this.store.setDefectState(input.workspaceId, input.defectId, 'closed');
    return outcome;
  }

  /**
   * Everything both paths share: the precondition, the derived set, the run,
   * and the evidence check on what came back.
   */
  private async runApplicable(input: CloseInput): Promise<VerificationOutcome> {
    const defect = await this.store.findDefect(input.workspaceId, input.defectId);
    if (!defect) throw new NotFoundError('Not found.');

    // `FR-DFR-041` at the other end of the workflow. The reason carries the
    // route that records one, so the refusal has somewhere to go.
    const acceptance = await this.tests.acceptFix({
      workspaceId: input.workspaceId,
      defectId: defect.id,
      acceptedBy: input.closedBy,
    });
    if (!acceptance.accepted) throw new ConflictError(acceptance.reason);

    if (input.touchedArtifacts.length === 0) {
      // Nothing to derive a set from is the same fact as a set nobody can
      // compute. Reading it as "no regressions" would let a caller opt out of
      // `FR-DFR-060` by sending less.
      throw new ValidationFailedError(
        'closure states which artifacts the fix touched, because the applicable regression set ' +
          'is derived from them and not chosen (FR-DFR-060)',
      );
    }

    const scope = await this.regressionScope(input);
    if (!scope.known) {
      throw new ConflictError(
        `${scope.because} — closure is refused rather than falling back to the defect test ` +
          'alone, because an unknown regression set and an empty one must not behave alike ' +
          '(FR-DFR-064)',
      );
    }

    if (!this.execution) {
      // `R-035-1`, `BR-0144`. The message names the seam: a 503 saying nothing
      // is the same defect with a better number.
      throw new GovernanceSeamUnboundError(
        'no TestExecution is bound (R-035-1 — no callable test-execution surface exists in the ' +
          'programme), so nothing can be run; "we could not run the tests" is not "the tests ' +
          'passed" (FR-DFR-062, FR-DFR-063, BR-0144)',
      );
    }

    // The defect's own test is always in the set, whatever the chain says. It is
    // the one test whose failure was observed.
    const testRefs = [
      ...new Set([
        ...(await this.store.testsFor(input.workspaceId, defect.id)).map((row) => row.testRef),
        ...scope.testRefs,
      ]),
    ];

    const results = await this.execution.run({ workspaceId: input.workspaceId, testRefs });
    this.assertCovers(testRefs, results);
    await this.retain(input.workspaceId, defect.id, results);

    return { testRefs, results };
  }

  private async regressionScope(input: CloseInput): Promise<RegressionScope> {
    if (!this.links) {
      // Unbound is the same outcome as unanswerable, and for the same reason:
      // nobody can say what this fix might have broken.
      return {
        known: false,
        because:
          'no traceability chain source is bound (EPIC-011 supplies it), so the applicable ' +
          'regression set cannot be computed (FR-DFR-064)',
      };
    }
    return applicableRegressionScope(
      await this.links.linksForWorkspace(input.workspaceId),
      input.touchedArtifacts,
    );
  }

  /**
   * `FR-DFR-063` — every requested test reported, and every pass backed.
   *
   * A result set that omits a test leaves it unrun, and an unrun test nothing
   * reports is the silent version of the whole problem this Room exists for.
   */
  private assertCovers(testRefs: readonly string[], results: readonly TestRunResult[]): void {
    const reported = new Set(results.map((result) => result.testRef));
    const missing = testRefs.filter((ref) => !reported.has(ref));
    if (missing.length > 0) {
      throw new ConflictError(
        `the run reported nothing for ${missing.join(', ')}, so those tests are unrun rather ` +
          'than passing (FR-DFR-063)',
      );
    }

    const unbacked = results.filter(
      (result) => result.outcome === 'pass' && (result.evidenceRef ?? '') === '',
    );
    if (unbacked.length > 0) {
      throw new ConflictError(
        `${unbacked.map((r) => r.testRef).join(', ')} reported passing with no evidence ` +
          'reference, which is a declaration of completion rather than evidence ' +
          '(FR-DFR-063, BR-0144)',
      );
    }
  }

  /** `FR-DFR-060` — retain the reference; the attestation lives in `EPIC-032`. */
  private async retain(
    workspaceId: string,
    defectId: string,
    results: readonly TestRunResult[],
  ): Promise<void> {
    for (const row of await this.store.testsFor(workspaceId, defectId)) {
      const result = results.find((candidate) => candidate.testRef === row.testRef);
      if (result) {
        await this.store.setTestRun(workspaceId, row.id, result.outcome, result.evidenceRef);
      }
    }
  }
}
