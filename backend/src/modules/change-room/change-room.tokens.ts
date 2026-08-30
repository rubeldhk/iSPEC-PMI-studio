/**
 * `T406q` (EPIC-034) — the Room's ports, and what each absence means.
 *
 * Six seams, and the interesting thing is that they do not all behave the same
 * way when unbound. Five **refuse**; one **degrades**. The asymmetry is the
 * design rather than an oversight, and `T406p` asserts it rather than assuming
 * it — it is exactly the kind of thing a later reader tidies into consistency.
 *
 * ## Why five refuse
 *
 * `FR-GEL-062`'s reasoning: *a default that permits is invisible* — at every
 * call site it looks exactly like a policy that said yes. An unbound
 * `PolicyProvider` means nobody authorised the change; an unbound
 * `EvidenceContractSource` means nothing proved it; an unbound `BaselineReader`
 * means the change has no target; an unbound `LoopEngine` means it is not
 * governed at all. Proceeding through any of those is not a degraded answer, it
 * is a wrong one.
 *
 * ## Why `ImpactSource` degrades
 *
 * `FR-CHR-032`. An unbound impact source means nobody could see the blast
 * radius — a fact a decision-maker can weigh, provided they are told. It
 * degrades to `unknown` with a reason, and `unknown` is deliberately not
 * `not-impacted`. Refusing instead would make a dependency-graph outage block
 * every change, including urgent ones the outage has nothing to do with.
 *
 * `TransferIntake` refuses too: a change arriving from `EPIC-035` with nowhere
 * to record where it came from would lose its provenance silently.
 */

/** What a port does when nothing is bound to it. */
export type AbsentBehaviour = 'refuse' | 'degrade';

export interface ChangeRoomPort {
  readonly name: string;
  readonly filledBy: string;
  readonly absent: AbsentBehaviour;
  /** Why this absence behaves as it does. Asserted by `T406p`. */
  readonly because: string;
}

export const CHANGE_ROOM_PORTS: readonly ChangeRoomPort[] = Object.freeze([
  Object.freeze({
    name: 'LoopEngine',
    filledBy: 'EPIC-030',
    absent: 'refuse' as const,
    because:
      'FR-CHR-001 — this Room is a distinct configured workflow type of the governed loop. ' +
      'Without the engine a change is not governed at all, and an ungoverned change that ' +
      'looked approved is the failure the whole Room exists to prevent',
  }),
  Object.freeze({
    name: 'PolicyProvider',
    filledBy: 'EPIC-031',
    absent: 'refuse' as const,
    because:
      'FR-GEL-062 — an undecided decision is not an approval, and a default that permits is ' +
      'indistinguishable at every call site from a policy that said yes',
  }),
  Object.freeze({
    name: 'EvidenceContractSource',
    filledBy: 'EPIC-032',
    absent: 'refuse' as const,
    because:
      'BR-0144 — declaring completion is not the evidence, and an unevaluated Contract is not ' +
      'a satisfied one',
  }),
  Object.freeze({
    name: 'BaselineReader',
    filledBy: 'EPIC-033',
    absent: 'refuse' as const,
    because:
      'FR-CHR-010 — a change is always AGAINST a baseline. With no reader there is no target ' +
      'version to freeze, and a change with no baseline is not a change',
  }),
  Object.freeze({
    name: 'ImpactSource',
    filledBy: 'EPIC-020',
    absent: 'degrade' as const,
    because:
      'FR-CHR-032 — the one exception, and deliberate: an absent impact source means nobody ' +
      'could see the blast radius, which a decision-maker can weigh if told. It degrades to ' +
      'unknown and never to not-impacted, and refusing would let a graph outage block every change',
  }),
  Object.freeze({
    name: 'TransferIntake',
    filledBy: 'EPIC-035',
    absent: 'refuse' as const,
    because:
      'a change transferred from the Defect Room with nowhere to record where it came from ' +
      'would lose its provenance silently, which is worse than refusing the transfer',
  }),
] as const);

export const LOOP_ENGINE = Symbol('CHANGE_ROOM_LOOP_ENGINE');
export const POLICY_PROVIDER = Symbol('CHANGE_ROOM_POLICY_PROVIDER');
export const EVIDENCE_CONTRACT_SOURCE = Symbol('CHANGE_ROOM_EVIDENCE_CONTRACT_SOURCE');
export const BASELINE_READER = Symbol('CHANGE_ROOM_BASELINE_READER');
export const IMPACT_SOURCE = Symbol('CHANGE_ROOM_IMPACT_SOURCE');
export const TRANSFER_INTAKE = Symbol('CHANGE_ROOM_TRANSFER_INTAKE');

/** The behaviour a named port takes when unbound, or `null` if nobody declared it. */
export function absentBehaviourOf(name: string): AbsentBehaviour | null {
  return CHANGE_ROOM_PORTS.find((port) => port.name === name)?.absent ?? null;
}
