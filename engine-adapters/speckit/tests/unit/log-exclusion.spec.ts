/**
 * T559 — no prompt and no model output reaches an operational record (PC-3).
 *
 * The engine adapter is the one component that holds all three dangerous
 * things at once: the customer's requirements (the prompt), the model's answer
 * (the output), and the provider credential. `AgentExecutionRecord` is the
 * structure that leaves it, so it is the structure that has to be proven empty
 * of them.
 *
 * `FR-AGT-012` and Native §7 make this a requirement rather than hygiene:
 * an execution record is **provenance** — who reasoned, when, at what cost —
 * and provenance is safe to ship to an aggregator precisely because it carries
 * nothing a customer wrote and nothing a model said.
 */
import { describe, expect, it } from 'vitest';
import { FixtureAgent } from '@pmi/agent-adapter-fixture';
import type { AgentExecutionRecord } from '@pmi/agent-contract';
import { redact, SpecKitEngine, type ContainerRuntime, type SandboxSession } from '../../src/speckit.adapter.js';
import type { WorkspaceFileSystem } from '../../src/workspace.js';

/**
 * T575 — the engine now takes a ProjectExecutionEnvironment, which carries a
 * descriptor. Fakes declare one so the port is honoured rather than cast away.
 */
const ENV_DESCRIPTOR = {
  provider: 'fake',
  supportedLifecycles: ['ephemeral'],
  supportsPersistentState: false,
  supportsNetworkPolicy: true,
  maxWallClockMs: 900_000,
} as const;

const SECRET_REQUIREMENT = 'Patients must be able to export their diagnosis history';
const MODEL_OUTPUT = '# Feature Specification: Apollo\n\n## Requirements\n\n- **FR-001**: MUST ' + SECRET_REQUIREMENT + '\n';

const fileSystem: WorkspaceFileSystem = {
  makeTempDirectory: async () => '/tmp/pmi-test',
  removeDirectory: async () => undefined,
};

function environment(): ContainerRuntime {
  const session: SandboxSession = {
    exec: async () => ({ exitCode: 0, stdout: MODEL_OUTPUT, stderr: '' }),
    writeFile: async () => undefined,
    listFiles: async () => ['specs/001-apollo/spec.md'],
    readFile: async () => MODEL_OUTPUT,
  };
  return { descriptor: ENV_DESCRIPTOR, start: async () => session, stop: async () => undefined };
}

const ctx = () => ({
  correlationId: '00000000-0000-4000-8000-000000000000',
  signal: new AbortController().signal,
  timeoutMs: 5_000,
});

const input = {
  projectName: 'Apollo',
  requirements: [
    { reference: 'FR-001', type: 'functional', priority: 'must', description: SECRET_REQUIREMENT },
  ],
};

async function recordsFrom(agent = new FixtureAgent({ stdout: MODEL_OUTPUT })) {
  const records: AgentExecutionRecord[] = [];
  await new SpecKitEngine({
    descriptor: { name: 'speckit', version: '1.0.0', capabilities: ['generate_specification', 'generate_tasks', 'validate_specification'] },
    environment: environment(),
    agent,
    fileSystem,
    aiProviderToken: 'sk-live-not-a-real-key',
    onAgentRun: (r) => records.push(r),
  }).generateSpecification(input as never, ctx());
  return records;
}

describe('T559 · the execution record is provenance, never content', () => {
  it('is emitted at all — provenance that is never recorded is not provenance', async () => {
    const records = await recordsFrom();
    expect(records).toHaveLength(1);
  });

  it('names who reasoned, when, and how it ended', async () => {
    const [record] = await recordsFrom();
    expect(record).toMatchObject({
      provider: 'fixture',
      model: 'fixture-1',
      correlationId: '00000000-0000-4000-8000-000000000000',
      status: 'succeeded',
    });
    expect(record?.startedAt).toBeTruthy();
    expect(record?.endedAt).toBeTruthy();
  });

  it('carries no model output', async () => {
    // The single most likely leak: `stdout` is right there on the result, and
    // adding it to the record for debugging is a one-line change that ships.
    const serialised = JSON.stringify(await recordsFrom());
    expect(serialised).not.toContain('Feature Specification');
    expect(serialised).not.toContain(SECRET_REQUIREMENT);
  });

  it('carries no prompt', async () => {
    const serialised = JSON.stringify(await recordsFrom());
    expect(serialised).not.toContain('/speckit-specify');
    expect(serialised).not.toContain('pmi-input.md');
  });

  it('carries no credential', async () => {
    const serialised = JSON.stringify(await recordsFrom());
    expect(serialised).not.toContain('sk-live-not-a-real-key');
  });

  it('declares no field outside Native §7 that could hold content', async () => {
    // A whitelist rather than a blacklist: the next person adding a field has
    // to change this test, which is the moment to ask whether it is provenance.
    const [record] = await recordsFrom();
    const allowed = new Set([
      'provider', 'model', 'agentVersion', 'executionId', 'correlationId',
      'startedAt', 'endedAt', 'status', 'failureReason', 'costMetadata',
    ]);
    for (const key of Object.keys(record ?? {})) {
      expect(allowed.has(key), `unexpected field "${key}" on an execution record`).toBe(true);
    }
  });
});

describe('T559 · a FAILED run is where content leaks', () => {
  it('records the failure reason without the agent message body', async () => {
    const records = await recordsFrom(new FixtureAgent({ failWith: 'malformed_output' }));
    expect(records[0]).toMatchObject({ status: 'failed', failureReason: 'malformed_output' });
    expect(JSON.stringify(records)).not.toContain(SECRET_REQUIREMENT);
  });

  it('keeps cancellation and timeout distinct in the record', async () => {
    // Both surface as an aborted signal. Collapsing them makes a systemic
    // problem look like ordinary user behaviour in every metric.
    const cancelled = await recordsFrom(new FixtureAgent({ failWith: 'cancelled' }));
    const timedOut = await recordsFrom(new FixtureAgent({ failWith: 'timeout' }));
    expect(cancelled[0]?.status).toBe('cancelled');
    expect(timedOut[0]?.status).toBe('timed_out');
  });
});

describe('T559 · redact() is the last line, and it is tested directly', () => {
  it.each([
    ['sk-live-abcdefgh12345678', 'sk-[redacted]'],
    ['Bearer abcdefgh12345678', 'Bearer [redacted]'],
    ['AI_PROVIDER_TOKEN=sk-x-abcdefgh', 'AI_PROVIDER_TOKEN=[redacted]'],
    ['password: hunter2hunter2', 'password=[redacted]'],
  ])('redacts %s', (input, expected) => {
    expect(redact(new Error(input))).toContain(expected);
  });

  it('does not pretend to redact what it cannot recognise', () => {
    // Stated so nobody mistakes this for a general secret scanner. It matches
    // known shapes; the real guarantee is that diagnostics never reach a user
    // and never reach a log, which the assertions above cover.
    expect(redact(new Error('a customer requirement in prose'))).toContain('prose');
  });
});
