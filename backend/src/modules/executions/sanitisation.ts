import { scrubCredentialsDeep } from '../../core/errors.js';
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

/**
 * Shapes that are recognisably secrets wherever they appear.
 *
 * EPIC-048 `T2321` (`A-037-1`, `R-048-18`): each pattern carries a **name**, so a
 * refusal can say which rule matched without repeating the value
 * (`FR-LRN-018`). The patterns are unchanged; `looksLikeSecret` delegates, so
 * every existing answer is the same. Order matters only for naming: the
 * Anthropic shape is checked before the broader OpenAI one it would also match.
 */
const SECRET_RULES: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: 'private-key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9]{16,}\b/ },
  { name: 'anthropic-key', pattern: /\bsk-ant-[A-Za-z0-9-]{16,}\b/ },
  { name: 'openai-key', pattern: /\bsk-[A-Za-z0-9-]{16,}\b/ },
  { name: 'aws-access-key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'slack-token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { name: 'connection-string', pattern: /\bpostgres(?:ql)?:\/\/[^\s:]+:[^\s@]+@/ },
];

/** The rule names, for a caller that lists them. */
export const SECRET_RULE_NAMES: readonly string[] = Object.freeze(SECRET_RULES.map((r) => r.name));

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

/**
 * EPIC-048 `T2321` — the name of the first rule `value` matches, or `null`.
 * Never the value itself: a refusal that echoed it would write the secret into a
 * log, a screen and an agent transcript at once.
 */
export function secretRuleMatching(value: string): string | null {
  return SECRET_RULES.find((r) => r.pattern.test(value))?.name ?? null;
}

export function looksLikeSecret(value: string): boolean {
  return secretRuleMatching(value) !== null;
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

/**
 * EPIC-043 T1440 (`FR-PIC-036`, `FR-PIC-026`) — an audit detail for a connector
 * operation, with every credential shape replaced. The shapes are the
 * platform's own (`core/errors.ts`), so a refusal body and an audit row can
 * never disagree about what a credential looks like.
 */
export function scrubDetail(detail: Record<string, unknown>): Record<string, unknown> {
  return scrubCredentialsDeep(detail);
}
