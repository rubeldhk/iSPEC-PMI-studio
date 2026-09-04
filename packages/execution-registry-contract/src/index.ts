/**
 * `@pmi/execution-registry-contract` — EPIC-037's governed execution registry.
 *
 * ## Why this is not `@pmi/execution-contract`
 *
 * That package already exists and belongs to **EPIC-028**. It is the *Project
 * Execution Environment* contract — container runtimes, egress profiles,
 * sessions: **where code runs**. This is about **how governed executions are
 * recorded**. Two different concepts that share an English word.
 *
 * `T1018` said to create `packages/execution-contract/`, written before that
 * package existed. Merging them would have put two unrelated meanings behind
 * one name, in a package six files already import — the same collapse this Epic
 * spends its contract avoiding between connector and agent, and between
 * descriptor and identity. Recorded as a task-list defect and decided by the
 * project owner.
 */
export {
  ALL_EVENT_TYPES,
  CONTENT_EVENTS,
  EVENT_CLASSES,
  GOVERNANCE_EVENTS,
  LIFECYCLE_EVENTS,
  REGISTRATION_EVENTS,
  TERMINAL_LIFECYCLE_EVENTS,
  WITHDRAWN_EVENT_TYPES,
  classOf,
  isExecutionEventType,
  isTerminalLifecycleEvent,
  permittedAfterTerminal,
  type ContentEventType,
  type EventClass,
  type ExecutionEventType,
  type GovernanceEventType,
  type LifecycleEventType,
  type RegistrationEventType,
  type TerminalLifecycleEventType,
} from './events.js';

export {
  EXECUTION_SURFACES,
  GOVERNED_COMMANDS,
  REGISTRY_REFUSALS,
  RegistryRefusedError,
  type AppendEventRequest,
  type AppendedEvent,
  type CompleteExecutionRequest,
  type ExecutionIdentityRefs,
  type ExecutionRegistry,
  type ExecutionSnapshot,
  type ExecutionSurface,
  type GovernedCommand,
  type InputBinding,
  type OutputBinding,
  type ProposeTransitionRequest,
  type RegisterExecutionRequest,
  type RegistryRefusal,
} from './contract.js';

export {
  FixtureConnector,
  type FixtureConnectorOptions,
  type FixtureRunResult,
} from './fixture-connector.js';

// EPIC-041 T1315 — assurance is derived from the surface, never supplied (FR-LPW-034).
export { EXECUTION_ASSURANCES, assuranceFor, type ExecutionAssurance } from './contract.js';
