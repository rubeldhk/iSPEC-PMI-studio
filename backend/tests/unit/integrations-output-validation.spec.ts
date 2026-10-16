/**
 * `T2145` (EPIC-039, `FR-HUB-016`, `FR-HUB-081`) — the Hub, not the adapter,
 * decides whether an output conforms. A non-conforming one is an adapter fault
 * and is never passed through; an `Embed` result is refused whole on any of the
 * four shapes `EPIC-038`'s `embedChecked` refuses.
 *
 * Written to FAIL before `T2146`.
 */
import { contractFor } from '@pmi/capability-contract';
import { describe, expect, it } from 'vitest';
import { checkOutput } from '../../src/modules/integrations/requests/output-validation.js';

const SHA = 'd'.repeat(40);

describe('T2145 · output validation against the contract', () => {
  it('accepts a conforming ReadBuildStatus output', () => {
    expect(checkOutput(contractFor('ReadBuildStatus', 1)!, { revision: SHA, state: 'success', final: true, checks: [], observedAt: 'now' })).toEqual({ ok: true });
  });

  it('refuses a non-conforming one as adapter-fault, naming the path', () => {
    const r = checkOutput(contractFor('ReadBuildStatus', 1)!, { revision: SHA, state: 'almost', final: true, checks: [], observedAt: 'now' });
    expect(r).toMatchObject({ ok: false, errorCategory: 'adapter-fault' });
    expect(r.ok ? '' : r.message).toContain('state');
  });
});

describe('T2145 · Embed', () => {
  const embed = contractFor('Embed', 1)!;
  const out = (vectors: number[][], dimension = 3) => ({ model: { id: 'm', version: 'v', dimension }, vectors });

  it('accepts one finite, non-zero vector per text, of the declared dimension', () => {
    expect(checkOutput(embed, out([[1, 0, 0], [0, 1, 0]]), { texts: 2, dimension: 3 })).toEqual({ ok: true });
  });

  it.each([
    ['a count mismatch', out([[1, 0, 0]]), 'returned 1 vectors for 2 texts'],
    ['a wrong dimension', out([[1, 0], [0, 1]]), 'dimension 2, declared 3'],
    ['a non-finite component', out([[1, Number.POSITIVE_INFINITY, 0], [0, 1, 0]]), 'finite'],
    ['a zero vector', out([[0, 0, 0], [0, 1, 0]]), 'zero vector'],
    ['a model declaring another dimension', out([[1, 0, 0], [0, 1, 0]], 4), 'declared 3'],
  ])('refuses %s, whole', (_l, value, fragment) => {
    const r = checkOutput(embed, value, { texts: 2, dimension: 3 });
    expect(r).toMatchObject({ ok: false, errorCategory: 'adapter-fault' });
    expect(r.ok ? '' : r.message).toContain(fragment);
  });
});

describe('T2621 · FR-HUB-045 — an output carrying credential material is refused, never returned or recorded', () => {
  const canary = `pmi-canary-${'0a1b2c3d'}-4e5f-6789-abcd-ef0123456789`;
  const output = (name: string) => ({ revision: SHA, state: 'failure', final: true, checks: [{ name, state: 'failure', final: true }], observedAt: 'now' });

  it('refuses as adapter-fault, naming where — and never the value', () => {
    const r = checkOutput(contractFor('ReadBuildStatus', 1)!, output(`deploy failed with token ${canary}`));
    expect(r).toMatchObject({ ok: false, errorCategory: 'adapter-fault' });
    const message = r.ok ? '' : r.message;
    expect(message).toMatch(/credential material/);
    expect(message).toContain('checks.0.name');
    expect(message).not.toContain(canary);
  });

  it('passes the same output without the material', () => {
    expect(checkOutput(contractFor('ReadBuildStatus', 1)!, output('deploy failed'))).toEqual({ ok: true });
  });
});
