/**
 * T1027 (EPIC-037 Band A) — a connector cannot reach the database, EPIC-030's
 * internals, or EPIC-009.
 *
 * `FR-EXR-021`. The registry's whole authority model rests on connectors being
 * able to *report* and *propose* and nothing else. That is enforced three ways,
 * and this asserts all three rather than trusting the first:
 *
 * 1. The contract exposes no verb for applying, approving or patching.
 * 2. `packages/*` cannot import `backend/src`, so a connector package cannot
 *    reach a service even if it wanted to.
 * 3. `LoopModule` exports only `PROPOSAL_ADJUDICATOR`, so this Epic cannot
 *    assemble its own adjudicator over its own gate provider.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..', '..', '..');
const REGISTRY_PKG = join(ROOT, 'packages', 'execution-registry-contract');
const EXECUTIONS = join(ROOT, 'backend', 'src', 'modules', 'executions');

/** Block and line comments removed, so a rule reads code rather than prose. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}

const packageFiles = walk(REGISTRY_PKG);
const moduleFiles = walk(EXECUTIONS);

describe('T1027 · the scan is real', () => {
  it('found both trees — an empty scan proves nothing', () => {
    expect(packageFiles.length).toBeGreaterThan(3);
    expect(moduleFiles.length).toBeGreaterThan(4);
  });
});

describe('T1027 · the connector package reaches nothing privileged', () => {
  it('imports no backend module', () => {
    const offenders = packageFiles.filter((f) =>
      /from\s+['"][^'"]*backend\/src/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });

  it('imports no Prisma client and names no registry table', () => {
    const forbidden = [
      '@prisma/client',
      'execution_events',
      'status_transition_proposals',
      'agent_identity_snapshots',
    ];
    const offenders: string[] = [];
    for (const f of packageFiles) {
      const src = readFileSync(f, 'utf8');
      for (const needle of forbidden) {
        if (src.includes(needle)) offenders.push(`${relative(ROOT, f)} → ${needle}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('offers no verb for applying, approving or patching', () => {
    // The omission IS the enforcement. A contract that offered these would make
    // "connectors must not apply transitions" a rule somebody has to remember.
    //
    // Comments are stripped first. The rule is about the DECLARED SURFACE, and
    // the first version of this check failed against the doc comment above
    // explaining why `applyTransition` is absent — the prose naming a forbidden
    // verb is the opposite of the defect.
    const contract = stripComments(
      readFileSync(join(REGISTRY_PKG, 'src', 'contract.ts'), 'utf8'),
    );
    for (const verb of ['applyTransition', 'approve(', 'setStatus', 'patch(']) {
      expect(contract.includes(verb), `the contract exposes ${verb}`).toBe(false);
    }
    // And the four it DOES offer are present, so this is not passing by
    // matching an empty file.
    for (const verb of ['register(', 'appendEvent(', 'complete(', 'proposeTransition(']) {
      expect(contract.includes(verb)).toBe(true);
    }
  });
});

describe('T1027 · the module reaches EPIC-030 through one token only', () => {
  const moduleSource = (): string =>
    readFileSync(join(EXECUTIONS, 'executions.module.ts'), 'utf8');

  it('imports PROPOSAL_ADJUDICATOR and none of the individual ports', () => {
    const src = moduleSource();
    expect(src).toContain('PROPOSAL_ADJUDICATOR');
    for (const token of [
      'ADJUDICATION_GATE_OUTCOMES',
      'ADJUDICATION_AUTHORITY_POLICY',
      'ADJUDICATION_LIFECYCLE_VALIDATION',
      'ADJUDICATION_LIFECYCLE_APPLICATION',
      'ADJUDICATION_INTAKE_AUTHORIZATION',
      'ADJUDICATION_RECORDS',
    ]) {
      expect(src.includes(token), `the module reaches ${token}`).toBe(false);
    }
  });

  it('no file in the module reaches EPIC-009 at all', () => {
    // A connector cannot apply a lifecycle transition because nothing in this
    // module can. Asserted rather than left to the absence of a call.
    const offenders = moduleFiles.filter((f) => {
      const src = readFileSync(f, 'utf8');
      return (
        src.includes('SpecificationLifecycleService') ||
        src.includes('LifecycleTransitionRepository') ||
        /modules\/specifications/.test(src)
      );
    });
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });

  it('can actually detect a violation — proven by construction', () => {
    // The anti-tautology check. Each rule above is re-run against text that
    // SHOULD trip it, so a scan matching nothing cannot pass silently.
    expect(/from\s+['"][^'"]*backend\/src/.test(`import x from '../backend/src/a.js';`)).toBe(true);
    expect('const a = ADJUDICATION_GATE_OUTCOMES;'.includes('ADJUDICATION_GATE_OUTCOMES')).toBe(true);
    expect(/modules\/specifications/.test(`from '../specifications/x.js'`)).toBe(false);
    expect(/modules\/specifications/.test(`from '../../modules/specifications/x.js'`)).toBe(true);
    // And stripping works: a forbidden verb in prose is not a declaration.
    const prose = ['// applyTransition is absent', 'export interface X {}'].join(String.fromCharCode(10));
    expect(stripComments(prose)).not.toContain('applyTransition');
    expect(stripComments('export interface X { applyTransition(): void }')).toContain(
      'applyTransition',
    );
  });
});
