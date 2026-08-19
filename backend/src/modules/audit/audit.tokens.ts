/**
 * T674 — injection tokens for the audit layer.
 *
 * Separate from `audit.module.ts` so the controller can name the token it needs
 * without importing the module that registers the controller. A file that
 * exported both would be a cycle.
 */

/** The persistence adapter that writes audit rows. */
export const AUDIT_WRITER = Symbol('AUDIT_WRITER');

/** The read side of `/v1/audit`. */
export const AUDIT_READER = Symbol('AUDIT_READER');
