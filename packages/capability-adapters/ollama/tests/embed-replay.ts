/**
 * EPIC-039 — serving the Ollama recordings for any batch.
 *
 * `Replay` matches on method and path only, and a recorded `POST /api/embed`
 * answers for the three texts it was recorded with. This overlay answers any
 * batch from those recorded vectors: the k-th DISTINCT text in a test run gets
 * recorded vector `k mod n`, rotated by `floor(k / n)` places — so identical
 * texts get identical vectors, distinct texts distinct ones, and every vector
 * keeps the recorded dimension and norm. Not a model: the values mean nothing
 * (the recording's provenance says so).
 *
 * Not a `.spec.ts`: imported, never collected.
 */
import type { RecordedResponse, Recording, SeenRequest } from '@pmi/capability-contract/replay';

export function embedOverlay(recording: Recording): (req: SeenRequest, recorded: RecordedResponse | null) => RecordedResponse | null {
  const embed = recording.interactions.find((i) => i.request.method === 'POST' && i.request.path === '/api/embed');
  const base = ((embed?.response.json as { embeddings?: number[][] } | undefined)?.embeddings ?? []) as number[][];
  const seen = new Map<string, number>();
  const vectorFor = (text: string): number[] => {
    if (!seen.has(text)) seen.set(text, seen.size);
    const k = seen.get(text)!;
    const v = base[k % base.length]!;
    const shift = Math.floor(k / base.length) % v.length;
    return [...v.slice(shift), ...v.slice(0, shift)];
  };
  return (req, recorded) => {
    if (req.method !== 'POST' || req.path !== '/api/embed' || recorded === null || recorded.status !== 200 || req.body === undefined) return recorded;
    const body = JSON.parse(req.body) as { model: string; input: string | string[] };
    const texts = Array.isArray(body.input) ? body.input : [body.input];
    return { ...recorded, json: { ...(recorded.json as Record<string, unknown>), model: body.model, embeddings: texts.map(vectorFor) } };
  };
}
