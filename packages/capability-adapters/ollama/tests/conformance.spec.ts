/**
 * `T2196` (EPIC-039, `US7`, `FR-HUB-060`, `FR-HUB-081`, `FR-HUB-082`,
 * `R-039-18`) — `ollama-embed` passes the shared conformance suite for `Embed`
 * over RECORDED responses served through an injected `fetch` — never the
 * network.
 *
 * - `POST /api/embed` with a batch `input`;
 * - the dimension comes from the adapter's model table, and an unlisted model
 *   is refused at binding (the binding schema's enum), never probed;
 * - the version is the `GET /api/tags` digest, and a changed digest changes
 *   the version (CC-12);
 * - a missing model is `unhealthy: model-not-present`;
 * - an optional `bearer-token` credential is sent only when bound.
 *
 * Written to FAIL before `T2197`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { capabilityConformanceSuite, type ConformanceScenario } from '@pmi/capability-contract/conformance';
import { Replay, type RecordedResponse, type Recording, type SeenRequest } from '@pmi/capability-contract/replay';
import { createCredentialHandle, validate, type AdapterContext, type CapabilityAdapter } from '@pmi/capability-contract';
import { describe, expect, it } from 'vitest';
import { OLLAMA_DESCRIPTOR, OLLAMA_MODELS, OllamaEmbedAdapter } from '../src/index.js';
import { embedOverlay } from './embed-replay.js';

const BASE = 'http://127.0.0.1:11434';
const DIR = new URL('./recordings/', import.meta.url);
const load = (name: string): Recording => JSON.parse(readFileSync(new URL(name, DIR), 'utf8')) as Recording;
const RECORDING = load('2026-10-10.ollama-embed.json');
const NEW_DIGEST = load('2026-10-10.ollama-embed.new-digest.json');
const ABSENT = load('2026-10-10.ollama-embed.model-absent.json');
const DIGEST = '0a109f422b47e3a30ba2b10eca18548e944e8a23073ee3f3e947efcf3c45e59f';
const TOKEN = 'pmi-canary-0e11a4a0-0000-4000-8000-000000000001';

interface Rig {
  replay: Replay;
  scenario: ConformanceScenario | null;
}
const rigs = new WeakMap<CapabilityAdapter, Rig>();

function overlay(rig: Rig): (req: SeenRequest, recorded: RecordedResponse | null) => RecordedResponse | null {
  const vectors = embedOverlay(RECORDING);
  const newTags = NEW_DIGEST.interactions[0]!.response;
  const absent = new Map(ABSENT.interactions.map((i) => [`${i.request.method} ${i.request.path}`, i.response]));
  return (req, recorded) => {
    switch (rig.scenario) {
      case 'credential-rejected':
        return { status: 401, text: 'Unauthorized' }; // an authenticating proxy in front of Ollama
      case 'unhealthy':
        return absent.get(`${req.method} ${req.path}`) ?? recorded;
      case 'provider-error':
        return { status: 500, json: { error: 'llama runner process has terminated' } };
      case 'model-version-changed':
        if (req.method === 'GET' && req.path === '/api/tags') return newTags;
        return vectors(req, recorded);
      default:
        return vectors(req, recorded);
    }
  };
}

function make(): OllamaEmbedAdapter {
  const rig: Rig = { replay: undefined as unknown as Replay, scenario: null };
  rig.replay = new Replay([RECORDING], { overlay: (req, rec) => overlay(rig)(req, rec) });
  const adapter = new OllamaEmbedAdapter({ fetch: rig.replay.fetch(BASE) });
  rigs.set(adapter, rig);
  return adapter;
}

function context(_a: CapabilityAdapter, over: Partial<AdapterContext> = {}): AdapterContext {
  return {
    workspaceId: null,
    projectId: null,
    binding: { baseUrl: BASE, model: 'nomic-embed-text' },
    credential: null,
    scope: { requested: { access: 'read', resources: ['model.embed'] }, granted: ['ollama:embed'], narrowing: 'exact' },
    signal: new AbortController().signal,
    timeoutMs: 10_000,
    ...over,
  };
}

capabilityConformanceSuite('ollama-embed', {
  capability: 'Embed',
  adapter: make,
  context: (a) => context(a),
  validInput: () => ({ texts: ['alpha bravo', 'charlie delta'] }),
  inject: (a, s) => {
    rigs.get(a)!.scenario = s;
  },
  supports: ['credential-rejected', 'unhealthy', 'provider-error', 'model-version-changed'],
  requests: (a) => rigs.get(a)!.replay.seen.map((r) => ({ method: r.method, url: r.path, headers: r.headers })),
  permissionFor: (r) => (r.url === '/api/embed' ? 'ollama:embed' : r.url === '/api/tags' ? null : 'unknown'),
});

describe('T2196 · ollama-embed specifics', () => {
  const embed = (a: OllamaEmbedAdapter, texts: string[], over: Partial<AdapterContext> = {}) => a.invoke({ ...context(a, over), capability: 'Embed', contractVersion: '1.0', input: { texts } });

  it('POST /api/embed carries the bound model and the whole batch as input', async () => {
    const a = make();
    const r = await embed(a, ['one', 'two', 'three']);
    expect(r.ok).toBe(true);
    const post = rigs.get(a)!.replay.seen.find((s) => s.method === 'POST')!;
    expect(post.path).toBe('/api/embed');
    expect(JSON.parse(post.body!)).toEqual({ model: 'nomic-embed-text', input: ['one', 'two', 'three'] });
    expect((r as { output: { vectors: number[][] } }).output.vectors).toHaveLength(3);
  });

  it('the dimension is the model table\'s, and the version is the tags digest', async () => {
    const r = await embed(make(), ['x']);
    expect(r).toMatchObject({ ok: true, output: { model: { id: 'nomic-embed-text', version: DIGEST, dimension: 768 } } });
    expect(OLLAMA_MODELS).toMatchObject({ 'nomic-embed-text': 768, 'all-minilm': 384, 'mxbai-embed-large': 1024 });
    expect(OLLAMA_DESCRIPTOR.embedding!.models).toEqual(Object.entries(OLLAMA_MODELS).map(([model, dimension]) => ({ model, dimension })));
  });

  it('an unlisted model is refused at binding, never probed into a dimension', async () => {
    expect(validate(OLLAMA_DESCRIPTOR.bindingSchema, { baseUrl: BASE, model: 'nomic-embed-text' })).toEqual({ ok: true });
    expect(validate(OLLAMA_DESCRIPTOR.bindingSchema, { baseUrl: BASE, model: 'some-unlisted-model' }).ok).toBe(false);
    const a = make();
    expect(await embed(a, ['x'], { binding: { baseUrl: BASE, model: 'some-unlisted-model' } })).toMatchObject({ ok: false, errorCategory: 'adapter-fault' });
    expect(rigs.get(a)!.replay.seen).toEqual([]);
  });

  it('a changed digest is a changed version, in the output and in health (CC-12)', async () => {
    const a = make();
    rigs.get(a)!.scenario = 'model-version-changed';
    expect(await embed(a, ['x'])).toMatchObject({ ok: true, output: { model: { version: '970aa74c0a90ef7482477cf803618e776e173c007bf957f635f1015bfcfef0e6' } } });
  });

  it('a missing model is unhealthy: model-not-present, and an embed is model-not-present', async () => {
    const a = make();
    rigs.get(a)!.scenario = 'unhealthy';
    expect(await a.checkHealth(context(a))).toMatchObject({ state: 'unhealthy', reason: 'model-not-present' });
    expect(await embed(a, ['x'])).toMatchObject({ ok: false, errorCategory: 'model-not-present' });
  });

  it('health is healthy with the digest as modelVersion', async () => {
    const a = make();
    expect(await a.checkHealth(context(a))).toEqual({ state: 'healthy', modelVersion: DIGEST });
  });

  it('a bearer token is sent only when a credential is bound', async () => {
    const a = make();
    await embed(a, ['x']);
    expect(rigs.get(a)!.replay.seen.every((s) => s.headers['authorization'] === undefined)).toBe(true);
    const b = make();
    await embed(b, ['x'], { credential: createCredentialHandle(TOKEN, 'bearer-token') });
    const seen = rigs.get(b)!.replay.seen;
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((s) => s.headers['authorization'] === `Bearer ${TOKEN}`)).toBe(true);
  });

  it('declares Embed, no required credential, an optional bearer-token, provider ollama', () => {
    expect(OLLAMA_DESCRIPTOR).toMatchObject({ key: 'ollama-embed', provider: 'ollama', transport: 'native-api', credentialRequired: false, credentialKinds: [{ kind: 'bearer-token', narrowing: 'none' }] });
    expect(OLLAMA_DESCRIPTOR.implements).toEqual([{ capability: 'Embed', majors: [1] }]);
  });

  it('the recordings are dated and say where they came from', () => {
    for (const f of readdirSync(DIR)) {
      expect(f).toMatch(/^\d{4}-\d{2}-\d{2}\./);
      expect(load(f).provenance.length).toBeGreaterThan(40);
    }
  });
});
