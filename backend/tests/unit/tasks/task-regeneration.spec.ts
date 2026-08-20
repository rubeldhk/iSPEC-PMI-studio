/**
 * T097 — regeneration warns before replacing existing tasks.
 * Written to FAIL before T103 exists (Constitution V).
 *
 * US4 scenario 4: silently replacing a task list someone has been working
 * from is the failure this exists to prevent. The warning is a REFUSAL to
 * proceed without confirmation, not a note attached to the damage.
 */
import { describe, expect, it } from 'vitest';
import { engineOk, type SpecificationEngine } from '@pmi/engine-contract';
import {
  GenerateTasksService,
  InMemoryTaskStore,
} from '../../../src/modules/tasks/generate-tasks.service.js';
import { TaskRegenerationService } from '../../../src/modules/tasks/task-regeneration.service.js';
import {
  InMemoryTraceabilityLinkStore,
  LinkWriterService,
} from '../../../src/modules/traceability/link-writer.service.js';

const DESCRIPTOR = {
  name: 'fixture',
  version: '0.1.0',
  capabilities: [
    'generate_specification',
    'generate_tasks',
    'validate_specification',
  ] as ('generate_specification' | 'generate_tasks' | 'validate_specification')[],
};

const CTX = { signal: new AbortController().signal, timeoutMs: 1000, correlationId: 'corr-r' };

const SPEC = {
  id: 's1',
  workspaceId: 'ws_a',
  projectId: 'p1',
  title: 'Approved spec',
  contentRaw: '# Spec\n',
  lifecycleState: 'approved' as const,
};

function engine(descriptions: string[]): SpecificationEngine {
  return {
    descriptor: DESCRIPTOR,
    generateTasks: async () => engineOk(descriptions.map((description) => ({ description })), DESCRIPTOR),
  } as unknown as SpecificationEngine;
}

function build(): { regen: TaskRegenerationService; generator: GenerateTasksService; store: InMemoryTaskStore } {
  const store = new InMemoryTaskStore();
  const generator = new GenerateTasksService(store, new LinkWriterService(new InMemoryTraceabilityLinkStore()));
  return { regen: new TaskRegenerationService(generator, store), generator, store };
}

describe('T097 · regeneration warns before replacing (US4 scenario 4)', () => {
  it('with existing tasks and NO confirmation: warns, names the count, replaces NOTHING', async () => {
    const { regen, generator, store } = build();
    await generator.generate(engine(['Old A', 'Old B']), SPEC, CTX, 'u1');

    const outcome = await regen.regenerate(engine(['New 1']), SPEC, CTX, 'u1', { confirmed: false });

    expect(outcome.requiresConfirmation).toBe(true);
    expect(outcome.existingTaskCount).toBe(2);
    expect(outcome.replaced).toBe(false);
    const kept = await store.listForSpecification('ws_a', 's1');
    expect(kept.map((t) => t.description).sort()).toEqual(['Old A', 'Old B']);
  });

  it('with confirmation: replaces the list', async () => {
    const { regen, generator, store } = build();
    await generator.generate(engine(['Old A', 'Old B']), SPEC, CTX, 'u1');

    const outcome = await regen.regenerate(engine(['New 1', 'New 2', 'New 3']), SPEC, CTX, 'u1', {
      confirmed: true,
    });

    expect(outcome.replaced).toBe(true);
    const now = await store.listForSpecification('ws_a', 's1');
    expect(now.map((t) => t.description).sort()).toEqual(['New 1', 'New 2', 'New 3']);
  });

  it('with NO existing tasks: proceeds without demanding confirmation — there is nothing to warn about', async () => {
    const { regen, store } = build();
    const outcome = await regen.regenerate(engine(['First 1']), SPEC, CTX, 'u1', { confirmed: false });
    expect(outcome.requiresConfirmation).toBe(false);
    expect(outcome.replaced).toBe(true);
    expect(await store.listForSpecification('ws_a', 's1')).toHaveLength(1);
  });

  it('a failed regeneration keeps the OLD list intact — never half-replaced (FR-027)', async () => {
    const { regen, generator, store } = build();
    await generator.generate(engine(['Old A']), SPEC, CTX, 'u1');
    const failing = {
      descriptor: DESCRIPTOR,
      generateTasks: async () => ({ ok: false as const, failure: { reason: 'engine_error' as const, message: 'boom' } }),
    } as unknown as SpecificationEngine;

    await regen.regenerate(failing, SPEC, CTX, 'u1', { confirmed: true }).catch(() => undefined);
    const kept = await store.listForSpecification('ws_a', 's1');
    expect(kept.map((t) => t.description)).toEqual(['Old A']);
  });
});
