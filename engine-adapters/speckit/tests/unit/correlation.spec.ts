/**
 * T161 — correlation across the sandbox boundary.
 * Written to FAIL before T162 exists (Constitution V).
 *
 * PC-3 asymmetry: the id goes IN as an environment variable — free, and no
 * change to the security contract. Telemetry does NOT come out; the worker
 * records on the container's behalf. Getting telemetry out would mean widening
 * the egress allow-list and weakening ADR-0002.
 */
import { describe, expect, it } from 'vitest';
import { SANDBOX_CORRELATION_ENV, buildSandboxEnvironment } from '../../src/correlation.js';

const CID = '7f1c6a2e-9b3d-4a5e-8c1f-2d3e4f5a6b7c';

describe('buildSandboxEnvironment()', () => {
  it('passes the correlation id in as an environment variable', () => {
    const env = buildSandboxEnvironment({ correlationId: CID, aiProviderToken: 'sk-secret' });
    expect(env[SANDBOX_CORRELATION_ENV]).toBe(CID);
  });

  it('passes the AI provider credential and NOTHING else from the platform', () => {
    const env = buildSandboxEnvironment({
      correlationId: CID,
      aiProviderToken: 'sk-secret',
    });
    // ADR-0002: no platform credential is mounted — no database URL, no session
    // secret. The agent gets exactly one credential, for one endpoint.
    const keys = Object.keys(env).sort();
    expect(keys).toEqual(['AI_PROVIDER_TOKEN', SANDBOX_CORRELATION_ENV].sort());
    expect(keys).not.toContain('DATABASE_URL');
    expect(keys).not.toContain('REDIS_URL');
  });

  it('refuses a malformed correlation id', () => {
    expect(() =>
      buildSandboxEnvironment({ correlationId: 'nope', aiProviderToken: 'sk' }),
    ).toThrow(/correlation/i);
  });

  it('refuses to build an environment with no credential', () => {
    expect(() => buildSandboxEnvironment({ correlationId: CID, aiProviderToken: '' })).toThrow(
      /credential/i,
    );
  });

  it('does not provide any outbound telemetry endpoint (PC-3)', () => {
    // If the sandbox could emit telemetry, egress would have to widen. It
    // cannot, and this asserts the design stays that way.
    const env = buildSandboxEnvironment({ correlationId: CID, aiProviderToken: 'sk' });
    for (const k of Object.keys(env)) {
      expect(k).not.toMatch(/OTEL|OTLP|TELEMETRY|COLLECTOR/i);
    }
  });
});
