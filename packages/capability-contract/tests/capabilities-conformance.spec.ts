/**
 * `T2113`, `T2126`, `T2246` (EPIC-039, `R-039-3`, Constitution V) — the five
 * capability contract JSON files are the non-code output of this Epic, and this
 * is the executable check that pairs with them.
 *
 * It fails when a file's name disagrees with its content, a schema uses a
 * keyword outside the subset, a later minor removes or retypes a field of the
 * previous one, a capability changes state without being on the allow-list
 * below, `Embed` loses its stated limits, the migration's seed rows differ from
 * the files, or a file is not tracked by Git (the record `FR-HUB-015` reads).
 *
 * **Observed failing on a deliberately broken copy**: the last block copies the
 * files to a temporary directory, breaks each rule once, and asserts the check
 * reports it. A conformance check that cannot fail is decoration.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { CONTRACT_FILE_PATTERN, compareContractVersions, contractDocumentErrors, contractFileName, type CapabilityContractDocument } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const PACKAGE = resolve(here, '..');
const REPO_ROOT = resolve(PACKAGE, '../..');
const CAPABILITIES = join(PACKAGE, 'capabilities');
const MIGRATION = join(REPO_ROOT, 'backend/prisma/migrations/20261009120000_epic039_integration_hub/migration.sql');

/**
 * `FR-HUB-014` — the capabilities allowed to change state at a provider.
 * Editing this list is the deliberate act the rule asks for.
 */
const STATE_CHANGING_ALLOW_LIST: readonly string[] = ['SendNotification'];

function readDir(dir: string): { file: string; doc: CapabilityContractDocument }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((file) => ({ file, doc: JSON.parse(readFileSync(join(dir, file), 'utf8')) as CapabilityContractDocument }));
}

/** The whole check, as a function, so the broken-copy block can run it on a copy. */
function checkContracts(dir: string): string[] {
  const errors: string[] = [];
  const all = readDir(dir);
  for (const { file, doc } of all) {
    if (!CONTRACT_FILE_PATTERN.test(file)) errors.push(`${file}: name is not <Name>.v<major>.<minor>.json`);
    else if (file !== contractFileName(doc)) errors.push(`${file}: content says ${contractFileName(doc)}`);
    for (const e of contractDocumentErrors(doc)) errors.push(`${file}: ${e}`);
    if (doc.changesState === true && !STATE_CHANGING_ALLOW_LIST.includes(doc.name)) errors.push(`${file}: changesState is true but ${doc.name} is not on the state-changing allow-list (FR-HUB-014)`);
    if (doc.name === 'Embed') {
      if (doc.limits?.['maxTexts'] !== 64) errors.push(`${file}: Embed must state maxTexts 64 (FR-HUB-083)`);
      if (doc.limits?.['maxTextLength'] !== 8000) errors.push(`${file}: Embed must state maxTextLength 8000 (FR-HUB-083)`);
      const texts = doc.inputSchema.properties?.['texts'];
      if (texts?.maxItems !== 64 || texts.items?.maxLength !== 8000) errors.push(`${file}: Embed's input schema must enforce the stated limits`);
    }
  }
  const byMajor = new Map<string, CapabilityContractDocument[]>();
  for (const { doc } of all) byMajor.set(`${doc.name}@${doc.major}`, [...(byMajor.get(`${doc.name}@${doc.major}`) ?? []), doc]);
  for (const versions of byMajor.values()) {
    const sorted = versions.sort((a, b) => a.minor - b.minor);
    for (let i = 1; i < sorted.length; i++) {
      const r = compareContractVersions(sorted[i - 1]!, sorted[i]!);
      for (const d of r.differences) errors.push(`${sorted[i]!.name} ${sorted[i]!.major}.${sorted[i]!.minor}: ${d}`);
    }
  }
  return errors;
}

/** Normalised JSON for comparison: key order and whitespace do not matter, content does. */
function normal(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(normal).join(',')}]`;
  return `{${Object.keys(value as object)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${normal((value as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}

/** The seed rows, parsed from the migration: one `-- seed:<file>` marker and one JSON document per row. */
function seedRows(sql: string): { file: string; document: unknown; createdBy: string }[] {
  const rows: { file: string; document: unknown; createdBy: string }[] = [];
  for (const m of sql.matchAll(/-- seed:(\S+)\n([\s\S]*?)\n-- end-seed/g)) {
    const body = m[2]!;
    const json = /\$contract\$([\s\S]*?)\$contract\$/.exec(body)?.[1];
    const createdBy = /'(git:[^']+)'/.exec(body)?.[1] ?? '';
    rows.push({ file: m[1]!, document: json === undefined ? null : JSON.parse(json), createdBy });
  }
  return rows;
}

describe('T2113 · the capability contract files conform', () => {
  const files = readDir(CAPABILITIES);

  it('has the five v1 documents, or this check proves nothing', () => {
    expect(files.map((f) => f.file)).toEqual(['Embed.v1.0.json', 'ReadBuildStatus.v1.0.json', 'ReadRepository.v1.0.json', 'ReadTestResults.v1.0.json', 'SendNotification.v1.0.json']);
  });

  it('passes every rule', () => {
    expect(checkContracts(CAPABILITIES)).toEqual([]);
  });

  it('declares only SendNotification as changing state (FR-HUB-014)', () => {
    expect(files.filter((f) => f.doc.changesState).map((f) => f.doc.name)).toEqual(['SendNotification']);
  });
});

describe('T2126 · the migration seeds exactly the files (R-039-3)', () => {
  it('seeds one approved row per file, equal after normalisation', () => {
    expect(existsSync(MIGRATION), 'the EPIC-039 migration is missing').toBe(true);
    const rows = seedRows(readFileSync(MIGRATION, 'utf8'));
    expect(rows.map((r) => r.file).sort()).toEqual(readDir(CAPABILITIES).map((f) => f.file));
    for (const { file, doc } of readDir(CAPABILITIES)) {
      const row = rows.find((r) => r.file === file)!;
      expect(normal(row.document), `${file} differs from its seed row`).toBe(normal(doc));
    }
  });
});

describe('T2246 (analysis C1) · FR-HUB-015 — the record of a contract change is its Git history', () => {
  it('every seeded row names its file as its creator', () => {
    const rows = seedRows(readFileSync(MIGRATION, 'utf8'));
    for (const r of rows) expect(r.createdBy).toBe(`git:packages/capability-contract/capabilities/${r.file}`);
  });

  it('every contract file is tracked by Git, so a change has an author, an instant and a diff', () => {
    for (const { file } of readDir(CAPABILITIES)) {
      expect(() =>
        execFileSync('git', ['ls-files', '--error-unmatch', `packages/capability-contract/capabilities/${file}`], { cwd: REPO_ROOT, stdio: 'pipe' }),
      ).not.toThrow();
    }
  });
});

describe('T2113 · the check is observed failing on a deliberately broken copy (Constitution V)', () => {
  const copies: string[] = [];
  const copy = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'pmi-capabilities-'));
    cpSync(CAPABILITIES, dir, { recursive: true });
    copies.push(dir);
    return dir;
  };
  const edit = (dir: string, file: string, change: (doc: Record<string, unknown>) => void, as = file): void => {
    const doc = JSON.parse(readFileSync(join(dir, file), 'utf8')) as Record<string, unknown>;
    change(doc);
    if (as !== file) rmSync(join(dir, file));
    writeFileSync(join(dir, as), JSON.stringify(doc, null, 2));
  };
  afterAll(() => {
    for (const d of copies) rmSync(d, { recursive: true, force: true });
  });

  it('a file named for another version', () => {
    const dir = copy();
    edit(dir, 'Embed.v1.0.json', () => undefined, 'Embed.v1.1.json');
    expect(checkContracts(dir)).toContain('Embed.v1.1.json: content says Embed.v1.0.json');
  });

  it('an unsupported schema keyword', () => {
    const dir = copy();
    edit(dir, 'ReadBuildStatus.v1.0.json', (d) => ((d['inputSchema'] as Record<string, unknown>)['oneOf'] = []));
    expect(checkContracts(dir).some((e) => e.includes('oneOf at (root)'))).toBe(true);
  });

  it('a minor that renames an output field without a new major (quickstart Q1)', () => {
    const dir = copy();
    const next = JSON.parse(readFileSync(join(dir, 'ReadBuildStatus.v1.0.json'), 'utf8')) as Record<string, any>;
    next['minor'] = 1;
    next['outputSchema']['properties']['finished'] = next['outputSchema']['properties']['final'];
    delete next['outputSchema']['properties']['final'];
    next['outputSchema']['required'] = (next['outputSchema']['required'] as string[]).map((r) => (r === 'final' ? 'finished' : r));
    writeFileSync(join(dir, 'ReadBuildStatus.v1.1.json'), JSON.stringify(next, null, 2));
    expect(checkContracts(dir)).toContain('ReadBuildStatus 1.1: output.final removed');
  });

  it('an undeclared state-changing capability', () => {
    const dir = copy();
    edit(dir, 'ReadRepository.v1.0.json', (d) => (d['changesState'] = true));
    expect(checkContracts(dir).some((e) => e.includes('not on the state-changing allow-list'))).toBe(true);
  });

  it('Embed without its stated limits', () => {
    const dir = copy();
    edit(dir, 'Embed.v1.0.json', (d) => delete d['limits']);
    expect(checkContracts(dir)).toContain('Embed.v1.0.json: Embed must state maxTexts 64 (FR-HUB-083)');
  });
});
