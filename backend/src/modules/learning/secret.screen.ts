/**
 * `T2329` (EPIC-048, `FR-LRN-018`, `R-048-18`) — screen a submission for secrets
 * before anything else happens to it.
 *
 * The detection is `EPIC-037`'s (`secretRuleMatching`, `A-037-1`) — the same
 * patterns execution events are screened with (`BR-0173`). This file decides
 * only **what** is screened (every string in the body, wherever it sits) and how
 * a match is refused: naming the rule and the field, never the value.
 *
 * Framework-free (PC-1).
 */
import { ValidationFailedError } from '../../core/errors.js';
import { secretRuleMatching } from '../executions/sanitisation.js';
import type { SecretScreenPort } from './learning.tokens.js';

/** Every string leaf of `value`, keyed by its path (`confidence.basis`, `evidence[0].evidenceId`). */
export function stringFields(value: unknown, path = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof value === 'string') {
    out[path || '(body)'] = value;
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => Object.assign(out, stringFields(v, `${path}[${i}]`)));
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      Object.assign(out, stringFields(v, path === '' ? k : `${path}.${k}`));
    }
  }
  return out;
}

/** The `SecretScreen` port over `EPIC-037`'s named rules. */
export function secretScreenPort(): SecretScreenPort {
  return {
    async screen(fields) {
      for (const [field, value] of Object.entries(fields)) {
        const rule = secretRuleMatching(value);
        if (rule !== null) return { rule, field };
      }
      return null;
    },
  };
}

/** Refuse a body that carries a secret anywhere. Throws; returns nothing on a clean body. */
export async function assertNoSecret(port: SecretScreenPort, body: unknown): Promise<void> {
  const match = await port.screen(stringFields(body));
  if (match === null) return;
  throw new ValidationFailedError(
    `Refused: the field "${match.field}" matches the secret rule "${match.rule}". Nothing was stored — ` +
      'candidates are append-only, so a secret written there could never be removed (FR-LRN-018).',
    { rule: match.rule, field: match.field },
  );
}
