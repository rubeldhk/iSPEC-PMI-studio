/**
 * T1043 (EPIC-037 Band A) — arguments are sanitised, and credentials refuse.
 *
 * `FR-EXR-022`. Two different responses, and the difference matters:
 *
 * - a value that *looks like* a secret is **redacted** — the argument is still
 *   recorded, so the history shows what shape the command had;
 * - a value that *is* a credential in a named credential field is **refused** —
 *   registration fails rather than storing a redacted placeholder, because
 *   accepting it would tell the connector its behaviour was fine.
 *
 * The redaction happens at the connector too. This is the server-side backstop:
 * a connector that forgets, or a connector nobody wrote, must not be able to put
 * a token in the audit record.
 *
 * ## Why the patterns are conservative
 *
 * A false positive redacts an argument that was not a secret, which is
 * recoverable and visible. A false negative writes a live credential into an
 * append-only table, which is neither. So the patterns lean towards redacting.
 */

export const REDACTED = '[redacted]';

/** Field names whose *presence* is refused outright, whatever the value. */
const CREDENTIAL_FIELDS = [
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'accesskey',
  'access_key',
  'privatekey',
  'private_key',
  'clientsecret',
  'client_secret',
  'authorization',
  'credential',
  'credentials',
];

/** Shapes that are recognisably secrets wherever they appear. */
const SECRET_PATTERNS: readonly RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{16,}\b/, // GitHub tokens
  /\bsk-[A-Za-z0-9-]{16,}\b/, // OpenAI-style
  /\bsk-ant-[A-Za-z0-9-]{16,}\b/, // Anthropic-style
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, // Slack
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, // JWT
  /\bpostgres(?:ql)?:\/\/[^\s:]+:[^\s@]+@/, // connection string with a password
];

export class CredentialDetectedError extends Error {
  constructor(readonly field: string) {
    super(
      `Refusing to register: "${field}" looks like a credential. ` +
        'Arguments are recorded in an append-only table, so a secret written here cannot be ' +
        'removed afterwards.',
    );
    this.name = 'CredentialDetectedError';
  }
}

function isCredentialField(key: string): boolean {
  const normalised = key.toLowerCase().replace(/[^a-z_]/g, '');
  return CREDENTIAL_FIELDS.some((f) => normalised.includes(f.replace(/[^a-z_]/g, '')));
}

export function looksLikeSecret(value: string): boolean {
  return SECRET_PATTERNS.some((p) => p.test(value));
}

/**
 * Sanitise one argument object.
 *
 * Recurses, because a credential nested two levels down is still a credential
 * and a shallow pass would be a guard that looks like protection.
 */
export function sanitiseArgs(args: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (isCredentialField(key)) {
      // A named credential field is refused rather than redacted: storing a
      // placeholder would tell the connector its behaviour was acceptable.
      throw new CredentialDetectedError(key);
    }
    if (typeof value === 'string') {
      out[key] = looksLikeSecret(value) ? REDACTED : value;
      continue;
    }
    if (Array.isArray(value)) {
      out[key] = value.map((v) =>
        typeof v === 'string' && looksLikeSecret(v)
          ? REDACTED
          : v !== null && typeof v === 'object'
            ? sanitiseArgs(v as Record<string, unknown>)
            : v,
      );
      continue;
    }
    if (value !== null && typeof value === 'object') {
      out[key] = sanitiseArgs(value as Record<string, unknown>);
      continue;
    }
    out[key] = value;
  }
  return out;
}
