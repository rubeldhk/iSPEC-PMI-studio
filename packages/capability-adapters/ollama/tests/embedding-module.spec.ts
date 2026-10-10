/**
 * `T2198` (EPIC-039, `R-039-18` Decision 4) — `@pmi/capability-adapter-ollama/embedding-module`.
 *
 * The module `EPIC-038`'s `T1282` loads through `CONTEXT_EMBEDDING_MODULE`:
 * its default export returns an object of `EmbeddingPort`'s shape —
 * `modelId`, `dimension`, `embed(texts)` — over the Ollama adapter, applying
 * the same refusals as `EPIC-038`'s `embedChecked` (count, dimension,
 * non-finite, zero) and the contract's limits (64 texts, 8,000 characters).
 *
 * Over the recordings, never the network. Written to FAIL before `T2199`.
 */
import { readFileSync } from 'node:fs';
import { Replay, type Recording } from '@pmi/capability-contract/replay';
import { afterEach, describe, expect, it } from 'vitest';
import createDefault, { createOllamaEmbeddingPort } from '../src/embedding-module.js';
import { embedOverlay } from './embed-replay.js';

const BASE = 'http://127.0.0.1:11434';
const DIR = new URL('./recordings/', import.meta.url);
const RECORDING = JSON.parse(readFileSync(new URL('2026-10-10.ollama-embed.json', DIR), 'utf8')) as Recording;
const DIGEST = '0a109f422b47e3a30ba2b10eca18548e944e8a23073ee3f3e947efcf3c45e59f';

function port(overlay?: ConstructorParameters<typeof Replay>[1]) {
  const replay = new Replay([RECORDING], overlay ?? { overlay: embedOverlay(RECORDING) });
  return { replay, port: createOllamaEmbeddingPort({ baseUrl: BASE, model: 'nomic-embed-text', fetch: replay.fetch(BASE) }) };
}

const previous = process.env['PMI_EMBED_BINDING'];
afterEach(() => {
  if (previous === undefined) delete process.env['PMI_EMBED_BINDING'];
  else process.env['PMI_EMBED_BINDING'] = previous;
});

describe('T2198 · the embedding module EPIC-038 loads', () => {
  it('the default export returns EmbeddingPort\'s shape, synchronously, from PMI_EMBED_BINDING', () => {
    process.env['PMI_EMBED_BINDING'] = JSON.stringify({ baseUrl: BASE, model: 'all-minilm' });
    const p = createDefault();
    expect(typeof p.embed).toBe('function');
    expect(p.dimension).toBe(384);
    expect(p.modelId).toMatch(/^ollama-embed:all-minilm/);
  });

  it('defaults to nomic-embed-text on loopback without a binding', () => {
    delete process.env['PMI_EMBED_BINDING'];
    expect(createDefault().dimension).toBe(768);
  });

  it('refuses a model outside the table at construction, naming it', () => {
    process.env['PMI_EMBED_BINDING'] = JSON.stringify({ model: 'unlisted' });
    expect(() => createDefault()).toThrow(/unlisted/);
  });

  it('embeds a batch: one vector per text, of the declared dimension; modelId carries the digest', async () => {
    const { port: p } = port();
    const vectors = await p.embed(['a', 'b', 'a']);
    expect(vectors).toHaveLength(3);
    expect(vectors.every((v) => v.length === 768)).toBe(true);
    expect(vectors[2]).toEqual(vectors[0]);
    expect(p.modelId).toBe(`ollama-embed:nomic-embed-text@${DIGEST.slice(0, 12)}`);
  });

  it('65 texts → batch-too-large; 8,001 characters → text-too-long naming the index; nothing sent', async () => {
    const { port: p, replay } = port();
    await expect(p.embed(Array.from({ length: 65 }, (_, i) => `t${i}`))).rejects.toThrow(/batch-too-large/);
    await expect(p.embed(['ok', 'x'.repeat(8001)])).rejects.toThrow(/text-too-long.*index 1/);
    expect(replay.seen).toEqual([]);
  });

  it('refuses what embedChecked refuses: a count mismatch, a wrong dimension, a non-finite component, a zero vector', async () => {
    const cases: [string, (n: number) => number[][]][] = [
      ['count', () => [new Array(768).fill(0.1)]],
      ['dimension', (n) => Array.from({ length: n }, () => [0.1, 0.2])],
      ['non-finite', (n) => Array.from({ length: n }, () => [Number.NaN, ...new Array(767).fill(0.1)])],
      ['zero', (n) => Array.from({ length: n }, () => new Array(768).fill(0))],
    ];
    for (const [name, vectors] of cases) {
      const { port: p } = port({
        overlay: (req, rec) => {
          if (req.path !== '/api/embed') return rec;
          const n = (JSON.parse(req.body!) as { input: string[] }).input.length;
          return { status: 200, json: { model: 'nomic-embed-text', embeddings: vectors(n) } };
        },
      });
      await expect(p.embed(['a', 'b']), name).rejects.toThrow();
    }
  });

  it('an adapter failure is an error carrying the category, never vectors', async () => {
    const { port: p } = port({ overlay: () => ({ status: 500, json: { error: 'runner terminated' } }) });
    await expect(p.embed(['a'])).rejects.toThrow(/provider-unavailable/);
  });
});
