/**
 * `T856b` — the attestation envelope, **adopted from in-toto, not invented**
 * (`R-032-1`).
 *
 * The shape is the in-toto Attestation v1 Statement's; the types are ours. No
 * npm package is taken — conforming to a JSON shape needs no runtime dependency
 * (`TS-001`).
 *
 * ## The fence `FR-EVS-042` needs
 *
 * A contribution naming no artifact version is refused. Here that is two type
 * facts: `subject` is a **non-empty tuple**, and a subject's `digest` carries
 * **at least one** algorithm. The compiler refuses the bad value before any
 * runtime check is reached; `parseAttestation` is the same rule for bodies that
 * arrive over HTTP, where no compiler stands guard.
 *
 * ## Any one algorithm, not all three
 *
 * The in-toto Statement spec requires each subject to carry a digest *set* —
 * any algorithm. Its own `test-result` example names `gitCommit` alone.
 * `contracts/evidence-contract.md` §1 first typed the digest as a record of all
 * three, which would have refused every real test-result attestation; this is
 * the corrected form.
 */

export const IN_TOTO_STATEMENT_TYPE = 'https://in-toto.io/Statement/v1' as const;

/** The digest algorithms this platform accepts. in-toto permits others; we name ours. */
export const DIGEST_ALGORITHMS = Object.freeze(['sha256', 'gitCommit', 'gitBlob'] as const);

export type DigestAlgorithm = (typeof DIGEST_ALGORITHMS)[number];

type AtLeastOne<K extends string> = {
  [P in K]: Readonly<Record<P, string>> & Readonly<Partial<Record<Exclude<K, P>, string>>>;
}[K];

/** A digest set naming at least one algorithm. `{}` does not type-check. */
export type SubjectDigest = AtLeastOne<DigestAlgorithm>;

export interface AttestationSubject {
  readonly name: string;
  readonly digest: SubjectDigest;
}

/** in-toto Attestation v1 Statement. */
export interface Attestation {
  readonly _type: typeof IN_TOTO_STATEMENT_TYPE;
  /** `FR-EVS-042` — at least one subject, so "attests nothing" is unrepresentable. */
  readonly subject: readonly [AttestationSubject, ...AttestationSubject[]];
  /** `FR-EVS-003` — a URI naming what this proves, not which tool produced it. */
  readonly predicateType: string;
  readonly predicate: unknown;
}

/**
 * Two refusals, kept apart because the HTTP surface answers them differently in
 * spirit: `no-subject-digest` is `FR-EVS-042` specifically — *you did not say
 * which version* — and `malformed` is everything else.
 */
export type AttestationRefusal = 'no-subject-digest' | 'malformed';

export type ParseResult =
  | { readonly ok: true; readonly value: Attestation }
  | { readonly ok: false; readonly reason: AttestationRefusal; readonly message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseDigest(value: unknown): SubjectDigest | null {
  if (!isRecord(value)) return null;
  const out: Partial<Record<DigestAlgorithm, string>> = {};
  for (const algorithm of DIGEST_ALGORITHMS) {
    const candidate = value[algorithm];
    if (typeof candidate === 'string' && candidate.length > 0) out[algorithm] = candidate;
  }
  return Object.keys(out).length > 0 ? (out as SubjectDigest) : null;
}

/** The runtime fence. Returns a result; never throws (`R-032-2`). */
export function parseAttestation(candidate: unknown): ParseResult {
  if (!isRecord(candidate)) {
    return { ok: false, reason: 'malformed', message: 'an attestation is a JSON object' };
  }
  if (candidate['_type'] !== IN_TOTO_STATEMENT_TYPE) {
    return {
      ok: false,
      reason: 'malformed',
      message: `an attestation's _type is ${IN_TOTO_STATEMENT_TYPE}`,
    };
  }
  const predicateType = candidate['predicateType'];
  if (typeof predicateType !== 'string' || !/^https?:\/\/\S+$/.test(predicateType)) {
    return {
      ok: false,
      reason: 'malformed',
      message: 'predicateType is a URI naming what the evidence proves (FR-EVS-003)',
    };
  }

  const rawSubjects = candidate['subject'];
  if (!Array.isArray(rawSubjects) || rawSubjects.length === 0) {
    return {
      ok: false,
      reason: 'no-subject-digest',
      message: 'an attestation names at least one subject and its digest (FR-EVS-042)',
    };
  }
  const subjects: AttestationSubject[] = [];
  for (const raw of rawSubjects) {
    const digest = isRecord(raw) ? parseDigest(raw['digest']) : null;
    if (digest === null) {
      return {
        ok: false,
        reason: 'no-subject-digest',
        message:
          `every subject carries a digest in one of ${DIGEST_ALGORITHMS.join(', ')}; ` +
          'a contribution naming no version is refused, never attached to whatever is current (FR-EVS-042)',
      };
    }
    const name = isRecord(raw) && typeof raw['name'] === 'string' ? raw['name'] : '_';
    subjects.push({ name, digest });
  }

  return {
    ok: true,
    value: {
      _type: IN_TOTO_STATEMENT_TYPE,
      subject: subjects as unknown as Attestation['subject'],
      predicateType,
      predicate: candidate['predicate'] ?? null,
    },
  };
}
