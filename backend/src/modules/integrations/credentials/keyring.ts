/**
 * `T2173` (EPIC-039, `R-039-10`) — the `CredentialKeyring` from configuration.
 *
 * `PMI_INTEGRATION_KEYS` is JSON `{ "<keyId>": "<base64 of 32 bytes>" }` and
 * `PMI_INTEGRATION_ACTIVE_KEY` names the key new credentials are sealed with.
 * Rotation: add a key and make it active; old rows still open by their keyId.
 * Unset → no keyring → credential writes answer 503 naming the port.
 * Misconfiguration fails at boot, never at the first credential.
 * A KMS-backed keyring is a later binding of the same port.
 */
import type { CredentialKeyring } from '../integrations.tokens.js';

/** The keyring from configuration, or `null` when none is configured. Misconfiguration fails at boot. */
export function envKeyring(env: Readonly<Record<string, string | undefined>>): CredentialKeyring | null {
  const raw = env['PMI_INTEGRATION_KEYS'];
  if (raw === undefined || raw.trim() === '') return null;
  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(raw) as Record<string, string>;
  } catch {
    throw new Error('PMI_INTEGRATION_KEYS is not valid JSON ({ "<keyId>": "<base64 of 32 bytes>" }).');
  }
  const keys = new Map<string, Buffer>();
  for (const [keyId, b64] of Object.entries(parsed)) {
    const key = Buffer.from(String(b64), 'base64');
    if (key.length !== 32) throw new Error(`PMI_INTEGRATION_KEYS: key ${keyId} must be 32 bytes (AES-256), base64-encoded.`);
    keys.set(keyId, key);
  }
  const active = env['PMI_INTEGRATION_ACTIVE_KEY'] ?? '';
  if (!keys.has(active)) throw new Error(`PMI_INTEGRATION_ACTIVE_KEY "${active}" names no key in PMI_INTEGRATION_KEYS.`);
  return {
    activeKey: () => ({ keyId: active, key: keys.get(active)! }),
    key: (keyId) => keys.get(keyId) ?? null,
  };
}
