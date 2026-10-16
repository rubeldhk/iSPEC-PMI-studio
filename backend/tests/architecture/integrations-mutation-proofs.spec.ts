/**
 * `T2230` (EPIC-039, Constitution V) — the two required mutation proofs are
 * recorded, and still say something.
 *
 * `specs/039-integration-hub/mutation-proofs.md` records `T2228` (`SC-HUB-001`)
 * and `T2229` (`SC-HUB-004`). A proof is evidence about named code and named
 * tests; if either moves or vanishes, the record stops meaning anything. So
 * this reads each section and fails unless it has:
 *
 * - a mutation that was **applied**, naming the production file it changed —
 *   and that file still exists;
 * - an **observed failing** block naming at least one failing test — and each
 *   named test's title is still in the check it names;
 * - a **revert**, observed green.
 *
 * The parser is also run on deliberately broken copies, so it is seen to fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..', '..');
const PROOFS = readFileSync(resolve(root, 'specs', '039-integration-hub', 'mutation-proofs.md'), 'utf8');

interface Expected {
  readonly task: 'T2228' | 'T2229';
  readonly criterion: string;
  /** The production files the mutation changed. */
  readonly mutated: readonly string[];
  /** The checks the observed failures came from. */
  readonly checks: readonly string[];
}

const EXPECTED: readonly Expected[] = [
  {
    task: 'T2228',
    criterion: 'SC-HUB-001',
    mutated: ['backend/src/modules/integrations/resolver/resolver.service.ts', 'backend/src/modules/loop/loop.service.ts'],
    checks: ['backend/tests/architecture/capability-independence.spec.ts'],
  },
  {
    task: 'T2229',
    criterion: 'SC-HUB-004',
    mutated: ['backend/src/modules/integrations/credentials/credential.service.ts'],
    checks: ['backend/tests/integration/integrations-credential-canary.spec.ts', 'backend/tests/unit/integrations-credentials.spec.ts'],
  },
];

/** The section of the record for one task: from its `## \`Txxxx\`` heading to the next `## `. */
function section(md: string, task: string): string {
  const start = md.indexOf(`## \`${task}\``);
  if (start < 0) return '';
  const next = md.indexOf('\n## ', start + 4);
  return md.slice(start, next < 0 ? undefined : next);
}

/** Test titles quoted in an observed-failing block: the text after the last ` > ` of a bullet. */
function failingTitles(text: string): string[] {
  return [...text.matchAll(/^- `([^`]+)`/gm)]
    .map((m) => m[1]!)
    .filter((t) => t.includes(' > '))
    .map((t) => t.split(' > ').at(-1)!.replace(/\s+/g, ' ').trim());
}

function findings(md: string, expected: Expected, read: (path: string) => string | null): string[] {
  const out: string[] = [];
  const body = section(md, expected.task);
  if (body === '') return [`${expected.task}: no section`];
  if (!body.includes(expected.criterion)) out.push(`${expected.task}: does not name ${expected.criterion}`);
  if (!/\*\*Applied\*\*/.test(body)) out.push(`${expected.task}: no applied mutation`);
  if (!/\*\*Observed failing\*\*[\s\S]*?\d+ failed/.test(body)) out.push(`${expected.task}: no observed failure with a count`);
  if (!/\*\*Reverted\*\*[\s\S]*?passed/.test(body)) out.push(`${expected.task}: no revert observed green`);
  for (const file of expected.mutated) {
    const name = file.split('/').at(-1)!;
    if (!body.includes(name)) out.push(`${expected.task}: does not name the mutated file ${name}`);
    if (read(file) === null) out.push(`${expected.task}: the mutated file ${file} no longer exists`);
  }
  // Join a bullet's wrapped lines, never a bullet to the line before it.
  const titles = failingTitles(body.replace(/\n[ \t]+/g, ' '));
  if (titles.length === 0) out.push(`${expected.task}: names no failing test`);
  const checks = expected.checks.map((c) => read(c));
  for (const [i, c] of expected.checks.entries()) if (checks[i] === null) out.push(`${expected.task}: the check ${c} no longer exists`);
  for (const title of titles) {
    const flat = (s: string | null) => (s ?? '').replace(/\s+/g, ' ');
    if (!checks.some((c) => flat(c).includes(title.replace(/ \(.*$/, '').slice(0, 40)))) out.push(`${expected.task}: no check still has the test "${title}"`);
  }
  return out;
}

const readRepo = (path: string): string | null => {
  const abs = resolve(root, path);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
};

describe('T2230 · EPIC-039 mutation proofs are recorded and still bind to code and tests', () => {
  it.each(EXPECTED.map((e) => [e.task, e] as const))('%s — mutation, named failing tests, revert, and the files it changed', (_task, expected) => {
    expect(findings(PROOFS, expected, readRepo)).toEqual([]);
  });

  it('the record names the files T2228 and T2229 changed, and each still exists', () => {
    for (const e of EXPECTED) for (const f of e.mutated) expect(readRepo(f), f).not.toBeNull();
  });
});

describe('T2230 · the check can fail — each rule against a broken copy', () => {
  const t2228 = EXPECTED[0]!;
  it.each([
    ['the section removed', PROOFS.replace('## `T2228`', '## `T9999`')],
    ['the revert removed', PROOFS.replace(/\*\*Reverted\*\* from the copy: 12 passed\./, 'Left in place.').replace(/\*\*Reverted\*\* from the copy \(`git status --short backend\/src` empty\): 12 passed\./, 'Left in place.')],
    ['the observation removed', PROOFS.split('**Observed failing** (1 failed | 11 passed)').join('Nothing observed').split('**Observed failing** (2 failed | 10 passed)').join('Nothing observed')],
    ['a mutated file renamed away', PROOFS.split('resolver.service.ts').join('resolver.gone.ts')],
  ])('flags %s', (_label, broken) => {
    expect(findings(broken, t2228, readRepo).length).toBeGreaterThan(0);
  });

  it('flags a failing test whose title no longer exists in its check', () => {
    const renamed = (path: string) => (path.endsWith('capability-independence.spec.ts') ? (readRepo(path) ?? '').split('backend/src names no provider').join('renamed') : readRepo(path));
    expect(findings(PROOFS, t2228, renamed).some((f) => /no check still has the test/.test(f))).toBe(true);
  });

  it('flags a mutated file that no longer exists', () => {
    const gone = (path: string) => (path.endsWith('loop.service.ts') ? null : readRepo(path));
    expect(findings(PROOFS, t2228, gone)).toContain('T2228: the mutated file backend/src/modules/loop/loop.service.ts no longer exists');
  });
});
