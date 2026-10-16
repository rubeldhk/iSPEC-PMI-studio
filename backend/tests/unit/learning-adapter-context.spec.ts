/**
 * `T2398` (EPIC-048 Phase 9, `R-048-11`, `R-048-13`; `FR-LRN-050`, `-052`,
 * `-054`) — this Epic's two halves of supply, bound into `EPIC-038`.
 *
 * - `KnowledgeIndex` is `EPIC-038`'s `IndexService.reindex`, passed straight
 *   through: its outcome is mapped, its refusals (no embedding provider — the
 *   normal state in this programme) reach `RetrievabilityService` as
 *   themselves, never as a success;
 * - the reader and admission are bound into `ContextModule` through the
 *   binding slot `EPIC-038` exports (`CONTEXT_KNOWLEDGE`), which its sources
 *   adapter and assembly read at call time — so the binding made after the
 *   module is built is the one used;
 * - end to end over the real `KnowledgeReader` and `KnowledgeGate`, an admitted
 *   item's `inclusionReason` begins `approved knowledge —` once, not twice;
 * - a package assembled before a supersession keeps the version it was given,
 *   and inspection notes the drift to the successor.
 *
 * The composed graph's binding is asserted in `learning-reachability.spec.ts`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { KNOWLEDGE_INCLUSION_PREFIX } from '@pmi/learning-contract';
import { GovernanceSeamUnboundError } from '../../src/core/errors.js';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { knowledgeSupplyPorts, unboundKnowledgeSupply, withKnowledgeSupply, type KnowledgeSupplyBinding } from '../../src/modules/context/context.tokens.js';
import { InspectionService } from '../../src/modules/context/inspection.service.js';
import { IndexService } from '../../src/modules/context/retrieval/index.service.js';
import { InMemoryVectorIndex } from '../../src/modules/context/retrieval/vector.index.js';
import { governedSources } from '../../src/modules/context/sources.adapter.js';
import { bindKnowledgeIntoContext, knowledgeIndexAdapter } from '../../src/modules/learning/adapters/context.adapter.js';
import { ApproverGuard } from '../../src/modules/learning/approver.guard.js';
import { DecisionRequester } from '../../src/modules/learning/decision.requester.js';
import { InMemoryKnowledgeWriter } from '../../src/modules/learning/knowledge.writer.js';
import { InMemoryLearningStore } from '../../src/modules/learning/learning.store.js';
import { LearningPolicyReader } from '../../src/modules/learning/learning-policy.js';
import { Materialiser } from '../../src/modules/learning/materialiser.js';
import { SubmissionService, type SubmissionActor } from '../../src/modules/learning/submission.service.js';
import { KnowledgeGate, KnowledgeReader } from '../../src/modules/learning/supply.js';
import { allow, classes, noAuthorisations } from '../helpers/context-fixtures.js';
import { learningWorld, submission, type LearningTestWorld } from '../helpers/learning-ports.js';

describe('T2398 · KnowledgeIndex is EPIC-038’s IndexService.reindex', () => {
  it('passes the version straight through and maps the outcome', async () => {
    const calls: unknown[] = [];
    const port = knowledgeIndexAdapter({
      async reindex(request) {
        calls.push(request);
        return { status: calls.length === 1 ? 'indexed' : 'current', entry: {} as never };
      },
    });
    const input = { workspaceId: 'ws_a', sourceType: 'knowledge-entry' as const, entryId: 'ke_1', versionId: 'kv_1' };
    await expect(port.reindex(input)).resolves.toEqual({ outcome: 'indexed' });
    await expect(port.reindex(input)).resolves.toEqual({ outcome: 'current' });
    expect(calls[0]).toEqual({ workspaceId: 'ws_a', sourceType: 'knowledge-entry', sourceId: 'ke_1', sourceVersion: 'kv_1' });
  });

  it('a real IndexService refuses as itself — no source class (DEF-038-007) here, no embedding provider in the running app — never a success', async () => {
    const index = new IndexService(new InMemoryContextStore(), new InMemoryVectorIndex(), null, null);
    const err = await knowledgeIndexAdapter(index)
      .reindex({ workspaceId: 'ws_a', sourceType: 'knowledge-entry', entryId: 'ke_1', versionId: 'kv_1' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    // EPIC-038's own refusal, never this Epic's "KnowledgeIndex unbound".
    expect(err).not.toBeInstanceOf(GovernanceSeamUnboundError);
    expect((err as Error).message).toMatch(/knowledge-entry/);
    expect((err as Error).message).not.toMatch(/KnowledgeIndex/);
  });
});

describe('T2398 · the reader and admission bound into ContextModule’s slot', () => {
  it('the slot starts unbound, and binding fills both halves', () => {
    const binding = unboundKnowledgeSupply();
    expect(binding).toEqual({ reader: null, admission: null });
    const reader = new KnowledgeReader(new InMemoryLearningStore());
    const gate = new KnowledgeGate({ reads: new InMemoryLearningStore(), ports: learningWorld().ports, policy: new LearningPolicyReader(learningWorld().ports.policy) });
    bindKnowledgeIntoContext(binding, { reader, admission: gate });
    expect(binding.reader).toBe(reader);
    expect(binding.admission).toBe(gate);
  });

  it('assembly reads the slot at call time: unbound excludes with permission; bound later, the same service admits', async () => {
    const binding = unboundKnowledgeSupply();
    const ports = knowledgeSupplyPorts(binding);
    expect(ports.admission).toBeNull();
    expect(ports.knowledge).toBeNull();
    const gate = { async admit() { return [{ admitted: true as const, inclusionNote: 'approved knowledge — entry ke v1, scope workspace' }]; } };
    bindKnowledgeIntoContext(binding, { reader: new KnowledgeReader(new InMemoryLearningStore()), admission: gate });
    expect(ports.admission?.get('knowledge-entry')).toBe(gate);
    expect(ports.admission?.get('requirement')).toBeUndefined();
    expect(ports.knowledge).toBe(binding.reader);
  });
});

// ---------------------------------------------------------------------------
// End to end over this Epic's real reader and gate.

const AGENT: SubmissionActor = { kind: 'agent', workspaceId: 'ws_a', principalId: 'agent_1', projectId: 'p1' };

let world: LearningTestWorld;
let learning: InMemoryLearningStore;
let materialiser: Materialiser;
let submissions: SubmissionService;
let binding: KnowledgeSupplyBinding;

beforeEach(() => {
  world = learningWorld();
  learning = new InMemoryLearningStore();
  const policy = new LearningPolicyReader(world.ports.policy);
  materialiser = new Materialiser({ store: learning, writer: new InMemoryKnowledgeWriter(learning, world.ports.audit), ports: world.ports, policy, guard: new ApproverGuard(world.ports.principals) });
  const requester = new DecisionRequester({ store: learning, ports: world.ports, policy, applyResolution: (c, r) => materialiser.applyResolution(c.workspaceId, c.id, r) });
  submissions = new SubmissionService({ store: learning, ports: world.ports, policy, requestDecision: (c) => requester.request(c) });
  binding = unboundKnowledgeSupply();
  bindKnowledgeIntoContext(binding, {
    reader: new KnowledgeReader(learning),
    admission: new KnowledgeGate({ reads: learning, ports: world.ports, policy }),
  });
});

async function approved(over: Record<string, unknown>): Promise<{ versionId: string; entryId: string }> {
  const out = await submissions.submit({ actor: AGENT, projectId: 'p1', body: submission(over) });
  const resolution = world.decisions.resolveAs(out.body.decisionId!, { outcome: 'approved', actorKind: 'human', decidedBy: 'u_h' });
  const applied = await materialiser.applyResolution('ws_a', out.body.candidateId, resolution);
  return { versionId: applied.versionId!, entryId: applied.entryId! };
}

function contextOver(...found: { entryId: string; versionId: string }[]) {
  const store = new InMemoryContextStore();
  const sources = governedSources({
    requirements: { async get() { throw new Error('unused'); } },
    specifications: { async get() { throw new Error('unused'); }, async versions() { return []; } },
    knowledge: () => binding.reader,
  });
  const assembly = new AssemblyService(store, withKnowledgeSupply({
    retrieval: {
      async search() {
        const candidates = found.map((f) => ({ sourceType: 'knowledge-entry', sourceId: f.entryId, sourceVersion: f.versionId, relevanceScore: 0.9, workspaceId: 'ws_a' }));
        return { requested: candidates.length, returned: candidates.length, candidates, modelId: 'model-a' };
      },
    },
    access: allow(),
    sourceClasses: classes(['knowledge-entry']),
    authorisations: noAuthorisations(),
  }, binding));
  return { store, assembly, inspection: new InspectionService(store, sources, null) };
}

const assembleInput = {
  workspaceId: 'ws_a', projectId: 'p1', executionId: 'ex_1', objective: 'how is the notifier retried',
  actorId: 'u_1', actorRole: 'engineer', budgetTokens: 12000, budgetCost: 40, essentialSources: [],
};

describe('T2398 · end to end over the real reader and gate (FR-LRN-050, FR-LRN-052)', () => {
  it('an admitted knowledge item’s inclusionReason begins “approved knowledge —” exactly once, and reads current', async () => {
    const v1 = await approved({ subject: 'notifier retry' });
    const { store, assembly } = contextOver(v1);
    const result = await assembly.assemble(assembleInput);
    const [item] = await store.itemsFor('ws_a', result.packageId);
    expect(item).toBeDefined();
    expect(item!.inclusionReason.startsWith(`${KNOWLEDGE_INCLUSION_PREFIX} `)).toBe(true);
    expect(item!.inclusionReason.indexOf(KNOWLEDGE_INCLUSION_PREFIX, 1)).toBe(-1);
    expect(item!.inclusionReason).toContain(v1.entryId);
    expect(item!.authoritativeStatus).toBe('current');
  });

  it('a package assembled before a supersession still shows the version supplied, and inspection notes the drift (FR-LRN-054)', async () => {
    const v1 = await approved({ subject: 'notifier retry' });
    const { assembly, inspection } = contextOver(v1);
    const before = await assembly.assemble(assembleInput);

    const v2 = await approved({ subject: 'notifier retry', kind: 'supersede', targetVersionId: v1.versionId, statement: 'retry the notifier twice' });
    expect(v2.entryId).toBe(v1.entryId);

    const inspected = await inspection.inspect('ws_a', before.packageId);
    const item = inspected!.items.find((i) => i.sourceId === v1.entryId)!;
    expect(item.sourceVersion).toBe(v1.versionId);
    expect(item.drift).toMatchObject({ kind: 'moved', currentVersion: v2.versionId });

    // Assembled now, the superseded version is refused as stale, and its successor supplied.
    const { store: after, assembly: again } = contextOver(v1, v2);
    const now = await again.assemble(assembleInput);
    const [excluded] = await after.exclusionsFor('ws_a', now.packageId);
    expect(excluded).toMatchObject({ reason: 'stale', sourceId: v1.entryId });
    expect(excluded!.detail).toBe(`superseded: by ${v2.versionId}`);
    expect((await after.itemsFor('ws_a', now.packageId)).map((i) => i.sourceVersion)).toEqual([v2.versionId]);
  });
});
