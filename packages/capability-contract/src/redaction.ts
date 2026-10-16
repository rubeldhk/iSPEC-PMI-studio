/**
 * `T2122` (EPIC-039, `FR-HUB-045`, `R-039-10`) — the platform's one list of
 * shapes that are recognisably credentials.
 *
 * **Moved here, not copied**, from `backend/src/modules/executions/sanitisation.ts`
 * (`EPIC-037` `T1043`), which now imports and re-exports this list unchanged —
 * so the execution registry and the Integration Hub can never disagree about
 * what a secret looks like. `redaction.spec.ts` asserts the identity.
 *
 * ## Why the patterns are conservative
 *
 * A false positive refuses or redacts something that was not a secret, which is
 * recoverable and visible. A false negative writes a live credential into an
 * append-only table, which is neither.
 */
export const SECRET_PATTERNS: readonly RegExp[] = Object.freeze([
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{16,}\b/, // GitHub tokens
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/, // GitHub fine-grained tokens
  /\bsk-[A-Za-z0-9-]{16,}\b/, // OpenAI-style
  /\bsk-ant-[A-Za-z0-9-]{16,}\b/, // Anthropic-style
  /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{8,}\b/, // Resend API keys
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, // Slack
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, // JWT
  /\bpostgres(?:ql)?:\/\/[^\s:]+:[^\s@]+@/, // connection string with a password
  /pmi_ct_[A-Za-z0-9_-]{20,}/, // this platform's connector credential (EPIC-041)
  /\bpmi-canary-[0-9a-f-]{8,}\b/, // EPIC-039 SC-HUB-004 canary — a test credential must look like one
]);

export function looksLikeSecret(value: string): boolean {
  return SECRET_PATTERNS.some((p) => p.test(value));
}

/**
 * The path of the first string anywhere in `value` that looks like a secret,
 * or `null`. Used to **refuse** input, binding and notification content
 * (`FR-HUB-045`) — never to redact it and carry on.
 */
export function findSecret(value: unknown, path = ''): string | null {
  if (typeof value === 'string') return looksLikeSecret(value) ? path || '(root)' : null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findSecret(value[i], path === '' ? String(i) : `${path}.${i}`);
      if (hit !== null) return hit;
    }
    return null;
  }
  if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const hit = findSecret(v, path === '' ? k : `${path}.${k}`);
      if (hit !== null) return hit;
    }
  }
  return null;
}

/** Replace every secret-shaped run in a provider message before it is stored (`FR-HUB-045`). */
export function sanitiseText(text: string): string {
  let out = text;
  for (const p of SECRET_PATTERNS) out = out.replace(new RegExp(p.source, p.flags.includes('g') ? p.flags : `${p.flags}g`), '[redacted]');
  return out;
}
