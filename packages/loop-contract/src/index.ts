/**
 * T925 — `@pmi/loop-contract`.
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
