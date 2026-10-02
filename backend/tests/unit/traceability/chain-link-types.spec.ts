/**
 * T300 — the twelve chain link types (FR-ENH-021, R-017-7).
 * Written to FAIL before T301 exists (Constitution V).
 *
 * The chain WIDENS TraceabilityLink — the chain IS derivation, extended —
 * the opposite conclusion to DependencyEdge, deliberately: the test is not
 * "is it a link?" but "does it behave like derivation?".
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CHAIN_LINK_TYPES,
  CHAIN_STAGES,
  PERMITTED_EDGES,
  isChainStage,
  assertPermittedEdge,
  stageIndex,
} from '../../../src/modules/traceability/link-writer.service.js';

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA = readFileSync(resolve(here, '../../../prisma/schema.prisma'), 'utf8');

const THE_TWELVE = [
  'vision',
  'goals',
  'capabilities',
  'requirements',
  'specifications',
  'architecture',
  'planning',
  'tasks',
  'code',
  'tests',
  'release',
  'operations',
];

describe('T300 · the twelve chain link types', () => {
  it('are exactly the source document’s twelve, in chain order', () => {
    expect([...CHAIN_LINK_TYPES]).toEqual(THE_TWELVE);
  });

  it('the schema enum accepts all twelve alongside the two Phase 1 types', () => {
    const match = /enum TraceRelationship \{[\s\S]*?\}/.exec(SCHEMA);
    expect(match).toBeTruthy();
    const block = match![0];
    for (const type of [...THE_TWELVE, 'generated_from', 'derived_from']) {
      expect(block, `enum missing ${type}`).toContain(type);
    }
  });

  it('the chain stages run vision → operations, twelve of them', () => {
    expect(CHAIN_STAGES.length).toBe(12);
    expect(CHAIN_STAGES[0]).toBe('vision');
    expect(CHAIN_STAGES[11]).toBe('operation');
    expect(CHAIN_STAGES).toContain('specification');
  });

  it('an unknown artifact stage is rejected by name', () => {
    expect(() => stageIndex('galaxy' as never)).toThrow(/galaxy/);
  });

  it('every chain edge points from a LATER stage to an EARLIER one — acyclic by construction', () => {
    // Scoped to edges whose BOTH ends are chain stages. `EPIC-034`'s
    // `FR-CHR-064` added `specification|task|test → change`, and `change` has
    // no position in the derivation chain by design — asking whether it points
    // up-chain is a question with no correct answer, not an acyclicity
    // violation. The next case asserts what constrains those edges instead.
    const chainEdges = PERMITTED_EDGES.filter(
      (edge) => isChainStage(edge.sourceType) && isChainStage(edge.targetType),
    );
    expect(chainEdges.length).toBeGreaterThanOrEqual(12);
    for (const edge of chainEdges) {
      expect(
        stageIndex(edge.sourceType) > stageIndex(edge.targetType),
        `${edge.sourceType}->${edge.targetType} does not point up-chain`,
      ).toBe(true);
    }
  });

  it('and a non-chain edge never points AWAY from the chain', () => {
    // What replaces the ordering check for `change`: it may only be a TARGET.
    // An edge with `change` as its source would make a change request derive
    // from the work it caused, which is the chain by the back door.
    for (const edge of PERMITTED_EDGES) {
      expect(
        isChainStage(edge.sourceType),
        `${edge.sourceType}->${edge.targetType} has a non-chain SOURCE`,
      ).toBe(true);
    }
  });

  it('an edge outside the permitted set is still refused, naming the set', () => {
    expect(() => assertPermittedEdge('vision' as never, 'operation' as never)).toThrow();
  });
});
