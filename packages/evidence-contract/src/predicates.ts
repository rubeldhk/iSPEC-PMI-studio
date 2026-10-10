/**
 * `T856d` — the `predicateType` registry. `FR-EVS-003`: evidence is typed by
 * **what it proves**.
 *
 * `BR-0140` names nine kinds. Each gets exactly one URI: the in-toto or SLSA
 * one where a standard predicate exists, a PMI one under
 * `https://pmi.studio/attestation/` where none does (`R-032-1`).
 *
 * The `origin` column is recorded so a future standard predicate can replace a
 * PMI one **without the gate changing**. The gate matches URIs and never asks
 * where one came from — which is also why two scanners emitting
 * `.../vulns/v0.2` are interchangeable to it (`BR-0146`).
 */

export const EVIDENCE_KINDS = Object.freeze([
  'test-result',
  'scan',
  'build',
  'approval',
  'screenshot',
  'transcript',
  'review-finding',
  'deployment',
  'external-output',
] as const);

export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export type PredicateOrigin = 'in-toto' | 'slsa' | 'pmi';

export interface PredicateTypeEntry {
  readonly kind: EvidenceKind;
  readonly uri: string;
  readonly origin: PredicateOrigin;
}

const PMI = 'https://pmi.studio/attestation';

export const PREDICATE_TYPES: readonly PredicateTypeEntry[] = Object.freeze([
  { kind: 'test-result', uri: 'https://in-toto.io/attestation/test-result/v0.1', origin: 'in-toto' },
  { kind: 'scan', uri: 'https://in-toto.io/attestation/vulns/v0.2', origin: 'in-toto' },
  { kind: 'build', uri: 'https://slsa.dev/provenance/v1', origin: 'slsa' },
  // in-toto has no approval, screenshot, transcript, review-finding, deployment
  // or generic tool-output predicate. Ours, until a standard one exists.
  { kind: 'approval', uri: `${PMI}/approval/v1`, origin: 'pmi' },
  { kind: 'screenshot', uri: `${PMI}/screenshot/v1`, origin: 'pmi' },
  { kind: 'transcript', uri: `${PMI}/transcript/v1`, origin: 'pmi' },
  { kind: 'review-finding', uri: `${PMI}/review-finding/v1`, origin: 'pmi' },
  { kind: 'deployment', uri: `${PMI}/deployment/v1`, origin: 'pmi' },
  { kind: 'external-output', uri: `${PMI}/external-output/v1`, origin: 'pmi' },
] as const);

export function predicateTypeFor(kind: EvidenceKind): string {
  return PREDICATE_TYPES.find((entry) => entry.kind === kind)!.uri;
}

/** The kind a URI proves, or `null` — never a guess from a similar-looking URI. */
export function kindOf(uri: string): EvidenceKind | null {
  return PREDICATE_TYPES.find((entry) => entry.uri === uri)?.kind ?? null;
}

export function isStandardPredicate(uri: string): boolean {
  const entry = PREDICATE_TYPES.find((p) => p.uri === uri);
  return entry !== undefined && entry.origin !== 'pmi';
}

export function isPmiPredicate(uri: string): boolean {
  return PREDICATE_TYPES.some((p) => p.uri === uri && p.origin === 'pmi');
}

/**
 * Whether a predicate **reports a failure of the thing it attests**.
 *
 * The gate matches items by `predicateType` (`FR-EVS-003`), and a type says
 * what *kind* of proof a document is — not what it proved. A `test-result`
 * whose `result` is `FAILED` is genuine evidence that the tests failed. Without
 * this, it would satisfy an item reading *"automated tests pass"*, and *"done is
 * not proof"* (`BR-0144`) would be undone by a failing run.
 *
 * Deliberately narrow: only predicates whose **standard** schema has an
 * explicit outcome field are read, and only that field. in-toto `test-result`
 * defines `result` as `PASSED`, `WARNED` or `FAILED`; `WARNED` is a pass with
 * warnings. Everything else — a scan, a build, an approval — attests that the
 * thing happened, and its content is for a reader, not the gate. Whether a scan
 * with findings should block is a policy question (`EPIC-031`), not this one.
 */
export function declaresFailure(predicateType: string, predicate: unknown): boolean {
  if (predicateType !== predicateTypeFor('test-result')) return false;
  if (typeof predicate !== 'object' || predicate === null) return false;
  return (predicate as { result?: unknown }).result === 'FAILED';
}
