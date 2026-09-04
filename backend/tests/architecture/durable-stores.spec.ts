/**
 * `T1330` (EPIC-041) — the composed application keeps what it creates.
 *
 * `FR-LPW-043`, `R-041-7`. PMI-DOC-004B §2.1 found tasks, runs and generation
 * jobs held in memory in the composed application: every restart lost them, and
 * every governance gate stayed green because module-level tests used the same
 * in-memory stores deliberately. This check reads the three composition roots
 * and fails the moment any of them can hand back an in-memory store when a
 * database is configured.
 *
 * Reads source rather than booting the graph, in the pattern
 * `engine-independence.spec.ts` and `executions-unmounted.spec.ts` established:
 * it runs without Docker, which is exactly when the regression would otherwise
 * hide. `T1331` boots the real graph and asserts the same through DI.
 *
 * Written to FAIL against the composition roots as they were on 2026-09-03.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const MODULES = resolve(here, '../../src/modules');

interface Binding {
  readonly module: string;
  readonly token: string;
  readonly prisma: string;
  readonly inMemory: string;
}

/** Every store PMI-DOC-004B §2.1 found in memory, and the class that must replace it. */
const BINDINGS: readonly Binding[] = [
  { module: 'tasks/tasks.module.ts', token: 'TASK_STORE', prisma: 'PrismaTaskStore', inMemory: 'InMemoryTaskStore' },
  { module: 'runs/runs.module.ts', token: 'RUN_STORE', prisma: 'PrismaRunStore', inMemory: 'InMemoryRunStore' },
  { module: 'runs/runs.module.ts', token: 'QUESTION_STORE', prisma: 'PrismaQuestionStore', inMemory: 'InMemoryQuestionStore' },
  { module: 'runs/runs.module.ts', token: 'MARKING_STORE', prisma: 'PrismaMarkingStore', inMemory: 'InMemoryMarkingStore' },
  { module: 'runs/runs.module.ts', token: 'OVERRIDE_STORE', prisma: 'PrismaOverrideStore', inMemory: 'InMemoryOverrideStore' },
  {
    module: 'specifications/specifications.module.ts',
    token: 'GENERATION_JOB_LEDGER',
    prisma: 'PrismaGenerationJobLedger',
    inMemory: 'InMemoryGenerationJobLedger',
  },
  { module: 'jobs/jobs.module.ts', token: 'JOB_STORE', prisma: 'PrismaJobStore', inMemory: 'NullJobStore' },
  // Found by T1383, not by PMI-DOC-004B: the trace read a store the commit never wrote to.
  {
    module: 'traceability/traceability.module.ts',
    token: 'TRACEABILITY_LINK_STORE',
    prisma: 'PrismaTraceabilityLinkStore',
    inMemory: 'InMemoryTraceabilityLinkStore',
  },
];

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** The `useFactory` expression bound to a token, comments removed. */
function factoryFor(source: string, token: string): string {
  const code = stripComments(source);
  const match = new RegExp(`provide:\\s*${token}\\s*,([\\s\\S]*?)\\n\\s*\\}\\s*,`).exec(code);
  expect(match, `${token} has no provider`).not.toBeNull();
  return match![1]!;
}

describe('T1330 · no store is in-memory when a database is configured (FR-LPW-043)', () => {
  it.each(BINDINGS)('$module binds $token to $prisma under DATABASE_URL', ({ module, token, prisma, inMemory }) => {
    const source = readFileSync(resolve(MODULES, module), 'utf8');
    const factory = factoryFor(source, token);

    expect(factory, `${token}'s factory never selects ${prisma}`).toContain(prisma);
    expect(factory, `${token}'s factory does not consult DATABASE_URL`).toMatch(/DATABASE_URL/);

    // The in-memory store MAY remain as the database-less fallback (unit
    // suites run without one). It MAY NOT be the unconditional choice: a
    // factory whose body is `new InMemoryX()` and nothing else is the defect.
    const unconditional = new RegExp(`^\\s*\\(\\)\\s*(?::\\s*\\w+)?\\s*=>\\s*new ${inMemory}\\(\\)\\s*,?\\s*$`);
    expect(factory.trim(), `${token} is unconditionally ${inMemory}`).not.toMatch(unconditional);
  });
});

describe('T1330 · the fallback is explicit, not accidental', () => {
  it.each(BINDINGS)('$module still names $inMemory, so the database-less posture is a decision', ({ module, inMemory }) => {
    // Deleting the in-memory stores would make 3886 unit tests need a
    // database. Keeping them, behind the DATABASE_URL check, is the design.
    const source = stripComments(readFileSync(resolve(MODULES, module), 'utf8'));
    expect(source).toContain(inMemory);
  });
});
