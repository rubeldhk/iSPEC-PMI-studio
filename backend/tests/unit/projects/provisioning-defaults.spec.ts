/**
 * `T1396` (EPIC-041 convergence) — the default agent integration and script
 * type are configuration, not code (`FR-LPW-005`): `PMI_DEFAULT_AGENT_INTEGRATION`
 * and `PMI_DEFAULT_SCRIPT_TYPE`, falling back to the bundle's default
 * integration and `sh`. The backend still names no provider.
 *
 * Written to FAIL before `readProjectsRootConfig` reads them.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readProjectsRootConfig } from '../../../src/modules/projects/projects-root.js';
import { InMemoryProjectStore, ProjectsService } from '../../../src/modules/projects/projects.service.js';
import { ProvisioningService } from '../../../src/modules/projects/provisioning.service.js';
import { InMemoryProvisioningRecordStore } from '../../../src/modules/projects/provisioning.store.js';

const CTX = { workspaceId: 'ws_a', userId: 'u_owner' };
let root: string;
let bundleDir: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'pmi-defaults-root-'));
  bundleDir = mkdtempSync(join(tmpdir(), 'pmi-defaults-bundle-'));
  mkdirSync(join(bundleDir, 'setup-PMIStudio'), { recursive: true });
  writeFileSync(join(bundleDir, 'setup-PMIStudio', 'SKILL.md'), '# skill\n');
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(bundleDir, { recursive: true, force: true });
});

describe('T1396 · readProjectsRootConfig reads the defaults', () => {
  it('exposes the configured default integration and script type', () => {
    const config = readProjectsRootConfig({ PMI_PROJECTS_ROOT: '/p', PMI_PROJECTS_ROOT_HOST: '/p', PMI_DEFAULT_AGENT_INTEGRATION: 'copilot', PMI_DEFAULT_SCRIPT_TYPE: 'ps' });
    expect(config.defaultAgentIntegration).toBe('copilot');
    expect(config.defaultScriptType).toBe('ps');
  });

  it('leaves both undefined when unset, so the bundle and sh decide', () => {
    const config = readProjectsRootConfig({ PMI_PROJECTS_ROOT: '/p', PMI_PROJECTS_ROOT_HOST: '/p' });
    expect(config.defaultAgentIntegration).toBeUndefined();
    expect(config.defaultScriptType).toBeUndefined();
  });

  it('refuses a script type outside the vocabulary rather than passing it to the initialiser', () => {
    expect(() => readProjectsRootConfig({ PMI_PROJECTS_ROOT: '/p', PMI_PROJECTS_ROOT_HOST: '/p', PMI_DEFAULT_SCRIPT_TYPE: 'bash' })).toThrow(/PMI_DEFAULT_SCRIPT_TYPE/);
  });
});

describe('T1396 · the prepare step applies the configured defaults', () => {
  function service(env: Record<string, string>) {
    const projects = new InMemoryProjectStore();
    const projectsApi = new ProjectsService(projects);
    const svc = new ProvisioningService({
      config: readProjectsRootConfig({ PMI_PROJECTS_ROOT: root, PMI_PROJECTS_ROOT_HOST: root, ...env }),
      projects,
      records: new InMemoryProvisioningRecordStore(),
      jobs: null,
      bundle: {
        version: '0.1.0',
        defaultIntegration: 'bundle-default',
        skillsDir: () => bundleDir,
        skillsPathFor: (i: string) => ({ ok: true as const, path: `.${i}/skills` }),
      },
      git: { init: async () => undefined },
    });
    return { svc, projectsApi };
  }

  it('uses PMI_DEFAULT_AGENT_INTEGRATION and PMI_DEFAULT_SCRIPT_TYPE when the request names neither', async () => {
    const { svc, projectsApi } = service({ PMI_DEFAULT_AGENT_INTEGRATION: 'copilot', PMI_DEFAULT_SCRIPT_TYPE: 'ps' });
    const created = await projectsApi.create(CTX, { name: 'A' });
    const { project } = await svc.prepare(CTX, created.id, { rootPath: 'a' });
    expect(project.agentIntegration).toBe('copilot');
    expect(project.scriptType).toBe('ps');
  });

  it('falls back to the bundle\'s default integration and sh when unset', async () => {
    const { svc, projectsApi } = service({});
    const created = await projectsApi.create(CTX, { name: 'B' });
    const { project } = await svc.prepare(CTX, created.id, { rootPath: 'b' });
    expect(project.agentIntegration).toBe('bundle-default');
    expect(project.scriptType).toBe('sh');
  });

  it('a request still wins over the configured default', async () => {
    const { svc, projectsApi } = service({ PMI_DEFAULT_AGENT_INTEGRATION: 'copilot', PMI_DEFAULT_SCRIPT_TYPE: 'ps' });
    const created = await projectsApi.create(CTX, { name: 'C' });
    const { project } = await svc.prepare(CTX, created.id, { rootPath: 'c', agentIntegration: 'gemini', scriptType: 'sh' });
    expect(project.agentIntegration).toBe('gemini');
    expect(project.scriptType).toBe('sh');
  });
});
