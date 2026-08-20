/**
 * Shared fixture for the traceability suite. Non-spec module so importing it
 * does not re-register another file's tests (the EPIC-007 lesson).
 *
 * The graph:
 *   r1 ← s1 ← {t1, t2}     (s1 generated from r1 and r2)
 *   r2 ← s1
 *   r1 ← s2                (s2 generated from r1; no tasks yet)
 *   r_retired ← s1         (link to a retired requirement — flagged, kept)
 *   r_uncovered            (no specification at all)
 *   t_orphan               (a task with no links — SC-003 red flag)
 */
import {
  InMemoryTraceabilityLinkStore,
  LinkWriterService,
} from '../../../src/modules/traceability/link-writer.service.js';
import { TraceabilityService } from '../../../src/modules/traceability/traceability.service.js';

export async function buildTraceFixture(): Promise<{
  service: TraceabilityService;
  store: InMemoryTraceabilityLinkStore;
  writer: LinkWriterService;
}> {
  const store = new InMemoryTraceabilityLinkStore();
  const writer = new LinkWriterService(store);

  await writer.linkSpecificationToRequirements({
    workspaceId: 'ws_a',
    specificationId: 's1',
    requirementIds: ['r1', 'r2', 'r_retired'],
  });
  await writer.linkSpecificationToRequirements({
    workspaceId: 'ws_a',
    specificationId: 's2',
    requirementIds: ['r1'],
  });
  await writer.linkTasksToSpecification({
    workspaceId: 'ws_a',
    specificationId: 's1',
    taskIds: ['t1', 't2'],
  });

  return { service: new TraceabilityService(store), store, writer };
}
