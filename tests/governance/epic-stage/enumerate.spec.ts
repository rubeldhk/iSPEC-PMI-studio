/**
 * T471 — Epic enumeration and the exclusion rule.
 * Written to FAIL before T472 exists (Constitution V).
 *
 * **`FR-ESK-008`: every Epic directory appears, with no registration step.**
 * The load-bearing word is *pattern*. `specs/_shared/` is excluded because it
 * does not match `NNN-`, **not** because someone remembered to list it. A
 * maintained exclusion list is a second source of truth that silently omits the
 * next directory somebody adds — which is exactly the failure mode this epic
 * exists to remove, so it must not be reintroduced in the enumerator.
 *
 * The zero-stage case is a rule, not an edge: a directory matching the Epic
 * pattern with no `spec.md` is **invalid**, not early. An Epic without a
 * specification is a mistake, and reporting it as "stage 0" would file a
 * mistake as progress.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { enumerateEpics, loadStageConfig } from './derive';
import { buildEpicTree, MINIMAL_SPEC, type FixtureTree } from './fixtures';

let tree: FixtureTree | undefined;

afterEach(() => {
  tree?.cleanup();
  tree = undefined;
});

describe('T471 · enumerateEpics (FR-ESK-008)', () => {
  it('includes every directory matching the Epic pattern', () => {
    tree = buildEpicTree({
      '001-alpha': { spec: MINIMAL_SPEC },
      '004-beta': { spec: MINIMAL_SPEC },
      '026-gamma': { spec: MINIMAL_SPEC },
    });
    expect(enumerateEpics(tree.specsDir).map((epic) => epic.directory)).toEqual([
      '001-alpha',
      '004-beta',
      '026-gamma',
    ]);
  });

  it('excludes non-Epic directories BY PATTERN, not by a list', () => {
    tree = buildEpicTree({
      '001-alpha': { spec: MINIMAL_SPEC },
      _shared: { spec: MINIMAL_SPEC },
      scratch: { spec: MINIMAL_SPEC },
    });
    const directories = enumerateEpics(tree.specsDir).map((epic) => epic.directory);
    expect(directories).toEqual(['001-alpha']);
    // Named explicitly because `_shared` is the one everybody knows about, and
    // `scratch` is the one nobody would have thought to list.
    expect(directories).not.toContain('_shared');
    expect(directories).not.toContain('scratch');
  });

  it('uses the configured pattern rather than a literal of its own', () => {
    // If the enumerator carried its own regex, changing the config would move
    // the documented rule and leave the behaviour where it was.
    const config = loadStageConfig();
    expect(config.epicDirectoryPattern).toBeTruthy();
    tree = buildEpicTree({ '999-omega': { spec: MINIMAL_SPEC } });
    expect(new RegExp(config.epicDirectoryPattern).test('999-omega')).toBe(true);
    expect(enumerateEpics(tree.specsDir)).toHaveLength(1);
  });

  it('orders by Epic identifier ascending, always', () => {
    // The register is compared byte-for-byte against a fresh generation, so a
    // filesystem-order dependency would produce spurious drift failures on a
    // different machine.
    tree = buildEpicTree({
      '026-gamma': { spec: MINIMAL_SPEC },
      '001-alpha': { spec: MINIMAL_SPEC },
      '013-beta': { spec: MINIMAL_SPEC },
    });
    expect(enumerateEpics(tree.specsDir).map((epic) => epic.id)).toEqual([
      'EPIC-001',
      'EPIC-013',
      'EPIC-026',
    ]);
  });

  it('reports a directory with no spec.md as invalid, not as an early stage', () => {
    tree = buildEpicTree({ '007-empty': {} });
    const [epic] = enumerateEpics(tree.specsDir);
    expect(epic?.valid).toBe(false);
    expect(epic?.findings.join(' ')).toMatch(/spec\.md/);
  });

  it('marks an Epic with a spec.md as valid', () => {
    tree = buildEpicTree({ '007-real': { spec: MINIMAL_SPEC } });
    expect(enumerateEpics(tree.specsDir)[0]?.valid).toBe(true);
  });

  it('reads the title from the spec’s first heading', () => {
    tree = buildEpicTree({
      '004-workspace': { spec: '# Epic Specification: Workspace Tenancy & Audit\n\nbody\n' },
    });
    expect(enumerateEpics(tree.specsDir)[0]?.title).toBe('Workspace Tenancy & Audit');
  });

  it('falls back to the directory name when the spec has no usable heading', () => {
    // Better a slightly ugly row than a crash or a blank cell that reads as
    // "this Epic has no title" when it merely has an unusual spec.
    tree = buildEpicTree({ '008-odd': { spec: 'no heading here\n' } });
    expect(enumerateEpics(tree.specsDir)[0]?.title).toBe('008-odd');
  });

  it('finds the real repository’s Epics when given no argument', () => {
    // The unit tests above use fixtures so the rules can be exercised against
    // trees this repository does not contain. This one asserts the default
    // actually points at `specs/` — a derivation that only ever ran against
    // fixtures would be a rule nobody applied.
    const epics = enumerateEpics();
    expect(epics.length).toBeGreaterThan(20);
    expect(epics.map((epic) => epic.id)).toContain('EPIC-026');
    expect(epics.map((epic) => epic.directory)).not.toContain('_shared');
  });
});
