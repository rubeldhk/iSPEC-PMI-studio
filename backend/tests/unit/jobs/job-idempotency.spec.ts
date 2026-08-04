/**
 * T042 — idempotent job keys: a duplicate submission joins the existing job.
 * Written to FAIL before T043 exists (Constitution V).
 *
 * Not a nicety: each engine run is a metered AI agent invocation, so starting
 * two for one request is a real cost (RAID R-02).
 */
import { describe, expect, it } from 'vitest';
import { computeJobKey, JobsService, type JobStore } from '../../../src/modules/jobs/jobs.service.js';

function store(): JobStore & { rows: Map<string, { id: string; state: string; jobKey: string }> } {
  const rows = new Map<string, { id: string; state: string; jobKey: string }>();
  let n = 0;
  return {
    rows,
    async findLive(_projectId, jobKey) {
      const hit = [...rows.values()].find(
        (r) => r.jobKey === jobKey && (r.state === 'queued' || r.state === 'running'),
      );
      return hit ?? null;
    },
    async create(data) {
      const id = `job_${++n}`;
      rows.set(id, { id, state: 'queued', jobKey: data.jobKey });
      return { id, state: 'queued', jobKey: data.jobKey };
    },
  };
}

const req = {
  workspaceId: 'ws_a',
  projectId: 'p1',
  kind: 'generate_specification' as const,
  requestedById: 'u1',
  engineName: 'fixture',
  engineVersion: 'fixture-1.0.0+model=none',
  correlationId: 'corr-1',
  inputRefs: { requirementIds: ['r1', 'r2'] },
};

describe('computeJobKey()', () => {
  it('is stable for identical input', () => {
    expect(computeJobKey(req)).toBe(computeJobKey({ ...req }));
  });

  it('is order-insensitive across the selection', () => {
    const a = computeJobKey(req);
    const b = computeJobKey({ ...req, inputRefs: { requirementIds: ['r2', 'r1'] } });
    expect(a).toBe(b);
  });

  it('differs when the selection differs', () => {
    expect(computeJobKey(req)).not.toBe(
      computeJobKey({ ...req, inputRefs: { requirementIds: ['r1'] } }),
    );
  });

  it('differs when the kind differs', () => {
    expect(computeJobKey(req)).not.toBe(computeJobKey({ ...req, kind: 'generate_tasks' }));
  });
});

describe('JobsService.submit()', () => {
  it('creates a job on first submission', async () => {
    const s = store();
    const svc = new JobsService(s);
    const r = await svc.submit(req);
    expect(r.joinedExisting).toBe(false);
    expect(s.rows.size).toBe(1);
  });

  it('JOINS the live job on duplicate submission — never starts a second', async () => {
    const s = store();
    const svc = new JobsService(s);
    const first = await svc.submit(req);
    const second = await svc.submit(req);
    expect(second.joinedExisting).toBe(true);
    expect(second.job.id).toBe(first.job.id);
    expect(s.rows.size).toBe(1);
  });

  it('starts a new job once the previous one is terminal', async () => {
    const s = store();
    const svc = new JobsService(s);
    const first = await svc.submit(req);
    s.rows.get(first.job.id)!.state = 'succeeded';
    const second = await svc.submit(req);
    expect(second.joinedExisting).toBe(false);
    expect(s.rows.size).toBe(2);
  });

  it('refuses an empty selection before creating anything (E7)', async () => {
    const s = store();
    const svc = new JobsService(s);
    await expect(svc.submit({ ...req, inputRefs: { requirementIds: [] } })).rejects.toThrow(
      /empty_selection|at least one/i,
    );
    expect(s.rows.size).toBe(0);
  });
});
