/**
 * `T1498` (EPIC-042, `FR-EXT-001`, `SC-EXT-001`, `R-042-2`) — installing the
 * extension and merging the hook fragment leaves the ten stock skill files
 * byte-identical to the integration manifest.
 *
 * Two layers. (1) Always: a temp project seeded with THIS repository's stock
 * skills and its pinned manifest (`.specify/integrations/claude.manifest.json`,
 * written by the toolkit at the pinned tag) — the extension is installed, the
 * fragment merged, and every manifest digest recomputed. (2) When
 * `PMI_STOCK_SKILLS_REAL_INIT=1` and the toolkit is on PATH: a real
 * `specify init` in a temp directory first, so the manifest is the toolkit's
 * own for this host. The first layer is what CI runs; the second is what a
 * person runs on a workstation, and the closure record names which ran.
 *
 * The mutation owed at closure: make the install append one line to
 * `speckit-specify/SKILL.md` and observe this fail. Written to FAIL before
 * `T1499`'s copy and merge exist (the merge function is what installs here).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { extensionDir, extensionsFragment, mergeExtensionsRegistry } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '../../..');
const MANIFEST_REL = '.specify/integrations/claude.manifest.json';

interface IntegrationManifest {
  files: Record<string, string>;
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** The install the worker's initialiser and the setup skill perform (`contracts/extension-and-hooks.md` §2). */
export function installExtension(projectDir: string): string[] {
  const written: string[] = [];
  const target = join(projectDir, '.specify', 'extensions', 'pmi');
  mkdirSync(target, { recursive: true });
  cpSync(extensionDir(), target, { recursive: true });
  written.push('.specify/extensions/pmi/extension.yml');
  const registry = join(projectDir, '.specify', 'extensions.yml');
  const existing = existsSync(registry) ? readFileSync(registry, 'utf8') : null;
  writeFileSync(registry, mergeExtensionsRegistry(existing, extensionsFragment()), 'utf8');
  written.push('.specify/extensions.yml');
  return written;
}

let dir: string;
let manifest: IntegrationManifest;
/** The digests of every pinned file as seeded, BEFORE installation — the baseline the install must not move. */
let baseline: Record<string, string>;
let layer: 'seeded from this repository' | 'real specify init' = 'seeded from this repository';

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'pmi-stock-'));
  const real = process.env['PMI_STOCK_SKILLS_REAL_INIT'] === '1';
  if (real) {
    execFileSync('specify', ['init', '--here', '--ai', 'claude', '--script', 'sh', '--no-git', '--force'], { cwd: dir, stdio: 'pipe', timeout: 300_000 });
    layer = 'real specify init';
  } else {
    // Seed: the manifest and every file it names, from this checkout.
    const src = JSON.parse(readFileSync(join(REPO, MANIFEST_REL), 'utf8')) as IntegrationManifest;
    mkdirSync(join(dir, '.specify', 'integrations'), { recursive: true });
    mkdirSync(join(dir, '.specify', 'memory'), { recursive: true });
    cpSync(join(REPO, MANIFEST_REL), join(dir, MANIFEST_REL));
    for (const rel of Object.keys(src.files)) {
      const from = join(REPO, rel);
      if (!existsSync(from)) continue;
      mkdirSync(dirname(join(dir, rel)), { recursive: true });
      cpSync(from, join(dir, rel));
    }
  }
  manifest = JSON.parse(readFileSync(join(dir, MANIFEST_REL), 'utf8')) as IntegrationManifest;
  baseline = Object.fromEntries(Object.keys(manifest.files).filter((rel) => existsSync(join(dir, rel))).map((rel) => [rel, sha256(join(dir, rel))]));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('T1498 · the ten stock skill files are byte-identical after installing the extension', () => {
  it('the manifest pins at least the ten speckit skills, and every one is present before installation', () => {
    const skills = Object.keys(manifest.files).filter((f) => /speckit-[a-z]+\/SKILL\.md$/.test(f));
    expect(skills.length).toBeGreaterThanOrEqual(10);
    for (const rel of skills) expect(baseline[rel], `${rel} absent before installation (${layer})`).toBeDefined();
    // Under a real init the seeded files ARE the toolkit's, so they match its manifest. This
    // repository's own stock skills carry governance edits (Constitution X) and are pinned by
    // their pre-install digest instead — the property under test is that installation moves none.
    if (layer === 'real specify init') {
      for (const [rel, digest] of Object.entries(baseline)) expect(digest, `${rel} differs from the toolkit's manifest`).toBe(manifest.files[rel]);
    }
  });

  it('installs the extension and merges the fragment without touching a pinned file (SC-EXT-001)', () => {
    const written = installExtension(dir);
    expect(written).toEqual(['.specify/extensions/pmi/extension.yml', '.specify/extensions.yml']);
    for (const [rel, digest] of Object.entries(baseline)) {
      expect(sha256(join(dir, rel)), `${rel} changed by the installation (${layer})`).toBe(digest);
    }
    expect(existsSync(join(dir, '.specify', 'extensions', 'pmi', 'commands', 'begin.md'))).toBe(true);
    expect(readFileSync(join(dir, '.specify', 'extensions.yml'), 'utf8')).toContain('speckit.pmi.begin');
  });

  it('a second installation changes nothing (idempotent)', () => {
    const registry = readFileSync(join(dir, '.specify', 'extensions.yml'), 'utf8');
    installExtension(dir);
    expect(readFileSync(join(dir, '.specify', 'extensions.yml'), 'utf8')).toBe(registry);
    for (const [rel, digest] of Object.entries(baseline)) expect(sha256(join(dir, rel))).toBe(digest);
  });

  it('records which layer ran', () => {
    process.stdout.write(`T1498 layer: ${layer}\n`);
    expect(['seeded from this repository', 'real specify init']).toContain(layer);
  });
});
