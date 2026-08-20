/**
 * T068a — the content hash changes on material edits and is stable for
 * incidental ones. Written to FAIL before T069 exists (Constitution V).
 *
 * This is the seam to EPIC-008's out-of-date flagging (FR-032): get it wrong
 * and either nothing is ever flagged, or everything is (plan.md).
 */
import { describe, expect, it } from 'vitest';
import { requirementContentHash } from '../../../src/modules/requirements/requirement-hash.js';

const BASE = {
  description: 'The system shall retain edit history.',
  type: 'functional',
  priority: 'p2',
} as const;

describe('requirementContentHash', () => {
  it('is deterministic', () => {
    expect(requirementContentHash(BASE)).toBe(requirementContentHash({ ...BASE }));
  });

  it('changes when the description materially changes', () => {
    const edited = { ...BASE, description: 'The system shall retain FULL edit history.' };
    expect(requirementContentHash(edited)).not.toBe(requirementContentHash(BASE));
  });

  it('changes when type or priority changes', () => {
    expect(requirementContentHash({ ...BASE, type: 'constraint' })).not.toBe(
      requirementContentHash(BASE),
    );
    expect(requirementContentHash({ ...BASE, priority: 'p1' })).not.toBe(
      requirementContentHash(BASE),
    );
  });

  it('is STABLE across incidental whitespace edits', () => {
    const incidental = [
      { ...BASE, description: '  The system shall retain edit history.  ' },
      { ...BASE, description: 'The system  shall retain\tedit history.' },
      { ...BASE, description: 'The system shall retain\nedit history.' },
    ];
    for (const variant of incidental) {
      expect(requirementContentHash(variant)).toBe(requirementContentHash(BASE));
    }
  });

  it('is sensitive to casing — a case change is a meaning change', () => {
    expect(
      requirementContentHash({ ...BASE, description: 'the system shall retain edit history.' }),
    ).not.toBe(requirementContentHash(BASE));
  });

  it('two fields cannot collide by concatenation', () => {
    // "ab" + "c" must not hash like "a" + "bc" — the encoding must delimit.
    const a = requirementContentHash({ description: 'ab', type: 'c', priority: 'p1' } as never);
    const b = requirementContentHash({ description: 'a', type: 'bc', priority: 'p1' } as never);
    expect(a).not.toBe(b);
  });

  it('yields a compact stable format (hex sha-256)', () => {
    expect(requirementContentHash(BASE)).toMatch(/^[0-9a-f]{64}$/);
  });
});
