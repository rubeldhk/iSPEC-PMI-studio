/**
 * `T1613` (EPIC-044, `FR-EPB-014`, analysis `C1`) — two boundaries around the
 * stage derivation.
 *
 * 1. `packages/epic-stage/src/` is a pure package: every file imports only
 *    `node:` modules and its sibling files — nothing from `backend/`, `tests/`,
 *    `engine-adapters/` or a toolkit package. The register and the product board
 *    read one rule because neither side can pull the rule towards itself.
 * 2. `backend/src/modules/epics/` names no governed command as a string
 *    literal. The commands that reach a stage (`specify`, `clarify`, …) come
 *    from `epic-stage.config.json`'s `reachedBy`; a literal in the module would
 *    be a second, silently divergent copy of the configuration.
 *
 * The forbidden names are read from the configuration, not typed here, so a
 * command added to the configuration is forbidden as a literal on the same day.
 * Observed red by mutation (a literal planted in the module) before it was
 * kept clean — see `specs/044-epic-model-journey-board/closure.md`.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '../../..');
const PACKAGE_SRC = join(REPO, 'packages', 'epic-stage', 'src');
const MODULE = join(REPO, 'backend', 'src', 'modules', 'epics');
const CONFIG = join(REPO, 'packages', 'epic-stage', 'epic-stage.config.json');

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const read = (root: string) => walk(root).map((p) => ({ rel: relative(REPO, p).replaceAll('\\', '/'), body: readFileSync(p, 'utf8') }));

function governedCommands(): string[] {
  const config = JSON.parse(readFileSync(CONFIG, 'utf8')) as { stages: { reachedBy?: string | null }[]; productStages?: { reachedBy?: string | null }[] };
  return [...config.stages, ...(config.productStages ?? [])].map((s) => s.reachedBy).filter((c): c is string => typeof c === 'string' && c.length > 0);
}

describe('T1613 · @pmi/epic-stage imports only node: and its siblings (FR-EPB-014)', () => {
  const files = read(PACKAGE_SRC);

  it('has source files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('every import specifier is a node: module or a sibling file', () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const m of file.body.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
        const spec = m[1]!;
        if (!spec.startsWith('node:') && !spec.startsWith('./') && !spec.startsWith('../')) offenders.push(`${file.rel} → ${spec}`);
        if (spec.startsWith('../') && !spec.startsWith('../src/')) offenders.push(`${file.rel} → ${spec} (leaves the package)`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never names backend, tests, engine-adapters or a toolkit package', () => {
    const forbidden = /(?:from|import)\s*\(?\s*['"][^'"]*(?:backend\/|tests\/|engine-adapters\/|@pmi\/(?!epic-stage))/;
    expect(files.filter((f) => forbidden.test(f.body)).map((f) => f.rel)).toEqual([]);
  });
});

describe('T1613 · backend/src/modules/epics names no governed command as a literal (FR-EPB-014)', () => {
  const files = read(MODULE);
  const commands = governedCommands();

  it('has source files and a configuration to check against', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(commands.length).toBeGreaterThanOrEqual(8);
  });

  it.each(governedCommands())('never contains the literal %j', (command) => {
    const literal = new RegExp(`['"\`]/?(?:speckit-)?${command}['"\`]`);
    const offenders = files.filter((f) => literal.test(f.body)).map((f) => f.rel);
    expect(offenders).toEqual([]);
  });
});
