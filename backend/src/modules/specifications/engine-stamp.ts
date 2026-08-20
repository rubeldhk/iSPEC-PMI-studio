/**
 * T082 — engine provenance stamping (F-04.4, FR-022).
 *
 * FR-022 requires every generated artifact to record which engine produced it,
 * at which version. That is only *checkable* if a missing stamp is impossible
 * to store — so this module refuses rather than defaults.
 *
 * There is deliberately no fallback value. A placeholder like `"unknown"` would
 * satisfy the NOT NULL column while attributing an artifact to an engine that
 * never ran it, and nothing downstream could tell the difference. The database
 * says the same thing a second time: `specifications_engine_identified` rejects
 * a blank name or version.
 *
 * The version identifies BOTH the engine tool and the AI model (research R-001,
 * contract rule E10). The stamp records what the descriptor claims, unaltered —
 * deciding what a version means is the adapter's job, not this module's.
 *
 * Framework-free (PC-1).
 */

export interface EngineProvenance {
  engineName: string;
  engineVersion: string;
  generatedAt: Date;
}

export type ProvenanceField = keyof EngineProvenance;

export class MissingEngineProvenanceError extends Error {
  readonly code = 'missing_engine_provenance' as const;

  constructor(readonly field: ProvenanceField) {
    super(
      `Cannot stamp a generated artifact: "${field}" is missing. An artifact whose engine ` +
        `cannot be identified is not storable (FR-022).`,
    );
    this.name = 'MissingEngineProvenanceError';
  }
}

function required(value: unknown, field: ProvenanceField): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new MissingEngineProvenanceError(field);
  }
  return value.trim();
}

/**
 * Build the provenance an artifact carries, from the engine's own descriptor.
 *
 * `generatedAt` is passed in rather than read from the clock here: the whole
 * commit — specification, version, links, terminal state — shares one instant,
 * and a service that reaches for `new Date()` mid-write produces a row set whose
 * timestamps disagree by however long the transaction took.
 */
export function stampEngineProvenance(
  descriptor: { name?: unknown; version?: unknown } | null | undefined,
  generatedAt: Date,
): EngineProvenance {
  const engineName = required(descriptor?.name, 'engineName');
  const engineVersion = required(descriptor?.version, 'engineVersion');
  if (!(generatedAt instanceof Date)) throw new MissingEngineProvenanceError('generatedAt');

  return { engineName, engineVersion, generatedAt };
}

/**
 * Assert an artifact about to be stored carries its stamp.
 *
 * Called on the write path, not only at generation: FR-022 is a property of
 * every generated artifact, and a later code path that constructs one by hand
 * must fail here rather than at the database, where the message is worse.
 */
export function assertStamped(artifact: {
  engineName?: unknown;
  engineVersion?: unknown;
  generatedAt?: unknown;
}): void {
  required(artifact.engineName, 'engineName');
  required(artifact.engineVersion, 'engineVersion');
  if (!(artifact.generatedAt instanceof Date)) {
    throw new MissingEngineProvenanceError('generatedAt');
  }
}
