/**
 * `T406p`, `T406q` (EPIC-034) — five ports refuse, one degrades.
 *
 * `FR-CHR-032`. The asymmetry is asserted rather than assumed, because it is
 * exactly the kind of thing a later reader tidies into consistency. Making
 * `ImpactSource` refuse would block every change during a graph outage; making
 * any of the other five degrade would let an unauthorised or unproven change
 * through looking exactly like an approved one.
 */
import { describe, expect, it } from 'vitest';
import {
  CHANGE_ROOM_PORTS,
  absentBehaviourOf,
} from '../../src/modules/change-room/change-room.tokens.js';

describe('T406p · six ports, named', () => {
  it('declares exactly six', () => {
    expect(CHANGE_ROOM_PORTS).toHaveLength(6);
  });

  it('names each one and who fills it', () => {
    expect(CHANGE_ROOM_PORTS.map((p) => `${p.name}:${p.filledBy}`)).toEqual([
      'LoopEngine:EPIC-030',
      'PolicyProvider:EPIC-031',
      'EvidenceContractSource:EPIC-032',
      'BaselineReader:EPIC-033',
      'ImpactSource:EPIC-020',
      'TransferIntake:EPIC-035',
    ]);
  });

  it('is frozen, and so is each entry', () => {
    expect(Object.isFrozen(CHANGE_ROOM_PORTS)).toBe(true);
    for (const port of CHANGE_ROOM_PORTS) {
      expect(Object.isFrozen(port), `${port.name} is mutable`).toBe(true);
    }
  });

  it('every port says WHY its absence behaves as it does', () => {
    // A behaviour with no recorded reason is one somebody changes on a tidying
    // pass, which is how an asymmetry becomes a bug.
    for (const port of CHANGE_ROOM_PORTS) {
      expect(port.because.length, `${port.name} has no reason`).toBeGreaterThan(40);
    }
  });
});

describe('T406p · five refuse', () => {
  it.each([
    'LoopEngine',
    'PolicyProvider',
    'EvidenceContractSource',
    'BaselineReader',
    'TransferIntake',
  ])('%s refuses when absent', (name) => {
    expect(absentBehaviourOf(name)).toBe('refuse');
  });

  it('exactly five refuse — not four, not six', () => {
    expect(CHANGE_ROOM_PORTS.filter((p) => p.absent === 'refuse')).toHaveLength(5);
  });
});

describe('T406p · one degrades, and it is the impact source', () => {
  it('ImpactSource degrades', () => {
    expect(absentBehaviourOf('ImpactSource')).toBe('degrade');
  });

  it('is the ONLY one that degrades', () => {
    const degrading = CHANGE_ROOM_PORTS.filter((p) => p.absent === 'degrade');
    expect(degrading).toHaveLength(1);
    expect(degrading[0]?.name).toBe('ImpactSource');
  });

  it('records that it degrades to unknown and never to not-impacted', () => {
    // The distinction the Room turns on, written where somebody changing this
    // behaviour would read it.
    const impact = CHANGE_ROOM_PORTS.find((p) => p.name === 'ImpactSource');
    expect(impact?.because).toMatch(/unknown/i);
    expect(impact?.because).toMatch(/never to not-impacted/i);
  });

  it('the policy port does NOT degrade — the asymmetry is real', () => {
    // Anti-vacuity: without this, a registry where everything degraded would
    // satisfy the assertion above.
    expect(absentBehaviourOf('PolicyProvider')).not.toBe('degrade');
  });
});

describe('T406p · an unknown port name has no behaviour', () => {
  it('returns null rather than guessing', () => {
    // Guessing `refuse` would be safe and wrong: a port nobody declared is a
    // question, not a policy.
    expect(absentBehaviourOf('SomethingElse')).toBeNull();
  });
});
