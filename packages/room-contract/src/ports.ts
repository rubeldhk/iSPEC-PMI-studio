/**
 * T337q — the ports a Room requires, and what happens when one is absent.
 * `FR-RQR-002`, `FR-RQR-003`, `FR-GEL-062`, `RULE-03`.
 *
 * **Declared as data, not as prose.** The absent-behaviour of each seam is the
 * kind of rule that lives in a paragraph, gets summarised in a comment, and then
 * gets decided differently at the third call site. Here it is a value with a
 * test over it, so `EPIC-034` and `EPIC-035` inherit the reasoning rather than
 * re-deriving it — and so softening one is visibly a change to a shared file.
 *
 * **Four refuse; one degrades.** The asymmetry is the point:
 *
 *   - four of these mean *a governance guarantee cannot be evaluated*, and
 *     proceeding would be indistinguishable from the guarantee having passed;
 *   - `AgentGateway` means *the AI could not help*, and a human can still
 *     clarify, decide and baseline by hand. Refusing there would make the
 *     governed path depend on a model being reachable, which inverts `RULE-03`.
 *
 * This lives in the shared contract rather than in the Requirement Room's module
 * because all three Rooms consume the same five seams, and `EPIC-034` and
 * `EPIC-035` each reached the same conclusion independently. Three Epics
 * agreeing by accident is weaker than one place saying it.
 */

/** What a Room does when a port has no implementation bound. */
export type AbsentBehaviour = 'refuse' | 'degrade';

export interface RoomPort {
  readonly name: string;
  /** Which Epic supplies it. A seam with no named owner is one nobody is building. */
  readonly filledBy: string;
  readonly absent: AbsentBehaviour;
  /**
   * Why that behaviour is right.
   *
   * *"Refuse"* alone is a rule somebody will soften on a Friday. The reason is
   * what makes softening it arguable — and visibly a decision.
   */
  readonly because: string;
  /** For a capability-negotiated seam: which capability this Room needs. */
  readonly capability?: string;
}

export const ROOM_PORTS = Object.freeze([
  Object.freeze({
    name: 'LoopEngine',
    filledBy: 'EPIC-030',
    absent: 'refuse',
    because:
      'no transition without the loop — a Room that moved its own object would be a second ' +
      'writer of state the loop is the only writer of (FR-GEL-010)',
  }),
  Object.freeze({
    name: 'PolicyProvider',
    filledBy: 'EPIC-031',
    absent: 'refuse',
    because:
      'FR-GEL-062 — an undecided decision is not an approval, and a default that permits is ' +
      'indistinguishable at every call site from a policy that said yes (ADR-0025)',
  }),
  Object.freeze({
    name: 'EvidenceContractSource',
    filledBy: 'EPIC-032',
    absent: 'refuse',
    because:
      'FR-RQR-053 — a baseline cannot complete on an unevaluated Evidence Contract, and ' +
      'BR-0144 says declaring completion is not the evidence',
  }),
  Object.freeze({
    name: 'RequirementRegister',
    filledBy: 'EPIC-007',
    absent: 'refuse',
    because:
      'FR-RQR-002 and D-33 — this Room CONSUMES the register EPIC-007 owns and is never ' +
      'substituted by a local store. A local cache of requirement text would feel convenient ' +
      'every single day, which is why it is asserted rather than trusted',
  }),
  Object.freeze({
    name: 'AgentGateway',
    filledBy: 'EPIC-028',
    absent: 'degrade',
    capability: 'analyze',
    because:
      'the one exception, and deliberate: an absent ANALYSIS provider means the AI could not ' +
      'help, and a human can still clarify, decide and baseline by hand. Refusing would make ' +
      'the governed path depend on a model being reachable, which inverts RULE-03 — AI ' +
      'recommends; humans and policy govern',
  }),
] as const);

export type RoomPortName = (typeof ROOM_PORTS)[number]['name'];

export function absentBehaviourOf(name: RoomPortName): AbsentBehaviour {
  const port = ROOM_PORTS.find((candidate) => candidate.name === name);
  if (!port) throw new Error(`no room port named "${name}"`);
  return port.absent;
}
