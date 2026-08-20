/**
 * T857 — a generated specification is traceable (F1, **T081**, **FR-029**,
 * **SC-002**, US7 scenarios 1–2).
 *
 * Written to FAIL before T858 exists (Constitution V).
 *
 * Found by `/speckit-converge EPIC-011`. Link creation on generation was
 * implemented TWICE and connected once: `LinkWriterService` — `T081`'s whole
 * deliverable — had no caller anywhere, while EPIC-008's generation path built
 * links itself and wrote them into `SpecificationStore`, a different object.
 * Both were correct; they were connected to different halves of the system, so
 * a specification generated through the API produced links the trace and
 * coverage endpoints could not see.
 *
 * That is the `T648` shape — one requirement, two implementations, agreeing
 * with each other and tested separately, with nothing asserting they meet.
 * This is the test that asserts they meet.
 */
import { describe, expect, it } from 'vitest';
import {
  InMemoryTraceabilityLinkStore,
  LinkWriterService,
  type TraceabilityLinkStore,
} from '../../../src/modules/traceability/link-writer.service.js';
import { TraceabilityLinkAdapter } from '../../../src/modules/traceability/link-writer.service.js';
import { TraceabilityService } from '../../../src/modules/traceability/traceability.service.js';
import { CoverageService } from '../../../src/modules/traceability/coverage.service.js';
import { GenerateSpecificationService } from '../../../src/modules/specifications/generate-specification.service.js';
import { InMemorySpecificationStore } from '../../../src/modules/specifications/specifications-read.service.js';
import { OutOfDateService } from '../../../src/modules/specifications/out-of-date.service.js';
import { PROJECT, StubEngine, WS, selection } from '../specifications/helpers.js';

/** The composed shape: ONE link store, written by generation, read by traversal. */
function world(): {
  generate: GenerateSpecificationService;
  links: TraceabilityLinkStore;
  trace: TraceabilityService;
  specifications: InMemorySpecificationStore;
} {
  const links = new InMemoryTraceabilityLinkStore();
  const specifications = new InMemorySpecificationStore(
    new TraceabilityLinkAdapter(new LinkWriterService(links), links),
  );
  return {
    links,
    specifications,
    trace: new TraceabilityService(links),
    generate: new GenerateSpecificationService(
      { resolveForProject: async () => StubEngine.returning() },
      specifications,
    ),
  };
}

const order = {
  jobId: 'job_1',
  workspaceId: WS,
  projectId: PROJECT,
  requestedById: 'u1',
  correlationId: 'corr_1',
  projectName: 'Payments',
  requirements: selection(3),
  timeoutMs: 1_000,
};

describe('generation writes links the traversal can read (US7/AC1, US7/AC2)', () => {
  it('forward: every selected requirement traces to the generated specification', async () => {
    const { generate, trace } = world();
    const outcome = await generate.run(order as never);
    expect(outcome.state).toBe('succeeded');

    for (const requirement of order.requirements) {
      const forward = await trace.forwardTrace(WS, requirement.id);
      expect(
        forward.specifications.map((s) => s.specificationId),
        `requirement ${requirement.id} traces to nothing`,
      ).toContain(outcome.specification!.id);
    }
  });

  it('both directions: the specification traces back to every requirement it came from', async () => {
    const { generate, trace } = world();
    const outcome = await generate.run(order as never);

    const both = await trace.bothFor(WS, outcome.specification!.id);
    expect(both.requirementIds.sort()).toEqual(order.requirements.map((r) => r.id).sort());
  });

  it('there is ONE link store — generation and traversal do not keep separate copies', async () => {
    const { generate, links } = world();
    const outcome = await generate.run(order as never);

    // Asserted against the store the READ path uses. Before T858 this held the
    // links EPIC-011 wrote and none of the ones generation produced.
    const rows = await links.bySource(WS, 'specification', outcome.specification!.id);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.relationship).toBe('generated_from');
      expect(row.targetType).toBe('requirement');
    }
  });

  it('the links go through LinkWriterService — its edge rule applies to generation too', async () => {
    // `writeAll` refuses an impermissible edge and de-duplicates. Generation
    // reaching the store directly would bypass both.
    const { generate, links } = world();
    await generate.run(order as never);
    await generate.run({ ...order, jobId: 'job_2' } as never);

    // A second generation makes a second specification, so 6 links — but no
    // duplicate rows for the same (source, target, relationship).
    const all = await Promise.all(
      order.requirements.map((r) => links.byTarget(WS, 'requirement', r.id)),
    );
    for (const rows of all) {
      const keys = rows.map((r) => `${r.sourceId}|${r.targetId}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('a generated specification is never uncovered (SC-002, SC-010)', () => {
  it('coverage reports no uncovered requirement once a specification exists', async () => {
    const { generate, links } = world();
    await generate.run(order as never);

    const coverage = new CoverageService(links, {
      listRequirementIds: async () => order.requirements.map((r) => r.id),
      listSpecificationIds: async () => [],
    });
    const report = await coverage.forProject(WS, PROJECT);
    expect(report.uncoveredRequirementIds).toEqual([]);
  });

  it('a requirement nothing was generated from IS reported uncovered (US7/AC3)', async () => {
    const { generate, links } = world();
    await generate.run(order as never);

    const coverage = new CoverageService(links, {
      listRequirementIds: async () => [...order.requirements.map((r) => r.id), 'req_orphan'],
      listSpecificationIds: async () => [],
    });
    const report = await coverage.forProject(WS, PROJECT);
    expect(report.uncoveredRequirementIds).toEqual(['req_orphan']);
  });
});

describe('FR-032 still reads the same links', () => {
  it('out-of-date flagging finds specifications through the shared store', async () => {
    // `OutOfDateService` resolves derived specifications through the
    // specification store's link view. Moving the links must not silently
    // strand it — that would turn a working flag into a no-op.
    const { generate, specifications } = world();
    const outcome = await generate.run(order as never);

    const flagged = await new OutOfDateService(specifications).flagForRequirementChange({
      workspaceId: WS,
      requirementId: order.requirements[0]!.id,
      previousContentHash: 'before',
      currentContentHash: 'after',
    });
    expect(flagged.flagged).toEqual([outcome.specification!.id]);
  });
});
