/**
 * T548, T578, T579, T580 — the refusals.
 *
 * `generation` is frozen (SC-AGT-005); `implementation` enumerates explicitly
 * (FR-AGT-011); a provider that cannot enforce a policy must not accept one; and
 * a credential must never travel as a value.
 */
import { describe, expect, it } from 'vitest';
import {
  GENERATION_EGRESS_PROFILE,
  IMPLEMENTATION_EGRESS_PROFILE,
} from '../../src/profiles.js';
import {
  assertCredentialRef,
  assertEgressProfile,
  assertLifecycleSupported,
  assertNoSecretsInEnv,
  assertProviderCanEnforce,
  PolicyRefusedError,
} from '../../src/validation.js';
import type { EgressProfile, ExecutionEnvironmentDescriptor } from '../../src/index.js';

const CAPABLE: ExecutionEnvironmentDescriptor = {
  provider: 'docker',
  supportedLifecycles: ['ephemeral'],
  supportsPersistentState: false,
  supportsNetworkPolicy: true,
  maxWallClockMs: 900_000,
};

const FUTURE = new Date(Date.now() + 3_600_000).toISOString();

describe('T548 · the generation profile is frozen (SC-AGT-005)', () => {
  it('permits exactly the AI provider endpoint, matching ADR-0002', () => {
    // Sourced from engine-adapters/speckit/docker/sandbox.json, which
    // sandbox-config.spec.ts has asserted since EPIC-003.
    expect(GENERATION_EGRESS_PROFILE.allowedDestinations).toEqual(['api.anthropic.com']);
  });

  it('is frozen at runtime, so nothing can widen it in place', () => {
    expect(Object.isFrozen(GENERATION_EGRESS_PROFILE)).toBe(true);
    expect(() => {
      (GENERATION_EGRESS_PROFILE.allowedDestinations as string[]).push('registry.npmjs.org');
    }).toThrow();
  });

  it('opens no registry, telemetry, or repository destination', () => {
    for (const forbidden of ['registry.npmjs.org', 'pypi.org', 'github.com', 'localhost']) {
      expect(GENERATION_EGRESS_PROFILE.allowedDestinations).not.toContain(forbidden);
    }
  });
});

describe('T578 · the implementation profile enumerates explicitly (FR-AGT-011)', () => {
  it('ships deliberately minimal — one destination (R-028-6)', () => {
    // A guessed npm/PyPI/GitHub list would be untested, would read as
    // authoritative, and would be inherited as settled.
    expect(IMPLEMENTATION_EGRESS_PROFILE.allowedDestinations).toHaveLength(1);
  });

  it('records the proxy as the intended enforcement (D-28)', () => {
    expect(IMPLEMENTATION_EGRESS_PROFILE.enforcement).toBe('proxy');
  });

  it('contains zero wildcards (SC-AGT-006)', () => {
    expect(() => assertEgressProfile(IMPLEMENTATION_EGRESS_PROFILE)).not.toThrow();
  });
});

describe('T578 · general internet access is refused, in every form it takes', () => {
  const profile = (dest: string): EgressProfile => ({
    name: 'probe',
    allowedDestinations: [dest],
    enforcement: 'network-policy',
  });

  it.each(['*', '**', '0.0.0.0/0', '::/0', 'any', 'ALL', ' 0/0 '])('refuses %s', (dest) => {
    expect(() => assertEgressProfile(profile(dest))).toThrow(PolicyRefusedError);
  });

  it('refuses an empty destination list', () => {
    // An empty list reads as "no restriction" to a careless implementation.
    expect(() =>
      assertEgressProfile({ name: 'p', allowedDestinations: [], enforcement: 'proxy' }),
    ).toThrow(/no destinations/i);
  });

  it('names the offending destination, so an operator can act', () => {
    expect(() => assertEgressProfile(profile('0.0.0.0/0'))).toThrow(/0\.0\.0\.0\/0/);
  });
});

describe('T579 · a provider that cannot enforce must not accept a profile', () => {
  it('refuses when supportsNetworkPolicy is false', () => {
    // Otherwise a security control silently does nothing (ADR-0002).
    const incapable = { ...CAPABLE, provider: 'fixture', supportsNetworkPolicy: false };
    expect(() => assertProviderCanEnforce(incapable, GENERATION_EGRESS_PROFILE)).toThrow(
      /silently does nothing/,
    );
  });

  it('accepts when the provider declares support', () => {
    expect(() => assertProviderCanEnforce(CAPABLE, GENERATION_EGRESS_PROFILE)).not.toThrow();
  });

  it('refuses a lifecycle the provider does not support', () => {
    expect(() =>
      assertLifecycleSupported(CAPABLE, {
        kind: 'persistent',
        projectRef: 'r',
        mode: 'read-only',
        branch: 'main',
      }),
    ).toThrow(/does not support a persistent workspace/);
  });
});

describe('T580 · credentials are refs, scoped, and short-lived (D-27)', () => {
  it('accepts a scoped ref with an expiry', () => {
    expect(() =>
      assertCredentialRef({ id: 'c1', purpose: 'ai-provider', scope: 'anthropic', expiresAt: FUTURE }),
    ).not.toThrow();
  });

  it('refuses a ref with no expiry', () => {
    expect(() =>
      assertCredentialRef({ id: 'c1', purpose: 'ai-provider', scope: 'anthropic', expiresAt: '' }),
    ).toThrow(/no expiry/);
  });

  it('refuses an unparseable expiry', () => {
    expect(() =>
      assertCredentialRef({ id: 'c1', purpose: 'repository', scope: 'r', expiresAt: 'soon' }),
    ).toThrow(/unparseable expiry/);
  });

  it('refuses an unscoped ref', () => {
    expect(() =>
      assertCredentialRef({ id: 'c1', purpose: 'repository', scope: '', expiresAt: FUTURE }),
    ).toThrow(/unscoped/);
  });

  it('refuses a credential value flattened into an environment variable', () => {
    // The point of the ref type is that the secret never travels in the request.
    const refs = [{ id: 'sk-live', purpose: 'ai-provider' as const, scope: 's', expiresAt: FUTURE }];
    expect(() => assertNoSecretsInEnv({ AI_TOKEN: 'sk-live' }, refs)).toThrow(/AI_TOKEN/);
  });

  it('permits an environment carrying no credential value', () => {
    const refs = [{ id: 'sk-live', purpose: 'ai-provider' as const, scope: 's', expiresAt: FUTURE }];
    expect(() => assertNoSecretsInEnv({ CORRELATION_ID: 'abc' }, refs)).not.toThrow();
  });
});
