/**
 * T856p — the executable conformance check for the Evidence Contract
 * definitions, written to fail first (`R-032-4`, Constitution V for a non-code
 * output: *"a check that cannot fail is decoration"*).
 *
 * The definitions live in `packages/evidence-contract/contracts/` — one JSON
 * file per governed work class — and this reads every one. It fails on:
 *
 * - an item naming no accepting `predicateType`, or one naming a URI the
 *   registry does not know (`FR-EVS-025`, `FR-EVS-003`);
 * - an **unknown work class** — a file whose class is not in `work-classes.json`;
 * - a **zero-item Contract with no `zeroItemPolicyRef`** (`FR-EVS-026`) — the
 *   silent one, because an empty Contract is a gate that always passes and looks
 *   identical to a Contract nobody wrote yet;
 * - a file name that disagrees with the class it declares, or two versions of a
 *   class sharing a number (`contractVersion` is never reused).
 *
 * Work-class *names* live in data (`work-classes.json`), not in the package's
 * types. Naming them there is a tenant fact; naming them in `src/` would be
 * Room vocabulary, which `evidence-independence.spec.ts` forbids — the same line
 * `loop-independence.spec.ts` draws between `workflows/` and `src/`.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { kindOf, validateContract } from '@pmi/evidence-contract';

const here = dirname(fileURLToPath(import.meta.url));
const CONTRACTS = resolve(here, '../../../packages/evidence-contract/contracts');
const REGISTRY = join(CONTRACTS, 'work-classes.json');

interface Finding {
  readonly file: string;
  readonly problem: string;
}

/** Pure: the whole check, so it can be run against planted fixtures as well. */
export function conformanceFindings(
  files: ReadonlyArray<{ name: string; body: unknown }>,
  knownClasses: ReadonlySet<string>,
): Finding[] {
  const findings: Finding[] = [];
  const versions = new Map<string, Set<number>>();
  for (const { name, body } of files) {
    const validation = validateContract(body);
    if (!validation.ok) {
      findings.push({ file: name, problem: `${validation.reason}: ${validation.message}` });
      continue;
    }
    const contract = validation.value;
    if (!knownClasses.has(contract.workClass)) {
      findings.push({ file: name, problem: `unknown work class ${contract.workClass}` });
    }
    if (!name.startsWith(`${contract.workClass}.v${contract.contractVersion}.`)) {
      findings.push({
        file: name,
        problem: `file name does not match ${contract.workClass}.v${contract.contractVersion}.json`,
      });
    }
    const seen = versions.get(contract.workClass) ?? new Set<number>();
    if (seen.has(contract.contractVersion)) {
      findings.push({ file: name, problem: `contractVersion ${contract.contractVersion} reused` });
    }
    seen.add(contract.contractVersion);
    versions.set(contract.workClass, seen);
    for (const item of contract.items) {
      for (const uri of item.acceptingPredicateTypes) {
        if (kindOf(uri) === null) {
          findings.push({ file: name, problem: `item ${item.itemId} accepts unknown predicateType ${uri}` });
        }
      }
    }
  }
  return findings;
}

function readDefinitions(): { classes: Set<string>; files: Array<{ name: string; body: unknown }> } {
  const registry = JSON.parse(readFileSync(REGISTRY, 'utf8')) as { workClasses: Array<{ id: string }> };
  const files = readdirSync(CONTRACTS)
    .filter((n) => n.endsWith('.json') && n !== 'work-classes.json')
    .map((name) => ({ name, body: JSON.parse(readFileSync(join(CONTRACTS, name), 'utf8')) as unknown }));
  return { classes: new Set(registry.workClasses.map((c) => c.id)), files };
}

describe('T856p · the Evidence Contract definitions exist', () => {
  it('has a contracts directory and a work-class registry', () => {
    expect(existsSync(CONTRACTS), `no directory at ${CONTRACTS}`).toBe(true);
    expect(existsSync(REGISTRY), 'no work-classes.json').toBe(true);
  });

  it('has at least one definition — anti-vacuity', () => {
    expect(readDefinitions().files.length).toBeGreaterThan(0);
  });

  it('defines a Contract for every registered work class', () => {
    const { classes, files } = readDefinitions();
    const defined = new Set(files.map((f) => (f.body as { workClass?: string }).workClass));
    expect([...classes].filter((c) => !defined.has(c))).toEqual([]);
  });
});

describe('T856p · R-032-4 — every definition conforms', () => {
  it('reports no findings against the shipped definitions', () => {
    const { classes, files } = readDefinitions();
    expect(conformanceFindings(files, classes)).toEqual([]);
  });
});

describe('T856p · the check can fail — each rule against a planted definition', () => {
  const classes = new Set(['feature-delivery']);
  const item = {
    itemId: 'tests-pass',
    description: 'Automated tests pass',
    acceptingPredicateTypes: ['https://in-toto.io/attestation/test-result/v0.1'],
  };
  const good = { workClass: 'feature-delivery', contractVersion: 1, items: [item] };

  it.each([
    ['an item with no accepting predicateType', { ...good, items: [{ ...item, acceptingPredicateTypes: [] }] }],
    ['an unknown predicateType', { ...good, items: [{ ...item, acceptingPredicateTypes: ['https://example.com/x/v1'] }] }],
    ['an unknown work class', { ...good, workClass: 'not-a-class' }],
    ['a zero-item Contract with no zeroItemPolicyRef', { ...good, items: [] }],
  ])('flags %s', (_label, body) => {
    const name = `${(body as { workClass: string }).workClass}.v1.json`;
    expect(conformanceFindings([{ name, body }], classes).length).toBeGreaterThan(0);
  });

  it('flags a reused contractVersion', () => {
    const files = [
      { name: 'feature-delivery.v1.json', body: good },
      { name: 'feature-delivery.v1.json', body: good },
    ];
    expect(conformanceFindings(files, classes).some((f) => /reused/.test(f.problem))).toBe(true);
  });

  it('passes the planted good definition — so the failures above are about the rule', () => {
    expect(conformanceFindings([{ name: 'feature-delivery.v1.json', body: good }], classes)).toEqual([]);
  });
});
