/**
 * T322 · Check G-05d — the layout records its D-13 dependency and pre-empts nothing.
 *
 * FR-RGP-008 is the constraint in this epic most easily broken by good intentions: it is
 * tempting to "tidy" module paths while writing a layout document. D-13 (the 18-module
 * re-cut) is deferred deliberately. This epic records the dependency and changes nothing.
 *
 * The teeth are in the last check: the layout's "paths that must not break" list is
 * compared against the epic directories actually on disk. If either drifts — a path
 * silently moved, or an epic added without being registered — this fails.
 */
import { describe, it, expect } from 'vitest';
import { read, epicDirectories } from './helpers';

const layout = read('governance/repository-layout.md');

describe('G-05d · D-13 is recorded, not resolved (FR-RGP-008)', () => {
  it('names decision D-13 and links to the decision register', () => {
    expect(layout).toMatch(/\bD-13\b/);
    expect(layout).toContain('srs-alignment.md');
  });

  it('states that no module-path change is applied by this epic', () => {
    expect(layout).toMatch(/no module[- ]path change is applied/i);
  });

  it('marks every migration as proposed rather than applied', () => {
    const migrationSection = layout.split('## Proposed migrations')[1]?.split('\n## ')[0] ?? '';
    expect(migrationSection.length, 'the layout records no migration section').toBeGreaterThan(0);
    expect(migrationSection).toMatch(/proposed, not applied/i);

    const claimsApplied = /\b(has been|were|was) (moved|migrated|renamed)\b/i.exec(migrationSection);
    expect(claimsApplied?.[0] ?? null, 'a migration is described as done while D-13 is open').toBeNull();
  });

  it('registers every epic directory currently on disk as a path that must not break', () => {
    const section = layout.split('## Paths that must not break')[1]?.split('\n## ')[0] ?? '';
    expect(section.length, 'the layout has no "Paths that must not break" section').toBeGreaterThan(0);

    const unregistered = epicDirectories().filter((dir) => !section.includes(dir));
    expect(
      unregistered,
      'these epic directories exist but are not registered as protected paths — ' +
        'add them to governance/repository-layout.md, or the next re-cut will break them silently',
    ).toEqual([]);
  });

  it('registers no protected path that has since disappeared', () => {
    const section = layout.split('## Paths that must not break')[1]?.split('\n## ')[0] ?? '';
    const listed = [...section.matchAll(/`specs\/(\d{3}-[a-z0-9-]+)\/`/g)]
      .map((match) => match[1])
      .filter((dir): dir is string => dir !== undefined);
    const onDisk = new Set(epicDirectories());
    const vanished = listed.filter((dir) => !onDisk.has(dir));
    expect(vanished, 'the layout protects a path that no longer exists').toEqual([]);
  });
});
