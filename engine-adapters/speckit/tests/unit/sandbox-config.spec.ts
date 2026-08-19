/**
 * T089a — the sandbox manifest declares every containment control.
 *
 * This is the sole containment for RAID **R-02** (unbounded AI agent cost) and
 * a load-bearing part of **R-06** (sandbox escape / credential leakage). The
 * manifest is data, so nothing about it fails at compile time — which is
 * exactly why it needs a test that fails the build when a control is weakened.
 *
 * Every assertion here is a specific control, not a schema check.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { SANDBOX_CORRELATION_ENV } from '../../src/correlation.js';

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
  readFileSync(resolve(here, '../../docker/sandbox.json'), 'utf8'),
) as Record<string, any>;

describe('identity and privilege (R-06)', () => {
  it('runs as a non-root user', () => {
    expect(manifest['user'].nonRoot).toBe(true);
    expect(manifest['user'].uid).toBeGreaterThan(0);
  });

  it('drops all capabilities and adds none back', () => {
    expect(manifest['capabilities'].drop).toContain('ALL');
    expect(manifest['capabilities'].add).toEqual([]);
  });

  it('forbids privilege escalation', () => {
    expect(manifest['security'].noNewPrivileges).toBe(true);
    expect(manifest['security'].privileged).toBe(false);
  });

  it('applies a seccomp profile', () => {
    expect(manifest['security'].seccompProfile).toBeTruthy();
  });
});

describe('filesystem', () => {
  it('mounts the root filesystem read-only', () => {
    expect(manifest['filesystem'].readOnlyRootFilesystem).toBe(true);
  });

  it('permits exactly one writable path, and it is ephemeral', () => {
    const writable = manifest['filesystem'].writableMounts;
    expect(writable).toHaveLength(1);
    expect(writable[0].ephemeral).toBe(true);
    expect(writable[0].sizeMb).toBeGreaterThan(0);
  });
});

describe('resource limits — the containment for R-02', () => {
  it('caps CPU, memory, and process count', () => {
    expect(manifest['limits'].cpus).toBeGreaterThan(0);
    expect(manifest['limits'].memoryMb).toBeGreaterThan(0);
    expect(manifest['limits'].pids).toBeGreaterThan(0);
  });

  it('caps wall-clock time (E5, FR-025)', () => {
    // Without this an agent that hangs bills until someone notices.
    expect(manifest['limits'].wallClockSeconds).toBeGreaterThan(0);
  });

  it('sets the wall-clock ceiling to the agreed 10 minutes', () => {
    // Clarified 2026-08-07 and recorded in specs/_shared/platform-spec.md.
    // Configurable per deployment; this is the default that ships.
    expect(manifest['limits'].wallClockSeconds).toBe(600);
  });

  it('destroys the container per job (E8)', () => {
    expect(manifest['oneContainerPerJob']).toBe(true);
  });
});

describe('network egress — the containment for credential exfiltration', () => {
  it('denies egress by default', () => {
    expect(manifest['network'].egress.policy).toBe('deny-all');
  });

  it('permits exactly ONE destination', () => {
    expect(manifest['network'].egress.allow).toHaveLength(1);
  });

  it('permits only the AI provider endpoint, over TLS', () => {
    const [allowed] = manifest['network'].egress.allow;
    expect(allowed.protocol).toBe('https');
    expect(allowed.port).toBe(443);
    expect(allowed.host).toBeTruthy();
  });

  it('opens no telemetry, package-registry, or database destination', () => {
    const hosts: string[] = manifest['network'].egress.allow.map((a: { host: string }) => a.host);
    for (const forbidden of ['registry.npmjs.org', 'pypi.org', 'github.com', 'localhost', '0.0.0.0']) {
      expect(hosts).not.toContain(forbidden);
    }
  });

  it('denies ingress', () => {
    expect(manifest['network'].ingress.policy).toBe('deny-all');
  });
});

describe('environment — exhaustive, not a baseline (PC-3)', () => {
  it('permits exactly the two keys the sandbox builder returns', () => {
    expect(manifest['environment'].allowedKeys).toEqual([SANDBOX_CORRELATION_ENV, 'AI_PROVIDER_TOKEN']);
  });

  it('mounts NO platform credential', () => {
    // Anything mounted here is available to code the platform did not write.
    const allowed: string[] = manifest['environment'].allowedKeys;
    for (const secret of ['DATABASE_URL', 'REDIS_URL', 'VALKEY_URL', 'SESSION_SECRET', 'JWT_SECRET']) {
      expect(allowed).not.toContain(secret);
    }
  });
});

describe('telemetry asymmetry (PC-3, ADR-0002)', () => {
  it('emits nothing from inside the container', () => {
    // Emitting would require widening the egress allow-list above — the one
    // control standing between this container and the open internet. The
    // worker records spans from outside instead.
    expect(manifest['telemetry'].egressFromContainer).toBe(false);
  });
});
