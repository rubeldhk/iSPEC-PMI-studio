/**
 * `T2197` (EPIC-039, `R-039-18` Decision 2) — `ollama-embed`: `Embed` over a
 * local Ollama model server.
 *
 * No credential in the default topology (loopback). The optional
 * `bearer-token` kind is for an Ollama behind an authenticating proxy — it
 * cannot be narrowed, and `Embed` does not change state, so the default is
 * proceed-and-record (`FR-HUB-034`).
 */
import type { AdapterDescriptor } from '@pmi/capability-contract';
import { OLLAMA_MODELS } from './models.js';

export const OLLAMA_ADAPTER_VERSION = '0.1.0';

export const OLLAMA_DESCRIPTOR: AdapterDescriptor = Object.freeze({
  key: 'ollama-embed',
  name: 'Ollama (local embeddings)',
  provider: 'ollama',
  transport: 'native-api',
  version: OLLAMA_ADAPTER_VERSION,
  implements: [{ capability: 'Embed', majors: [1] }],
  credentialKinds: [{ kind: 'bearer-token', narrowing: 'none' }],
  credentialRequired: false,
  bindingSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['model'],
    properties: {
      baseUrl: { type: 'string', pattern: '^https?://[^\\s]+$', maxLength: 300 },
      model: { type: 'string', enum: Object.keys(OLLAMA_MODELS) },
    },
  },
  scopeMapping: { 'model.embed': ['ollama:embed'] },
  embedding: { models: Object.entries(OLLAMA_MODELS).map(([model, dimension]) => ({ model, dimension })) },
}) as AdapterDescriptor;
