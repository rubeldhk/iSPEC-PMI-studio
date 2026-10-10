/**
 * `T1271` (EPIC-038) — the embedding boundary.
 *
 * `FR-CTX-013`. The model sits behind a port that names a capability, never a
 * vendor: no vendor, model name or API shape may appear in the data model,
 * because that is the part that cannot be swapped later.
 *
 * And an unbound port **refuses**. The tempting fallback is a zero vector —
 * every distance to it is equal, so ranking "works" and returns an arbitrary
 * order that looks like a ranking. That is a wrong package nobody can tell is
 * wrong, which is the one outcome this Epic exists to prevent.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GovernanceSeamUnboundError, ProviderUnavailableError } from '../../src/core/errors.js';
import {
  embedChecked,
  type EmbeddingPort,
} from '../../src/modules/context/retrieval/embedding.port.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');
const SCHEMA = resolve(here, '../../prisma/schema.prisma');

const port = (vectors: number[][], dimension = 3): EmbeddingPort => ({
  modelId: 'model-a',
  dimension,
  async embed() {
    return vectors;
  },
});

describe('T1271 · no vendor in the data model', () => {
  const context = [
    ...readdirSync(MIGRATIONS)
      .filter((d) => /epic038/.test(d))
      .map((d) => readFileSync(join(MIGRATIONS, d, 'migration.sql'), 'utf8')),
    readFileSync(SCHEMA, 'utf8').match(/model Context[\s\S]*?\n}/g)?.join('\n') ?? '',
  ].join('\n');

  it('reads the Context DDL, or the check is vacuous', () => {
    expect(context).toMatch(/context_index_entries/);
  });

  it.each(['openai', 'anthropic', 'cohere', 'voyage', 'ada-002', 'text-embedding', 'bedrock', 'vertex'])(
    'names no %s',
    (vendor) => {
      expect(context.toLowerCase()).not.toContain(vendor);
    },
  );
});

describe('T1271 · an unbound port refuses', () => {
  it('with a 503-class error naming the seam', async () => {
    await expect(embedChecked(null, ['objective'])).rejects.toBeInstanceOf(GovernanceSeamUnboundError);
    await expect(embedChecked(null, ['objective'])).rejects.toThrow(/EmbeddingPort[\s\S]*FR-CTX-013/);
  });
});

describe('T1271 · a bound port is checked, not trusted', () => {
  it('returns the vectors with the model and dimension that produced them', async () => {
    const out = await embedChecked(port([[0.1, 0.2, 0.3]]), ['objective']);
    expect(out).toEqual({ modelId: 'model-a', dimension: 3, vectors: [[0.1, 0.2, 0.3]] });
  });

  it('refuses a zero vector rather than ranking against it', async () => {
    await expect(embedChecked(port([[0, 0, 0]]), ['objective'])).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });

  it('refuses a vector of the wrong dimension', async () => {
    await expect(embedChecked(port([[0.1, 0.2]]), ['objective'])).rejects.toThrow(/dimension/);
  });

  it('refuses a non-finite component', async () => {
    await expect(embedChecked(port([[0.1, Number.NaN, 0.3]]), ['objective'])).rejects.toThrow(/finite/);
  });

  it('refuses a count that does not match the inputs', async () => {
    await expect(embedChecked(port([[0.1, 0.2, 0.3]]), ['a', 'b'])).rejects.toThrow(/2/);
  });
});
