/**
 * `T1352` (EPIC-041) — the files the platform emits into a project directory
 * are exactly the contract's set, in the contract's shape, and never carry a
 * credential.
 *
 * `FR-LPW-009`, `FR-LPW-011`, `SC-LPW-003`; contracts/project-files.md. This is
 * a CONTRACT test: it provisions through the service into a temp root and
 * reads back every file under it. **Mutation-tested at closure**: make the
 * merge step write the credential value and this must fail (`T1388`).
 *
 * Blocks CI. Moved from tests/governance/ on 2026-09-03 (analysis `I2`): it
 * boots a backend service, and the governance project reads files only.
 *
 * Written to FAIL before `T1342` exists.
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BUNDLE_VERSION, extensionDir, skillsDir, skillsPathFor } from '@pmi/workspace-bundle';
import { readProjectsRootConfig } from '../../src/modules/projects/projects-root.js';
import { InMemoryProjectStore, ProjectsService } from '../../src/modules/projects/projects.service.js';
import { InMemoryProvisioningRecordStore } from '../../src/modules/projects/provisioning.store.js';
import { ProvisioningService } from '../../src/modules/projects/provisioning.service.js';

const CTX = { workspaceId: 'ws_c', userId: 'u_c' };
const CREDENTIAL_SHAPE = /pmi_ct_[A-Za-z0-9_-]{20,}/;

/** The contract's enumeration for the prepare step, relative to the root. `.git/` when initialised. */
const CONTRACT_FILES = ['.pmi/project.json', '.mcp.json', '.claude/skills/setup-PMIStudio/SKILL.md'];

let root: string;
let dir: string;

function walk(base: string, current = base): string[] {
  return readdirSync(current).flatMap((entry) => {
    const full = join(current, entry);
    if (entry === '.git') return [];
    return statSync(full).isDirectory() ? walk(base, full) : [relative(base, full).split('\\').join('/')];
  });
}

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'pmi-contract-'));
  const projects = new InMemoryProjectStore();
  const service = new ProvisioningService({
    config: readProjectsRootConfig({ PMI_PROJECTS_ROOT: root, PMI_PROJECTS_ROOT_HOST: root, PMI_PUBLIC_URL: 'http://localhost:3000' }),
    projects,
    records: new InMemoryProvisioningRecordStore(),
    jobs: null,
    bundle: { version: BUNDLE_VERSION, defaultIntegration: 'claude', skillsDir, skillsPathFor },
    // A fake git: the file set is the subject here, and `.git/` is skipped by the walk.
    git: { init: async () => undefined },
  });
  void extensionDir;
  const project = await new ProjectsService(projects).create(CTX, { name: 'Contract' });
  await service.prepare(CTX, project.id, { rootPath: 'contract', agentIntegration: 'claude', scriptType: 'sh' });
  dir = join(root, 'contract');
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('T1352 · the written file set is exactly the contract\'s (FR-LPW-011)', () => {
  it('writes the three files and nothing else', () => {
    expect(walk(dir).sort()).toEqual([...CONTRACT_FILES].sort());
  });
});

describe('T1352 · shapes (FR-LPW-009)', () => {
  it('.pmi/project.json validates against the contract', () => {
    const text = readFileSync(join(dir, '.pmi', 'project.json'), 'utf8');
    expect(text.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(text);
    expect(Object.keys(parsed).sort()).toEqual(
      ['schemaVersion', 'projectId', 'workspaceId', 'projectName', 'platformUrl', 'agentIntegration', 'scriptType', 'engineTag', 'bundleVersion', 'provisionedBy', 'preparedAt'].sort(),
    );
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.provisionedBy).toBe('pmi-studio');
    expect(parsed.bundleVersion).toBe(BUNDLE_VERSION);
    expect(text).not.toContain(root);
  });

  it('.mcp.json parses and carries the pmi-studio entry with an env-var reference', () => {
    const parsed = JSON.parse(readFileSync(join(dir, '.mcp.json'), 'utf8'));
    expect(parsed.mcpServers['pmi-studio']).toMatchObject({ type: 'stdio', command: 'npx', env: { PMI_STUDIO_TOKEN: '${PMI_STUDIO_TOKEN}' } });
  });

  it('the setup skill is the bundle\'s, byte for byte', () => {
    expect(readFileSync(join(dir, '.claude', 'skills', 'setup-PMIStudio', 'SKILL.md'), 'utf8')).toBe(
      readFileSync(join(skillsDir(), 'setup-PMIStudio', 'SKILL.md'), 'utf8'),
    );
  });
});

describe('T1352 · no file matches the credential shape (SC-LPW-003)', () => {
  it('reads back every file the platform wrote', () => {
    for (const file of walk(dir)) {
      expect(readFileSync(join(dir, file), 'utf8'), `${file} carries a credential`).not.toMatch(CREDENTIAL_SHAPE);
    }
  });
});
