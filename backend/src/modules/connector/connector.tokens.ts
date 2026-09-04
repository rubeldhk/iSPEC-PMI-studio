/**
 * EPIC-041 — DI tokens for the connector module, in their own file so the
 * guard and the module can both name them without importing each other.
 */
export const CONNECTOR_CREDENTIAL_STORE = Symbol('CONNECTOR_CREDENTIAL_STORE');
