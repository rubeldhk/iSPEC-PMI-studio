/**
 * `T2368` (EPIC-048, `FR-LRN-037`, `R-048-17`, spec Edge Cases; analysis `C3`) —
 * `learning.flags`: knowledge whose footing changed is flagged for review, and
 * **never** deprecated by the platform.
 *
 * - `evidence-changed` when a citation behind a current version turns
 *   `integrity-failed` or `unresolvable`; a later row clears it when it recovers;
 * - `source-invalid` when the source execution carries `validation-failed`,
 *   `transition-refused`, `transition-inconsistent` or
 *   `execution-reconciliation-conflicted` — on the approved version **and** on any
 *   open candidate from it (`C3`), so a reviewer sees it before deciding;
 * - status never changes: deprecation is a human decision.
 *
 * Driven through the job runner on the composed application. `EvidenceReads` is
 * a mutable recorder; the source-invalid case wraps the real `Executions` port
 * for one execution, visibly, because nothing on `main` lets a test append a
 * governance verdict to an execution the way `EPIC-030` would.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startLearningApp, type LearningApp } from '../helpers/learning-app.js';
import { DecisionRecorder, verified } from '../helpers/learning-ports.js';
import type { ResolvedEvidence } from '../../src/modules/learning/learning.tokens.js';
import type { LearningJobs } from '../../src/modules/learning/learning.jobs.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let app: LearningApp;
let jobs: LearningJobs;
let decisions: DecisionRecorder;
const evidence = new Map<string, ResolvedEvidence>();

async function flags(where: string, id: string): Promise<{ kind: string; detail: string; clearsFlagId: string | null }[]> {
  const r = await app.db.query(`SELECT kind, detail, "clearsFlagId" FROM knowledge_flags WHERE "${where}" = $1 ORDER BY "raisedAt", "createdAt"`, [id]);
  return r.rows;
}

async function status(versionId: string): Promise<string> {
  const r = await app.db.query(`SELECT status FROM knowledge_version_status_events WHERE "versionId" = $1 ORDER BY at DESC LIMIT 1`, [versionId]);
  return r.rows[0].status;
}

/** Submit, approve in "EPIC-031's Inbox", and let the resolve sweep materialise it. */
async function approvedVersion(over: Record<string, unknown> = {}): Promise<{ candidateId: string; versionId: string }> {
  const res = await app.submit(app.body(over)).expect(201);
  decisions.resolveAs(res.body.decisionId, { outcome: 'approved', actorKind: 'human', decidedBy: 'u_rev' });
  await jobs.run('learning.resolve-decisions', { workspaceId: 'ws_flags' });
  const v = await app.db.query(`SELECT id FROM knowledge_entry_versions WHERE "candidateId" = $1`, [res.body.candidateId]);
  return { candidateId: res.body.candidateId, versionId: v.rows[0].id };
}

beforeAll(async () => {
  if (noRuntime) return;
  app = await startLearningApp({ workspaceId: 'ws_flags' });
  app.bindNotAnExpert();
  decisions = new DecisionRecorder();
  app.ports.decisions = decisions;
  evidence.set('ev_1', verified('ev_1', { attestedTarget: { type: 'project', id: app.projectId } }));
  evidence.set('ev_2', verified('ev_2', { attestedTarget: { type: 'project', id: app.projectId } }));
  app.ports.evidence = {
    async resolve(ws, ids) {
      const out = new Map<string, ResolvedEvidence>();
      if (ws === 'ws_flags') for (const id of ids) if (evidence.has(id)) out.set(id, evidence.get(id)!);
      return out;
    },
  };
  // EPIC-032's contribute, bound to succeed: an unbound one would flag every approval attestation-missing.
  app.ports.attestations = { async contribute() { return { evidenceId: 'att_ok' }; } };
  const { LearningJobs: Jobs } = await import('../../src/modules/learning/learning.jobs.js');
  jobs = app.started.app.get(Jobs, { strict: false });
}, 600_000);

afterAll(async () => {
  await app?.close();
}, 120_000);

suite('T2368 · learning.flags', () => {
  it('raises evidence-changed when a cited item turns integrity-failed — and the status stays current', async () => {
    const { versionId } = await approvedVersion({ evidence: [{ evidenceId: 'ev_2', digest: { sha256: 'a'.repeat(64) } }] });
    evidence.set('ev_2', verified('ev_2', { integrity: 'failed' }));
    const report = await jobs.run('learning.flags', { workspaceId: 'ws_flags' });
    expect(report.outcome).toBe('succeeded');
    const raised = await flags('versionId', versionId);
    expect(raised).toHaveLength(1);
    expect(raised[0]).toMatchObject({ kind: 'evidence-changed', clearsFlagId: null });
    expect(raised[0]!.detail).toMatch(/ev_2.*integrity-failed/);
    expect(await status(versionId)).toBe('current');

    // A second sweep raises nothing new.
    await jobs.run('learning.flags', { workspaceId: 'ws_flags' });
    expect(await flags('versionId', versionId)).toHaveLength(1);

    // Recovery: a later row clears it; nothing is updated.
    evidence.set('ev_2', verified('ev_2', { attestedTarget: { type: 'project', id: app.projectId } }));
    await jobs.run('learning.flags', { workspaceId: 'ws_flags' });
    const after = await flags('versionId', versionId);
    expect(after).toHaveLength(2);
    expect(after[1]).toMatchObject({ kind: 'evidence-changed' });
    expect(after[1]!.clearsFlagId).not.toBeNull();
    expect(await status(versionId)).toBe('current');
  });

  it('raises evidence-changed when a cited item becomes unresolvable', async () => {
    evidence.set('ev_3', verified('ev_3', { attestedTarget: { type: 'project', id: app.projectId } }));
    const { versionId } = await approvedVersion({ evidence: [{ evidenceId: 'ev_3', digest: { sha256: 'a'.repeat(64) } }] });
    evidence.delete('ev_3');
    await jobs.run('learning.flags', { workspaceId: 'ws_flags' });
    expect((await flags('versionId', versionId))[0]).toMatchObject({ kind: 'evidence-changed' });
    expect(await status(versionId)).toBe('current');
  });

  it('an unreachable Evidence Store is not "changed evidence" — the sweep reports it and flags nothing', async () => {
    const { versionId } = await approvedVersion();
    const real = app.ports.evidence;
    app.ports.evidence = { async resolve() { throw new Error('EvidenceReads is not bound'); } };
    try {
      const report = await jobs.run('learning.flags', { workspaceId: 'ws_flags' });
      expect(report.errors.join(' ')).toMatch(/EvidenceReads/);
      expect(await flags('versionId', versionId)).toEqual([]);
    } finally {
      app.ports.evidence = real;
    }
  });

  it('raises source-invalid on the version and on open candidates from that execution (C3) — and changes no status', async () => {
    const tainted = await app.register('reg_tainted');
    const { versionId } = await approvedVersion({ executionId: tainted });
    const open = await app.submit(app.body({ executionId: tainted })).expect(201);
    const real = app.ports.executions;
    app.ports.executions = {
      ...real,
      async describe(ws, id) {
        const f = await real.describe(ws, id);
        return f !== null && id === tainted ? { ...f, invalidatedBy: ['validation-failed'] } : f;
      },
    };
    try {
      await jobs.run('learning.flags', { workspaceId: 'ws_flags' });
    } finally {
      app.ports.executions = real;
    }
    expect((await flags('versionId', versionId)).map((f) => f.kind)).toEqual(['source-invalid']);
    expect((await flags('versionId', versionId))[0]!.detail).toMatch(/validation-failed/);
    expect((await flags('candidateId', open.body.candidateId)).map((f) => f.kind)).toEqual(['source-invalid']);
    expect(await status(versionId)).toBe('current');
    const state = await app.db.query(`SELECT state FROM learning_candidate_transitions WHERE "candidateId" = $1 ORDER BY seq DESC LIMIT 1`, [open.body.candidateId]);
    expect(state.rows[0].state).toBe('pending-review');
  });

  it('retries a missing approval attestation and clears its flag', async () => {
    let fail = true;
    app.ports.attestations = { async contribute() { if (fail) throw new Error('evidence store down'); return { evidenceId: 'att_retry' }; } };
    const { versionId } = await approvedVersion();
    expect((await flags('versionId', versionId)).map((f) => f.kind)).toEqual(['attestation-missing']);
    fail = false;
    await jobs.run('learning.flags', { workspaceId: 'ws_flags' });
    const after = await flags('versionId', versionId);
    expect(after).toHaveLength(2);
    expect(after[1]!.detail).toMatch(/att_retry/);
  });
});
