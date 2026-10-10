/**
 * `T2121` (EPIC-039, `FR-HUB-045`, `R-039-10`) — the execution sanitiser and the
 * Integration Hub use ONE list of credential shapes. Asserted by identity, not
 * by copy: a copy is two lists the day someone edits one.
 *
 * Lives on the backend side because `@pmi/capability-contract` imports nothing
 * from the repository, its tests included.
 */
import { SECRET_PATTERNS, looksLikeSecret } from '@pmi/capability-contract';
import { describe, expect, it } from 'vitest';
import * as sanitisation from '../../src/modules/executions/sanitisation.js';

describe('T2121 · the secret patterns are one list', () => {
  it('is the very list the execution sanitiser uses', () => {
    expect(sanitisation.SECRET_PATTERNS).toBe(SECRET_PATTERNS);
    expect(sanitisation.looksLikeSecret).toBe(looksLikeSecret);
  });

  it('so the sanitiser now also redacts the SC-HUB-004 canary', () => {
    expect(sanitisation.sanitiseArgs({ note: 'pmi-canary-0b3f2c1e-4d5a-4e6f-9a7b-8c9d0e1f2a3b' })).toEqual({ note: '[redacted]' });
  });
});
