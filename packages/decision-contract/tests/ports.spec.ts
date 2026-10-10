/**
 * T727 — the four ports, written to fail first. `FR-DPE-050`.
 *
 * Every absent port refuses — `ADR-0025`'s reasoning applied to composition,
 * matching `EPIC-030` `FR-GEL-062` and `EPIC-032`. A governed action must not
 * slip through the seam between substrate Epics.
 */
import { describe, expect, it } from 'vitest';
import { DECISION_PORTS } from '../src/ports.js';

describe('T727 · FR-DPE-050 — every absent port refuses', () => {
  it('declares exactly the four ports the contract names, and who fills each', () => {
    expect(Object.fromEntries(DECISION_PORTS.map((p) => [p.name, p.filledBy]))).toEqual({
      SteeringSource: 'EPIC-019',
      GateProvider: 'EPIC-021',
      EvidenceContractSource: 'EPIC-032',
      AuditSink: 'EPIC-004',
    });
  });

  it('declares refuse as every absent-behaviour', () => {
    for (const port of DECISION_PORTS) expect(port.absent).toBe('refuse');
    expect(Object.isFrozen(DECISION_PORTS)).toBe(true);
  });
});
