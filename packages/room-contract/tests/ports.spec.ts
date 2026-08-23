/**
 * T337q — five ports, and only one of them degrades. `FR-RQR-002`,
 * `FR-RQR-003`, `FR-GEL-062`, `RULE-03`.
 *
 * The asymmetry is the whole test, and it is deliberate rather than accidental:
 *
 *   `LoopEngine`             absent ⇒ **refuse** — no transition without the loop
 *   `PolicyProvider`         absent ⇒ **refuse** — an undecided decision is not an approval
 *   `EvidenceContractSource` absent ⇒ **refuse** — a baseline cannot complete on an unevaluated Contract
 *   `RequirementRegister`    absent ⇒ **refuse**, and NEVER substituted by a local store
 *   `AgentGateway`           absent ⇒ **degrade**
 *
 * Four of those say *"a governance guarantee cannot be evaluated, so nothing
 * proceeds"*. The fifth says something different: an absent **analysis**
 * provider means the AI could not help, and a human can still clarify, decide
 * and baseline by hand. Refusing there would make the governed path depend on a
 * model being reachable, which inverts `RULE-03` — *AI recommends; humans and
 * policy govern*.
 *
 * Declared here as **data** rather than as prose, so `EPIC-034` and `EPIC-035`
 * inherit the same reasoning instead of re-deriving it. `EPIC-034` reached the
 * identical conclusion for `ImpactSource` and `EPIC-035` for its own
 * `AgentGateway`; three Epics agreeing by accident is not the same as one place
 * saying it.
 */
import { describe, expect, it } from 'vitest';
import { ROOM_PORTS, absentBehaviourOf, type RoomPortName } from '../src/ports.js';

describe('T337q · the five ports the Room requires', () => {
  it('names exactly five', () => {
    expect(ROOM_PORTS.map((p) => p.name)).toEqual([
      'LoopEngine',
      'PolicyProvider',
      'EvidenceContractSource',
      'RequirementRegister',
      'AgentGateway',
    ]);
  });

  it('is frozen, so a consumer cannot add a sixth at runtime', () => {
    expect(Object.isFrozen(ROOM_PORTS)).toBe(true);
  });

  it('says which Epic fills each one', () => {
    // A seam with no named owner is a seam nobody is building.
    for (const port of ROOM_PORTS) {
      expect(port.filledBy).toMatch(/EPIC-\d{3}/);
    }
  });
});

describe('FR-GEL-062 · four refuse, and the reason is recorded with each', () => {
  it.each(['LoopEngine', 'PolicyProvider', 'EvidenceContractSource', 'RequirementRegister'] as const)(
    '%s refuses when absent',
    (name: RoomPortName) => {
      expect(absentBehaviourOf(name)).toBe('refuse');
    },
  );

  it('gives each refusing port a reason, not just a verdict', () => {
    // "Refuse" alone is a rule somebody will soften. The reason is what makes it
    // arguable — and what makes softening it visibly a decision.
    for (const port of ROOM_PORTS) {
      expect(port.because.length).toBeGreaterThan(20);
    }
  });

  it('FR-RQR-002 · RequirementRegister is never substituted by a local store', () => {
    const register = ROOM_PORTS.find((p) => p.name === 'RequirementRegister');
    expect(register?.filledBy).toContain('EPIC-007');
    // D-33 is the decision this port exists to honour: this Room CONSUMES the
    // register EPIC-007 owns. A local cache of requirement text would feel
    // convenient every single day, which is why it is asserted rather than
    // trusted.
    expect(register?.because).toMatch(/never substituted|D-33|local/i);
  });
});

describe('RULE-03 · AgentGateway degrades, and it is the only one', () => {
  it('degrades rather than refusing', () => {
    expect(absentBehaviourOf('AgentGateway')).toBe('degrade');
  });

  it('is the ONLY port that degrades', () => {
    // The assertion that keeps the asymmetry deliberate. A second degrading port
    // would arrive as a convenience — "the evidence store is flaky, let it
    // through" — and that is FR-RQR-053 quietly deleted.
    const degrading = ROOM_PORTS.filter((p) => p.absent === 'degrade');
    expect(degrading.map((p) => p.name)).toEqual(['AgentGateway']);
  });

  it('says why the exception is right, in terms of RULE-03', () => {
    const gateway = ROOM_PORTS.find((p) => p.name === 'AgentGateway');
    expect(gateway?.because).toMatch(/RULE-03|human/i);
  });

  it('declares the capability it needs, so the seam is not "some AI"', () => {
    const gateway = ROOM_PORTS.find((p) => p.name === 'AgentGateway');
    expect(gateway?.capability).toBe('analyze');
  });
});

describe('the declaration is total, so a new port cannot skip the decision', () => {
  it('gives every port an absent-behaviour', () => {
    // A port added without one would default to whatever the caller does when a
    // token is unbound — which is the silent pass FR-GEL-062 exists to prevent.
    for (const port of ROOM_PORTS) {
      expect(['refuse', 'degrade']).toContain(port.absent);
    }
  });

  it('offers no third behaviour to reach for', () => {
    const behaviours = new Set(ROOM_PORTS.map((p) => p.absent));
    expect([...behaviours].sort()).toEqual(['degrade', 'refuse']);
  });
});
