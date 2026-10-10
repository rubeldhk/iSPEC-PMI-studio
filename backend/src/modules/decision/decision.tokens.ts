/**
 * `T737` — the decision module's injection tokens. Each port may resolve to
 * `null`: an absent port is a declared state whose behaviour is refuse.
 */
export const DECISION_REPOSITORY = Symbol('DECISION_REPOSITORY');
/** `SteeringSource` — `EPIC-019`. */
export const DECISION_STEERING_SOURCE = Symbol('DECISION_STEERING_SOURCE');
/** `GateProvider` — `EPIC-021`. Null ⇒ every required gate is a violation. */
export const DECISION_GATE_PROVIDER = Symbol('DECISION_GATE_PROVIDER');
/** `AuditSink` — `EPIC-004`. Null ⇒ every decision refuses. */
export const DECISION_AUDIT_SINK = Symbol('DECISION_AUDIT_SINK');
export const DECISION_POLICY_SOURCE = Symbol('DECISION_POLICY_SOURCE');
