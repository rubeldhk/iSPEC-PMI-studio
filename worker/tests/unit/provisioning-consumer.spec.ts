/**
 * `T1343` (EPIC-041) — the worker's initialise step, and what it records.
 *
 * `FR-LPW-008`, `R-041-1`, `R-041-9`, `SC-LPW-002`. The consumer runs the
 * injected initialiser on the job's workspace, then hands the result — the
 * steps it completed, the files it wrote, the tag and bundle it used, or the
 * step it failed at with a sanitised reason — to the platform to record. The
 * consumer itself names no engine: the initialiser is composed at the root.
 *
 * Written to FAIL before `T1346` exists.
 */
import { describe, expect, it, vi } from 'vitest';
import { createProvisioningConsumer, type InitialiseJobDescription } from '../../src/provisioning.consumer.js';

const job: InitialiseJobDescription = {
  jobId: 'job_9',
  kind: 'initialise_workspace',
  workspace: { writePath: '/projects/alpha', agentIntegration: 'claude', scriptType: 'sh', engineTag: 'v0.16.4', bundleVersion: '0.1.0' },
};

describe('T1343 · createProvisioningConsumer', () => {
  it('runs the initialiser on the workspace and finalises a success with tag and bundle', async () => {
    const initialiser = {
      initialise: vi.fn(async () => ({
        ok: true as const,
        stepsCompleted: ['run_engine_init', 'copy_extension', 'register_hooks', 'verify_structure'] as const,
        filesWritten: ['.specify/extensions/pmi/extension.yml'],
      })),
    };
    const finalise = vi.fn(async () => undefined);
    const consumer = createProvisioningConsumer({ initialiser, finalise, extensionDir: () => '/bundle/extension' });

    const result = await consumer.run(job);

    expect(initialiser.initialise).toHaveBeenCalledWith(
      expect.objectContaining({ directory: '/projects/alpha', agentIntegration: 'claude', scriptType: 'sh', engineTag: 'v0.16.4', bundleVersion: '0.1.0', extensionDir: '/bundle/extension' }),
    );
    expect(finalise).toHaveBeenCalledWith('job_9', expect.objectContaining({ ok: true, engineTag: 'v0.16.4', bundleVersion: '0.1.0' }));
    expect(result).toEqual({ state: 'succeeded' });
  });

  it('finalises a failure with the step and a sanitised reason, and reports failed', async () => {
    const initialiser = {
      initialise: vi.fn(async () => ({
        ok: false as const,
        failedStep: 'run_engine_init' as const,
        reason: 'initialiser_unavailable: uv is not on PATH',
        stepsCompleted: [] as const,
        filesWritten: [],
      })),
    };
    const finalise = vi.fn(async () => undefined);
    const consumer = createProvisioningConsumer({ initialiser, finalise, extensionDir: () => '/bundle/extension' });

    const result = await consumer.run(job);

    expect(finalise).toHaveBeenCalledWith('job_9', expect.objectContaining({ ok: false, failedStep: 'run_engine_init', reason: expect.stringContaining('initialiser_unavailable') }));
    expect(result).toEqual({ state: 'failed', failureReason: 'engine_error' });
  });

  it('refuses a job that is not an initialise job', async () => {
    const consumer = createProvisioningConsumer({
      initialiser: { initialise: vi.fn() },
      finalise: vi.fn(),
      extensionDir: () => '/bundle/extension',
    });
    await expect(consumer.run({ ...job, kind: 'generate_specification' } as never)).rejects.toThrow(/initialise_workspace/);
  });

  it('turns an initialiser that throws into a failed step rather than a crashed worker', async () => {
    const initialiser = { initialise: vi.fn(async () => { throw new Error('disk full at /projects/alpha'); }) };
    const finalise = vi.fn(async () => undefined);
    const consumer = createProvisioningConsumer({ initialiser, finalise, extensionDir: () => '/bundle/extension' });
    const result = await consumer.run(job);
    expect(result.state).toBe('failed');
    expect(finalise).toHaveBeenCalledWith('job_9', expect.objectContaining({ ok: false, failedStep: 'run_engine_init' }));
  });
});
