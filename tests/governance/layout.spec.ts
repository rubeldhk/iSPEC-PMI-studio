/**
 * T321 · Check G-05 — every artifact type has exactly one documented location, and no
 * documented location contradicts the structure the repository already uses.
 * T326 · The governance index names every governance artifact.
 *
 * Satisfies SC-RGP-004 and SC-RGP-007. Two locations for one artifact type is two places
 * to look and one place to forget.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { read, repoExists, GOVERNANCE_DIR } from './helpers';

const layout = read('governance/repository-layout.md');
const index = read('governance/README.md');

interface Row {
  artifactType: string;
  location: string;
  proposed: boolean;
}

/** Parse the mapping table: | Artifact type | Location | Governing standard | Status | */
function mappingRows(markdown: string): Row[] {
  const section = markdown.split('## Artifact location map')[1]?.split('\n## ')[0] ?? '';
  return section
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('|') && line.includes('`'))
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 5 && !/^-+$/.test(cells[1] ?? ''))
    .map((cells) => ({
      artifactType: (cells[1] ?? '').replace(/\*\*/g, ''),
      location: (/`([^`]+)`/.exec(cells[2] ?? '')?.[1] ?? '').trim(),
      proposed: /proposed/i.test(cells[4] ?? ''),
    }))
    .filter((row) => row.location.length > 0);
}

const rows = mappingRows(layout);

describe('G-05 · artifact location mapping (FR-RGP-006, FR-RGP-007)', () => {
  it('documents a non-empty mapping', () => {
    expect(rows.length).toBeGreaterThanOrEqual(10);
  });

  it('gives each artifact type exactly one location', () => {
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.artifactType, (counts.get(row.artifactType) ?? 0) + 1);
    const duplicated = [...counts.entries()].filter(([, count]) => count > 1).map(([type]) => type);
    expect(duplicated, 'an artifact type with two locations has no location').toEqual([]);
  });

  it('maps every current location to a path that exists', () => {
    const missing = rows
      .filter((row) => !row.proposed)
      .filter((row) => !repoExists(row.location.replace(/\/?<[^>]+>\/?.*$/, '').replace(/\*+$/, '')))
      .map((row) => `${row.artifactType} → ${row.location}`);
    expect(missing, 'the layout claims a location the repository does not have').toEqual([]);
  });

  it('does not contradict the structure already in use', () => {
    expect(layout).toContain('specs/_shared/');
    expect(layout).toContain('specs/<epic>/');
    expect(repoExists('specs/_shared')).toBe(true);
  });
});

describe('G-05b · governance index completeness (FR-RGP-009, SC-RGP-007)', () => {
  const governanceFiles = readdirSync(GOVERNANCE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md')
    .map((entry) => entry.name);

  it.each(governanceFiles)('the index names %s', (name) => {
    expect(index, `governance/README.md does not name ${name}`).toContain(name);
  });

  it('names the steering register and the configuration file', () => {
    expect(index).toContain('steering/');
    expect(index).toContain('governance.config.json');
  });

  it('records purpose, path and version for each artifact', () => {
    for (const heading of ['Purpose', 'Path', 'Version']) {
      expect(index).toContain(heading);
    }
  });

  it('records whether each path is exempt from the Constitution I command gate', () => {
    expect(index).toMatch(/Constitution I/);
    expect(index).toMatch(/exempt/i);
  });
});

describe('G-05c · the layout is reachable from the index', () => {
  it('links repository-layout.md', () => {
    expect(index).toContain('repository-layout.md');
    expect(repoExists(join('governance', 'repository-layout.md').replace(/\\/g, '/'))).toBe(true);
  });
});
