/**
 * `T1287` (EPIC-038) — execution history, through `EPIC-037`'s projections.
 *
 * `FR-CTX-015`, `R-038-8`. History is read through the **projections** — the
 * surface `EPIC-037` offers for current state — never by replaying its event
 * stream, which would make this Epic a second interpreter of event semantics
 * it does not own.
 *
 * The port **degrades**: with it unbound, history drops out of the package and
 * the package **records that it did**.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import type { ExecutionProjections } from '../../src/modules/context/live-state.js';
import type { Candidate } from '../../src/modules/context/retrieval/outcome.types.js';
import { allow, classes, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';

const found: Candidate[] = [
  { sourceType: 'requirement', sourceId: 'rq_1', sourceVersion: 'v1', relevanceScore: 0.9, workspaceId: 'ws_1' },
  { sourceType: 'execution-history', sourceId: 'ex_7', sourceVersion: '12', relevanceScore: 0.8, workspaceId: 'ws_1' },
  { sourceType: 'execution-history', sourceId: 'ex_8', sourceVersion: '3', relevanceScore: 0.7, workspaceId: 'ws_1' },
];

async function assemble(executions: ExecutionProjections | null) {
  const store = new InMemoryContextStore();
  const result = await new AssemblyService(store, {
    retrieval: retrieval(found),
    access: allow(),
    sourceClasses: classes(['requirement', 'execution-history']),
    authorisations: noAuthorisations(),
    executions,
    // Unbound: this file is about history degradation, not binding (T1847 checks a
    // named execution against EPIC-037 first, which these ports do not model).
  }).assemble(input({ executionId: undefined }));
  return {
    items: (await store.itemsFor('ws_1', result.packageId)).map((i) => i.sourceId),
    exclusions: await store.exclusionsFor('ws_1', result.packageId),
    pkg: await store.findPackage('ws_1', result.packageId),
  };
}

describe('T1287 · execution history', () => {
  it('with projections bound, current history is included', async () => {
    const { items, pkg } = await assemble({
      async projectedVersion(_ws, executionId) {
        return executionId === 'ex_7' ? '12' : '3';
      },
    });
    expect(items).toEqual(['rq_1', 'ex_7', 'ex_8']);
    expect(pkg?.executionHistory).toBe('available');
  });

  it('history whose projection has moved on is excluded as stale', async () => {
    const { items, exclusions } = await assemble({
      async projectedVersion(_ws, executionId) {
        return executionId === 'ex_7' ? '15' : '3';
      },
    });
    expect(items).toEqual(['rq_1', 'ex_8']);
    expect(exclusions.map((e) => [e.sourceId, e.reason])).toEqual([['ex_7', 'stale']]);
  });

  it('with the port unbound, history drops out AND the package records that it did', async () => {
    const { items, exclusions, pkg } = await assemble(null);
    expect(items).toEqual(['rq_1']);
    expect(pkg?.executionHistory).toBe('unavailable');
    expect(pkg?.executionHistoryReason).toMatch(/ExecutionProjections[\s\S]*EPIC-037/);
    expect(exclusions.map((e) => e.sourceId).sort()).toEqual(['ex_7', 'ex_8']);
  });

  it('a failing projection read degrades the same way', async () => {
    const { items, pkg } = await assemble({
      async projectedVersion() {
        throw new Error('projection store unreachable');
      },
    });
    expect(items).toEqual(['rq_1']);
    expect(pkg?.executionHistory).toBe('unavailable');
    expect(pkg?.executionHistoryReason).toMatch(/projection store unreachable/);
  });

  it('the port reads projections, never the event stream', async () => {
    const source = (await import('node:fs')).readFileSync(
      new URL('../../src/modules/context/live-state.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(/\bhistory\(|appendEvent|ExecutionEvent|execution_events/);
  });
});
