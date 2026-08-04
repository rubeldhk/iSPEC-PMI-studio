/**
 * T045a — the worker consumer.
 * Written to FAIL before T046 exists (Constitution V).
 *
 * The success path writes specification, versions, links, and terminal state in
 * ONE transaction (SC-002). Every failure path writes NO artifact (FR-027, SC-006).
 */
import { describe, expect, it, vi } from 'vitest';
import { FixtureEngine } from '@pmi/engine-adapter-fixture';
import { consumeGenerationJob, type JobPersistence } from '../../src/generation.consumer.js';

function persistence() {
  const commits: unknown[][] = [];
  const p: JobPersistence & { commits: unknown[][] } = {
    commits,
    async transaction(fn) {
      const staged: unknown[] = [];
      const result = await fn({ write: async (r) => void staged.push(r) });
      commits.push(staged);
      return result;
    },
  };
  return p;
}

const job = {
  id: 'job_1',
  workspaceId: 'ws_a',
  projectId: 'p1',
  requestedById: 'u1',
  correlationId: 'corr-1',
  projectName: 'Demo',
  requirements: [
    { reference: 'R1', description: 'Do a thing', type: 'functional' as const, priority: 'p1' as const },
  ],
};

describe('consumeGenerationJob — success', () => {
  it('writes specification, version, links and terminal state in ONE transaction', async () => {
    const p = persistence();
    const r = await consumeGenerationJob(job, new FixtureEngine(), p, { timeoutMs: 1000 });
    expect(r.state).toBe('succeeded');
    expect(p.commits).toHaveLength(1);
    const kinds = p.commits[0]!.map((w) => (w as { kind: string }).kind);
    expect(kinds).toEqual(['specification', 'specification_version', 'traceability_link', 'job_state']);
  });

  it('links the specification to EVERY selected requirement (SC-002)', async () => {
    const p = persistence();
    await consumeGenerationJob(
      { ...job, requirements: [...job.requirements, { reference: 'R2', description: 'Another', type: 'functional' as const, priority: 'p2' as const }] },
      new FixtureEngine(),
      p,
      { timeoutMs: 1000 },
    );
    const links = p.commits[0]!.filter((w) => (w as { kind: string }).kind === 'traceability_link');
    expect(links).toHaveLength(1);
    expect((links[0] as { requirementRefs: string[] }).requirementRefs).toEqual(['R1', 'R2']);
  });

  it('stamps engine name and version on the artifact (FR-022)', async () => {
    const p = persistence();
    await consumeGenerationJob(job, new FixtureEngine(), p, { timeoutMs: 1000 });
    const spec = p.commits[0]!.find((w) => (w as { kind: string }).kind === 'specification');
    expect(spec).toMatchObject({ engineName: 'fixture', engineVersion: 'fixture-1.0.0+model=none' });
  });
});

describe('consumeGenerationJob — failure paths write NOTHING', () => {
  it.each([
    ['engine_unavailable', 'failed'],
    ['engine_error', 'failed'],
    ['malformed_output', 'failed'],
    ['empty_output', 'failed'],
  ] as const)('%s -> %s with no artifact', async (failWith, expected) => {
    const p = persistence();
    const r = await consumeGenerationJob(job, new FixtureEngine({ failWith }), p, {
      timeoutMs: 1000,
    });
    expect(r.state).toBe(expected);
    expect(r.failureReason).toBe(failWith);
    const written = p.commits.flat().map((w) => (w as { kind: string }).kind);
    expect(written).toEqual(['job_state']); // terminal state only
    expect(written).not.toContain('specification');
  });

  it('refuses an empty selection before invoking the engine (E7)', async () => {
    const p = persistence();
    const engine = new FixtureEngine();
    const spy = vi.spyOn(engine, 'generateSpecification');
    const r = await consumeGenerationJob({ ...job, requirements: [] }, engine, p, {
      timeoutMs: 1000,
    });
    expect(r.failureReason).toBe('empty_selection');
    expect(spy).not.toHaveBeenCalled();
  });

  it('records the timeout reason and no artifact', async () => {
    const p = persistence();
    const r = await consumeGenerationJob(job, new FixtureEngine({ delayMs: 5_000 }), p, {
      timeoutMs: 30,
    });
    expect(r.state).toBe('timed_out');
    expect(r.failureReason).toBe('timeout');
    expect(p.commits.flat().map((w) => (w as { kind: string }).kind)).toEqual(['job_state']);
  });

  it('records cancellation and no artifact', async () => {
    const p = persistence();
    const c = new AbortController();
    const run = consumeGenerationJob(job, new FixtureEngine({ delayMs: 5_000 }), p, {
      timeoutMs: 5_000,
      signal: c.signal,
    });
    c.abort();
    const r = await run;
    expect(r.state).toBe('cancelled');
    expect(r.failureReason).toBe('cancelled');
  });
});

describe('correlation', () => {
  it('passes the job correlation id into the engine context (PC-3)', async () => {
    const p = persistence();
    const engine = new FixtureEngine();
    const spy = vi.spyOn(engine, 'generateSpecification');
    await consumeGenerationJob(job, engine, p, { timeoutMs: 1000 });
    expect(spy.mock.calls[0]?.[1].correlationId).toBe('corr-1');
  });
});
