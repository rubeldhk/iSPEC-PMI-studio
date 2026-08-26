/**
 * T993m — `@pmi/loop-contract`.
 *
 * The vendor-neutral surface `EPIC-031`–`EPIC-035` build against: the eight
 * stages, the five ports the loop requires and does not fill, and the result and
 * projection types.
 *
 * **What is deliberately not here** (`FR-GEL-060`, `FR-GEL-061`, asserted by
 * `backend/tests/architecture/loop-independence.spec.ts`): no import from any
 * Room module; no Room vocabulary in a type, field or stage name; no risk band
 * or policy type (`EPIC-031`); no evidence type beyond the `EvidenceProvider`
 * port (`EPIC-032`).
 *
 * The distinction that keeps `workflowType: 'requirement-room'` legal: the
 * contract may carry the **string**, because a tenant's configuration file is
 * data. It may not name the **concept**.
 */

export { LOOP_STAGES, isLoopStage, type LoopStage } from './stages.js';

export {
  GATE_RESULTS,
  isGateResult,
  type ActorRef,
  type AuditSink,
  type DecisionRequest,
  type DecisionResult,
  type EvidenceContractView,
  type EvidenceProvider,
  type GateOutcome,
  type GateProvider,
  type GateResult,
  type LoopObjectRef,
  type PolicyProvider,
  type StageHandler,
  type StageResult,
  type TransactionHandle,
  type TransitionAuditEntry,
  type TransitionContext,
} from './ports.js';

export {
  STAGE_STATUSES,
  TRANSITION_OUTCOMES,
  isTransitionOutcome,
  projectProgress,
  type LoopProgress,
  type ProgressInput,
  type StageStatus,
  type TransitionOutcome,
  type TransitionResult,
} from './types.js';

/**
 * Specification status-transition adjudication (`T1083`, EPIC-030 Phase C2A).
 *
 * This is the surface `EPIC-037` consumes. It is here, in the contract package,
 * for the reason the rest of this file exists: a connector or registry service
 * must be able to *propose* a transition and *read* the verdict without
 * importing a backend module — and therefore without being able to apply
 * lifecycle policy itself.
 */
export {
  ADJUDICATION_VERDICTS,
  isAdjudicationVerdict,
  type AdjudicationProposal,
  type AdjudicationVerdict,
  type AdjudicationVerdictName,
  type ApprovalAttempt,
  type LifecycleApplicationOutcome,
  type LifecycleApplicationPort,
  type ProposalAdjudicator,
  type ProposerType,
  type SpecificationStatus,
} from './adjudication.js';
