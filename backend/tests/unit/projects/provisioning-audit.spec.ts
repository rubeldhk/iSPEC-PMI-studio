/**
 * `T1395` (EPIC-041 convergence) — the provisioning audit entry names the
 * path as the host sees it, the agent integration and the script type beside
 * outcome and failed step (`FR-LPW-004`). Never the write root.
 *
 * Written to FAIL before `append()` carries them.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuditService, type AuditWriter } from '../../../src/modules/audit/audit.service.js';
import { readProjectsRootConfig } from '../../../src/modules/projects/projects-root.js';
import { InMemoryProjectStore, ProjectsService } from '../../../src/modules/projects/projects.service.js';
import { ProvisioningService } from '../../../src/modules/projects/provisioning.service.js';
import { InMemoryProvisioningRecordStore } from '../../../src/modules/projects/provisioning.store.js';

const CTX = { workspaceId: 'ws_a', userId: 'u_owner' };
let root: string;
let hostRoot: string;
let bundleDir: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'pmi-audit-root-'));
  hostRoot = '/Users/me/pmi-projects';
  bundleDir = mkdtempSync(join(tmpdir(), 'pmi-audit-bundle-'));
  mkdirSync(join(bundleDir, 'setup-PMIStudio'), { recursive: true });
  writeFileSync(join(bundleDir, 'setup-PMIStudio', 'SKILL.md'), '# skill\n');
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(bundleDir, { recursive: true, force: true });
});

function harness(gitFails = false) {
  const projects = new InMemoryProjectStore();
  const projectsApi = new ProjectsService(projects);
  const audits: Record<string, unknown>[] = [];
  const writer: AuditWriter = { create: async (row) => void audits.push(row) };
  const service = new ProvisioningService({
    config: readProjectsRootConfig({ PMI_PROJECTS_ROOT: root, PMI_PROJECTS_ROOT_HOST: hostRoot, PMI_PUBLIC_URL: 'http://localhost:3000' }),
    projects,
    records: new InMemoryProvisioningRecordStore(),
    jobs: null,
    bundle: {
      version: '0.1.0',
      defaultIntegration: 'claude',
      skillsDir: () => bundleDir,
      skillsPathFor: () => ({ ok: true as const, path: '.claude/skills' }),
    },
    git: {
      init: async () => {
        if (gitFails) throw new Error(`git init failed under ${root}`);
      },
    },
    audit: new AuditService(writer),
  });
  return { service, projectsApi, audits };
}

describe('T1395 · the provisioning audit entry (FR-LPW-004)', () => {
  it('names actor, host path, integration, script type and outcome on success', async () => {
    const { service, projectsApi, audits } = harness();
    const project = await projectsApi.create(CTX, { name: 'Alpha' });
    const { project: prepared } = await service.prepare(CTX, project.id, { rootPath: 'alpha', agentIntegration: 'copilot', scriptType: 'ps' });
    const entry = audits.find((a) => (a['detail'] as { kind?: string })?.kind === 'provision');
    expect(entry).toMatchObject({ actorId: 'u_owner', targetType: 'project', targetId: project.id, outcome: 'success' });
    const detail = entry?.['detail'] as { path: string };
    // No queue on this host, so the prepare ends pending; the audit says so.
    expect(detail).toMatchObject({ agentIntegration: 'copilot', scriptType: 'ps', outcome: 'pending' });
    // The path as the host sees it — the record's own rootPath — never the write root.
    expect(detail.path).toBe(prepared.rootPath);
    expect(detail.path.startsWith(hostRoot)).toBe(true);
    expect(detail.path.endsWith('alpha')).toBe(true);
    expect(JSON.stringify(entry)).not.toContain(root);
  });

  it('names the failed step alongside the same fields on failure', async () => {
    const { service, projectsApi, audits } = harness(true);
    const project = await projectsApi.create(CTX, { name: 'Beta' });
    // A failed step writes its record and audit entry, then rethrows (the contract's status).
    await expect(service.prepare(CTX, project.id, { rootPath: 'beta', agentIntegration: 'claude', scriptType: 'sh' })).rejects.toThrow();
    const entry = audits.find((a) => (a['detail'] as { kind?: string })?.kind === 'provision');
    const detail = entry?.['detail'] as { path: string };
    expect(detail).toMatchObject({ agentIntegration: 'claude', scriptType: 'sh', failedStep: 'adopt_or_init_git' });
    expect(detail.path.startsWith(hostRoot)).toBe(true);
    expect(detail.path.endsWith('beta')).toBe(true);
    expect(JSON.stringify(entry)).not.toContain(root);
  });
});
