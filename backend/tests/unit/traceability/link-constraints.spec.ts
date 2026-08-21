/**
 * T077a — TraceabilityLink permits only the enumerated edge set and rejects
 * duplicates. Written to FAIL before T078/T081 exist (Constitution V).
 *
 * FR-029 + FR-ENH-021: **updated by EPIC-022 T302** — the set widened from
 * the two Phase 1 edges to include the ten chain-adjacent pairs (R-017-7).
 * This update was a PLANNED task of that epic; the pre-widening assertion
 * failed the build the moment T301 landed, exactly as designed.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  InMemoryTraceabilityLinkStore,
  assertPermittedEdge,
  PERMITTED_EDGES,
} from '../../../src/modules/traceability/link-writer.service.js';
import { ConflictError, ValidationFailedError } from '../../../src/core/errors.js';

const here = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(resolve(here, '../../../prisma/schema.prisma'), 'utf8');

describe('the permitted edges (FR-029 + FR-ENH-021, widened by EPIC-022 T302)', () => {
  it('are exactly the two Phase 1 edges plus the ten chain-adjacent pairs', () => {
    expect(PERMITTED_EDGES.map((e) => `${e.sourceType}->${e.targetType}`).sort()).toEqual(
      [
        'specification->requirement',
        'task->specification',
        'goal->vision',
        'capability->goal',
        'requirement->capability',
        'architecture->specification',
        'plan->architecture',
        'task->plan',
        'code->task',
        'test->code',
        'release->test',
        'operation->release',
      ].sort(),
    );
  });

  it.each([
    ['requirement', 'specification'],
    ['requirement', 'task'],
    ['specification', 'task'],
    ['task', 'requirement'],
    ['specification', 'specification'],
    // Down-chain edges stay refused — derivation only ever points up-chain.
    ['vision', 'goal'],
    ['release', 'operation'],
  ])('%s → %s is refused, naming the field', (sourceType, targetType) => {
    const err = ((): unknown => {
      try {
        assertPermittedEdge(sourceType as never, targetType as never);
        return null;
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(ValidationFailedError);
  });
});

describe('the store rejects duplicates', () => {
  const LINK = {
    workspaceId: 'ws_a',
    sourceType: 'specification',
    sourceId: 's1',
    targetType: 'requirement',
    targetId: 'r1',
    relationship: 'generated_from',
  } as const;

  it('an identical five-tuple is a conflict, not a second row', async () => {
    const store = new InMemoryTraceabilityLinkStore();
    await store.append({ ...LINK, id: 'l1', createdAt: new Date() });
    await expect(store.append({ ...LINK, id: 'l2', createdAt: new Date() })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('a different target is a different link — no false dedup', async () => {
    const store = new InMemoryTraceabilityLinkStore();
    await store.append({ ...LINK, id: 'l1', createdAt: new Date() });
    await expect(
      store.append({ ...LINK, id: 'l2', targetId: 'r2', createdAt: new Date() }),
    ).resolves.toBeDefined();
  });

  it('the store exposes no delete — links are the audit trail of derivation', () => {
    const store = new InMemoryTraceabilityLinkStore();
    for (const forbidden of ['delete', 'deleteMany', 'remove', 'destroy']) {
      expect(
        (store as unknown as Record<string, unknown>)[forbidden],
        `store must not expose ${forbidden}()`,
      ).toBeUndefined();
    }
  });
});

describe('T078 — the Prisma model matches the design', () => {
  function model(name: string): string {
    const m = schema.match(new RegExp(`model ${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
    if (!m?.[1]) throw new Error(`model ${name} not found in schema.prisma`);
    return m[1];
  }

  it('declares the polymorphic link with both traversal indexes (FR-030)', () => {
    const link = model('TraceabilityLink');
    expect(link).toMatch(/sourceType\s+TraceArtifactType/);
    expect(link).toMatch(/targetType\s+TraceArtifactType/);
    expect(link).toMatch(/relationship\s+TraceRelationship/);
    // Both directions must stay fast at 500 specs/project (SC-009).
    expect(link).toMatch(/@@index\(\[targetType, targetId\]\)/);
    expect(link).toMatch(/@@index\(\[sourceType, sourceId\]\)/);
    expect(link).toMatch(/@@unique\(\[sourceType, sourceId, targetType, targetId, relationship\]\)/);
    expect(link).toMatch(/workspaceId\s+String/);
  });
});
