/**
 * T660 — the WORKER installs observability too.
 *
 * `T656` asserts the same thing of the API, and both of its installation
 * assertions read `backend/src/main.ts`. Nothing read `worker/src/main.ts`, so
 * `T657` could be marked complete with half of its own task text undone and the
 * suite stayed green. That is DEF-001-001.
 *
 * The lesson is in the shape of this file: an installation check that names one
 * process cannot speak for the other. There are two long-running processes, so
 * there are two of these.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildObservability, NullMetricSink } from '@pmi/observability';
import { reportGenerationResult } from '../../src/observability-composition.js';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Comments are stripped before asserting, in both directions.
 *
 * A positive assertion satisfied by a comment proves nothing — a file that
 * merely *mentions* `buildObservability` in prose would pass while installing
 * nothing, which is the same false-green DEF-001-001 was made of. And a
 * negative assertion broken by a comment is a check that fails on documentation,
 * which teaches the next person to delete the comment rather than fix the code.
 */
function code(path: string): string {
  return readFileSync(resolve(here, path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const workerMain = code('../../src/main.ts');

const JOB = {
  id: 'job-1',
  workspaceId: 'ws-1',
  projectId: 'proj-1',
  requestedById: 'user-1',
  correlationId: '11111111-1111-4111-8111-111111111111',
  projectName: 'Apollo',
  requirements: [],
};

function capture() {
  const lines: string[] = [];
  const sink = new NullMetricSink();
  const obs = buildObservability({ service: 'worker', sink, write: (l) => lines.push(l) });
  return { obs, lines, sink };
}

describe('T660 · the worker bootstrap installs observability', () => {
  it('main.ts builds the observability bundle', () => {
    // The whole of DEF-001-001: without this the worker emits nothing.
    //
    // The CALL, not the import — see the SC-011 assertion below for why the
    // difference matters and how it was found.
    expect(workerMain).toMatch(/buildObservability\s*\(/);
  });

  it('main.ts emits its startup record through the structured logger', () => {
    expect(workerMain).toMatch(/loggerFor\s*\(/);
    expect(workerMain).toMatch(/worker\.started/);
  });

  it('main.ts does not hand-roll a log line', () => {
    // The original `console.log(JSON.stringify({...}))` carried no level, no
    // workspace, no actor, no correlation id, and never passed through redact().
    // A hand-rolled line is a line the log-safety rules do not apply to.
    expect(workerMain).not.toMatch(/console\.log/);
  });

  it('main.ts reports every job result, so terminal states reach metrics (SC-011)', () => {
    // The CALL, not the import. `toMatch(/reportGenerationResult/)` was the
    // first version of this line and a mutation survived it: deleting the call
    // site left the `import { reportGenerationResult }` statement behind, and
    // the check stayed green while nothing reported anything.
    //
    // That is DEF-001-001's shape reproduced inside the check written to prevent
    // it — an assertion that matches the DECLARATION of a capability rather than
    // its USE. Worth the two extra characters.
    expect(workerMain).toMatch(/reportGenerationResult\s*\(/);
    expect(workerMain).toMatch(/onResult\s*:/);
  });
});

describe('T660 · a finished job is logged and measured', () => {
  it('records the terminal state and duration on the sink', () => {
    const { obs, sink } = capture();

    reportGenerationResult(obs, JOB, { state: 'succeeded' }, 42, 'speckit');

    expect(sink.recorded.map((m) => m.name)).toEqual(['job.finished', 'job.duration_ms']);
    expect(sink.recorded[0]?.attrs).toMatchObject({ state: 'succeeded', engine: 'speckit' });
    expect(sink.recorded[1]?.value).toBe(42);
  });

  it('carries the failure reason so SC-005 stays answerable from metrics alone', () => {
    const { obs, sink } = capture();

    reportGenerationResult(
      obs,
      JOB,
      { state: 'failed', failureReason: 'engine_error' },
      7,
      'speckit',
    );

    expect(sink.recorded[0]?.attrs).toMatchObject({ state: 'failed', reason: 'engine_error' });
  });

  it('logs the job with its correlation id, so the trace spans the worker hop (PC-3)', () => {
    const { obs, lines } = capture();

    reportGenerationResult(obs, JOB, { state: 'succeeded' }, 42, 'speckit');

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] as string)).toMatchObject({
      service: 'worker',
      msg: 'job.finished',
      correlationId: JOB.correlationId,
      workspaceId: JOB.workspaceId,
      jobId: JOB.id,
      state: 'succeeded',
    });
  });

  it('logs a failure at warn, not info — a failed generation is not routine', () => {
    const { obs, lines } = capture();

    reportGenerationResult(obs, JOB, { state: 'failed', failureReason: 'engine_error' }, 7, 'x');

    expect(JSON.parse(lines[0] as string)).toMatchObject({ level: 'warn' });
  });

  it('never lets engine output or a credential reach the worker log', () => {
    const { obs, lines } = capture();

    // The worker is the process that HOLDS the engine, so it is the process
    // most able to leak what the engine produced.
    obs
      .loggerFor({ workspaceId: 'ws-1', actorId: null, correlationId: JOB.correlationId })
      .log('info', 'engine.finished', { token: 'sk-live-secret', contentRaw: 'a requirement' });

    const line = lines[0] as string;
    expect(line).not.toContain('sk-live-secret');
    expect(line).not.toContain('a requirement');
  });
});
