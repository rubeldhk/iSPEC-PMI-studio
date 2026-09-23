/**
 * `T1337` (EPIC-041) — the two files the platform writes, and what they never carry.
 *
 * `FR-LPW-009`, `FR-LPW-024`, `R-041-10`; `contracts/project-files.md`.
 * `.pmi/project.json` matches the contract shape, has `\n` endings and a trailing
 * newline, carries `platformUrl` from `PMI_PUBLIC_URL` and nothing inferred from
 * the request, and contains no credential and no root path. `.mcp.json` is
 * MERGED — an existing entry survives byte-for-byte — created when absent, left
 * untouched with a named failure when unparseable, and its token is the literal
 * `${PMI_STUDIO_TOKEN}` reference.
 *
 * Written to FAIL before `T1338` exists.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  McpJsonUnparseableError,
  PMI_STUDIO_TOKEN_REFERENCE,
  mcpServerEntry,
  mergeMcpJson,
  writeConstitutionFile,
  writeFirstRunMarker,
  writeProjectJson,
} from '../../../src/modules/projects/project-files.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pmi-files-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const project = {
  projectId: 'pr_1',
  workspaceId: 'ws_1',
  projectName: 'Alpha',
  platformUrl: 'http://localhost:3000',
  agentIntegration: 'claude',
  scriptType: 'sh' as const,
  engineTag: 'v0.16.4',
  bundleVersion: '0.1.0',
  preparedAt: new Date('2026-09-03T10:00:00Z'),
};

describe('T1337 · .pmi/project.json', () => {
  it('writes the contract shape with LF endings and a trailing newline, and reports its relative path', async () => {
    const written = await writeProjectJson(dir, project);
    expect(written).toBe('.pmi/project.json');
    const text = readFileSync(join(dir, '.pmi', 'project.json'), 'utf8');
    expect(text.endsWith('\n')).toBe(true);
    expect(text).not.toContain('\r');
    expect(JSON.parse(text)).toEqual({
      schemaVersion: 1,
      projectId: 'pr_1',
      workspaceId: 'ws_1',
      projectName: 'Alpha',
      platformUrl: 'http://localhost:3000',
      agentIntegration: 'claude',
      scriptType: 'sh',
      engineTag: 'v0.16.4',
      bundleVersion: '0.1.0',
      provisionedBy: 'pmi-studio',
      preparedAt: '2026-09-03T10:00:00.000Z',
    });
  });

  it('carries no root path and no credential', async () => {
    await writeProjectJson(dir, project);
    const text = readFileSync(join(dir, '.pmi', 'project.json'), 'utf8');
    expect(text).not.toContain(dir);
    expect(text).not.toMatch(/pmi_ct_/);
    expect(text).not.toMatch(/token/i);
  });

  it('is byte-identical when written twice with the same inputs — a re-provision leaves git clean', async () => {
    await writeProjectJson(dir, project);
    const first = readFileSync(join(dir, '.pmi', 'project.json'), 'utf8');
    await writeProjectJson(dir, project);
    expect(readFileSync(join(dir, '.pmi', 'project.json'), 'utf8')).toBe(first);
  });
});

describe('T1337 · .mcp.json', () => {
  const entry = mcpServerEntry({ publicUrl: 'http://localhost:3000', mcpServerVersion: '0.1.0' });

  it('describes the pmi-studio server with an env-var REFERENCE, never a value', () => {
    expect(entry).toEqual({
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@pmi/mcp-server@0.1.0'],
      env: { PMI_STUDIO_URL: 'http://localhost:3000', PMI_STUDIO_TOKEN: PMI_STUDIO_TOKEN_REFERENCE },
    });
    expect(PMI_STUDIO_TOKEN_REFERENCE).toBe('${PMI_STUDIO_TOKEN}');
  });

  it('creates the file when absent', async () => {
    const result = await mergeMcpJson(dir, entry);
    expect(result).toEqual({ path: '.mcp.json', action: 'created' });
    const parsed = JSON.parse(readFileSync(join(dir, '.mcp.json'), 'utf8'));
    expect(parsed.mcpServers['pmi-studio']).toEqual(entry);
  });

  it('merges into an existing file, preserving every other server and key order', async () => {
    writeFileSync(
      join(dir, '.mcp.json'),
      JSON.stringify({ mcpServers: { playwright: { type: 'stdio', command: 'npx', args: ['-y', '@playwright/mcp@latest'] } }, other: 1 }, null, 2) + '\n',
    );
    const result = await mergeMcpJson(dir, entry);
    expect(result.action).toBe('merged');
    const parsed = JSON.parse(readFileSync(join(dir, '.mcp.json'), 'utf8'));
    expect(Object.keys(parsed)).toEqual(['mcpServers', 'other']);
    expect(Object.keys(parsed.mcpServers)).toEqual(['playwright', 'pmi-studio']);
    expect(parsed.mcpServers.playwright.args).toEqual(['-y', '@playwright/mcp@latest']);
    expect(parsed.other).toBe(1);
  });

  it('replaces only the pmi-studio entry on a second merge', async () => {
    await mergeMcpJson(dir, entry);
    const result = await mergeMcpJson(dir, mcpServerEntry({ publicUrl: 'http://localhost:4000', mcpServerVersion: '0.2.0' }));
    expect(result.action).toBe('merged');
    const parsed = JSON.parse(readFileSync(join(dir, '.mcp.json'), 'utf8'));
    expect(parsed.mcpServers['pmi-studio'].args).toEqual(['-y', '@pmi/mcp-server@0.2.0']);
    expect(Object.keys(parsed.mcpServers)).toEqual(['pmi-studio']);
  });

  it('leaves an unparseable file untouched and fails by name', async () => {
    writeFileSync(join(dir, '.mcp.json'), '{ not json');
    await expect(mergeMcpJson(dir, entry)).rejects.toBeInstanceOf(McpJsonUnparseableError);
    expect(readFileSync(join(dir, '.mcp.json'), 'utf8')).toBe('{ not json');
  });

  it('never writes a credential-shaped value', async () => {
    await mergeMcpJson(dir, entry);
    expect(readFileSync(join(dir, '.mcp.json'), 'utf8')).not.toMatch(/pmi_ct_[A-Za-z0-9_-]{20,}/);
  });

  it('creates the directory tree it needs', async () => {
    mkdirSync(join(dir, 'nested'));
    await writeProjectJson(join(dir, 'nested'), project);
    expect(existsSync(join(dir, 'nested', '.pmi', 'project.json'))).toBe(true);
  });
});

describe('T1404 · mcpServerEntry honours the checkout override (EPIC-043 R-043-11)', () => {
  it('runs the override command instead of npx when one is given, with the same env', () => {
    const entry = mcpServerEntry({ publicUrl: 'http://localhost:3000', mcpServerVersion: '0.1.0', mcpServerCommand: 'node ./packages/mcp-server/dist/main.js --verbose' });
    expect(entry.command).toBe('node');
    expect(entry.args).toEqual(['./packages/mcp-server/dist/main.js', '--verbose']);
    expect(entry.env).toEqual({ PMI_STUDIO_URL: 'http://localhost:3000', PMI_STUDIO_TOKEN: '${PMI_STUDIO_TOKEN}' });
  });

  it('keeps the npx entry unchanged when no override is given', () => {
    const entry = mcpServerEntry({ publicUrl: 'http://localhost:3000', mcpServerVersion: '0.1.0' });
    expect(entry.command).toBe('npx');
    expect(entry.args).toEqual(['-y', '@pmi/mcp-server@0.1.0']);
  });
});

describe('T1504 · .pmi/first-run and the constitution file (EPIC-042)', () => {
  it('writeFirstRunMarker writes one line — when and by which run — and reports its relative path', async () => {
    const path = await writeFirstRunMarker(dir, { at: new Date('2026-09-04T12:00:00Z'), correlationId: 'corr_1' });
    expect(path).toBe('.pmi/first-run');
    expect(readFileSync(join(dir, '.pmi', 'first-run'), 'utf8')).toBe('2026-09-04T12:00:00.000Z corr_1\n');
  });

  it('writeConstitutionFile writes the render as received with LF endings and reports its relative path', async () => {
    const path = await writeConstitutionFile(dir, '<!-- GENERATED -->\r\n# Alpha Constitution\r\n');
    expect(path).toBe('.specify/memory/constitution.md');
    expect(readFileSync(join(dir, '.specify', 'memory', 'constitution.md'), 'utf8')).toBe('<!-- GENERATED -->\n# Alpha Constitution\n');
  });
});
