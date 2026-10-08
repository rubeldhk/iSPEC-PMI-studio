/**
 * T1800 — a missing field fails a check rather than reading as blank. `SC-EVS-002`.
 *
 * *"100% of evidence items identify source, time, attested artifact and version,
 * and carry integrity metadata; a missing field fails a check rather than
 * reading as blank."* The Prisma mapper used to read a missing `projectId` as
 * `''`, a missing `subjectName` as `'_'` and a missing `attachedToId` as `''` —
 * a row that had lost its provenance looked like one that had a blank value.
 *
 * Now such a row is refused at read, and the gate that needed it refuses too:
 * evidence whose provenance cannot be established is not evidence (`FR-EVS-035`
 * — an unevaluable Contract is not a satisfied one).
 */
import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { predicateTypeFor } from '@pmi/evidence-contract';
import { PrismaEvidenceRepository } from '../../src/modules/evidence/evidence.repository.js';

const complete = {
  id: 'e1',
  workspaceId: 'ws',
  projectId: 'p1',
  type: predicateTypeFor('test-result'),
  subjectName: 'src/a.ts',
  subjectDigest: { gitCommit: 'a'.repeat(40) },
  attestsArtifactId: 'a1',
  attestsArtifactVersion: 1,
  producedAt: new Date('2026-10-08T00:00:00Z'),
  source: 'pmi:qa-suite',
  sourceVersion: null,
  storage: 'stored',
  payload: { result: 'PASSED' },
  reference: null,
  integrity: { algorithm: 'sha256', value: 'x' },
  integrityValid: true,
  attachedToType: 'task',
  attachedToId: 'T-1',
  createdAt: new Date('2026-10-08T00:00:00Z'),
};

function repositoryReturning(row: Record<string, unknown>) {
  const prisma = {
    evidenceItem: { findMany: async () => [row] },
    $queryRaw: async () => [row],
  } as unknown as PrismaClient;
  return new PrismaEvidenceRepository(prisma);
}

const ref = { type: 'task', id: 'T-1' } as const;

describe('T1800 · SC-EVS-002 — a complete row reads back complete', () => {
  it('maps every provenance field through unchanged', async () => {
    const [read] = await repositoryReturning(complete).attachedTo('ws', ref);
    expect(read).toMatchObject({ projectId: 'p1', subjectName: 'src/a.ts', attachedTo: ref, sourceUri: 'pmi:qa-suite' });
  });
});

describe('T1800 · SC-EVS-002 — a missing field fails rather than reading as blank', () => {
  it.each([
    'projectId',
    'subjectName',
    'subjectDigest',
    'attachedToId',
    'attachedToType',
    'integrity',
    'storage',
    'source',
  ])('refuses a row missing %s, on both read paths', async (field) => {
    const row = { ...complete, [field]: null };
    await expect(repositoryReturning(row).attachedTo('ws', ref)).rejects.toThrow(new RegExp(field));
    await expect(repositoryReturning(row).attachedToMany('ws', [ref])).rejects.toThrow(new RegExp(field));
  });
});
