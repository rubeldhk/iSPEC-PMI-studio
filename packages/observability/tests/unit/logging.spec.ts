/**
 * T157 — structured logging.
 * Written to FAIL before T158 exists (Constitution V).
 *
 * PP-010. Two exclusions are asserted here rather than left to review:
 * engine output is never logged (it may carry customer requirements), and no
 * credential is ever logged (research R-011).
 */
import { describe, expect, it } from 'vitest';
import { buildLogRecord, REDACTED, redact } from '../../src/logger.js';

const ctx = { workspaceId: 'ws_a', actorId: 'u1', correlationId: 'corr-1' };

describe('buildLogRecord()', () => {
  it('carries workspace, actor and correlation on every record', () => {
    const r = buildLogRecord('info', 'project.created', ctx, {});
    expect(r).toMatchObject({
      level: 'info',
      msg: 'project.created',
      workspaceId: 'ws_a',
      actorId: 'u1',
      correlationId: 'corr-1',
    });
  });

  it('carries jobId when the record concerns a job', () => {
    const r = buildLogRecord('info', 'job.started', { ...ctx, jobId: 'job_1' }, {});
    expect(r['jobId']).toBe('job_1');
  });

  it('refuses a record with no correlation id', () => {
    expect(() =>
      buildLogRecord('info', 'x', { workspaceId: 'ws_a', actorId: 'u1', correlationId: '' }, {}),
    ).toThrow(/correlation/i);
  });
});

describe('redaction', () => {
  it('never logs engine output', () => {
    const r = buildLogRecord('info', 'job.finished', ctx, {
      contentRaw: '# Specification: secret customer requirement',
      contentParsed: { title: 'x' },
    });
    const s = JSON.stringify(r);
    expect(s).not.toContain('secret customer requirement');
    expect(r['contentRaw']).toBe(REDACTED);
  });

  it('never logs a credential', () => {
    const r = buildLogRecord('error', 'engine.failed', ctx, {
      apiKey: 'sk-abc123',
      password: 'hunter2',
      token: 'ghp_xyz',
      diagnostics: 'stderr: token sk-abc123',
    });
    const s = JSON.stringify(r);
    for (const secret of ['sk-abc123', 'hunter2', 'ghp_xyz']) {
      expect(s).not.toContain(secret);
    }
  });

  it('redacts nested secrets too', () => {
    const r = buildLogRecord('info', 'x', ctx, { engine: { name: 'speckit', apiKey: 'sk-nested' } });
    expect(JSON.stringify(r)).not.toContain('sk-nested');
  });

  it('keeps safe operational fields', () => {
    const r = buildLogRecord('info', 'job.finished', ctx, {
      engineName: 'fixture',
      durationMs: 1234,
      state: 'succeeded',
    });
    expect(r['engineName']).toBe('fixture');
    expect(r['durationMs']).toBe(1234);
  });

  it('redact() is usable standalone and does not mutate its input', () => {
    const input = { apiKey: 'sk-1', keep: 'yes' };
    const out = redact(input);
    expect(out['apiKey']).toBe(REDACTED);
    expect(input.apiKey).toBe('sk-1');
    expect(out['keep']).toBe('yes');
  });
});
