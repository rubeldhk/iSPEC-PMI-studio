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
import type { BaselineReaderPort, SourceStatus } from '../../src/modules/context/provenance.service.js';

/** Ranked candidates, newest ranking first. */
export function candidates(ids: readonly string[], score = 0.9): Candidate[] {
  return ids.map((sourceId, index) => ({
    sourceType: 'requirement',
    sourceId,
    sourceVersion: 'v1',
    relevanceScore: score - index * 0.01,
    // Own-workspace material. Cross-boundary candidates are built explicitly at
    // the call site, so a test that means to cross a boundary says so.
    workspaceId: 'ws_1',
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

/**
 * Source classes for the named types, all indexable.
 *
 * A type absent from this list is **unclassified**. For the other exclusion —
 * classified but deliberately outside the corpus — use `classifiedNotIndexable`.
 */
export function classes(
  indexableTypes: readonly string[],
): AssemblyPorts['sourceClasses'] {
  return {
    async classify(
      _workspaceId,
      sourceType,
    ): Promise<{ securityClassification: string; indexable: boolean } | null> {
      // `FR-CTX-034` — null means NOT classified, which excludes. The absence
      // of a class is never a permissive default.
      return indexableTypes.includes(sourceType)
        ? { securityClassification: 'internal', indexable: true }
        : null;
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

/**
 * A class that exists and is marked **not indexable** (`FR-CTX-015`).
 *
 * The second of the two classification exclusions, and the one an
 * `if (!classified)` check silently admits.
 */
export function classifiedNotIndexable(
  types: readonly string[],
): AssemblyPorts['sourceClasses'] {
  return {
    async classify(_workspaceId, sourceType) {
      return types.includes(sourceType)
        ? { securityClassification: 'restricted', indexable: false }
        : null;
    },
  };
}

/**
 * A baseline reader answering from a table keyed `sourceId@sourceVersion`.
 *
 * A version absent from the table answers `unknown` — the reader **looked** and
 * has nothing recorded. That is deliberately not the same as the reader
 * throwing, which is an outage; `T1249` asserts the two produce different
 * reasons, and this fixture only ever produces the first.
 */
export function baselines(
  known: Readonly<Record<string, SourceStatus>>,
): BaselineReaderPort {
  return {
    async statusOf(input): Promise<SourceStatus> {
      return known[`${input.sourceId}@${input.sourceVersion}`] ?? { status: 'unknown' };
    },
  };
}

/** No authorisations at all — the ordinary case, and the default posture. */
export function noAuthorisations(): AssemblyPorts['authorisations'] {
  return {
    async find() {
      return null;
    },
  };
}

/**
 * One authorisation, in one direction, for one source.
 *
 * Matches on both endpoints so a test asserting direction cannot pass against a
 * fixture that ignores it.
 */
export function authorisedCrossing(
  sourceId: string,
  fromWorkspaceId: string,
  toWorkspaceId: string,
): AssemblyPorts['authorisations'] {
  return {
    async find(input) {
      return input.sourceId === sourceId &&
        input.fromWorkspaceId === fromWorkspaceId &&
        input.toWorkspaceId === toWorkspaceId
        ? {
            id: 'rka_1',
            sourceType: input.sourceType,
            sourceId,
            workspaceId: fromWorkspaceId,
            toWorkspaceId,
            authorisedBy: 'u_owner',
            rationale: 'the shared engineering handbook is deliberately common',
          }
        : null;
    },
  };
}
