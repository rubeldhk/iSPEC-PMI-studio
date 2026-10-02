/**
 * `T1496` (EPIC-042, `contracts/extension-and-hooks.md` §2) —
 * `mergeExtensionsRegistry` adds `pmi` to `installed` once, appends each hook
 * entry only when no `{ extension: pmi, command }` entry exists for that event,
 * leaves every other extension's entries byte-identical, is idempotent, and
 * creates the file shape from nothing. Written to FAIL before `T1497`.
 */
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { extensionsFragment, mergeExtensionsRegistry } from '../src/index.js';

type Registry = { installed?: string[]; hooks?: Record<string, { extension: string; command: string; optional?: boolean; prompt?: string }[]> };

const FOREIGN = `installed: [git]
settings:
  auto_execute_hooks: true
hooks:
  before_implement:
    - extension: git
      command: speckit.git.commit
      enabled: true
      optional: true
      prompt: "Commit outstanding changes before implementation?"
  after_tasks:
    - { extension: jira, command: speckit.jira.specstoissues, enabled: true, optional: true, prompt: "Create Jira issues from tasks?" }
`;

describe('T1496 · mergeExtensionsRegistry', () => {
  it('creates the registry from nothing, as the fragment', () => {
    const merged = parse(mergeExtensionsRegistry(null)) as Registry;
    const fragment = parse(extensionsFragment()) as Registry;
    expect(merged.installed).toEqual(['pmi']);
    expect(Object.keys(merged.hooks ?? {}).sort()).toEqual(Object.keys(fragment.hooks ?? {}).sort());
  });

  it('treats the EPIC-041 placeholder (hooks: {}) as an empty block', () => {
    const merged = parse(mergeExtensionsRegistry('# Registered by PMI Studio (EPIC-041). Hooks arrive with EPIC-042.\nhooks: {}\n')) as Registry;
    expect(merged.installed).toEqual(['pmi']);
    expect(merged.hooks?.['before_specify']?.[0]).toMatchObject({ extension: 'pmi', command: 'speckit.pmi.begin', optional: false });
  });

  it('adds pmi to a flow-style installed list and appends beside foreign entries, leaving them byte-identical', () => {
    const merged = mergeExtensionsRegistry(FOREIGN);
    const parsed = parse(merged) as Registry;
    expect(parsed.installed).toEqual(['git', 'pmi']);
    // Every foreign line survives verbatim.
    for (const line of FOREIGN.split('\n').filter((l) => l.trim().length > 0 && !l.startsWith('installed:'))) {
      expect(merged.split('\n')).toContain(line);
    }
    expect(parsed.hooks?.['before_implement']).toHaveLength(2);
    expect(parsed.hooks?.['before_implement']?.[0]).toMatchObject({ extension: 'git', command: 'speckit.git.commit', prompt: 'Commit outstanding changes before implementation?' });
    expect(parsed.hooks?.['before_implement']?.[1]).toMatchObject({ extension: 'pmi', command: 'speckit.pmi.begin', optional: false });
    expect(parsed.hooks?.['after_tasks']).toHaveLength(2);
    expect(parsed.hooks?.['after_tasks']?.[0]?.extension).toBe('jira');
    expect(parsed.hooks?.['after_specify']?.[0]).toMatchObject({ extension: 'pmi', command: 'speckit.pmi.finish' });
  });

  it('adds pmi to a block-style installed list', () => {
    const merged = mergeExtensionsRegistry('installed:\n  - git\nhooks: {}\n');
    expect((parse(merged) as Registry).installed).toEqual(['git', 'pmi']);
  });

  it('is idempotent: merging twice changes nothing, and never duplicates an entry', () => {
    const once = mergeExtensionsRegistry(FOREIGN);
    const twice = mergeExtensionsRegistry(once);
    expect(twice).toBe(once);
    const parsed = parse(twice) as Registry;
    expect(parsed.installed).toEqual(['git', 'pmi']);
    expect(parsed.hooks?.['before_specify']).toHaveLength(1);
  });

  it('keeps an existing pmi entry a person edited rather than adding a second', () => {
    const edited = 'installed: [pmi]\nhooks:\n  before_specify:\n    - { extension: pmi, command: speckit.pmi.begin, enabled: false, optional: false, description: "disabled by me" }\n';
    const merged = parse(mergeExtensionsRegistry(edited)) as Registry;
    expect(merged.hooks?.['before_specify']).toHaveLength(1);
    expect(merged.hooks?.['before_specify']?.[0]).toMatchObject({ extension: 'pmi', enabled: false } as never);
    expect(merged.hooks?.['after_specify']).toHaveLength(1);
  });
});
