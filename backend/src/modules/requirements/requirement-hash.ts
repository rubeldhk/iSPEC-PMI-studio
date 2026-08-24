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

/**
 * T338f (`EPIC-033`) — one member of a baselined set. `R-033-5`.
 *
 * The version id identifies *which* requirement state was frozen; the content
 * hash is what makes the freeze checkable. Both, because either alone loses
 * something: ids alone cannot detect that a member's content moved, and hashes
 * alone cannot say which requirement moved.
 */
export interface BaselineMember {
  requirementVersionId: string;
  /** `requirementContentHash` of that member — never recomputed elsewhere. */
  contentHash: string;
}

/**
 * T338f (`EPIC-033`) — the content hash over a baselined **set**. `R-033-5`,
 * `FR-RQR-050`, `FR-RQR-051`.
 *
 * **Here rather than in the Requirement Room, deliberately.** `R-033-5`:
 * *"two hashing schemes over the same content would eventually disagree, and
 * the disagreement would surface as a baseline nobody can verify."* A second
 * hash function in `baseline.service.ts` would be a second scheme within a
 * month of the first edit to either.
 *
 * Three properties the callers rely on:
 *
 *   - **order-independent.** A baseline is a set. Two approvals of the same
 *     members listed in a different order must produce the same hash, or
 *     `FR-RQR-054`'s overlap detection compares hashes that differ for no
 *     reason anyone can see;
 *   - **domain-separated** from `requirementContentHash` by a prefix and a
 *     count, so a one-member set can never hash to that member's own content
 *     hash — which would let a single requirement be mistaken for the set that
 *     froze it;
 *   - **total.** It hashes exactly what it is given and refuses nothing. An
 *     empty or duplicated member set is a refusal `BaselineService` owns, at
 *     the layer that can name which member was duplicated.
 */
export function requirementSetHash(members: readonly BaselineMember[]): string {
  const ordered = [...members].sort((a, b) =>
    a.requirementVersionId < b.requirementVersionId
      ? -1
      : a.requirementVersionId > b.requirementVersionId
        ? 1
        : 0,
  );
  const hash = createHash('sha256');
  hash.update(`baseline-set:${ordered.length}:`);
  for (const member of ordered) {
    for (const part of [member.requirementVersionId, member.contentHash]) {
      hash.update(`${Buffer.byteLength(part, 'utf8')}:`);
      hash.update(part, 'utf8');
    }
  }
  return hash.digest('hex');
}
