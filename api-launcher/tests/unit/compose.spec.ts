/**
 * `T2594` (EPIC-047) — what the API's composition root hands it.
 * `DEF-047-002`, option A.
 *
 * The launcher is where an agent adapter, an execution provider and a model
 * may be named, because `backend/src` may not. These tests pin exactly what it
 * composes, so a run's model, image, credential and network are configuration
 * someone can read rather than something inferred:
 *
 * - the fixture agent, always, as the worker composes it;
 * - one agent gateway per model listed in `PMI_EXPERT_MODELS`, each declaring
 *   that model, because Expert dispatch selects a gateway by the model the
 *   contract names;
 * - the injected environment, Docker by default;
 * - a session per run built from the engine image (or `PMI_EXPERT_IMAGE`), the
 *   sandbox environment — the AI credential and the run's own correlation id,
 *   and nothing else — the generation egress profile and the engine's limits.
 *
 * A missing credential refuses the run, by the sandbox's own rule, rather than
 * starting an agent that cannot authenticate.
 */
import { describe, expect, it } from 'vitest';
import { GENERATION_EGRESS_PROFILE, type ProjectExecutionEnvironment } from '@pmi/execution-contract';
import {
  DEFAULT_ENGINE_IMAGE,
  DEFAULT_RESOURCE_LIMITS,
  SANDBOX_CORRELATION_ENV,
} from '@pmi/engine-adapter-speckit';
import type { SessionTemplate } from '@pmi/backend/api';
import { composeExpertRuntime, expertModels } from '../../src/compose.js';

const environment = { descriptor: { provider: 'injected' } } as unknown as ProjectExecutionEnvironment;
const RUN = '0b6f2f1e-5f6a-4b7c-9d8e-1f2a3b4c5d6e';

describe('T2594 · the models an Expert may be dispatched to', () => {
  it('reads PMI_EXPERT_MODELS — trimmed, deduplicated, blanks ignored', () => {
    expect(expertModels(' model-a, model-b ,,model-a, ')).toEqual(['model-a', 'model-b']);
    expect(expertModels(undefined)).toEqual([]);
    expect(expertModels('   ')).toEqual([]);
  });

  it('composes the fixture agent always, and one gateway per listed model declaring that model', () => {
    const runtime = composeExpertRuntime({ PMI_EXPERT_MODELS: 'model-a,model-b' }, { environment });
    const descriptors = runtime.gateways.map((g) => g.descriptor);
    expect(descriptors[0]).toMatchObject({ name: 'fixture', model: 'fixture-1' });
    expect(descriptors.slice(1).map((d) => d.model)).toEqual(['model-a', 'model-b']);
    expect(new Set(descriptors.map((d) => d.name)).size).toBe(descriptors.length);
  });

  it('composes only the fixture agent when no model is listed', () => {
    const runtime = composeExpertRuntime({}, { environment });
    expect(runtime.gateways.map((g) => g.descriptor.model)).toEqual(['fixture-1']);
  });

  it('uses the environment it is given', () => {
    expect(composeExpertRuntime({}, { environment }).environment).toBe(environment);
  });
});

describe('T2594 · the session each run starts', () => {
  const sessionFor = (env: Record<string, string>) => {
    const { session } = composeExpertRuntime(env, { environment });
    expect(session).toBeTypeOf('function');
    return (session as (run: { correlationId: string }) => SessionTemplate)({ correlationId: RUN });
  };

  it('is ephemeral, on the engine image, behind the generation egress profile, within the engine limits', () => {
    expect(sessionFor({ AI_PROVIDER_TOKEN: 'tok' })).toMatchObject({
      lifecycle: 'ephemeral',
      image: DEFAULT_ENGINE_IMAGE,
      workspace: { kind: 'ephemeral' },
      egressProfile: GENERATION_EGRESS_PROFILE,
      credentials: [],
      resourceLimits: { ...DEFAULT_RESOURCE_LIMITS },
    });
  });

  it('carries the AI credential and the run\'s own correlation id, and nothing else', () => {
    expect(sessionFor({ AI_PROVIDER_TOKEN: 'tok', DATABASE_URL: 'postgres://never' }).env).toEqual({
      [SANDBOX_CORRELATION_ENV]: RUN,
      AI_PROVIDER_TOKEN: 'tok',
    });
  });

  it('takes its image from PMI_EXPERT_IMAGE when set', () => {
    expect(sessionFor({ AI_PROVIDER_TOKEN: 'tok', PMI_EXPERT_IMAGE: 'registry/experts:1' }).image).toBe('registry/experts:1');
  });

  it('refuses a run with no AI credential, naming it, rather than start an agent that cannot authenticate', () => {
    expect(() => sessionFor({})).toThrow(/AI provider credential/);
  });
});
