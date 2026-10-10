/**
 * T856i — the three ports, written to fail first.
 *
 * Every port declares its absent-behaviour, and every one is `refuse`
 * (`FR-EVS-035`, `FR-EVS-015`, `FR-EVS-040`) — the same direction as `EPIC-030`
 * and `EPIC-031`. Three substrate Epics, one failure direction: a governed
 * action that slips through any one of them is ungoverned.
 */
import { describe, expect, it } from 'vitest';
import { EVIDENCE_PORTS, type EvidenceStorage, type ResolveResult } from '../src/ports.js';

describe('T856i · every absent port refuses', () => {
  it('declares exactly the three ports the contract names', () => {
    expect(EVIDENCE_PORTS.map((p) => p.name)).toEqual([
      'EvidenceStorage',
      'AccessPolicy',
      'AttestationSource',
    ]);
  });

  it('declares refuse as the absent-behaviour of each', () => {
    for (const port of EVIDENCE_PORTS) expect(port.absent).toBe('refuse');
  });

  it('names the Epic that fills each', () => {
    expect(Object.fromEntries(EVIDENCE_PORTS.map((p) => [p.name, p.filledBy]))).toEqual({
      EvidenceStorage: 'EPIC-025',
      AccessPolicy: 'EPIC-024',
      AttestationSource: 'EPIC-013',
    });
  });
});

describe('T856i · FR-EVS-014 — resolution returns, it does not throw', () => {
  it('has a resolution result with resolved and unresolvable branches only', () => {
    const resolved: ResolveResult = { resolved: true };
    const missing: ResolveResult = { resolved: false, reason: 'destination_missing' };
    expect([resolved.resolved, missing.resolved]).toEqual([true, false]);
  });

  it('types resolve() as returning a result, never void', async () => {
    const storage: EvidenceStorage = {
      resolve: async () => ({ resolved: false, reason: 'provider_unavailable' }),
    };
    await expect(storage.resolve({ provider: 'fixture', location: 'x' })).resolves.toMatchObject({
      resolved: false,
    });
  });
});
