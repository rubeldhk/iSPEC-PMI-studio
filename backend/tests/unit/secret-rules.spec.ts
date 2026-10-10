/**
 * `T2320` (EPIC-048, `A-037-1`, `R-048-18`) — `EPIC-037`'s secret patterns, with
 * names.
 *
 * `FR-LRN-018` requires a refusal to **name the rule** that matched. The patterns
 * already exist in `executions/sanitisation.ts`, returning a boolean; this adds
 * the name without changing a single existing answer — `looksLikeSecret`
 * delegates, so `EPIC-037`'s own tests keep asserting its behaviour.
 */
import { describe, expect, it } from 'vitest';
import { looksLikeSecret, secretRuleMatching, SECRET_RULE_NAMES } from '../../src/modules/executions/sanitisation.js';

const SAMPLES: readonly [string, string][] = [
  ['github-token', `token ghp_${'A'.repeat(36)} in the log`],
  ['aws-access-key', 'key AKIAABCDEFGHIJKLMNOP here'],
  ['private-key', '-----BEGIN RSA PRIVATE KEY-----\nMIIE...'],
  ['jwt', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'],
  ['anthropic-key', `sk-ant-${'a'.repeat(24)}`],
  ['openai-key', `sk-${'b'.repeat(24)}`],
  ['slack-token', 'xoxb-1234567890-abcdefghij'],
  ['connection-string', 'postgresql://admin:hunter2@db.internal:5432/app'],
];

describe('T2320 · secretRuleMatching names the rule', () => {
  it.each(SAMPLES)('%s', (rule, value) => {
    expect(secretRuleMatching(value)).toBe(rule);
  });

  it('every rule has a name, and the names are the ones above', () => {
    expect([...SECRET_RULE_NAMES].sort()).toEqual(SAMPLES.map(([r]) => r).sort());
  });

  it('answers null for clean text', () => {
    for (const clean of ['Integration tests need the database started first.', 'sk-short', 'AKIA-not-a-key', 'eyJ.only.short', '']) {
      expect(secretRuleMatching(clean)).toBeNull();
    }
  });
});

describe('T2320 · looksLikeSecret is unchanged for every existing case', () => {
  it.each(SAMPLES)('still true for %s', (_rule, value) => {
    expect(looksLikeSecret(value)).toBe(true);
  });

  it('still false for clean text', () => {
    expect(looksLikeSecret('nothing to see here')).toBe(false);
  });

  it('agrees with secretRuleMatching on every input', () => {
    for (const value of [...SAMPLES.map(([, v]) => v), 'plain', 'ghp_short', 'xoxb-short']) {
      expect(looksLikeSecret(value)).toBe(secretRuleMatching(value) !== null);
    }
  });
});
