/**
 * `T1339` (EPIC-041) — the prepare step, against a real temp directory.
 *
 * `FR-LPW-002`, `FR-LPW-003`, `FR-LPW-006`, `FR-LPW-012`, `FR-LPW-013`,
 * `SC-LPW-004`, `SC-LPW-005`. The seven prepare steps run in order and each is
 * recorded; every refusal names its reason and leaves zero files; an empty git
 * repository is adopted and `git init` runs only where `.git` is absent; the
 * setup skill lands in `skillsPathFor(agentIntegration)` and an unmapped
 * integration fails the step by name rather than defaulting to any agent's
 * directory; a second run writes nothing and records `no_change`; an
 * interrupted run resumes at the first missing step and never repeats
 * `create_directory`.
 *
 * Written to FAIL before `T1342` exists.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readProjectsRootConfig } from '../../../src/modules/projects/projects-root.js';
import { InMemoryProjectStore, ProjectsService } from '../../../src/modules/projects/projects.service.js';
import { InMemoryProvisioningRecordStore } from '../../../src/modules/projects/provisioning.store.js';
import { ProvisioningService } from '../../../src/modules/projects/provisioning.service.js';
import { PREPARE_STEPS } from '../../../src/modules/projects/provisioning.types.js';

const CTX = { workspaceId: 'ws_a', userId: 'u_owner' };

let root: string;
let bundleDir: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'pmi-prov-'));
  bundleDir = mkdtempSync(join(tmpdir(), 'pmi-bundle-'));
  mkdirSync(join(bundleDir, 'setup-PMIStudio'), { recursive: true });
  writeFileSync(join(bundleDir, 'setup-PMIStudio', 'SKILL.md'), '---\nname: "setup-PMIStudio"\n---\nv0.1\n');
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(bundleDir, { recursive: true, force: true });
});

function harness(over: { jobs?: null; git?: { init: ReturnType<typeof vi.fn> } } = {}) {
  const config = readProjectsRootConfig({
    PMI_PROJECTS_ROOT: root,
    PMI_PROJECTS_ROOT_HOST: root,
    PMI_PUBLIC_URL: 'http://localhost:3000',
    PMI_ENGINE_TAG: 'v0.16.4',
  });
  const projects = new InMemoryProjectStore();
  const records = new InMemoryProvisioningRecordStore();
  const submit = vi.fn(async (req: { projectId: string }) => ({ job: { id: `job_${req.projectId}`, state: 'queued', jobKey: 'k' }, joinedExisting: false }));
  const git = over.git ?? { init: vi.fn(async () => undefined) };
  const audit = { record: vi.fn(async () => undefined) };
  const service = new ProvisioningService({
    config,
    projects,
    records,
    jobs: over.jobs === null ? null : { submit },
    bundle: {
      version: '0.1.0',
      defaultIntegration: 'claude',
      skillsDir: () => bundleDir,
      skillsPathFor: (i: string) => (i === 'claude' ? { ok: true as const, path: '.claude/skills' } : { ok: false as const, reason: `No skills directory is mapped for integration "${i}".` }),
    },
    git,
    audit,
    now: () => new Date('2026-09-03T10:00:00Z'),
  });
  return { config, projects, records, submit, git, audit, service, projectsApi: new ProjectsService(projects) };
}

async function project(h: ReturnType<typeof harness>, name = 'Alpha') {
  return h.projectsApi.create(CTX, { name });
}

describe('T1339 · a prepare that succeeds', () => {
  it('runs the seven steps in order, records them, and leaves the project prepared', async () => {
    const h = harness();
    const p = await project(h);
    const { project: after, record } = await h.service.prepare(CTX, p.id, { rootPath: 'alpha', agentIntegration: 'claude', scriptType: 'sh' });

    expect(record.outcome).toBe('succeeded');
    expect(record.stepsCompleted).toEqual([...PREPARE_STEPS]);
    expect(after.provisioningState).toBe('prepared');
    expect(after.rootPath).toBe(join(root, 'alpha'));
    expect(after.agentIntegration).toBe('claude');
    expect(after.scriptType).toBe('sh');
    expect(record.bundleVersion).toBe('0.1.0');
    expect(record.engineTag).toBe('v0.16.4');

    const dir = join(root, 'alpha');
    for (const f of ['.pmi/project.json', '.pmi/first-run', '.mcp.json', '.claude/skills/setup-PMIStudio/SKILL.md']) {
      expect(existsSync(join(dir, f)), `${f} missing`).toBe(true);
    }
    // EPIC-042 T1505: the first-run marker is written in the same step as .pmi/project.json (R-042-8).
    expect(record.filesWritten).toEqual(['.pmi/project.json', '.pmi/first-run', '.mcp.json', '.claude/skills/setup-PMIStudio/SKILL.md']);
    expect(record.firstRunMarkerWritten).toBe(true);
    expect(readFileSync(join(dir, '.pmi', 'first-run'), 'utf8')).toMatch(/^2026-09-03T10:00:00\.000Z \S+\n$/);
    expect(h.git.init).toHaveBeenCalledWith(dir);
    expect(h.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'initialise_workspace',
        projectId: p.id,
        inputRefs: expect.objectContaining({ workspace: expect.objectContaining({ writePath: dir, agentIntegration: 'claude', scriptType: 'sh', engineTag: 'v0.16.4', bundleVersion: '0.1.0' }) }),
      }),
    );
    expect(h.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: expect.any(String), targetType: 'project', targetId: p.id, outcome: 'success' }));
  });

  it('adopts an empty git repository without re-initialising it', async () => {
    const h = harness();
    const p = await project(h);
    mkdirSync(join(root, 'repo', '.git'), { recursive: true });
    const { record } = await h.service.prepare(CTX, p.id, { rootPath: 'repo', agentIntegration: 'claude', scriptType: 'sh' });
    expect(record.outcome).toBe('succeeded');
    expect(h.git.init).not.toHaveBeenCalled();
  });

  it('records pending when no queue can carry the initialise job', async () => {
    const h = harness({ jobs: null });
    const p = await project(h);
    const { project: after, record } = await h.service.prepare(CTX, p.id, { rootPath: 'alpha', agentIntegration: 'claude', scriptType: 'sh' });
    expect(record.outcome).toBe('pending');
    expect(after.provisioningState).toBe('initialisation_pending');
  });
});

describe('T1339 · every refusal names its reason and writes nothing (SC-LPW-005)', () => {
  it('refuses a non-empty directory by name', async () => {
    const h = harness();
    const p = await project(h);
    mkdirSync(join(root, 'busy'));
    writeFileSync(join(root, 'busy', 'README.md'), 'hi');
    await expect(h.service.prepare(CTX, p.id, { rootPath: 'busy', agentIntegration: 'claude', scriptType: 'sh' })).rejects.toThrow(/busy.*not empty|not empty.*busy/);
    expect(readdirSync(join(root, 'busy'))).toEqual(['README.md']);
    const latest = await h.records.latestForProject(CTX.workspaceId, p.id);
    expect(latest).toMatchObject({ outcome: 'failed', failedStep: 'create_directory' });
    expect((await h.projects.findById(p.id))?.provisioningState).toBe('failed');
  });

  it('refuses a path outside the root naming the root, and touches nothing', async () => {
    const h = harness();
    const p = await project(h);
    await expect(h.service.prepare(CTX, p.id, { rootPath: '/tmp/elsewhere', agentIntegration: 'claude', scriptType: 'sh' })).rejects.toThrow(/outside the projects root/);
    expect(readdirSync(root)).toEqual([]);
    expect((await h.records.latestForProject(CTX.workspaceId, p.id))?.failedStep).toBe('check_root');
  });

  it('refuses a directory another project owns, naming it', async () => {
    const h = harness();
    const a = await project(h, 'A');
    const b = await project(h, 'B');
    await h.service.prepare(CTX, a.id, { rootPath: 'shared', agentIntegration: 'claude', scriptType: 'sh' });
    await expect(h.service.prepare(CTX, b.id, { rootPath: 'shared', agentIntegration: 'claude', scriptType: 'sh' })).rejects.toThrow(/A/);
  });

  it('fails copy_setup_skill by name for an unmapped integration — never another agent\'s directory (FR-LPW-006)', async () => {
    const h = harness();
    const p = await project(h);
    await expect(h.service.prepare(CTX, p.id, { rootPath: 'cp', agentIntegration: 'copilot', scriptType: 'sh' })).rejects.toThrow(/copilot/);
    const latest = await h.records.latestForProject(CTX.workspaceId, p.id);
    expect(latest).toMatchObject({ outcome: 'failed', failedStep: 'copy_setup_skill' });
    expect(latest?.filesWritten).toEqual(['.pmi/project.json', '.pmi/first-run', '.mcp.json']);
    expect(existsSync(join(root, 'cp', '.claude'))).toBe(false);
  });
});

describe('T1339 · idempotence and resumption', () => {
  it('a second run on a prepared project writes nothing and records no_change (SC-LPW-004)', async () => {
    const h = harness();
    const p = await project(h);
    await h.service.prepare(CTX, p.id, { rootPath: 'alpha', agentIntegration: 'claude', scriptType: 'sh' });
    const before = readFileSync(join(root, 'alpha', '.pmi', 'project.json'), 'utf8');
    const { record } = await h.service.prepare(CTX, p.id, { rootPath: 'alpha' });
    expect(record.outcome).toBe('no_change');
    expect(record.filesWritten).toEqual([]);
    expect(readFileSync(join(root, 'alpha', '.pmi', 'project.json'), 'utf8')).toBe(before);
    expect(h.submit).toHaveBeenCalledTimes(1);
  });

  it('resumes at the first missing step and never re-runs create_directory', async () => {
    const h = harness();
    const p = await project(h);
    // A previous run got as far as writing project.json, then the process died.
    const dir = join(root, 'alpha');
    mkdirSync(join(dir, '.pmi'), { recursive: true });
    writeFileSync(join(dir, '.pmi', 'project.json'), '{"schemaVersion":1,"marker":"from the first run"}\n');
    mkdirSync(join(dir, '.git'));
    await h.projects.update(CTX.workspaceId, p.id, { rootPath: dir, agentIntegration: 'claude', scriptType: 'sh', provisioningState: 'failed' });
    await h.records.append({
      id: 'prov_prev', workspaceId: CTX.workspaceId, projectId: p.id, actorId: 'u_owner', correlationId: 'c0',
      startedAt: new Date('2026-09-03T09:00:00Z'), endedAt: new Date('2026-09-03T09:00:01Z'), outcome: 'failed',
      stepsCompleted: ['check_root', 'create_directory', 'adopt_or_init_git', 'write_project_json'],
      failedStep: 'merge_mcp_json', failureReason: 'process interrupted', engineTag: null, bundleVersion: '0.1.0',
      filesWritten: ['.pmi/project.json'],
      firstRunMarkerWritten: true,
    });

    const { record } = await h.service.prepare(CTX, p.id, { rootPath: 'alpha' });
    expect(record.outcome).toBe('succeeded');
    // The directory was NOT recreated (it would have refused: it is not empty) and git was not re-initialised.
    expect(h.git.init).not.toHaveBeenCalled();
    expect(readFileSync(join(dir, '.pmi', 'project.json'), 'utf8')).toContain('from the first run');
    expect(record.stepsCompleted).toEqual([...PREPARE_STEPS]);
    expect(record.filesWritten).toEqual(['.mcp.json', '.claude/skills/setup-PMIStudio/SKILL.md']);
  });
});

describe('T1521 · provisioning writes the constitution render (EPIC-042 FR-EXT-028)', () => {
  it('writes .specify/memory/constitution.md from the attached renderer, after .pmi/project.json, and records it', async () => {
    const h = harness();
    const render = vi.fn(async (_ws: string, _p: string, _u: string) => '<!-- GENERATED -->\n# Alpha Constitution\n');
    h.service.attachConstitutionRenderer({ render });
    const p = await project(h);
    const { record } = await h.service.prepare(CTX, p.id, { rootPath: 'alpha', agentIntegration: 'claude', scriptType: 'sh' });
    expect(render).toHaveBeenCalledWith(CTX.workspaceId, p.id, CTX.userId);
    expect(record.filesWritten).toEqual(['.pmi/project.json', '.pmi/first-run', '.specify/memory/constitution.md', '.mcp.json', '.claude/skills/setup-PMIStudio/SKILL.md']);
    expect(readFileSync(join(root, 'alpha', '.specify', 'memory', 'constitution.md'), 'utf8')).toBe('<!-- GENERATED -->\n# Alpha Constitution\n');
  });

  it('without a renderer attached, provisioning writes no constitution and says so by omission', async () => {
    const h = harness();
    const p = await project(h);
    const { record } = await h.service.prepare(CTX, p.id, { rootPath: 'alpha', agentIntegration: 'claude', scriptType: 'sh' });
    expect(record.filesWritten).not.toContain('.specify/memory/constitution.md');
  });
});
