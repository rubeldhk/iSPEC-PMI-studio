/**
 * `T1635` (EPIC-045, `FR-ART-030` to `FR-ART-034`, `R-045-4`) — the synced
 * `spec.md` becomes the Epic's specification, through a **port**.
 *
 * The artifacts module never touches a specification table. It calls
 * `SpecificationSyncPort`, which the specifications module implements — so the
 * dependency runs one way and the specification entity keeps its own module's
 * invariants (`R-045-4`).
 *
 * The alternative, reusing `commitGeneration` with a synthetic generation job,
 * was rejected in the plan: it would put a row in the job ledger describing an
 * engine invocation that never happened. Provenance here comes from the
 * execution's agent identity snapshot, or from the connector when there is
 * none — a fact, not a fiction. Written to FAIL before `T1636`.
 */
import { describe, expect, it } from 'vitest';
import { InMemorySpecificationSyncPort, type SpecificationSyncInput } from '../../../src/modules/artifacts/specification-sync.port.js';

const WS = 'ws-1';

function input(overrides: Partial<SpecificationSyncInput> = {}): SpecificationSyncInput {
  return {
    workspaceId: WS,
    projectId: 'proj-1',
    epicId: 'epic-3',
    sourcePath: 'specs/003-reports/spec.md',
    title: 'Reports',
    contentRaw: '# Reports\n\nA report is a thing.\n',
    createdById: 'user-1',
    ownerUserId: 'owner-1',
    provenance: { engineName: 'claude-code', engineVersion: '2.1.0' },
    ...overrides,
  };
}

describe('T1635 · findByEpicSource — one specification per (epicId, sourcePath) (FR-ART-030)', () => {
  it('finds nothing before the first sync', async () => {
    const port = new InMemorySpecificationSyncPort();
    expect(await port.findByEpicSource(WS, 'epic-3', 'specs/003-reports/spec.md')).toBeNull();
  });

  it('finds the one it created, and only for the right Epic and path', async () => {
    const port = new InMemorySpecificationSyncPort();
    const created = await port.createFromSync(input());
    expect((await port.findByEpicSource(WS, 'epic-3', 'specs/003-reports/spec.md'))?.id).toBe(created.id);
    expect(await port.findByEpicSource(WS, 'epic-7', 'specs/003-reports/spec.md')).toBeNull();
    expect(await port.findByEpicSource(WS, 'epic-3', 'specs/003-reports/plan.md')).toBeNull();
    expect(await port.findByEpicSource('ws-2', 'epic-3', 'specs/003-reports/spec.md')).toBeNull();
  });
});

describe('T1635 · createFromSync — bound to the Epic, drafted, with the execution\'s provenance (FR-ART-032, FR-ART-033)', () => {
  it('creates a specification bound to the Epic with its source path', async () => {
    const port = new InMemorySpecificationSyncPort();
    const spec = await port.createFromSync(input());
    expect(spec.epicId).toBe('epic-3');
    expect(spec.sourcePath).toBe('specs/003-reports/spec.md');
    expect(spec.projectId).toBe('proj-1');
  });

  it('starts at lifecycleState draft — a synced document has been approved by nobody', async () => {
    const port = new InMemorySpecificationSyncPort();
    expect((await port.createFromSync(input())).lifecycleState).toBe('draft');
  });

  it('takes provenance from the execution\'s agent identity snapshot', async () => {
    const port = new InMemorySpecificationSyncPort();
    const spec = await port.createFromSync(input({ provenance: { engineName: 'claude-code', engineVersion: '2.1.0' } }));
    expect(spec.engineName).toBe('claude-code');
    expect(spec.engineVersion).toBe('2.1.0');
  });

  it('falls back to the connector and the contract version when the execution has no agent snapshot', async () => {
    const port = new InMemorySpecificationSyncPort();
    const spec = await port.createFromSync(input({ provenance: { engineName: 'connector', engineVersion: '1.0.0' } }));
    expect(spec.engineName).toBe('connector');
    expect(spec.engineVersion).toBe('1.0.0');
  });

  it('attributes creation to the execution\'s initiator and ownership to the project owner', async () => {
    const port = new InMemorySpecificationSyncPort();
    const spec = await port.createFromSync(input());
    expect(spec.createdById).toBe('user-1');
    expect(spec.ownerUserId).toBe('owner-1');
  });

  it('writes the first version with the content VERBATIM (R-007)', async () => {
    const port = new InMemorySpecificationSyncPort();
    const raw = '# Reports\n\n  indented   spacing  kept\n\n\n';
    const spec = await port.createFromSync(input({ contentRaw: raw }));
    const versions = port.versionsOf(spec.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]?.contentRaw).toBe(raw);
    expect(versions[0]?.versionNumber).toBe(1);
    expect(versions[0]?.authoredById).toBe('user-1');
  });

  it('parses the content when it can and records { parsed: false } when it cannot', async () => {
    const port = new InMemorySpecificationSyncPort();
    const parsed = await port.createFromSync(input({ contentParsed: { title: 'Reports', sections: 2 } }));
    expect(port.versionsOf(parsed.id)[0]?.contentParsed).toEqual({ title: 'Reports', sections: 2 });
    const unparsed = await port.createFromSync(input({ epicId: 'epic-7', sourcePath: 'specs/007-intake/spec.md' }));
    expect(port.versionsOf(unparsed.id)[0]?.contentParsed).toEqual({ parsed: false });
  });

  it('gives a `7a` child its OWN specification, not the parent\'s (FR-ART-034)', async () => {
    const port = new InMemorySpecificationSyncPort();
    const parent = await port.createFromSync(input({ epicId: 'epic-7', sourcePath: 'specs/007-intake/spec.md' }));
    const child = await port.createFromSync(input({ epicId: 'epic-7a', sourcePath: 'specs/007a-intake/spec.md' }));
    expect(child.id).not.toBe(parent.id);
    expect(child.epicId).toBe('epic-7a');
    expect(port.all()).toHaveLength(2);
  });
});

describe('T1635 · appendVersionIfChanged — a no-op is not history (FR-ART-031)', () => {
  it('appends nothing when the content is identical', async () => {
    const port = new InMemorySpecificationSyncPort();
    const spec = await port.createFromSync(input());
    const outcome = await port.appendVersionIfChanged({ workspaceId: WS, specificationId: spec.id, contentRaw: '# Reports\n\nA report is a thing.\n', authoredById: 'user-2' });
    expect(outcome.appended).toBe(false);
    expect(port.versionsOf(spec.id)).toHaveLength(1);
  });

  it('appends a numbered version when the content changes', async () => {
    const port = new InMemorySpecificationSyncPort();
    const spec = await port.createFromSync(input());
    const outcome = await port.appendVersionIfChanged({ workspaceId: WS, specificationId: spec.id, contentRaw: '# Reports v2\n', authoredById: 'user-2' });
    expect(outcome.appended).toBe(true);
    expect(outcome.version.versionNumber).toBe(2);
    expect(port.versionsOf(spec.id)).toHaveLength(2);
    expect(port.versionsOf(spec.id).map((v) => v.contentRaw)).toContain('# Reports v2\n');
  });

  it('compares against the LATEST version, not the first — a revert to old content is still a new version', async () => {
    const port = new InMemorySpecificationSyncPort();
    const spec = await port.createFromSync(input());
    await port.appendVersionIfChanged({ workspaceId: WS, specificationId: spec.id, contentRaw: '# v2\n', authoredById: 'u' });
    const back = await port.appendVersionIfChanged({ workspaceId: WS, specificationId: spec.id, contentRaw: '# Reports\n\nA report is a thing.\n', authoredById: 'u' });
    expect(back.appended).toBe(true);
    expect(back.version.versionNumber).toBe(3);
  });
});
