/**
 * T733 — the executable conformance check for the risk-classification rules,
 * written to fail first (Constitution V for a non-code output).
 *
 * The rules are `risk-classification` steering documents (`R-031-1`). The
 * repository ships the initial set under
 * `packages/decision-contract/classification-rules/`; a tenant loads them into
 * its steering and changes them by new steering versions. This reads every one
 * and fails on:
 *
 * - a document naming no rules, or not `risk-classification`, or a scope outside
 *   organization / workspace / project;
 * - a rule naming no action pattern, a malformed pattern, or a band outside
 *   `RISK_BANDS`;
 * - **a rule lowering an irreducibly-high action** — `FR-DPE-012`. The
 *   classifier's floor would overrule it at use anyway (forbid overrides
 *   permit, `R-031-2`), but a shipped rule that *says* otherwise is a document
 *   that lies about what happens.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RISK_BANDS } from '@pmi/decision-contract';
import { IRREDUCIBLY_HIGH } from '../../src/modules/decision/classifier.js';

const here = dirname(fileURLToPath(import.meta.url));
const RULES = resolve(here, '../../../packages/decision-contract/classification-rules');

export function rulesFindings(name: string, body: unknown): string[] {
  const findings: string[] = [];
  const doc = body as Record<string, unknown>;
  if (doc['subject'] !== 'risk-classification') findings.push(`${name}: subject is not risk-classification`);
  if (!['organization', 'workspace', 'project'].includes(String(doc['scopeType']))) {
    findings.push(`${name}: scopeType is not organization, workspace or project`);
  }
  const rules = doc['rules'];
  if (!Array.isArray(rules) || rules.length === 0) return [...findings, `${name}: names no rules`];
  rules.forEach((raw, i) => {
    const rule = raw as Record<string, unknown>;
    const pattern = rule['actionPattern'];
    if (typeof pattern !== 'string' || !/^[a-z0-9-]+(\.[a-z0-9-]+)*(\.\*)?$/.test(pattern)) {
      findings.push(`${name}: rule ${i} has no well-formed action pattern`);
      return;
    }
    if (!(RISK_BANDS as readonly unknown[]).includes(rule['band'])) {
      findings.push(`${name}: rule ${i} names a band outside ${RISK_BANDS.join(', ')}`);
    }
    const prefix = pattern.endsWith('.*') ? pattern.slice(0, -1) : null;
    const lowers = IRREDUCIBLY_HIGH.filter((a) => (prefix === null ? a === pattern : a.startsWith(prefix)));
    if (lowers.length > 0 && rule['band'] !== 'high') {
      findings.push(`${name}: rule ${i} lowers ${lowers.join(', ')} below high (FR-DPE-012)`);
    }
  });
  return findings;
}

function shipped(): Array<{ name: string; body: unknown }> {
  return readdirSync(RULES)
    .filter((n) => n.endsWith('.json'))
    .map((name) => ({ name, body: JSON.parse(readFileSync(join(RULES, name), 'utf8')) as unknown }));
}

describe('T733 · the shipped classification rules exist', () => {
  it('has a classification-rules directory with at least one document', () => {
    expect(existsSync(RULES), `no directory at ${RULES}`).toBe(true);
    expect(shipped().length).toBeGreaterThan(0);
  });

  it('every shipped document conforms', () => {
    expect(shipped().flatMap(({ name, body }) => rulesFindings(name, body))).toEqual([]);
  });

  it('declares every irreducibly-high action high, so the document and the floor agree', () => {
    const declared = new Set(
      shipped().flatMap(({ body }) =>
        ((body as { rules: Array<{ actionPattern: string; band: string }> }).rules ?? [])
          .filter((r) => r.band === 'high')
          .map((r) => r.actionPattern),
      ),
    );
    expect(IRREDUCIBLY_HIGH.filter((a) => !declared.has(a))).toEqual([]);
  });
});

describe('T733 · the check can fail — each rule against a planted document', () => {
  const good = { subject: 'risk-classification', scopeType: 'workspace', rules: [{ actionPattern: 'deploy', band: 'medium' }] };

  it.each([
    ['another subject', { ...good, subject: 'security' }],
    ['a product scope', { ...good, scopeType: 'product' }],
    ['no rules', { ...good, rules: [] }],
    ['no action pattern', { ...good, rules: [{ band: 'low' }] }],
    ['a malformed pattern', { ...good, rules: [{ actionPattern: 'Deploy Now', band: 'low' }] }],
    ['a band outside the three', { ...good, rules: [{ actionPattern: 'deploy', band: 'unknown' }] }],
    ['an irreducible action lowered', { ...good, rules: [{ actionPattern: 'release.promote', band: 'low' }] }],
    ['an irreducible action lowered by wildcard', { ...good, rules: [{ actionPattern: 'release.*', band: 'medium' }] }],
  ])('flags %s', (_label, body) => {
    expect(rulesFindings('planted.json', body).length).toBeGreaterThan(0);
  });

  it('passes the planted good document — so the failures above are about the rule', () => {
    expect(rulesFindings('planted.json', good)).toEqual([]);
  });
});
