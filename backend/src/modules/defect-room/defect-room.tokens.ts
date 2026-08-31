/**
 * `T997p` (EPIC-035) — the Room's nine ports, and what each absence means.
 *
 * Eight **refuse**; one **degrades**. The asymmetry is the design rather than
 * an oversight, and `T997o` asserts it rather than assuming it — it is exactly
 * the kind of table a later reader tidies into consistency, and tidying it
 * either way breaks something.
 *
 * ## Why `TestExecution` refuses
 *
 * The row most likely to be got wrong kindly. A fix arrives, the port is
 * unbound, and letting it through feels reasonable: the runner is not this
 * Epic's fault, and blocking every repair on an absent dependency is punitive.
 *
 * `FR-DFR-041` settles it. *"We could not check"* is not *"there is a test"*.
 * An unbound runner means nothing has demonstrated the defect, and accepting
 * anyway writes a record saying something did. `FR-DFR-062`: absence yields
 * refusal and **never a pass**.
 *
 * ## Why only `AgentGateway` degrades
 *
 * `FR-DFR-023`: an agent MAY triage and propose a classification; it MUST NOT
 * confirm a defect or authorise a fix. An absent agent means nobody proposed —
 * which a human can proceed without, because they were always the one who had
 * to confirm. Every other absence means a governed step did not happen.
 */

export type AbsentBehaviour = 'refuse' | 'degrade';

export interface DefectRoomPort {
  readonly name: string;
  readonly filledBy: string;
  readonly absent: AbsentBehaviour;
  /** Why this absence behaves as it does. Asserted by `T997o`. */
  readonly because: string;
}

export const DEFECT_ROOM_PORTS: readonly DefectRoomPort[] = Object.freeze([
  Object.freeze({
    name: 'LoopEngine',
    filledBy: 'EPIC-030',
    absent: 'refuse' as const,
    because:
      'FR-DFR-001 — this Room is a distinct configured workflow type of the governed loop. ' +
      'Without the engine a defect is not governed at all, and an ungoverned defect that looked ' +
      'triaged is the failure the whole Room exists to prevent',
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
    name: 'EvidenceStore',
    filledBy: 'EPIC-032',
    absent: 'refuse' as const,
    because:
      'FR-DFR-032, FR-DFR-033, BR-0062 — reproduction evidence is readable only under the access ' +
      'rules of the artifact it concerns. With no store bound there is nowhere to put it that ' +
      'honours those rules, and a Room-local copy would honour this Room’s rules instead',
  }),
  Object.freeze({
    name: 'BaselineReader',
    filledBy: 'EPIC-033',
    absent: 'refuse' as const,
    because:
      'FR-DFR-020 — a defect is classified against approved expected behaviour. With no baseline ' +
      'readable there is no approved behaviour to judge against, and classifying anyway is the ' +
      'opinion the requirement exists to refuse',
  }),
  Object.freeze({
    name: 'ChangeIntake',
    filledBy: 'EPIC-034',
    absent: 'refuse' as const,
    because:
      'FR-DFR-074, BR-0057 — a change-request outcome transfers to the Change Room. With no ' +
      'intake bound the transfer has nowhere to arrive, and recording it as routed would leave ' +
      'the defect saying somebody else has it while nobody does',
  }),
  Object.freeze({
    name: 'RequirementIntake',
    // `T997d`, re-confirmed 2026-08-31: `T338v` landed and the route is mounted.
    // The port became an integration; the refusal is what happens until it is
    // bound in a given deployment, not a statement that nobody owns it.
    filledBy: 'EPIC-033 (POST /rooms/requirement/gap-intake, T338v)',
    absent: 'refuse' as const,
    because:
      'FR-DFR-022, FR-DFR-077 — a requirement-gap outcome routes to the Requirement Room. A gap ' +
      'held here would be a defect record standing in for a requirement nobody wrote, and the ' +
      'gap would never reach the people who decide what the behaviour should be',
  }),
  Object.freeze({
    name: 'TestExecution',
    // `R-035-1`, re-confirmed 2026-08-31: no callable test-execution surface
    // exists anywhere in the programme. Naming an owner that does not exist
    // would be worse than naming none.
    filledBy: 'unowned — no callable test-execution surface exists (R-035-1)',
    absent: 'refuse' as const,
    because:
      'FR-DFR-041, FR-DFR-062 — a fix submitted with no failing test on record must not be ' +
      'accepted, and "we could not check" is not "there is a test". An unbound runner means ' +
      'nothing demonstrated the defect; accepting anyway records that something did. Absence ' +
      'yields refusal and never a pass',
  }),
  Object.freeze({
    name: 'RepairTaskPort',
    filledBy: 'unowned — TaskRecord has no provenance field (R-035-3, EPIC-012)',
    absent: 'refuse' as const,
    because:
      'FR-DFR-090 — a confirmed defect becomes traceable repair work. With no port bound the ' +
      'repair task cannot carry where it came from, and a repair task with no provenance is ' +
      'indistinguishable from ordinary work nobody can trace to the defect it fixes',
  }),
  Object.freeze({
    name: 'AgentGateway',
    filledBy: 'EPIC-028',
    absent: 'degrade' as const,
    because:
      'FR-DFR-023 — an agent MAY triage and propose a classification; it MUST NOT confirm a ' +
      'defect or authorise a fix. An absent agent means nobody proposed one, which a human can ' +
      'proceed without, because they were always the one who had to confirm it',
  }),
] as const);

export const LOOP_ENGINE = Symbol('DEFECT_ROOM_LOOP_ENGINE');
export const POLICY_PROVIDER = Symbol('DEFECT_ROOM_POLICY_PROVIDER');
export const EVIDENCE_STORE = Symbol('DEFECT_ROOM_EVIDENCE_STORE');
export const BASELINE_READER = Symbol('DEFECT_ROOM_BASELINE_READER');
export const CHANGE_INTAKE = Symbol('DEFECT_ROOM_CHANGE_INTAKE');
export const REQUIREMENT_INTAKE = Symbol('DEFECT_ROOM_REQUIREMENT_INTAKE');
export const TEST_EXECUTION = Symbol('DEFECT_ROOM_TEST_EXECUTION');
export const REPAIR_TASK_PORT = Symbol('DEFECT_ROOM_REPAIR_TASK_PORT');
export const AGENT_GATEWAY = Symbol('DEFECT_ROOM_AGENT_GATEWAY');

/**
 * The store seam. Not a port: the nine above are collaborators other Epics
 * fill, and this one is persistence, which `EPIC-035` owns.
 */
export const DEFECT_ROOM_STORE = Symbol('DEFECT_ROOM_STORE');

/**
 * The behaviour a named port takes when unbound, or `null` if nobody declared
 * it.
 *
 * `null` rather than a default: answering `degrade` for an unknown name would
 * make every unlisted seam permissive, which is `FR-GEL-062`'s objection
 * arriving through the lookup function.
 */
export function absentBehaviourOf(name: string): AbsentBehaviour | null {
  return DEFECT_ROOM_PORTS.find((port) => port.name === name)?.absent ?? null;
}
