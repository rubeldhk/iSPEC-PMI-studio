/**
 * `FR-EVS-013` — the digest that makes tampering or substitution detectable.
 *
 * Computed over a **canonical** JSON form (keys sorted at every depth) so that
 * the same payload digests the same way whatever order its keys arrived in, and
 * a reordering is not mistaken for a substitution.
 */
import { createHash } from 'node:crypto';
import type { IntegrityRecord } from './evidence.types.js';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

export function digestOf(value: unknown): IntegrityRecord {
  const text = JSON.stringify(canonical(value ?? null));
  return { algorithm: 'sha256', value: createHash('sha256').update(text).digest('hex') };
}

export function sameDigest(a: IntegrityRecord, b: IntegrityRecord): boolean {
  return a.algorithm === b.algorithm && a.value.toLowerCase() === b.value.toLowerCase();
}
