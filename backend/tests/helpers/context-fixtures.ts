/**
 * Fixtures for `EPIC-038`'s assembly tests.
 *
 * Shared because seven spec files build the same three ports, and a fixture
 * copied seven times is seven places that drift. `EPIC-035` learned this the
 * expensive way twice in one session — a default parameter meant
 * `service(undefined)` received the bound port, so two tests written to prove
 * an unbound refusal were exercising a bound one and passing for the wrong
 * reason.
 *
 * **So nothing here takes a default.** Every helper is an explicit
 * construction, and a test that wants an absent port passes `undefined`
 * itself, visibly, at the call site.
 */
import type { AssembleInput, AssemblyPorts } from '../../src/modules/context/assembly.service.js';
import type { Candidate, RetrievalOutcome } from '../../src/modules/context/retrieval/outcome.types.js';

/** Ranked candidates, newest ranking first. */
export function candidates(ids: readonly string[], score = 0.9): Candidate[] {
  return ids.map((sourceId, index) => ({
    sourceType: 'requirement',
    sourceId,
    sourceVersion: 'v1',
    relevanceScore: score - index * 0.01,
  }));
}

/**
 * A retrieval port that answers with exactly what it is given.
 *
 * `returned` defaults to the candidate count — a **full** read. Tests that want
 * a shortfall say so explicitly by passing `requested`, because a fixture that
 * quietly under-returned would make every assembly test a shortfall test.
 */
export function retrieval(
  found: readonly Candidate[],
  options: { requested?: number; modelId?: string } = {},
): AssemblyPorts['retrieval'] {
  return {
    async search(): Promise<RetrievalOutcome & { modelId: string }> {
      return {
        requested: options.requested ?? found.length,
        returned: found.length,
        candidates: found,
        modelId: options.modelId ?? 'model-a',
      };
    },
  };
}

/** An access policy that permits everything — the ordinary case. */
export function allow(): AssemblyPorts['access'] {
  return { async mayRead(): Promise<boolean> { return true; } };
}

/** An access policy that refuses the named sources and permits the rest. */
export function denyFor(...denied: readonly string[]): AssemblyPorts['access'] {
  return {
    async mayRead(_actorId, source): Promise<boolean> {
      return !denied.includes(source.sourceId);
    },
  };
}

/** Source classes for the named types. A type absent from this list is unclassified. */
export function classes(
  indexableTypes: readonly string[],
): AssemblyPorts['sourceClasses'] {
  return {
    async classify(_workspaceId, sourceType): Promise<{ classification: string } | null> {
      // `FR-CTX-034` — null means NOT classified, which excludes. The absence
      // of a class is never a permissive default.
      return indexableTypes.includes(sourceType) ? { classification: 'internal' } : null;
    },
  };
}

/** A well-formed assembly request, overridable field by field. */
export function input(over: Partial<AssembleInput> = {}): AssembleInput {
  return {
    workspaceId: 'ws_1',
    projectId: 'pr_1',
    objective: 'why does the booking notify twice',
    actorId: 'u_1',
    actorRole: 'engineer',
    budgetTokens: 12000,
    budgetCost: 40,
    essentialSources: [],
    ...over,
  };
}
