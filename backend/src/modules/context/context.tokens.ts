/**
 * `T1234` (EPIC-038) — the five ports, and what each absence does.
 *
 * ## The split, which is the design
 *
 * **Two degrade.** Live state and execution history are *additions* to a
 * package. Missing them makes it smaller, and `FR-CTX-022` and `FR-CTX-015`
 * require it to say so — *unavailable with a reason* is distinguishable from
 * *read and empty*, which is the whole of the degradation being honest.
 *
 * **Three refuse.** An embedding model, an access adjudicator and the document
 * corpus are *preconditions*. Missing any of them makes the package **wrong**
 * rather than smaller, and a wrong package is one nobody can tell is wrong:
 *
 * - No embedding model and a zero vector would rank every candidate identically
 *   — a package that looks ranked and is not.
 * - No access adjudicator and every candidate is included — the leak, delivered
 *   in a package that reads as normal.
 * - No corpus and there is nothing to assemble, so an empty package would
 *   report *"nothing was relevant"* about a search that never happened.
 *
 * `FR-GEL-062` states the rule this file applies five times: **a default that
 * permits is invisible.**
 *
 * Framework-free (PC-1).
 */

export type AbsentBehaviour = 'refuse' | 'degrade';

export interface ContextPort {
  readonly name: string;
  /** Who supplies it — or `unowned`, stated rather than left blank. */
  readonly filledBy: string;
  readonly absent: AbsentBehaviour;
  /** Why that behaviour, for whoever is later tempted to flip it. */
  readonly because: string;
}

export const CONTEXT_PORTS: readonly ContextPort[] = Object.freeze([
  Object.freeze({
    name: 'EmbeddingPort',
    filledBy: 'unowned — no embedding provider exists anywhere in the programme (FR-CTX-013)',
    absent: 'refuse' as const,
    because:
      'a zero vector would rank every candidate identically, producing a package that looks ' +
      'ranked and is not — and nothing downstream could tell the difference between that and a ' +
      'corpus with no relevant material in it',
  }),
  Object.freeze({
    name: 'AccessPolicy',
    filledBy: 'EPIC-024 (artifact access control)',
    absent: 'refuse' as const,
    because:
      'with no adjudicator every candidate would be included, which is the leak FR-CTX-050 ' +
      'exists to prevent, delivered inside a package that reads as entirely normal. This Epic ' +
      'must not implement a second access model (FR-CTX-054)',
  }),
  Object.freeze({
    name: 'ArtifactSource',
    filledBy: 'EPIC-033 (baselines and requirements), EPIC-032 (evidence references)',
    absent: 'refuse' as const,
    because:
      'with no governed documents there is no corpus, and an empty package would report that ' +
      'nothing was relevant about a search that never happened',
  }),
  Object.freeze({
    name: 'ExecutionProjections',
    filledBy: 'EPIC-037 (governed execution registry, current-state projections)',
    absent: 'degrade' as const,
    because:
      'execution history is an addition to a package rather than a precondition for one; ' +
      'without it the package is smaller and FR-CTX-015 requires it to record that the history ' +
      'half was unavailable',
  }),
  Object.freeze({
    name: 'LiveStateReader',
    filledBy: 'the systems holding repository, build, deployment and incident state',
    absent: 'degrade' as const,
    because:
      'FR-CTX-022 requires unavailable-with-a-reason to be distinguishable from read-and-empty, ' +
      'so the absence is recorded on the package rather than refusing the whole assembly',
  }),
]);

/** Injection tokens, one per port. */
export const EMBEDDING_PORT = Symbol('CONTEXT_EMBEDDING_PORT');
export const ACCESS_POLICY = Symbol('CONTEXT_ACCESS_POLICY');
export const ARTIFACT_SOURCE = Symbol('CONTEXT_ARTIFACT_SOURCE');
export const EXECUTION_PROJECTIONS = Symbol('CONTEXT_EXECUTION_PROJECTIONS');
export const LIVE_STATE_READER = Symbol('CONTEXT_LIVE_STATE_READER');

/** Where the packages live. */
export const CONTEXT_STORE = Symbol('CONTEXT_STORE');

/**
 * What a named port's absence does, or `null` when nobody declared it.
 *
 * `null` rather than a default: a typo'd port name defaulting to `degrade`
 * would make an undeclared dependency silently survivable, which is exactly the
 * permissive default `FR-GEL-062` calls invisible.
 */
export function absentBehaviourOf(name: string): AbsentBehaviour | null {
  return CONTEXT_PORTS.find((port) => port.name === name)?.absent ?? null;
}
