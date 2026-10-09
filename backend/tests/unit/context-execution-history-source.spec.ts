/**
 * `T1827` (EPIC-038 Convergence) — execution history enters the corpus through
 * `EPIC-037`'s projections. `FR-CTX-015`, `R-038-8`.
 *
 * The artifact source served requirements and specifications only, so
 * execution history — half of `FR-CTX-015`'s approved set — could never be
 * indexed. It is read here from the execution's **projection**, through
 * `EPIC-037`'s public facade: the version is how far it has projected, which is
 * the same version the assembler's history judge compares against, and the
 * text is what the projection says about the execution. Never the event
 * stream.
 */
import { describe, expect, it } from 'vitest';
import { governedSources, type GovernedSourceServices } from '../../src/modules/context/sources.adapter.js';

const services: GovernedSourceServices = {
  requirements: { async get() { throw new Error('unused'); } },
  specifications: {
    async get() { throw new Error('unused'); },
    async versions() { return []; },
  },
  executions: {
    async snapshot(workspaceId, executionId) {
      if (workspaceId !== 'ws_1' || executionId !== 'ex_7') return null;
      return {
        executionId: 'ex_7',
        command: 'implement',
        surface: 'local-cli',
        lifecycleState: 'completed',
        governanceState: 'governed',
        projectedThroughSequence: 12,
        // `T1857` — registered to the workspace alone, by EPIC-037's own record.
        // A snapshot silent on the project is refused (context-history-project).
        projectId: null,
      };
    },
  },
};

describe('T1827 · execution history through projections', () => {
  const source = governedSources(services);

  it('the current version is how far the projection has projected', async () => {
    expect(await source.currentVersion('ws_1', 'execution-history', 'ex_7')).toEqual({
      resolves: true,
      version: '12',
    });
  });

  it('the text is what the projection says, at that version', async () => {
    const read = await source.read('ws_1', 'execution-history', 'ex_7', '12');
    expect(read?.text).toMatch(/implement[\s\S]*local-cli[\s\S]*completed/);
    expect(read?.projectId ?? null).toBeNull();
  });

  it('an older projection version, or an unknown execution, does not resolve', async () => {
    expect(await source.read('ws_1', 'execution-history', 'ex_7', '11')).toBeNull();
    expect(await source.currentVersion('ws_1', 'execution-history', 'ex_none')).toEqual({ resolves: false });
  });

  it('the adapter never reads the event stream', async () => {
    const code = (await import('node:fs')).readFileSync(
      new URL('../../src/modules/context/sources.adapter.ts', import.meta.url),
      'utf8',
    );
    expect(code).not.toMatch(/\bhistory\(|appendEvent|execution_events|ExecutionEvent\b/);
  });
});
