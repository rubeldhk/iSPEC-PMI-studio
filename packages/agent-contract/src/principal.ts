/**
 * T1133 (EPIC-028, C3B) — authoritative identity for non-human principals.
 *
 * Finding `Y2`: nothing in the platform could say who an agent *is*.
 * `WorkspaceBoundaryService` resolved actors only against the `users` table, so
 * the only way for an agent to cross a tenant boundary was to be registered as
 * a person. This is the contract that makes that unnecessary.
 *
 * ## The distinction this file exists to hold
 *
 * {@link AgentDescriptor} describes a **capability**: which provider, which
 * model, what it can do. It is metadata about a kind of tool.
 *
 * A {@link NonHumanPrincipal} is an **identity**: which tenant it belongs to,
 * which human sponsors it, whether it is still permitted to act. Two agents
 * running the same model are one descriptor and two principals.
 *
 * Adding `workspaceId` to a descriptor would have been the cheap move and it is
 * explicitly ruled out — a descriptor with a tenant on it is still capability
 * metadata, now carrying a field that invites it to be mistaken for identity.
 *
 * ## Eight concepts, never collapsed
 *
 * The authorisation for this step names them individually, because collapsing
 * any two is how a connector ends up able to approve its own work:
 *
 * | Concept | Held by |
 * |---|---|
 * | authenticated caller principal | `TrustedPrincipalContext` (backend only) |
 * | human user | `User` |
 * | AI agent principal | {@link NonHumanPrincipal} with `kind: 'agent'` |
 * | service principal | {@link NonHumanPrincipal} with `kind: 'service'` |
 * | connector / client registration | {@link ConnectorRegistration} |
 * | sponsoring human | `NonHumanPrincipal.sponsorUserId` |
 * | transition proposer | a snapshot id on the proposal |
 * | approver | a separate snapshot id on the approval |
 *
 * **A connector is not an agent.** It is the surface an execution arrives
 * through — a CLI, an IDE extension, a CI runner. The same agent can act
 * through several, and a connector carries no capability to propose anything on
 * its own.
 */

/** What kind of thing is acting. Humans are `User`; the rest are registered here. */
export const PRINCIPAL_KINDS = Object.freeze(['human', 'agent', 'service', 'connector'] as const);
export type PrincipalKind = (typeof PRINCIPAL_KINDS)[number];

/**
 * Whether a principal may still act.
 *
 * `suspended` and `revoked` both stop **new** privileged action. Neither
 * rewrites history: an execution recorded while active keeps its frozen
 * snapshot, because an audit trail that changes when someone is deactivated is
 * not an audit trail.
 */
export const PRINCIPAL_STATES = Object.freeze(['active', 'suspended', 'revoked'] as const);
export type PrincipalState = (typeof PRINCIPAL_STATES)[number];

export function isPrincipalKind(value: string): value is PrincipalKind {
  return (PRINCIPAL_KINDS as readonly string[]).includes(value);
}

export function isPrincipalState(value: string): value is PrincipalState {
  return (PRINCIPAL_STATES as readonly string[]).includes(value);
}

/** The surface an execution arrives through. Not an actor. */
export const CONNECTOR_KINDS = Object.freeze([
  'fixture',
  'managed-sandbox',
  'mcp-client',
  'ide-extension',
  'local-cli',
  'ci-cd',
] as const);
export type ConnectorKind = (typeof CONNECTOR_KINDS)[number];

export interface ConnectorRegistration {
  readonly connectorId: string;
  readonly workspaceId: string;
  readonly kind: ConnectorKind;
  /** The human who registered this surface — always a person. */
  readonly registeredByUserId: string;
  readonly state: PrincipalState;
  readonly registeredAt: string;
}

/**
 * A registered agent or service.
 *
 * `identityVersion` increments whenever a fact that authorisation depends on
 * changes — state, sponsor, workspace. It is what a snapshot pins, so a
 * historical decision can be re-read against the identity as it stood, and it
 * is deliberately **not** bumped by display-name or model-metadata edits.
 */
export interface NonHumanPrincipal {
  readonly principalId: string;
  readonly kind: Exclude<PrincipalKind, 'human'>;
  readonly workspaceId: string;
  /** Which capability this principal exercises — a descriptor name, not identity. */
  readonly descriptorRef: string;
  /** Mandatory. A machine may act; a person is accountable for it. */
  readonly sponsorUserId: string;
  readonly registeredByUserId: string;
  readonly state: PrincipalState;
  readonly identityVersion: number;
  readonly connectorRegistrationId?: string;
  readonly correlationId: string;
  readonly causationId: string;
  readonly registeredAt: string;
}

/**
 * A frozen identity, minted **server-side**.
 *
 * The snapshot is what separation of duties compares, so it carries the facts
 * that decision needs and nothing mutable. A caller cannot construct one and
 * cannot submit one belonging to another principal or workspace: the id is
 * resolved back through {@link IdentitySnapshotPort} and checked, never trusted
 * because it parsed.
 */
export interface PrincipalIdentitySnapshot {
  readonly snapshotId: string;
  readonly principalId: string;
  readonly kind: PrincipalKind;
  readonly workspaceId: string;
  /** The sponsoring human at capture time. `null` for a human principal. */
  readonly sponsorUserId: string | null;
  readonly identityVersion: number;
  readonly connectorRegistrationId: string | null;
  readonly capturedAt: string;
}

/** Read-only view of the registry. EPIC-024 resolves principals through this. */
export interface PrincipalRegistryPort {
  find(workspaceId: string, principalId: string): Promise<NonHumanPrincipal | null>;
  findConnector(workspaceId: string, connectorId: string): Promise<ConnectorRegistration | null>;
}

/**
 * Mints and resolves frozen identities.
 *
 * `capture` is the only way a snapshot comes into existence, and it takes a
 * principal id rather than a snapshot — a caller that could supply the snapshot
 * could supply somebody else's.
 */
export interface IdentitySnapshotPort {
  capture(workspaceId: string, principalId: string): Promise<PrincipalIdentitySnapshot>;
  resolve(snapshotId: string): Promise<PrincipalIdentitySnapshot | null>;
}

/** Why a principal may not act right now. */
export type PrincipalRefusalReason =
  | 'unknown_principal'
  | 'wrong_workspace'
  | 'suspended'
  | 'revoked'
  | 'sponsor_missing'
  | 'sponsor_left_workspace';

export interface PrincipalCheck {
  readonly permitted: boolean;
  readonly reason?: PrincipalRefusalReason;
}
