/**
 * `T860e` — `EPIC-015`'s validation runs as attestation **producers**
 * (`R-032-6`, `FR-EVS-050`).
 *
 * `EPIC-015` owns **running** validation and is built and closed; `BR-0080`
 * asks for the validation evidence to be *retained*, which is the half it did
 * not build. This converts the report a run already wrote — Vitest's
 * `--reporter=json` output — into an in-toto `test-result/v0.1` Statement.
 *
 * **It runs nothing.** It reads a report that exists; `evidence-no-review-
 * engine.spec.ts` asserts the module spawns no process and imports no runner.
 * A second validation path beside `EPIC-015` is what `FR-EVS-050` forbids.
 *
 * The predicate follows the in-toto `test-result` schema: `result` is `PASSED`
 * only when the run succeeded with no failed test, and the test names are
 * carried so a reader can see what was run without opening the report.
 */
import {
  IN_TOTO_STATEMENT_TYPE,
  predicateTypeFor,
  type Attestation,
  type AttestationSubject,
} from '@pmi/evidence-contract';
import type { WorkRef } from './evidence.types.js';

/** The subset of Vitest's JSON reporter output this reads. */
export interface VitestJsonReport {
  readonly success: boolean;
  readonly numFailedTests: number;
  readonly testResults: ReadonlyArray<{
    readonly name: string;
    readonly assertionResults: ReadonlyArray<{ readonly fullName: string; readonly status: string }>;
  }>;
}

export interface QaRunContext {
  /** The artifact the run validated, at the content identity it ran against. */
  readonly subject: AttestationSubject;
  readonly attestedArtifact: { readonly id: string; readonly version: number };
  readonly attachedTo: WorkRef;
  readonly projectId: string;
  readonly producedAt: Date;
  /** Where the run can be seen — a CI run URL. */
  readonly runUrl?: string;
  /** The suite configuration, e.g. `vitest.workspace.ts`. */
  readonly configuration?: string;
}

export function attestationFromVitestReport(report: VitestJsonReport, context: QaRunContext): Attestation {
  const assertions = report.testResults.flatMap((file) => file.assertionResults);
  const named = (status: string) => assertions.filter((a) => a.status === status).map((a) => a.fullName);
  const failedTests = named('failed');
  return {
    _type: IN_TOTO_STATEMENT_TYPE,
    subject: [context.subject],
    predicateType: predicateTypeFor('test-result'),
    predicate: {
      result: report.success && report.numFailedTests === 0 && failedTests.length === 0 ? 'PASSED' : 'FAILED',
      ...(context.configuration !== undefined ? { configuration: [{ name: context.configuration }] } : {}),
      ...(context.runUrl !== undefined ? { url: context.runUrl } : {}),
      passedTests: named('passed'),
      warnedTests: [],
      failedTests,
    },
  };
}

/** The body `POST /evidence` (or `EvidenceService.contribute`) takes. */
export function contributionFromVitestReport(report: VitestJsonReport, context: QaRunContext) {
  return {
    attestation: attestationFromVitestReport(report, context),
    attestedArtifact: context.attestedArtifact,
    attachedTo: context.attachedTo,
    producedAt: context.producedAt.toISOString(),
    // A platform producer: it contributes in-process, not through the
    // external-tool registry (FR-EVS-040 governs third-party tools).
    source: { uri: 'pmi:qa-suite' },
    projectId: context.projectId,
  };
}
