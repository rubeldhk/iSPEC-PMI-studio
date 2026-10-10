/**
 * `T1803` (EPIC-038 Convergence) — budget policy is configuration, not code.
 *
 * `FR-CTX-036`. The per-candidate estimate was a flat `500` in
 * `assembly.service.ts` and the retrieval limit a `40` in `context.module.ts`.
 * Both are policy, and policy in a constant is a decision nobody can see or
 * change without a deployment.
 *
 * So both are read from the workspace's budget policy, and a workspace with
 * **no** policy refuses — the absence of configuration is not permission to
 * use a number somebody typed into the code.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import type { AssemblyPorts } from '../../src/modules/context/assembly.service.js';
import { allow, candidates, classes, input, noAuthorisations } from '../helpers/context-fixtures.js';

const here = dirname(fileURLToPath(import.meta.url));
const code = (rel: string): string =>
  readFileSync(resolve(here, '../../src/modules/context', rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

/** A retrieval port that records the limit it was asked for. */
function recordingRetrieval(): AssemblyPorts['retrieval'] & { asked: (number | undefined)[] } {
  const asked: (number | undefined)[] = [];
  return {
    asked,
    async search(q) {
      asked.push(q.limit);
      const found = candidates(['rq_1', 'rq_2']);
      return { requested: q.limit ?? found.length, returned: found.length, candidates: found, modelId: 'm' };
    },
  };
}

describe('T1803 · the policy is read, per workspace', () => {
  it('the retrieval limit comes from the workspace policy', async () => {
    const store = new InMemoryContextStore();
    await store.addBudgetPolicy({ workspaceId: 'ws_1', retrievalLimit: 7, tokensPerCandidate: 100, costPerThousandTokens: 0 });
    const search = recordingRetrieval();
    await new AssemblyService(store, {
      retrieval: search,
      access: allow(),
      sourceClasses: classes(['requirement']),
      authorisations: noAuthorisations(),
      budgetPolicy: store,
    }).assemble(input());
    expect(search.asked).toEqual([7]);
  });

  it('the per-candidate estimate comes from the policy', async () => {
    const store = new InMemoryContextStore();
    await store.addBudgetPolicy({ workspaceId: 'ws_1', retrievalLimit: 7, tokensPerCandidate: 6000, costPerThousandTokens: 0 });
    const result = await new AssemblyService(store, {
      retrieval: recordingRetrieval(),
      access: allow(),
      sourceClasses: classes(['requirement']),
      authorisations: noAuthorisations(),
      budgetPolicy: store,
    }).assemble(input({ budgetTokens: 12000 }));
    // 6,000 per candidate: two fit in 12,000. At the old flat 500, both fit too —
    // so tighten: 11,999 admits only one.
    expect(result.itemCount).toBe(2);
    const tighter = await new AssemblyService(store, {
      retrieval: recordingRetrieval(),
      access: allow(),
      sourceClasses: classes(['requirement']),
      authorisations: noAuthorisations(),
      budgetPolicy: store,
    }).assemble(input({ budgetTokens: 11999 }));
    expect(tighter.itemCount).toBe(1);
  });

  it('another workspace’s policy is not this one’s', async () => {
    const store = new InMemoryContextStore();
    await store.addBudgetPolicy({ workspaceId: 'ws_other', retrievalLimit: 7, tokensPerCandidate: 100, costPerThousandTokens: 0 });
    expect(await store.budgetPolicyFor('ws_1')).toBeNull();
  });

  it('a workspace with no policy refuses, naming FR-CTX-036', async () => {
    const store = new InMemoryContextStore();
    await expect(
      new AssemblyService(store, {
        retrieval: recordingRetrieval(),
        access: allow(),
        sourceClasses: classes(['requirement']),
        authorisations: noAuthorisations(),
        budgetPolicy: store,
      }).assemble(input()),
    ).rejects.toThrow(/budget policy[\s\S]*FR-CTX-036/);
  });
});

describe('T1803 · no budget number lives in the code that runs', () => {
  it('context.module.ts declares no retrieval limit constant', () => {
    expect(code('context.module.ts')).not.toMatch(/RETRIEVAL_LIMIT|limit:\s*\d+/);
  });

  it('context.module.ts binds the budget policy port', () => {
    expect(code('context.module.ts')).toMatch(/budgetPolicy:/);
  });
});
