/**
 * `T2412` (EPIC-048, `RK-9`, `RK-11`, `RK-5`) — the example policy documents a
 * workspace copies are the ones the code accepts.
 *
 * Enabling anything beyond human review takes **three** documents per workspace
 * (`R-048-12`): the learning policy (this Epic's, declaring a category low-risk),
 * a `risk-classification` rule (`EPIC-031`'s band) and the tenant policy's
 * `automatedActions` (`EPIC-031`'s permission for the intake automation). An
 * example that the parser refuses, or that quietly sets up one of the known
 * hazards, teaches the wrong thing.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseLearningPolicy } from '../../src/modules/learning/learning-policy.js';
import { INTAKE_AUTOMATION, INTAKE_RULE } from '../../src/modules/learning/decision.requester.js';

const here = dirname(fileURLToPath(import.meta.url));
const EXAMPLES = resolve(here, '../../../specs/048-governed-learning/examples');
const json = (name: string): Record<string, unknown> => JSON.parse(readFileSync(resolve(EXAMPLES, name), 'utf8')) as Record<string, unknown>;

/** EPIC-031's pattern match (`policy.loader.ts` `patternCovers`), restated for the check. */
const covers = (pattern: string, action: string): boolean => pattern === action || (pattern.endsWith('.*') && action.startsWith(pattern.slice(0, -1)));

describe('T2412 · the learning policy example (R-048-3)', () => {
  const content = readFileSync(resolve(EXAMPLES, 'learning-policy.example.json'), 'utf8');

  it('parses with learning-policy.ts — no problems', () => {
    const parsed = parseLearningPolicy(content);
    expect(parsed.ok ? [] : parsed.problems).toEqual([]);
  });

  it('declares at least one low-risk category and one that is not — lowRisk is explicit both ways', () => {
    const parsed = parseLearningPolicy(content);
    if (!parsed.ok) throw new Error('unparseable');
    expect(parsed.content.categories.some((c) => c.lowRisk)).toBe(true);
    expect(parsed.content.categories.some((c) => !c.lowRisk)).toBe(true);
  });

  it('states reuse and all three settings rather than leaning on defaults', () => {
    const raw = JSON.parse(content) as Record<string, unknown>;
    expect(raw).toHaveProperty('reuse');
    for (const key of ['gracePeriodHours', 'reviewWindowDays', 'maxCandidatesPerExecution']) expect(raw).toHaveProperty(key);
  });
});

describe('T2412 · the EPIC-031 examples the quickstart names (RK-9)', () => {
  const rules = (json('epic-031-classification-rule.example.json')['rules'] ?? []) as { actionPattern: string; band: string }[];
  const tenant = json('epic-031-tenant-policy.example.json') as {
    bandTreatment: Record<string, string>;
    automatedActions: { actionPattern: string; ruleId: string }[];
    approvedBy: string;
  };
  const learning = parseLearningPolicy(readFileSync(resolve(EXAMPLES, 'learning-policy.example.json'), 'utf8'));
  const lowRisk = learning.ok ? learning.content.categories.filter((c) => c.lowRisk).map((c) => c.key) : [];

  it('classifies learning.approve.<category> low for every low-risk category — the band half of the opt-in', () => {
    for (const key of lowRisk) {
      const rule = rules.find((r) => covers(r.actionPattern, `learning.approve.${key}`));
      expect(rule?.band, key).toBe('low');
    }
  });

  it('never classifies a learning.review.* action low — a review must reach a human (RK-5)', () => {
    for (const kind of ['candidate', 'supersede', 'deprecate', 'widen-scope']) {
      const rule = rules.find((r) => covers(r.actionPattern, `learning.review.${kind}`));
      expect(rule?.band ?? 'high', kind).toBe('high');
    }
  });

  it('classifies no learning action medium — 031 refuses a medium request naming no gates (RK-11)', () => {
    expect(rules.filter((r) => r.actionPattern.startsWith('learning.') && r.band === 'medium')).toEqual([]);
  });

  it('permits the intake automation under its own rule id', () => {
    const permit = tenant.automatedActions.find((a) => covers(a.actionPattern, 'learning.approve.x') && covers(a.actionPattern, 'learning.review.candidate'));
    expect(permit?.ruleId).toBe(INTAKE_RULE);
    expect(INTAKE_AUTOMATION).toBe('learning-intake');
  });

  it('is a tenant policy 031 would load: high stays human-approved, low auto-executes, an approver is named', () => {
    expect(tenant.bandTreatment).toEqual({ low: 'auto-execute', medium: 'gates-required', high: 'human-approval' });
    expect(tenant.approvedBy.trim()).not.toBe('');
  });
});
