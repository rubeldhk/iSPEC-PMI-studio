/**
 * T107 — version comparison output.
 * Written to FAIL before T112 exists (Constitution V).
 *
 * FR-015: any two versions of the same specification are comparable. The
 * output is line-based — what a reviewer reads, not a byte offset.
 */
import { describe, expect, it } from 'vitest';
import { diffVersions } from '../../../src/modules/specifications/version-diff.service.js';

function version(versionNumber: number, contentRaw: string): { versionNumber: number; contentRaw: string } {
  return { versionNumber, contentRaw };
}

describe('diffVersions (FR-015)', () => {
  it('names both versions being compared', () => {
    const out = diffVersions(version(1, 'a'), version(3, 'b'));
    expect(out.fromVersion).toBe(1);
    expect(out.toVersion).toBe(3);
  });

  it('reports added and removed lines', () => {
    const a = version(1, 'kept line\nremoved line\n');
    const b = version(2, 'kept line\nadded line\n');
    const out = diffVersions(a, b);
    expect(out.removed).toEqual(['removed line']);
    expect(out.added).toEqual(['added line']);
    expect(out.unchanged).toBe(1);
  });

  it('identical versions diff to nothing', () => {
    const same = 'one\ntwo\nthree\n';
    const out = diffVersions(version(1, same), version(2, same));
    expect(out.added).toEqual([]);
    expect(out.removed).toEqual([]);
    expect(out.unchanged).toBe(3);
    expect(out.identical).toBe(true);
  });

  it('a repeated line counts each occurrence — multiset, not set', () => {
    const a = version(1, 'dup\ndup\nother\n');
    const b = version(2, 'dup\nother\n');
    const out = diffVersions(a, b);
    expect(out.removed).toEqual(['dup']);
    expect(out.added).toEqual([]);
  });

  it('is direction-sensitive: comparing b→a inverts added and removed', () => {
    const a = version(1, 'old\n');
    const b = version(2, 'new\n');
    const forward = diffVersions(a, b);
    const backward = diffVersions(b, a);
    expect(forward.added).toEqual(backward.removed);
    expect(forward.removed).toEqual(backward.added);
  });

  it('handles an empty version — everything is added', () => {
    const out = diffVersions(version(1, ''), version(2, 'line one\nline two\n'));
    expect(out.added).toEqual(['line one', 'line two']);
    expect(out.removed).toEqual([]);
  });
});
