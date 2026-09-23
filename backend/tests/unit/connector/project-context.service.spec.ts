/**
 * `T1444` (EPIC-043, `FR-PIC-040`–`FR-PIC-043`, `R-043-9`) — the reads a local
 * agent needs to begin: project context and requirements grouped by Epic, this
 * project only, the Epic-list derivation stated as unavailable until EPIC-044,
 * every read audited (`FR-PIC-036`, analysis `C3`).
 *
 * Written to FAIL before `T1445`.
 */
import { describe, expect, it, vi } from 'vitest';
import { ProjectContextService } from '../../../src/modules/connector/project-context.service.js';

const PROJECT = {
  id: 'proj_1', workspaceId: 'ws_a', name: 'Alpha', description: null, status: 'active', engineName: null, ownerUserId: 'u_owner', archivedAt: null,
  rootPath: '/home/me/alpha', agentIntegration: 'copilot', scriptType: 'sh', provisioningState: 'provisioned', provisionedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
};

function harness() {
  const audits: Record<string, unknown>[] = [];
  const projects = { get: vi.fn(async (workspaceId: string, id: string) => (workspaceId === 'ws_a' && id === 'proj_1' ? PROJECT : Promise.reject(new Error('Not found.')))) };
  const requirements = {
    list: vi.fn(async () => [
      { id: 'r1', workspaceId: 'ws_a', projectId: 'proj_1', reference: 'REQ-001', description: 'Alpha shall', type: 'functional', priority: 'p1', status: 'active', contentHash: 'h', retiredAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 'r2', workspaceId: 'ws_a', projectId: 'proj_1', reference: 'REQ-002', description: 'Beta shall', type: 'constraint', priority: 'p2', status: 'retired', contentHash: 'h', retiredAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
    ]),
  };
  const service = new ProjectContextService({
    projects: projects as never,
    requirements: requirements as never,
    bundleVersion: '0.1.0',
    contractVersion: '1.0',
    publicUrl: 'http://localhost:3000',
    audit: { record: vi.fn(async (row: Record<string, unknown>) => void audits.push(row)) },
  });
  return { service, audits, projects, requirements };
}

const CTX = { credentialId: 'cred_1', workspaceId: 'ws_a', projectId: 'proj_1', principalId: 'pr_1' };

describe('T1444 · project context', () => {
  it('returns the project fields, the versions, the public address, and an empty Epic list whose source is stated', async () => {
    const { service, audits } = harness();
    const ctx = await service.context(CTX);
    expect(ctx).toEqual({
      projectId: 'proj_1',
      name: 'Alpha',
      agentIntegration: 'copilot',
      scriptType: 'sh',
      provisioningState: 'provisioned',
      rootPath: '/home/me/alpha',
      extensionVersion: '0.1.0',
      contractVersion: '1.0',
      platformUrl: 'http://localhost:3000',
      epics: [],
      epicSource: 'unavailable-until-EPIC-044',
    });
    expect(audits[0]).toMatchObject({ workspaceId: 'ws_a', actorId: 'pr_1', targetType: 'project', targetId: 'proj_1', outcome: 'success', detail: { kind: 'connector', operation: 'project.context' } });
  });

  it('reads only the credential\'s project', async () => {
    const { service, projects } = harness();
    await service.context(CTX);
    expect(projects.get).toHaveBeenCalledWith('ws_a', 'proj_1');
    await expect(service.context({ ...CTX, projectId: 'proj_other' })).rejects.toThrow();
  });
});

describe('T1444 · requirements by Epic', () => {
  it('groups every active requirement once under unassigned, omits retired ones, and states the derivation', async () => {
    const { service, audits } = harness();
    const res = await service.requirementsByEpic(CTX, 'epic');
    expect(res.epicSource).toBe('unavailable-until-EPIC-044');
    expect(res.groups).toHaveLength(1);
    expect(res.groups[0]?.epic).toBe('unassigned');
    expect(res.groups[0]?.requirements).toEqual([
      { id: 'r1', reference: 'REQ-001', description: 'Alpha shall', type: 'functional', priority: 'p1', status: 'active', baselineState: null },
    ]);
    expect(res.baselineSource).toMatch(/unavailable/);
    expect(audits.some((a) => (a['detail'] as { operation?: string })?.operation === 'requirements.list')).toBe(true);
  });

  it('refuses a groupBy other than epic by name', async () => {
    const { service } = harness();
    await expect(service.requirementsByEpic(CTX, 'type')).rejects.toMatchObject({ code: 'validation_failed' });
  });
});
