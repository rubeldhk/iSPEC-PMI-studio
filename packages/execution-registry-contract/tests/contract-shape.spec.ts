/**
 * T1021 (EPIC-037 Band A) — the semantic surface is what it claims to be.
 *
 * These read the contract as **text**, which is unusual and deliberate. The
 * important properties are about what the contract does **not** contain, and an
 * absence cannot be asserted by calling something. A type test proves a verb
 * that exists behaves; only a shape test proves a verb that must not exist is
 * genuinely gone.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  EXECUTION_SURFACES,
  GOVERNED_COMMANDS,
  REGISTRY_REFUSALS,
  RegistryRefusedError,
} from '../src/contract.js';

const here = dirname(fileURLToPath(import.meta.url));
const CONTRACT = readFileSync(join(here, '..', 'src', 'contract.ts'), 'utf8');

/** Comments removed: the rule is about the declared surface, not the prose. */
const declared = CONTRACT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('T1021 · the four verbs, and only the four', () => {
  it('declares register, appendEvent, complete and proposeTransition', () => {
    for (const verb of ['register(', 'appendEvent(', 'complete(', 'proposeTransition(']) {
      expect(declared, `the contract is missing ${verb}`).toContain(verb);
    }
  });

  it.each(['applyTransition', 'approve(', 'setStatus', 'patch(', 'updateStatus', 'adjudicate('])(
    'declares no "%s"',
    (verb) => {
      // The omission IS the enforcement. A contract offering these would make
      // "connectors must not apply lifecycle policy" a rule to remember rather
      // than a thing that cannot be expressed.
      expect(declared.includes(verb), `the contract exposes ${verb}`).toBe(false);
    },
  );

  it('the absence check can actually fail', () => {
    // Anti-tautology: if the matcher could not detect a violation, every
    // assertion above would pass against an empty file.
    expect('interface X { applyTransition(): void }'.includes('applyTransition')).toBe(true);
  });
});

describe('T1021 · identity is eight fields, never one', () => {
  it('keeps every concept separate on ExecutionIdentityRefs', () => {
    // Collapsing any two is how a connector ends up able to approve its own
    // work, which is why C3B named them individually.
    for (const field of [
      'authenticatedPrincipalId',
      'agentSnapshotId',
      'connectorRegistrationId',
      'sponsorUserId',
      'delegationId',
      'delegationIdentityVersion',
    ]) {
      expect(declared, `identity is missing ${field}`).toContain(field);
    }
  });

  it('has no `actorId` anywhere — that is the collapse itself', () => {
    expect(declared.includes('actorId')).toBe(false);
  });
});

describe('T1021 · phase-aware binding is expressed in the types', () => {
  it('InputBinding carries commitBefore and NOT commitAfter', () => {
    const input = declared.slice(
      declared.indexOf('interface InputBinding'),
      declared.indexOf('interface OutputBinding'),
    );
    expect(input).toContain('commitBefore');
    // `AC-EXR-17b`: asking for an output commit at registration is the defect.
    expect(input.includes('commitAfter'), 'InputBinding accepts commitAfter').toBe(false);
  });

  it('OutputBinding carries commitAfter, and every field is optional', () => {
    const output = declared.slice(
      declared.indexOf('interface OutputBinding'),
      declared.indexOf('interface RegisterExecutionRequest'),
    );
    expect(output).toContain('commitAfter');
    // A failed run produced nothing (`AC-EXR-17d`), so nothing here can be
    // required by the type — the service decides per outcome.
    const fields = [...output.matchAll(/readonly (\w+)(\??):/g)];
    expect(fields.length).toBeGreaterThan(3);
    for (const [, name, optional] of fields) {
      expect(optional, `OutputBinding.${name} is required`).toBe('?');
    }
  });
});

describe('T1021 · closed vocabularies', () => {
  it('names six surfaces, and fixture is one of them', () => {
    expect(EXECUTION_SURFACES).toHaveLength(6);
    expect(EXECUTION_SURFACES).toContain('fixture');
  });

  it('names the governed Spec Kit commands', () => {
    expect(GOVERNED_COMMANDS).toContain('specify');
    expect(GOVERNED_COMMANDS).toContain('implement');
    expect(new Set(GOVERNED_COMMANDS).size).toBe(GOVERNED_COMMANDS.length);
  });

  it('gives every refusal a machine-readable code', () => {
    // The `X1` lesson, applied here from the start: a consumer branches on the
    // code, never on the sentence.
    expect(REGISTRY_REFUSALS.length).toBeGreaterThan(8);
    const error = new RegistryRefusedError('delegation_missing', 'anything at all');
    expect(error.refusal).toBe('delegation_missing');
    expect(error.name).toBe('RegistryRefusedError');
  });
});
