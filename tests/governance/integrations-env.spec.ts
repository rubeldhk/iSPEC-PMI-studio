/**
 * `T2106` (EPIC-039, `R-039-8`, `R-039-10`, `FR-HUB-084`) — the Integration Hub's
 * deployment variables are documented, and none ships a real-looking key.
 *
 * `PMI_ENVIRONMENT` is new and REQUIRED (the module refuses to start without
 * it); an operator learns that from `.env.example` or not at all. The keyring
 * variables hold the keys that encrypt every adapter credential, so a sample
 * that looked like a key would be copied into a deployment.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './helpers';

const example = readFileSync(join(REPO_ROOT, '.env.example'), 'utf8');
const VARIABLES = ['PMI_ENVIRONMENT', 'PMI_INTEGRATION_KEYS', 'PMI_INTEGRATION_ACTIVE_KEY', 'PMI_INTEGRATION_SCHEDULER', 'PMI_EMBED_ADAPTER', 'PMI_EMBED_BINDING'] as const;

describe('T2106 · the Integration Hub variables are documented', () => {
  it.each(VARIABLES)('%s is documented in .env.example with an explanation', (name) => {
    expect(example, `${name} is not in .env.example`).toMatch(new RegExp(`^#?\\s*${name}=`, 'm'));
    expect(example, `${name} has no explanation`).toMatch(new RegExp(`^# ${name}\\s+\\S`, 'm'));
  });

  it('sets PMI_ENVIRONMENT to one of the four environments', () => {
    expect(/^PMI_ENVIRONMENT=(local|dev|stage|prod)$/m.test(example)).toBe(true);
  });

  it('ships no real-looking key: no base64 run of 32 bytes or more anywhere in the keyring lines', () => {
    const keyLines = example.split('\n').filter((l) => /PMI_INTEGRATION_KEYS|PMI_INTEGRATION_ACTIVE_KEY/.test(l));
    expect(keyLines.length).toBeGreaterThan(0);
    for (const line of keyLines) expect(line, line).not.toMatch(/[A-Za-z0-9+/]{43}=/);
    expect(example).not.toMatch(/^PMI_INTEGRATION_KEYS=/m);
  });

  it('would notice a real-looking key (the matcher is not vacuous)', () => {
    expect('PMI_INTEGRATION_KEYS={"k1":"q83vEjRWeJASNFZ4kBI0VniQEjRWeJASNFZ4kBI0VnA="}').toMatch(/[A-Za-z0-9+/]{43}=/);
  });
});
