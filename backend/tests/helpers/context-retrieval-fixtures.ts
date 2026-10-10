/**
 * Fixtures for `EPIC-038`'s retrieval tests (Phase 7).
 *
 * A **fixture** embedding, deterministic and vendor-free: each text becomes a
 * bag-of-letters vector, so texts sharing letters land near each other. Good
 * enough to make ranking observable in a unit test, and deliberately not a
 * semantic model — `T1282` is where meaning is tested, and only against a real
 * provider.
 *
 * As in `context-fixtures.ts`, nothing here takes a default that would make an
 * unbound port look bound.
 */
import type { SourceVersionReader } from '../../src/modules/context/inspection.service.js';
import type { EmbeddingPort } from '../../src/modules/context/retrieval/embedding.port.js';
import type { ArtifactSource } from '../../src/modules/context/retrieval/index.service.js';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** 26 dimensions, one per letter, plus a constant so no text is a zero vector. */
export function letterVector(text: string): number[] {
  const v = new Array<number>(LETTERS.length + 1).fill(0);
  for (const ch of text.toLowerCase()) {
    const i = LETTERS.indexOf(ch);
    if (i >= 0) v[i]! += 1;
  }
  v[LETTERS.length] = 1;
  return v;
}

export function fixtureEmbedding(modelId = 'fixture-letters'): EmbeddingPort & { calls: number } {
  return {
    modelId,
    dimension: LETTERS.length + 1,
    calls: 0,
    async embed(texts) {
      this.calls += texts.length;
      return texts.map(letterVector);
    },
  };
}

/** An artifact source answering from a table keyed `type:id@version`. */
export function artifacts(texts: Readonly<Record<string, string>>): ArtifactSource {
  return {
    async read(_ws, sourceType, sourceId, version) {
      const text = texts[`${sourceType}:${sourceId}@${version}`];
      return text === undefined ? null : { text };
    },
  };
}

/** A version reader answering from a table keyed `type:id`. Absent means gone. */
export function currentVersions(table: Readonly<Record<string, string>>): SourceVersionReader {
  return {
    async currentVersion(_ws, sourceType, sourceId) {
      const version = table[`${sourceType}:${sourceId}`];
      return version === undefined ? { resolves: false } : { resolves: true, version };
    },
  };
}
