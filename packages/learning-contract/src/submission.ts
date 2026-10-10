/**
 * `T2308` (EPIC-048) — `LearningSubmissionV1` and `parseSubmission`
 * (`contracts/learning-contract.md` §2).
 *
 * The **same function** the backend uses, so a connector can validate before it
 * sends and the two can never disagree about what a valid submission is
 * (`FR-LRN-061`).
 *
 * `FR-LRN-010`: every missing element of source, evidence, confidence and scope
 * is named in one answer. It never throws — an unparseable body is a list of
 * problems, not a 500.
 */
import { parseScope, type ClaimedScope } from './scope.js';
import {
  CANDIDATE_KINDS,
  CONFIDENCE_LEVELS,
  RISK_BANDS,
  type CandidateKind,
  type ConfidenceLevel,
  type RiskBand,
} from './states.js';

export const SUBMISSION_SCHEMA_VERSION = 1 as const;

export interface EvidenceCitation {
  readonly evidenceId: string;
  readonly digest: { readonly sha256: string };
}

export interface LearningSubmissionV1 {
  readonly schemaVersion: 1;
  /** Required on the connector route; absent ⇒ a person is the source (`FR-LRN-006`). */
  readonly executionId?: string;
  readonly kind: CandidateKind;
  readonly targetVersionId?: string;
  readonly statement: string;
  readonly category: string;
  readonly subject: string;
  /** ≥ 1 — `FR-LRN-012`. */
  readonly evidence: readonly [EvidenceCitation, ...EvidenceCitation[]];
  readonly confidence: { readonly level: ConfidenceLevel; readonly basis: string };
  readonly claimedScope: ClaimedScope;
  /** The submitter's proposal only; never the effective band (`FR-LRN-023`). */
  readonly proposedBand?: RiskBand;
  readonly idempotencyKey: string;
  readonly correlationId: string;
}

/** The four elements `FR-LRN-010` names. */
export type MissingElement = 'source' | 'evidence' | 'confidence' | 'scope';

export interface SubmissionProblem {
  readonly field: string;
  readonly problem: string;
}

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly missing: readonly MissingElement[]; readonly problems: readonly SubmissionProblem[] };

export interface ParseOptions {
  /** True for agents and connectors: an execution must be named (`FR-LRN-005`). */
  readonly requireExecution?: boolean;
}

const SHA256 = /^[a-f0-9]{64}$/;

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function parseSubmission(candidate: unknown, options: ParseOptions = {}): ParseResult<LearningSubmissionV1> {
  const missing = new Set<MissingElement>();
  const problems: SubmissionProblem[] = [];
  const problem = (field: string, text: string): void => {
    problems.push({ field, problem: text });
  };

  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return {
      ok: false,
      missing: ['source', 'evidence', 'confidence', 'scope'],
      problems: [{ field: '(body)', problem: 'a submission must be a JSON object' }],
    };
  }
  const raw = candidate as Record<string, unknown>;

  if (raw['schemaVersion'] !== SUBMISSION_SCHEMA_VERSION) {
    problem('schemaVersion', `schemaVersion must be ${SUBMISSION_SCHEMA_VERSION}`);
  }

  // Source.
  const executionId = raw['executionId'];
  if (executionId !== undefined && !nonEmptyString(executionId)) {
    missing.add('source');
    problem('executionId', 'executionId must name a registered execution');
  } else if (executionId === undefined && options.requireExecution === true) {
    missing.add('source');
    problem('executionId', 'an agent submission names the registered execution it came from');
  }

  // Kind and target.
  const kind = raw['kind'];
  if (!(CANDIDATE_KINDS as readonly unknown[]).includes(kind)) {
    problem('kind', `kind must be one of ${CANDIDATE_KINDS.join(', ')}`);
  }
  const targetVersionId = raw['targetVersionId'];
  if (kind === 'new') {
    if (targetVersionId !== undefined) problem('targetVersionId', 'a new candidate targets no version');
  } else if ((CANDIDATE_KINDS as readonly unknown[]).includes(kind) && !nonEmptyString(targetVersionId)) {
    problem('targetVersionId', `a ${String(kind)} candidate names the version it acts on`);
  }

  // Content (FR-LRN-003).
  for (const field of ['statement', 'category', 'subject'] as const) {
    if (!nonEmptyString(raw[field])) problem(field, `${field} is required`);
  }

  // Evidence (FR-LRN-012).
  const evidenceRaw = raw['evidence'];
  const evidence: EvidenceCitation[] = [];
  if (!Array.isArray(evidenceRaw) || evidenceRaw.length === 0) {
    missing.add('evidence');
    problem('evidence', 'at least one evidence citation {evidenceId, digest: {sha256}} is required');
  } else {
    evidenceRaw.forEach((item: unknown, i) => {
      const cite = (item ?? {}) as { evidenceId?: unknown; digest?: unknown };
      if (typeof item !== 'object' || item === null || !nonEmptyString(cite.evidenceId)) {
        problem(`evidence[${i}].evidenceId`, 'each citation names an Evidence Store item');
      }
      const digest = (cite.digest ?? {}) as { sha256?: unknown };
      const sha = typeof digest === 'object' && digest !== null ? digest.sha256 : undefined;
      if (typeof sha !== 'string' || !SHA256.test(sha)) {
        problem(`evidence[${i}].digest.sha256`, 'each citation carries the sha256 digest it cites (64 lower-case hex)');
      }
      if (nonEmptyString(cite.evidenceId) && typeof sha === 'string' && SHA256.test(sha)) {
        // An id and a digest only: nothing else from the body is kept (FR-LRN-012).
        evidence.push({ evidenceId: cite.evidenceId, digest: { sha256: sha } });
      }
    });
  }

  // Confidence (FR-LRN-013).
  const confidenceRaw = raw['confidence'];
  let confidence: LearningSubmissionV1['confidence'] | undefined;
  if (confidenceRaw === null || typeof confidenceRaw !== 'object' || Array.isArray(confidenceRaw)) {
    missing.add('confidence');
    problem('confidence', 'confidence {level, basis} is required');
  } else {
    const c = confidenceRaw as { level?: unknown; basis?: unknown };
    const levelOk = (CONFIDENCE_LEVELS as readonly unknown[]).includes(c.level);
    if (!levelOk) problem('confidence.level', `confidence.level must be one of ${CONFIDENCE_LEVELS.join(', ')}`);
    if (!nonEmptyString(c.basis)) {
      missing.add('confidence');
      problem('confidence.basis', 'confidence.basis — why the submitter is this sure — is required');
    }
    if (levelOk && nonEmptyString(c.basis)) confidence = { level: c.level as ConfidenceLevel, basis: c.basis };
  }

  // Scope (FR-LRN-014).
  const scopeRaw = raw['claimedScope'];
  let claimedScope: ClaimedScope | undefined;
  if (scopeRaw === undefined || scopeRaw === null) {
    missing.add('scope');
    problem('claimedScope', 'claimedScope {kind, projectIds} is required');
  } else {
    const parsed = parseScope(scopeRaw);
    if (parsed.ok) claimedScope = parsed.value;
    else problem('claimedScope', parsed.problem);
  }

  // Band proposal (FR-LRN-023).
  const proposedBand = raw['proposedBand'];
  if (proposedBand !== undefined && !(RISK_BANDS as readonly unknown[]).includes(proposedBand)) {
    problem('proposedBand', `proposedBand must be one of ${RISK_BANDS.join(', ')}`);
  }

  // Controls (FR-LRN-061).
  if (!nonEmptyString(raw['idempotencyKey'])) problem('idempotencyKey', 'idempotencyKey is required');
  if (!nonEmptyString(raw['correlationId'])) problem('correlationId', 'correlationId is required');

  if (problems.length > 0 || confidence === undefined || claimedScope === undefined || evidence.length === 0) {
    return { ok: false, missing: [...missing], problems };
  }

  const value: LearningSubmissionV1 = {
    schemaVersion: 1,
    ...(nonEmptyString(executionId) ? { executionId } : {}),
    kind: kind as CandidateKind,
    ...(kind !== 'new' ? { targetVersionId: targetVersionId as string } : {}),
    statement: raw['statement'] as string,
    category: raw['category'] as string,
    subject: raw['subject'] as string,
    evidence: evidence as unknown as LearningSubmissionV1['evidence'],
    confidence,
    claimedScope,
    ...(proposedBand !== undefined ? { proposedBand: proposedBand as RiskBand } : {}),
    idempotencyKey: raw['idempotencyKey'] as string,
    correlationId: raw['correlationId'] as string,
  };
  return { ok: true, value };
}
