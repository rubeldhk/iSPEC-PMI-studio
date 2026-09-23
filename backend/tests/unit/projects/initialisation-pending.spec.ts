/**
 * `T1347` (EPIC-041) — *prepared* becomes *initialisation pending* when nobody
 * claims the job, and not a moment before.
 *
 * `FR-LPW-010`, `data-model.md` §1.1. The transition is derived from the job
 * ledger's state — a queued initialise job older than `PMI_INITIALISE_WAIT_MS`
 * — not from a timer the API must keep alive. A job claimed at 29 s does not
 * transition; one still queued at 31 s does, and the record says so.
 *
 * Written to FAIL before `T1348` exists.
 */
import { describe, expect, it } from 'vitest';
import { readProjectsRootConfig } from '../../../src/modules/projects/projects-root.js';
import { InMemoryProjectStore, ProjectsService } from '../../../src/modules/projects/projects.service.js';
import { InMemoryProvisioningRecordStore } from '../../../src/modules/projects/provisioning.store.js';
import { ProvisioningService } from '../../../src/modules/projects/provisioning.service.js';

const CTX = { workspaceId: 'ws_a', userId: 'u_owner' };
const NOW = new Date('2026-09-03T10:00:30Z');

function harness(job: { state: string; createdAt: Date; startedAt: Date | null } | null) {
  const projects = new InMemoryProjectStore();
  const records = new InMemoryProvisioningRecordStore();
  const ledger = {
    listForProject: async () =>
      job === null
        ? []
        : [{ id: 'job_1', kind: 'initialise_workspace', state: job.state, createdAt: job.createdAt, startedAt: job.startedAt, projectId: 'p', workspaceId: CTX.workspaceId, jobKey: 'k', failureReason: null, endedAt: null, resultRef: null }],
  };
  const service = new ProvisioningService({
    config: readProjectsRootConfig({ PMI_PROJECTS_ROOT: '/p', PMI_PROJECTS_ROOT_HOST: '/p', PMI_INITIALISE_WAIT_MS: '30000' }),
    projects,
    records,
    jobs: null,
    ledger,
    bundle: { version: '0.1.0', defaultIntegration: 'claude', skillsDir: () => '/nowhere', skillsPathFor: () => ({ ok: true as const, path: '.claude/skills' }) },
    git: { init: async () => undefined },
    now: () => NOW,
  });
  return { projects, records, service, projectsApi: new ProjectsService(projects) };
}

async function preparedProject(h: ReturnType<typeof harness>) {
  const p = await h.projectsApi.create(CTX, { name: 'Alpha' });
  await h.projects.update(CTX.workspaceId, p.id, { rootPath: '/p/alpha', agentIntegration: 'claude', scriptType: 'sh', provisioningState: 'prepared' });
  return p;
}

describe('T1347 · refresh()', () => {
  it('moves a prepared project to initialisation_pending when its job has waited past the bound', async () => {
    const h = harness({ state: 'queued', createdAt: new Date('2026-09-03T09:59:59Z'), startedAt: null });
    const p = await preparedProject(h);
    const after = await h.service.refresh(CTX.workspaceId, p.id);
    expect(after.provisioningState).toBe('initialisation_pending');
    expect((await h.records.latestForProject(CTX.workspaceId, p.id))?.outcome).toBe('pending');
  });

  it('leaves a prepared project alone while the job is inside the bound', async () => {
    const h = harness({ state: 'queued', createdAt: new Date('2026-09-03T10:00:01Z'), startedAt: null });
    const p = await preparedProject(h);
    const after = await h.service.refresh(CTX.workspaceId, p.id);
    expect(after.provisioningState).toBe('prepared');
    expect(await h.records.latestForProject(CTX.workspaceId, p.id)).toBeNull();
  });

  it('leaves a prepared project alone while a worker is running the job, however long', async () => {
    const h = harness({ state: 'running', createdAt: new Date('2026-09-03T09:00:00Z'), startedAt: new Date('2026-09-03T09:00:01Z') });
    const p = await preparedProject(h);
    expect((await h.service.refresh(CTX.workspaceId, p.id)).provisioningState).toBe('prepared');
  });

  it('does nothing for a project that is not prepared', async () => {
    const h = harness({ state: 'queued', createdAt: new Date('2026-09-03T09:00:00Z'), startedAt: null });
    const p = await h.projectsApi.create(CTX, { name: 'Beta' });
    expect((await h.service.refresh(CTX.workspaceId, p.id)).provisioningState).toBe('not_provisioned');
  });

  it('is idempotent — a second refresh appends no second pending record', async () => {
    const h = harness({ state: 'queued', createdAt: new Date('2026-09-03T09:00:00Z'), startedAt: null });
    const p = await preparedProject(h);
    await h.service.refresh(CTX.workspaceId, p.id);
    await h.service.refresh(CTX.workspaceId, p.id);
    expect((await h.records.listForProject(CTX.workspaceId, p.id)).filter((r) => r.outcome === 'pending')).toHaveLength(1);
  });
});
