/**
 * `T2140` (EPIC-039) — `fixture-git`: `ReadRepository` over a small, fixed
 * repository whose content depends only on the revision name.
 */
import type { AdapterCall, AdapterDescriptor, AdapterResult } from '@pmi/capability-contract';
import { FixtureAdapter, commitFor, fixtureDescriptor, invalidInput, type FixtureScript } from './shared.js';

const FILES: Readonly<Record<string, string>> = Object.freeze({
  'README.md': '# Fixture repository\n\nServed by fixture-git.\n',
  'src/index.ts': 'export const answer = 42;\n',
  'tests/index.spec.ts': "import { answer } from '../src/index';\n",
});

export class FixtureGitAdapter extends FixtureAdapter {
  readonly descriptor: AdapterDescriptor = fixtureDescriptor({
    key: 'fixture-git',
    name: 'Fixture Git host',
    implements: [{ capability: 'ReadRepository', majors: [1] }],
    scopeMapping: { 'repository.contents': ['fixture:contents'] },
  });

  protected async serve(call: AdapterCall, script: FixtureScript): Promise<AdapterResult> {
    const input = call.input as { revision?: unknown; mode?: unknown; paths?: unknown } | null;
    if (input === null || typeof input !== 'object' || typeof input.revision !== 'string' || (input.mode !== 'tree' && input.mode !== 'files')) {
      return invalidInput('ReadRepository needs a revision and a mode');
    }
    const revision = { requested: input.revision, resolvedCommit: commitFor(input.revision) };
    if (script.invoke === 'non-conforming') return { ok: true, output: { revision, entries: 'not-a-list' } };
    if (input.mode === 'tree') {
      const dirs = new Set(Object.keys(FILES).filter((p) => p.includes('/')).map((p) => p.split('/')[0]!));
      const entries = [
        ...[...dirs].map((path) => ({ path, kind: 'dir' as const })),
        ...Object.entries(FILES).map(([path, content]) => ({ path, kind: 'file' as const, sizeBytes: Buffer.byteLength(content) })),
      ].sort((a, b) => a.path.localeCompare(b.path));
      return { ok: true, output: { revision, entries, truncated: false } };
    }
    const paths = Array.isArray(input.paths) ? (input.paths as string[]) : [];
    const files = paths.filter((p) => p in FILES).map((path) => ({ path, encoding: 'utf8' as const, content: FILES[path]!, sizeBytes: Buffer.byteLength(FILES[path]!) }));
    return { ok: true, output: { revision, files, missing: paths.filter((p) => !(p in FILES)) } };
  }
}
