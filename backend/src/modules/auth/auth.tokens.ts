/**
 * Injection tokens for the auth module's replaceable ports (T024/T025).
 *
 * In their own file for the same reason `audit.tokens.ts` is: the module and
 * the controller both need them, and importing the module from the controller
 * would be a cycle.
 */
export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');
export const USER_DIRECTORY = Symbol('USER_DIRECTORY');
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
