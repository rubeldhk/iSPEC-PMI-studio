/**
 * `T2223` (EPIC-039, `R-039-18`) — `ollama-embed` latency against a **live**
 * Ollama. Opt-in: skipped unless an Ollama server answers at
 * `PMI_OLLAMA_URL` (default `http://localhost:11434`) and serves the model
 * (`PMI_OLLAMA_MODEL`, default `nomic-embed-text`).
 *
 * | Measure | Target |
 * |---|---|
 * | single-query embed, warm | p95 < 150 ms |
 * | 32 texts × 1,000 characters | p95 < 2.5 s |
 *
 * **Recorded, never asserted in CI**: the figures are printed for the closing
 * report and the only assertions are that each call returned one vector per
 * text of the declared dimension. A skipped run is reported as skipped — never
 * as passed — and the Epic's records say whether this ever ran.
 */
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { createOllamaEmbeddingPort } from '@pmi/capability-adapter-ollama/embedding-module';

const BASE_URL = process.env['PMI_OLLAMA_URL'] ?? 'http://localhost:11434';
const MODEL = process.env['PMI_OLLAMA_MODEL'] ?? 'nomic-embed-text';

async function reachable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/tags`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return false;
    const body = (await res.json()) as { models?: { name?: string }[] };
    return (body.models ?? []).some((m) => (m.name ?? '').split(':')[0] === MODEL);
  } catch {
    return false;
  }
}

const live = await reachable();

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]!;
}

describe.skipIf(!live)('T2223 · ollama-embed latency against a live Ollama (recorded, not asserted)', () => {
  const port = createOllamaEmbeddingPort({ baseUrl: BASE_URL, model: MODEL as 'nomic-embed-text' });

  it('single-query embed, warm — p95 recorded against 150 ms', async () => {
    await port.embed(['warm-up']);
    const samples: number[] = [];
    for (let i = 0; i < 30; i++) {
      const start = performance.now();
      const vectors = await port.embed([`booking notification sent twice ${i}`]);
      samples.push(performance.now() - start);
      expect(vectors).toHaveLength(1);
      expect(vectors[0]).toHaveLength(port.dimension);
    }
    console.log(`[T2223] single-query embed p95 ${p95(samples).toFixed(1)} ms (target 150 ms) — ${port.modelId}`);
  }, 120_000);

  it('32 × 1,000-character batch — p95 recorded against 2.5 s', async () => {
    const batch = Array.from({ length: 32 }, (_, i) => `${i} `.padEnd(1000, 'the booking notification is sent twice to the customer '));
    const samples: number[] = [];
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      const vectors = await port.embed(batch);
      samples.push(performance.now() - start);
      expect(vectors).toHaveLength(32);
    }
    console.log(`[T2223] 32 × 1,000-char batch p95 ${p95(samples).toFixed(1)} ms (target 2,500 ms) — ${port.modelId}`);
  }, 300_000);
});
