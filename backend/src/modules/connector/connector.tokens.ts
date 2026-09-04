/**
 * EPIC-041 — DI tokens for the connector module, in their own file so the
 * guard and the module can both name them without importing each other.
 */
export const CONNECTOR_CREDENTIAL_STORE = Symbol('CONNECTOR_CREDENTIAL_STORE');

/** EPIC-043 T1449 — the workstation connection store (R-043-8). */
export const WORKSTATION_CONNECTION_STORE = Symbol('WORKSTATION_CONNECTION_STORE');
/** The platform API version `pmi.health` answers with; the `/v1` prefix is the contract's own (D-8). */
export const API_VERSION = 'v1';
