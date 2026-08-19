/**
 * T550, T552 — the agent contract's shape and its pre-flight refusals.
 *
 * Descriptor completeness is asserted because Native §7 names the fields and a
 * descriptor missing `supportsMcp` or `securityClassification` is a descriptor
 * the orchestrator cannot negotiate against.
 */
import { describe, expect, it } from 'vitest';
import {
  AGENT_CAPABILITIES,
  AGENT_FAILURE_REASONS,
  ContextLimitExceededError,
  MissingAgentCapabilityError,
  agentFail,
  agentOk,
  assertAgentCapabilities,
  assertContextFits,
  isAgentFailure,
  type AgentDescriptor,
} from '../../src/index.js';

const descriptor: AgentDescriptor = {
  name: 'fixture',
  provider: 'fixture',
  model: 'fixture-1',
  executionType: 'headless',
  capabilities: ['execute', 'generate'],
  contextLimitTokens: 1000,
  toolCapabilities: [],
  supportsMcp: false,
  repositoryCapabilities: ['read'],
  securityClassification: 'internal',
  supportsUnattended: true,
  specKitIntegrationName: 'fixture',
};

describe('T550 · result narrowing', () => {
  it('carries provenance on success', () => {
    const r = agentOk({ exitCode: 0, stdout: 'ok' }, descriptor);
    expect(isAgentFailure(r)).toBe(false);
    if (!isAgentFailure(r)) expect(r.producedBy.provider).toBe('fixture');
  });

  it('narrows a failure to a named reason', () => {
    const r = agentFail('agent_unavailable', 'unreachable');
    expect(isAgentFailure(r)).toBe(true);
    if (isAgentFailure(r)) expect(r.failure.reason).toBe('agent_unavailable');
  });

  it('omits diagnostics unless supplied (PC-3)', () => {
    const r = agentFail('agent_error', 'msg');
    expect(isAgentFailure(r) && 'diagnostics' in r.failure).toBe(false);
  });
});

describe('T550 · the failure taxonomy has no generic fallback', () => {
  it('contains no `unknown`', () => {
    expect(AGENT_FAILURE_REASONS).not.toContain('unknown');
  });

  it('is free of duplicates', () => {
    expect(new Set(AGENT_FAILURE_REASONS).size).toBe(AGENT_FAILURE_REASONS.length);
  });

  it('distinguishes cancellation from timeout', () => {
    // The exact confusion T045a was written to prevent, and which the EPIC-003
    // conformance suite caught recurring in a different component.
    expect(AGENT_FAILURE_REASONS).toContain('cancelled');
    expect(AGENT_FAILURE_REASONS).toContain('timeout');
  });
});

describe('T550 · AgentDescriptor carries every field Native §7 names (FR-AGT-002)', () => {
  it.each([
    'provider',
    'model',
    'executionType',
    'capabilities',
    'contextLimitTokens',
    'toolCapabilities',
    'supportsMcp',
    'repositoryCapabilities',
    'securityClassification',
    'supportsUnattended',
  ])('declares %s', (field) => {
    expect(descriptor).toHaveProperty(field);
  });

  it('carries specKitIntegrationName — the field that removes `claude` from the engine', () => {
    expect(descriptor.specKitIntegrationName).toBeTruthy();
  });

  it('offers exactly the five declared capabilities', () => {
    expect([...AGENT_CAPABILITIES]).toEqual(['execute', 'analyze', 'generate', 'review', 'test']);
  });
});

describe('T552 · capability negotiation happens before assignment (FR-AGT-003)', () => {
  it('accepts an agent that declares everything required', () => {
    expect(() => assertAgentCapabilities(descriptor, ['execute'])).not.toThrow();
  });

  it('refuses and names EVERY missing capability, not just the first', () => {
    try {
      assertAgentCapabilities(descriptor, ['execute', 'review', 'test']);
      expect.unreachable('should have refused');
    } catch (e) {
      expect(e).toBeInstanceOf(MissingAgentCapabilityError);
      expect((e as MissingAgentCapabilityError).missing).toEqual(['review', 'test']);
      expect((e as Error).message).toContain('review, test');
    }
  });

  it('names the agent, so an operator knows which registration is wrong', () => {
    expect(() => assertAgentCapabilities(descriptor, ['analyze'])).toThrow(/"fixture"/);
  });
});

describe('T552 · the context limit is a pre-flight refusal (E7)', () => {
  it('permits a request that fits', () => {
    expect(() => assertContextFits(descriptor, 999)).not.toThrow();
  });

  it('refuses one that does not, before any container work', () => {
    // A doomed run is never billed — the same reason empty_selection and
    // input_too_large are decided before a container starts.
    expect(() => assertContextFits(descriptor, 1001)).toThrow(ContextLimitExceededError);
  });

  it('reports both the request and the limit', () => {
    expect(() => assertContextFits(descriptor, 5000)).toThrow(/1000 tokens; 5000 were requested/);
  });
});
