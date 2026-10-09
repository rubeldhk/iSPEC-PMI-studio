/**
 * `T1856` (EPIC-038 Convergence) — execution history belongs to a project.
 *
 * `FR-CTX-050`, `US3/AC1`, `SC-CTX-003`. History was indexed with no project,
 * because `EPIC-037`'s public snapshot did not carry one, so project A's
 * execution history entered project B's package as workspace-wide material —
 * the project-boundary leak `T1808` closed for documents, reopened through
 * history. The snapshot now carries `projectId`; an execution with no project
 * is workspace-wide by `EPIC-037`'s own record, and a snapshot that cannot say
 * (the field absent) is refused rather than guessed.
 */
import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../src/core/errors.js';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import type { Candidate } from '../../src/modules/context/retrieval/outcome.types.js';
import { governedSources, type GovernedSourceServices } from '../../src/modules/context/sources.adapter.js';
import { allow, classes, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';

function services(projectId: string | null | undefined): GovernedSourceServices {
  return {
    requirements: { async get() { throw new Error('unused'); } },
    specifications: { async get() { throw new Error('unused'); }, async versions() { return []; } },
    executions: {
      async snapshot() {
        return {
          executionId: 'ex_a',
          command: 'implement',
          surface: 'local-cli',
          lifecycleState: 'completed',
          governanceState: 'governed',
          projectedThroughSequence: 4,
          ...(projectId === undefined ? {} : { projectId }),
        };
      },
    },
  };
}

describe('T1856 · execution history carries its project', () => {
  it('reads the project EPIC-037 registered the execution under', async () => {
    const read = await governedSources(services('pr_A')).read('ws_1', 'execution-history', 'ex_a', '4');
    expect(read?.projectId).toBe('pr_A');
  });

  it('an execution registered with no project is workspace-wide by EPIC-037’s own record', async () => {
    const read = await governedSources(services(null)).read('ws_1', 'execution-history', 'ex_a', '4');
    expect(read?.projectId).toBeNull();
  });

  it('a snapshot that cannot say which project is refused, not guessed workspace-wide', async () => {
    await expect(
      governedSources(services(undefined)).read('ws_1', 'execution-history', 'ex_a', '4'),
    ).rejects.toBeInstanceOf(ValidationFailedError);
  });

  it("project A's history is excluded from project B's package as a boundary", async () => {
    const store = new InMemoryContextStore();
    const history: Candidate = {
      sourceType: 'execution-history',
      sourceId: 'ex_a',
      sourceVersion: '4',
      relevanceScore: 0.9,
      workspaceId: 'ws_1',
      projectId: 'pr_A',
    };
    const result = await new AssemblyService(store, {
      retrieval: retrieval([history]),
      access: allow(),
      sourceClasses: classes(['execution-history']),
      authorisations: noAuthorisations(),
      executions: { async projectedVersion() { return '4'; } },
    }).assemble(input({ projectId: 'pr_B', executionId: undefined }));
    const [exclusion] = await store.exclusionsFor('ws_1', result.packageId);
    expect([exclusion?.sourceId, exclusion?.reason]).toEqual(['ex_a', 'boundary']);
  });
});
