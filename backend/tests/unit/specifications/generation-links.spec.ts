/**
 * T073 — the paired test for T077 (`Specification` + `SpecificationVersion`)
 * and for the link invariant behind SC-002.
 *
 * Written to FAIL before the models and the generation service exist
 * (Constitution V).
 *
 * SC-002 — "zero orphaned specifications" — is claimed here as a STRUCTURAL
 * property, not a cleanup job: specification, version, traceability links and
 * the job's terminal state arrive as ONE commit, so there is no interleaving in
 * which a specification exists without its links.
 *
 * The link WRITER is EPIC-011 F-05 (`T081`). What this epic owns is the
 * guarantee that the links are handed over complete, in the same commit —
 * asserted here through the port EPIC-011 will implement.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GenerateSpecificationService } from '../../../src/modules/specifications/generate-specification.service.js';
import { InMemorySpecificationStore } from '../../../src/modules/specifications/specifications-read.service.js';
import { PROJECT, StubEngine, WS, selection } from './helpers.js';

const here = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(resolve(here, '../../../prisma/schema.prisma'), 'utf8');

function model(name: string): string {
  const m = schema.match(new RegExp(`model ${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!m?.[1]) throw new Error(`model ${name} not found in schema.prisma`);
  return m[1];
}

// --------------------------------------------------------------- T077 · model

describe('Specification model (T077)', () => {
  const spec = (): string => model('Specification');

  it('belongs to exactly one project, in one workspace (FR-010, FR-002)', () => {
    expect(spec()).toMatch(/workspaceId\s+String/);
    expect(spec()).toMatch(/projectId\s+String/);
    // A list of projects would make FR-010 unenforceable at the schema.
    expect(spec()).not.toMatch(/projects\s+Project\[\]/);
  });

  it('carries engine provenance that cannot be null (FR-022)', () => {
    expect(spec()).toMatch(/engineName\s+String\b(?!\?)/);
    expect(spec()).toMatch(/engineVersion\s+String\b(?!\?)/);
    expect(spec()).toMatch(/generatedAt\s+DateTime\b(?!\?)/);
  });

  it('carries the out-of-date flag, defaulting to false (FR-032)', () => {
    expect(spec()).toMatch(/isOutOfDate\s+Boolean\s+@default\(false\)/);
  });

  it('carries a lifecycle state defaulting to draft (FR-011, M08 §8)', () => {
    expect(spec()).toMatch(/lifecycleState\s+SpecLifecycleState\s+@default\(draft\)/);
    expect(schema).toMatch(
      /enum SpecLifecycleState\s*\{[\s\S]*draft[\s\S]*review[\s\S]*approved[\s\S]*baselined[\s\S]*implemented[\s\S]*archived[\s\S]*\n\}/,
    );
  });

  it('indexes the project listing view (SC-009)', () => {
    expect(spec()).toMatch(/@@index\(\[projectId, lifecycleState\]\)/);
  });
});

describe('SpecificationVersion model (T077)', () => {
  const version = (): string => model('SpecificationVersion');

  it('stores BOTH raw and parsed content (R-007)', () => {
    // Storing only the parsed form makes any future parser bug permanent data
    // loss — the engine cannot be re-run for free.
    expect(version()).toMatch(/contentRaw\s+String/);
    expect(version()).toMatch(/contentParsed\s+Json/);
  });

  it('numbers versions monotonically and uniquely per specification', () => {
    expect(version()).toMatch(/versionNumber\s+Int/);
    expect(version()).toMatch(/@@unique\(\[specificationId, versionNumber\]\)/);
  });

  it('records who authored it and when (FR-014)', () => {
    expect(version()).toMatch(/authoredById\s+String/);
    expect(version()).toMatch(/authoredAt\s+DateTime/);
  });

  it('carries workspaceId like every tenant-scoped model (FR-002)', () => {
    expect(version()).toMatch(/workspaceId\s+String/);
  });
});

// ------------------------------------------------- T073 · the link invariant

function service(engine = StubEngine.returning()): {
  service: GenerateSpecificationService;
  store: InMemorySpecificationStore;
} {
  const store = new InMemorySpecificationStore();
  return {
    store,
    service: new GenerateSpecificationService({ resolveForProject: async () => engine }, store),
  };
}

const request = (requirements = selection()) => ({
  jobId: 'job_1',
  workspaceId: WS,
  projectId: PROJECT,
  requestedById: 'u1',
  correlationId: 'corr_1',
  projectName: 'Payments',
  requirements,
  timeoutMs: 1_000,
});

describe('generation links every selected requirement (FR-029, SC-002)', () => {
  it('writes one link per selected requirement', async () => {
    const { service: svc, store } = service();
    const requirements = selection(4);
    const outcome = await svc.run(request(requirements));

    expect(outcome.state).toBe('succeeded');
    const links = store.linksFor(outcome.specification!.id);
    expect(links.map((l) => l.targetId).sort()).toEqual(requirements.map((r) => r.id).sort());
  });

  it('leaves NO selected requirement unlinked', async () => {
    const { service: svc, store } = service();
    const requirements = selection(5);
    const outcome = await svc.run(request(requirements));

    const linked = new Set(store.linksFor(outcome.specification!.id).map((l) => l.targetId));
    const unlinked = requirements.filter((r) => !linked.has(r.id));
    expect(unlinked).toEqual([]);
  });

  it('produces NO orphaned specification — every stored specification has ≥1 link', async () => {
    const { service: svc, store } = service();
    await svc.run(request());
    const orphans = store.all().filter((s) => store.linksFor(s.id).length === 0);
    expect(orphans).toEqual([]);
  });

  it('writes links only in the permitted direction (specification → requirement)', async () => {
    const { service: svc, store } = service();
    const outcome = await svc.run(request());
    for (const link of store.linksFor(outcome.specification!.id)) {
      expect(link.sourceType).toBe('specification');
      expect(link.targetType).toBe('requirement');
      expect(link.relationship).toBe('generated_from');
      expect(link.workspaceId).toBe(WS);
    }
  });

  it('de-duplicates a selection that names the same requirement twice', async () => {
    const { service: svc, store } = service();
    const [first] = selection(1);
    const outcome = await svc.run(request([first!, { ...first! }]));
    expect(store.linksFor(outcome.specification!.id)).toHaveLength(1);
  });
});

describe('one commit, or nothing (SC-002)', () => {
  it('commits specification, version, links and the job state together', async () => {
    const { service: svc, store } = service();
    const outcome = await svc.run(request());
    expect(store.commits).toHaveLength(1);
    const [commit] = store.commits;
    expect(commit!.specification.id).toBe(outcome.specification!.id);
    expect(commit!.version.specificationId).toBe(outcome.specification!.id);
    expect(commit!.version.versionNumber).toBe(1);
    expect(commit!.links).toHaveLength(3);
    // `resultRef` joined the commit with T845: the job is pointed at the
    // artifact in the SAME transaction that creates it, so a job can never
    // reference a specification that was rolled back.
    expect(commit!.job).toEqual({
      id: 'job_1',
      state: 'succeeded',
      resultRef: outcome.specification!.id,
    });
  });

  it('stores nothing at all when the commit fails — no half-written specification', async () => {
    const { service: svc, store } = service();
    store.failNextCommit(new Error('deadlock'));
    const outcome = await svc.run(request());

    expect(outcome.state).toBe('failed');
    expect(store.all()).toEqual([]);
    expect(store.allLinks()).toEqual([]);
  });

  it('the first version points at the specification it belongs to', async () => {
    const { service: svc, store } = service();
    await svc.run(request());
    const spec = store.all()[0]!;
    expect(spec.currentVersionId).toBe(store.versionsFor(spec.id)[0]!.id);
  });
});
