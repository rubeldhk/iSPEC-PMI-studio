/**
 * `T2107` (EPIC-039) — the vocabulary is closed and is a document, not names
 * spread across callers (`FR-HUB-003`, `FR-HUB-010`, `R-039-12`, `FR-HUB-084`).
 *
 * Written to FAIL before `T2108`.
 */
import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_NAMES,
  CAPABILITY_SCOPES,
  HTTP_CALLERS,
  PLATFORM_CALLERS,
  PLATFORM_ENVIRONMENTS,
  acceptsOverHttp,
  isCapabilityName,
  isPlatformCaller,
} from '../src/vocabulary.js';

describe('T2107 · the v1 vocabulary', () => {
  it('is exactly the five capabilities of FR-HUB-010, in order', () => {
    expect([...CAPABILITY_NAMES]).toEqual(['ReadRepository', 'ReadBuildStatus', 'ReadTestResults', 'SendNotification', 'Embed']);
    expect(Object.isFrozen(CAPABILITY_NAMES)).toBe(true);
  });

  it('refuses a name outside it — and is not simply refusing everything', () => {
    expect(isCapabilityName('ReadSecrets')).toBe(false);
    expect(isCapabilityName('readrepository')).toBe(false);
    for (const n of CAPABILITY_NAMES) expect(isCapabilityName(n)).toBe(true);
  });

  it('makes Embed the only deployment-scoped capability (FR-HUB-084)', () => {
    const deployment = CAPABILITY_NAMES.filter((n) => CAPABILITY_SCOPES[n] === 'deployment');
    expect(deployment).toEqual(['Embed']);
  });
});

describe('T2107 · platform callers (R-039-12, FR-HUB-004)', () => {
  it('is the closed list of platform-side callers', () => {
    expect([...PLATFORM_CALLERS]).toEqual([
      'room:requirement',
      'room:change',
      'room:defect',
      'loop',
      'context-assembly',
      'evidence-intake',
      'notification-dispatch',
    ]);
  });

  it('contains no connector, no agent and no surface', () => {
    for (const c of PLATFORM_CALLERS) {
      expect(c).not.toMatch(/connector|agent|mcp|local-cli|ide-extension|ci-cd|sandbox|pmi-studio/i);
    }
    expect(isPlatformCaller('pmi-studio')).toBe(false);
    expect(isPlatformCaller('local-agent')).toBe(false);
  });

  it('accepts only room:* over HTTP (analysis U1 — T2242)', () => {
    expect([...HTTP_CALLERS]).toEqual(['room:requirement', 'room:change', 'room:defect']);
    expect(acceptsOverHttp('evidence-intake')).toBe(false);
    expect(acceptsOverHttp('loop')).toBe(false);
    expect(acceptsOverHttp('room:change')).toBe(true);
  });
});

describe('T2107 · environments (R-039-8)', () => {
  it('is the promotion pipeline, and nothing else', () => {
    expect([...PLATFORM_ENVIRONMENTS]).toEqual(['local', 'dev', 'stage', 'prod']);
  });
});
