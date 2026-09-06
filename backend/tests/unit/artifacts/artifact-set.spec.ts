/**
 * `T1629` (EPIC-045, `R-045-9`) — which paths a sync may carry, and what kind
 * each one is.
 *
 * The set is **imported from `@pmi/workspace-bundle`**, not restated here: the
 * hook computes the digests of exactly `ARTIFACT_FILES` plus the `.md` files
 * under `contracts/` and `checklists/`, and a platform that admitted a
 * different set would refuse files the hook was told to send, or store files it
 * was never told to. One list, two readers.
 *
 * Everything else is refused by shape before any content is looked at: a path
 * that leaves the Epic directory is `path_escapes_epic`; a path that stays but
 * names a file outside the set is `path_not_in_artifact_set`. Written to FAIL
 * before `T1631`.
 */
import { describe, expect, it } from 'vitest';
import { ARTIFACT_FILES } from '@pmi/workspace-bundle';
import { classifyPath } from '../../../src/modules/artifacts/artifact-set.js';

describe('T1629 · the seven top-level artifact names are the bundle\'s, not a copy', () => {
  it.each([...ARTIFACT_FILES])('accepts specs/003-reports/%s', (name) => {
    const result = classifyPath(`specs/003-reports/${name}`);
    expect(result.ok, `${name} refused: ${JSON.stringify(result)}`).toBe(true);
  });

  it('derives the kind from the file name (data-model §1)', () => {
    const kinds: Record<string, string> = {
      'spec.md': 'spec',
      'plan.md': 'plan',
      'tasks.md': 'tasks',
      'research.md': 'research',
      'data-model.md': 'data-model',
      'analysis.md': 'analysis',
      'quickstart.md': 'quickstart',
    };
    for (const [name, kind] of Object.entries(kinds)) {
      const result = classifyPath(`specs/003-reports/${name}`);
      expect(result.ok && result.kind, name).toBe(kind);
    }
  });

  it('reads the set from the bundle — a name the bundle drops is refused here too', () => {
    // Anti-vacuity: if `classifyPath` carried its own list, this would still
    // pass while the two lists silently diverged. Asserting the count ties them.
    expect(ARTIFACT_FILES.length).toBe(7);
    const accepted = ARTIFACT_FILES.filter((n) => classifyPath(`specs/003-reports/${n}`).ok);
    expect(accepted.length).toBe(ARTIFACT_FILES.length);
  });
});

describe('T1629 · the two sub-directories', () => {
  it.each([
    ['specs/003-reports/contracts/reports-api.md', 'contract'],
    ['specs/003-reports/contracts/viewer.md', 'contract'],
    ['specs/003-reports/checklists/requirements.md', 'checklist'],
  ])('accepts %s as kind %s', (path, kind) => {
    const result = classifyPath(path);
    expect(result.ok).toBe(true);
    expect(result.ok && result.kind).toBe(kind);
  });

  it('accepts only .md under contracts/ and checklists/', () => {
    expect(classifyPath('specs/003-reports/contracts/openapi.yaml')).toMatchObject({ ok: false, code: 'path_not_in_artifact_set' });
    expect(classifyPath('specs/003-reports/checklists/notes.txt')).toMatchObject({ ok: false, code: 'path_not_in_artifact_set' });
  });

  it('refuses a third directory level — the hook reads one level, so nothing deeper can have come from it', () => {
    expect(classifyPath('specs/003-reports/contracts/v2/api.md')).toMatchObject({ ok: false, code: 'path_not_in_artifact_set' });
  });

  it('refuses a sub-directory that is neither contracts/ nor checklists/', () => {
    expect(classifyPath('specs/003-reports/defects/DEF-001.md')).toMatchObject({ ok: false, code: 'path_not_in_artifact_set' });
    // `closure.md` and `defects/` are deliberately out of scope (spec Assumption 4).
    expect(classifyPath('specs/003-reports/closure.md')).toMatchObject({ ok: false, code: 'path_not_in_artifact_set' });
  });
});

describe('T1629 · a path that leaves the Epic directory is refused before anything is read', () => {
  it.each([
    ['specs/003-reports/../../etc/passwd'],
    ['specs/../secrets.md'],
    ['specs/003-reports/../004-other/spec.md'],
    ['/etc/passwd'],
    ['/specs/003-reports/spec.md'],
    ['specs\\003-reports\\spec.md'],
    ['specs/003-reports\\spec.md'],
    ['C:/specs/003-reports/spec.md'],
  ])('refuses %s as path_escapes_epic', (path) => {
    expect(classifyPath(path)).toMatchObject({ ok: false, code: 'path_escapes_epic' });
  });

  it('refuses a path outside specs/ entirely', () => {
    expect(classifyPath('README.md')).toMatchObject({ ok: false, code: 'path_not_in_artifact_set' });
    expect(classifyPath('backend/src/main.ts')).toMatchObject({ ok: false, code: 'path_not_in_artifact_set' });
  });

  it('refuses a second directory level under specs/', () => {
    expect(classifyPath('specs/group/003-reports/spec.md')).toMatchObject({ ok: false, code: 'path_not_in_artifact_set' });
  });

  it('refuses an unknown file in the Epic directory', () => {
    expect(classifyPath('specs/003-reports/notes.txt')).toMatchObject({ ok: false, code: 'path_not_in_artifact_set' });
    expect(classifyPath('specs/003-reports/spec.txt')).toMatchObject({ ok: false, code: 'path_not_in_artifact_set' });
  });

  it('refuses an empty path and a bare directory', () => {
    expect(classifyPath('')).toMatchObject({ ok: false });
    expect(classifyPath('specs/003-reports')).toMatchObject({ ok: false });
    expect(classifyPath('specs/003-reports/')).toMatchObject({ ok: false });
  });
});

describe('T1629 · the Epic directory a path names', () => {
  it('reports the directory, so the tree can group by it and notice a renamed slug (FR-ART-035)', () => {
    const result = classifyPath('specs/003-reports/contracts/api.md');
    expect(result.ok && result.epicDir).toBe('specs/003-reports');
  });

  it('accepts a split child\'s directory', () => {
    const result = classifyPath('specs/007a-intake/spec.md');
    expect(result.ok).toBe(true);
    expect(result.ok && result.epicDir).toBe('specs/007a-intake');
  });
});
