/**
 * T338m — analysis runs through `EPIC-028`'s gateway, and **degrades** when it
 * is absent. `R-033-2`, `RULE-03`, `BR-0104`.
 *
 * **No new AI seam, no provider dependency.** `AGENT_CAPABILITIES` already
 * contains `analyze`, and no Room used it. Calling a model provider directly
 * would put a vendor in a Room's business logic, which is the coupling
 * `EPIC-028` exists to remove (`RULE-08`, `BR-0103`).
 *
 * **The asymmetry is the subject of this file.** Four of this Room's five ports
 * refuse when unbound, because each means a governance guarantee cannot be
 * evaluated and proceeding would be indistinguishable from it having passed.
 * `AgentGateway` is the one that degrades: an absent *analysis* provider means
 * the AI could not help, and a human can still clarify, decide and baseline by
 * hand. Refusing there would make the governed path depend on a model being
 * reachable — `RULE-03` inverted.
 *
 * **Degraded is not empty.** The failure this guards is a Room that loses its
 * analysis provider and renders a clean, confident, blank analysis: no
 * conflicts, no questions, nothing wrong. The deterministic half still runs and
 * the AI half says, in the payload, that it did not.
 *
 * **`AgentExecutionRecord` carries no prompt and no model output** (PC-3,
 * Native §7). It is an audit row, and an audit row that quotes the prompt is a
 * transcript nobody agreed to keep.
 */
import { describe, expect, it } from 'vitest';
import { absentBehaviourOf } from '@pmi/room-contract';
import {
  agentFail,
  agentOk,
  type AgentContext,
  type AgentDescriptor,
  type AgentGateway,
  type AgentInvocation,
  type AgentResult,
  type AgentExecutionOutcome,
  type HealthStatus,
} from '@pmi/agent-contract';
import type { ExecResult, ExecutionSession } from '@pmi/execution-contract';
import { AnalysisService } from '../../src/modules/requirement-room/analysis.service.js';
import { IntakeService } from '../../src/modules/requirement-room/intake.service.js';
import { InMemoryRequirementRoomStore } from '../../src/modules/requirement-room/requirement-room.store.js';

const DESCRIPTOR: AgentDescriptor = {
  name: 'probe',
  provider: 'probe-provider',
  model: 'probe-model-1',
  agentVersion: '9.9.9',
  executionType: 'headless',
  capabilities: ['analyze'],
  contextLimitTokens: 100_000,
  toolCapabilities: [],
  supportsMcp: false,
  repositoryCapabilities: ['read'],
  securityClassification: 'internal',
  supportsUnattended: true,
};

/** A real session, not a cast — the interface is four methods. */
class ProbeSession implements ExecutionSession {
  async exec(): Promise<ExecResult> {
    return { exitCode: 0, stdout: '', stderr: '' };
  }
  async writeFile(): Promise<void> {}
  async listFiles(): Promise<string[]> {
    return [];
  }
  async readFile(): Promise<string> {
    return '';
  }
}

const ELEMENTS = JSON.stringify({
  elements: [
    { epistemic: 'inference', text: 'The two intents appear to describe one requirement.' },
    { epistemic: 'open-question', text: 'Which role may approve a baseline?' },
  ],
});

class ProbeGateway implements AgentGateway {
  readonly descriptor = DESCRIPTOR;
  readonly calls: { invocation: AgentInvocation; session: ExecutionSession; ctx: AgentContext }[] =
    [];

  constructor(private readonly outcome: AgentResult<AgentExecutionOutcome>) {}

  getCapabilities(): AgentDescriptor {
    return DESCRIPTOR;
  }
  async healthCheck(): Promise<AgentResult<HealthStatus>> {
    return agentOk({ reachable: true }, DESCRIPTOR);
  }
  async execute(
    invocation: AgentInvocation,
    session: ExecutionSession,
    ctx: AgentContext,
  ): Promise<AgentResult<AgentExecutionOutcome>> {
    this.calls.push({ invocation, session, ctx });
    return this.outcome;
  }
}

const OK = (stdout = ELEMENTS): AgentResult<AgentExecutionOutcome> =>
  agentOk({ exitCode: 0, stdout }, DESCRIPTOR);

async function fixture(gateway?: ProbeGateway) {
  const store = new InMemoryRequirementRoomStore();
  const session = new ProbeSession();
  await new IntakeService(store).intake({
    workspaceId: 'ws_1',
    projectId: 'pr_1',
    roomObjectId: 'ro_1',
    sourceRef: 'direct:2026-08-23',
    sourceKind: 'document',
    text: 'A baseline must be immutable.\n\nAn approver must be named.',
  });
  const analysis = new AnalysisService(store, gateway ? { gateway, session } : undefined);
  return { store, analysis, session };
}

const REQUEST = {
  workspaceId: 'ws_1',
  projectId: 'pr_1',
  roomObjectId: 'ro_1',
  correlationId: 'corr_1',
};

describe('T338m · analysis invokes the EPIC-028 gateway', () => {
  it('asks for the analyze capability and no other', async () => {
    const gateway = new ProbeGateway(OK());
    const { analysis } = await fixture(gateway);

    await analysis.analyze(REQUEST);

    expect(gateway.calls).toHaveLength(1);
    expect(gateway.calls[0]?.invocation.capability).toBe('analyze');
  });

  it('runs inside a session it was given, because agents do not create environments', async () => {
    const gateway = new ProbeGateway(OK());
    const { analysis, session } = await fixture(gateway);

    await analysis.analyze(REQUEST);

    // The whole EPIC-028 separation: an agent runs inside an already-started
    // session. A Room that started its own would be an execution provider.
    expect(gateway.calls[0]?.session).toBe(session);
  });

  it('carries the callers correlation id into the invocation context', async () => {
    const gateway = new ProbeGateway(OK());
    const { analysis } = await fixture(gateway);

    await analysis.analyze(REQUEST);

    expect(gateway.calls[0]?.ctx.correlationId).toBe('corr_1');
  });

  it('reports the analysis as available and returns its labelled elements', async () => {
    const gateway = new ProbeGateway(OK());
    const { analysis } = await fixture(gateway);

    const result = await analysis.analyze(REQUEST);

    expect(result.aiAvailable).toBe(true);
    expect(result.elements.map((e) => e.epistemic)).toEqual(['inference', 'open-question']);
  });
});

describe('T338m · every invocation leaves an AgentExecutionRecord', () => {
  it('records the provider, model and outcome from the gateways own descriptor', async () => {
    const gateway = new ProbeGateway(OK());
    const { analysis } = await fixture(gateway);

    const result = await analysis.analyze(REQUEST);

    // BR-0104: every AI clarification is attributable. Taken from `producedBy`
    // rather than from configuration, so the record names what actually ran.
    expect(result.record).toMatchObject({
      provider: 'probe-provider',
      model: 'probe-model-1',
      agentVersion: '9.9.9',
      correlationId: 'corr_1',
      status: 'succeeded',
    });
    expect(result.record?.executionId).toBeTruthy();
  });

  it('records a failed invocation as failed, with the gateways reason', async () => {
    const gateway = new ProbeGateway(
      agentFail<AgentExecutionOutcome>('agent_unavailable', 'the provider did not answer'),
    );
    const { analysis } = await fixture(gateway);

    const result = await analysis.analyze(REQUEST);

    expect(result.record?.status).toBe('failed');
    expect(result.record?.failureReason).toBe('agent_unavailable');
  });

  it('never carries the prompt or the model output — PC-3, Native section 7', async () => {
    const gateway = new ProbeGateway(OK('a sentence the model produced'));
    const { analysis } = await fixture(gateway);

    const result = await analysis.analyze(REQUEST);
    const serialised = JSON.stringify(result.record);

    // An audit row that quotes the prompt is a transcript nobody agreed to keep.
    expect(serialised).not.toContain('a sentence the model produced');
    expect(serialised).not.toMatch(/immutable/);
  });

  it('gives each invocation its own execution id', async () => {
    const gateway = new ProbeGateway(OK());
    const { analysis } = await fixture(gateway);

    const first = await analysis.analyze(REQUEST);
    const second = await analysis.analyze(REQUEST);

    expect(first.record?.executionId).not.toBe(second.record?.executionId);
  });
});

describe('T338m · an absent gateway degrades, and never refuses', () => {
  it('agrees with the shared contract rather than restating it', () => {
    expect(absentBehaviourOf('AgentGateway')).toBe('degrade');
  });

  it('keeps the asymmetry — the other four refuse', () => {
    // Three Epics inherit ROOM_PORTS. If someone softens one of these to
    // `degrade`, this Room stops being the place the asymmetry is asserted.
    expect(absentBehaviourOf('LoopEngine')).toBe('refuse');
    expect(absentBehaviourOf('PolicyProvider')).toBe('refuse');
    expect(absentBehaviourOf('EvidenceContractSource')).toBe('refuse');
    expect(absentBehaviourOf('RequirementRegister')).toBe('refuse');
  });

  it('returns an analysis rather than throwing', async () => {
    const { analysis } = await fixture();

    const result = await analysis.analyze(REQUEST);

    expect(result.aiAvailable).toBe(false);
    expect(result.record).toBeNull();
  });

  it('says why, in the payload, so the absence is visible to a reader', async () => {
    const { analysis } = await fixture();

    const result = await analysis.analyze(REQUEST);

    // The failure this guards: a Room that loses its provider and renders a
    // clean, confident, blank analysis.
    expect(result.degradedReason).toMatch(/EPIC-028/);
    expect(result.elements).toEqual([]);
  });

  it('still runs the half that needs no model', async () => {
    const { analysis } = await fixture();

    const result = await analysis.analyze(REQUEST);

    // Conflicts, duplicates and gaps are computed from the candidate set and
    // the baselines. None of it needs a model, and a human can act on all of
    // it — which is precisely why refusing here would be wrong.
    expect(result.findings).toBeDefined();
    expect(Array.isArray(result.findings)).toBe(true);
  });

  it('degrades the same way when the gateway answers but fails', async () => {
    const gateway = new ProbeGateway(
      agentFail<AgentExecutionOutcome>('timeout', 'the provider timed out'),
    );
    const { analysis } = await fixture(gateway);

    const result = await analysis.analyze(REQUEST);

    // "The AI could not help" is one outcome, whether the seam was unbound or
    // the call failed. Two shapes for it would mean two code paths for the
    // caller, and one of them would eventually stop being handled.
    expect(result.aiAvailable).toBe(false);
    expect(result.degradedReason).toMatch(/timeout|timed out/i);
  });
});
