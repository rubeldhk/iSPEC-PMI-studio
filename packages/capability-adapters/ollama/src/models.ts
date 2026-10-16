/**
 * `T2197` (EPIC-039, `FR-HUB-081`, `R-039-18`) — the models `ollama-embed`
 * serves and their **declared** dimensions.
 *
 * A dimension is declared here, never probed from a response: an unlisted
 * model is refused at binding (the binding schema's enum), so the port's
 * `dimension` is known before the first request.
 */
export const OLLAMA_MODELS = Object.freeze({
  'nomic-embed-text': 768,
  'all-minilm': 384,
  'mxbai-embed-large': 1024,
} as const);

export type OllamaModel = keyof typeof OLLAMA_MODELS;

export const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
export const DEFAULT_OLLAMA_MODEL: OllamaModel = 'nomic-embed-text';

export function isOllamaModel(model: unknown): model is OllamaModel {
  return typeof model === 'string' && Object.prototype.hasOwnProperty.call(OLLAMA_MODELS, model);
}

/** `GET /api/tags` names a model `name:tag`; the bare name means `:latest`. */
export function tagMatches(tagName: string, model: string): boolean {
  return tagName === model || tagName === `${model}:latest`;
}
