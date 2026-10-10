/**
 * `T1272` (EPIC-038) — the embedding boundary. `FR-CTX-013`, `R-038-4`.
 *
 * **Declares the capability and implements nothing.** No provider exists
 * anywhere in the programme (`R-038-1`), so this port is unowned, and the
 * closing report names it as such.
 *
 * The port names a capability — a model id, a dimension, texts in, vectors
 * out — and never a vendor or an API shape. Those are the parts that cannot be
 * swapped later, and `T1271` asserts none of them reaches the data model.
 *
 * ## Checked, not trusted
 *
 * `embedChecked` is the only way this module reaches a provider, and it
 * refuses what would rank silently wrong:
 *
 * | Returned | Why it is refused |
 * |---|---|
 * | No port at all | An unranked package is a different thing, not a degraded one (`FR-CTX-012`) |
 * | A zero vector | Every distance to it is equal — an arbitrary order that looks like a ranking |
 * | The wrong dimension | It cannot share a column with the index it is compared to |
 * | A non-finite component | Distances computed from it are meaningless |
 * | Fewer or more vectors than texts | Every pairing after the gap is off by one |
 *
 * Framework-free (PC-1).
 */
import { GovernanceSeamUnboundError, ProviderUnavailableError } from '../../../core/errors.js';

export interface EmbeddingPort {
  /** Recorded on every entry and package (`R-038-4`). Opaque to this module. */
  readonly modelId: string;
  readonly dimension: number;
  embed(texts: readonly string[]): Promise<number[][]>;
}

export interface Embedded {
  readonly modelId: string;
  readonly dimension: number;
  readonly vectors: number[][];
}

/** The refusal an unbound port produces, shared by indexing and search. */
export function embeddingUnbound(): GovernanceSeamUnboundError {
  return new GovernanceSeamUnboundError(
    'no embedding provider is bound (EmbeddingPort, FR-CTX-013), so the index cannot be built or ' +
      'queried. This capability has no owner anywhere in the programme — see EPIC-038 R-038-1. ' +
      'Refusing rather than ranking by a stand-in, because an unranked package would be a ' +
      'different thing rather than a degraded one (FR-CTX-012)',
  );
}

export async function embedChecked(
  port: EmbeddingPort | null,
  texts: readonly string[],
): Promise<Embedded> {
  if (port === null) throw embeddingUnbound();

  const vectors = await port.embed(texts);
  const refuse = (why: string): ProviderUnavailableError =>
    new ProviderUnavailableError(`the embedding provider (${port.modelId}) ${why} (FR-CTX-013)`);

  if (vectors.length !== texts.length) {
    throw refuse(`returned ${vectors.length} vectors for ${texts.length} texts`);
  }
  for (const vector of vectors) {
    if (vector.length !== port.dimension) {
      throw refuse(`returned a vector of dimension ${vector.length}, declared ${port.dimension}`);
    }
    if (!vector.every((x) => Number.isFinite(x))) {
      throw refuse('returned a vector with a non-finite component');
    }
    if (vector.every((x) => x === 0)) {
      throw refuse('returned a zero vector, which every candidate is equally near');
    }
  }
  return { modelId: port.modelId, dimension: port.dimension, vectors };
}
