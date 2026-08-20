/**
 * T069 — content hashing for later out-of-date detection (FR-032 seam).
 *
 * The hash covers the MATERIAL fields — description, type, priority — after
 * whitespace normalisation, so an incidental re-space of the text does not
 * flag every derived specification, while any change of meaning-bearing
 * content does. Casing is preserved: "SHALL" vs "shall" can be a real change
 * in requirement language.
 *
 * Fields are length-delimited before hashing so no concatenation of two
 * values can collide with another split of the same characters.
 *
 * Framework-free (PC-1).
 */
import { createHash } from 'node:crypto';

export interface HashableRequirement {
  description: string;
  type: string;
  priority: string;
}

/** Collapse all runs of whitespace (spaces, tabs, newlines) to single spaces. */
function normalise(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

export function requirementContentHash(fields: HashableRequirement): string {
  const parts = [normalise(fields.description), fields.type, fields.priority];
  const hash = createHash('sha256');
  for (const part of parts) {
    hash.update(`${Buffer.byteLength(part, 'utf8')}:`);
    hash.update(part, 'utf8');
  }
  return hash.digest('hex');
}
