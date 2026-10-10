/**
 * `T2183` (EPIC-039, `FR-HUB-050`–`FR-HUB-055`, `R-039-11`) — evidence intake:
 * external results read through a capability and contributed as typed
 * evidence, or recorded as why not.
 *
 * Written to FAIL before `T2184`.
 */
import { describe, expect, it } from 'vitest';
import type { EvidenceContribution, EvidenceSink } from '../../src/modules/integrations/integrations.tokens.js';
import { INTAKE_GIVE_UP_SECONDS, INTAKE_RETRY_SECONDS } from '../../src/modules/integrations/evidence/evidence-intake.service.js';
import { OWNER, PROJECT, SHA, WS, configure, testHub } from './integrations-hub.fixture.js';

const ACTOR = { workspaceId: WS, userId: OWNER };
const BODY = { workRef: { type: 'task', id: 'tk_1' }, contractItemId: 'tests-pass', capability: 'ReadTestResults', revision: SHA, attestedArtifact: { id: 'art_1', version: 3 } };

function recordingSink(opts: { binding?: boolean; fail?: boolean } = {}): EvidenceSink & { contributions: EvidenceContribution[] } {
  const contributions: EvidenceContribution[] = [];
  return {
    contributions,
    bindingExists: async () => opts.binding ?? true,
    contribute: async (c) => {
      if (opts.fail) throw new Error('the evidence store could not be reached (FR-EVS-035)');
      contributions.push(c);
      return { attestationId: `att_${contributions.length}` };
    },
  };
}

async function hubWithResults(script: Record<string, unknown> = {}) {
  const hub = testHub();
  await configure(hub, 'ReadTestResults', ['fixture-ci']);
  if (Object.keys(script).length > 0) {
    const e = await hub.entry('fixture-ci');
    await hub.configuration.put(ACTOR, PROJECT, 'ReadTestResults', { adapters: [{ registryEntryId: e.id, preference: 1, binding: { repository: 'acme/widgets', script } }] });
  }
  return hub;
}

describe('T2183 · enqueue (FR-HUB-053)', () => {
  it('no revision is recorded not-contributed / no-revision, then refused 400', async () => {
    const hub = await hubWithResults();
    const { revision: _r, ...noRevision } = BODY;
    const err = await hub.intake.enqueue(ACTOR, PROJECT, noRevision).catch((e: unknown) => e as { code?: string; details?: { intakeId?: string } });
    expect(err).toMatchObject({ code: 'validation_failed' });
    const id = (err as { details: { intakeId: string } }).details.intakeId;
    expect(await hub.intake.view(ACTOR, PROJECT, id)).toMatchObject({ state: 'not-contributed', reason: 'no-revision', attempts: 0 });
  });

  it('refuses a capability that yields no evidence', async () => {
    const hub = await hubWithResults();
    await expect(hub.intake.enqueue(ACTOR, PROJECT, { ...BODY, capability: 'SendNotification' })).rejects.toMatchObject({ code: 'validation_failed' });
  });

  it('a valid request is pending, due now, with a give-up instant 30 minutes out', async () => {
    const hub = await hubWithResults();
    const { intakeId } = await hub.intake.enqueue(ACTOR, PROJECT, BODY);
    const row = await hub.intake.view(ACTOR, PROJECT, intakeId);
    expect(row).toMatchObject({ state: 'pending', attempts: 0 });
    expect(INTAKE_GIVE_UP_SECONDS).toBe(1800);
    expect(new Date(row.giveUpAt).getTime() - hub.clock.now.getTime()).toBe(1800_000);
  });

  it('an intake in another project is not found', async () => {
    const hub = await hubWithResults();
    const { intakeId } = await hub.intake.enqueue(ACTOR, PROJECT, BODY);
    await expect(hub.intake.view(ACTOR, 'pr_beta', intakeId)).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('T2183 · the job (FR-HUB-050–FR-HUB-055)', () => {
  it('while EvidenceSink is unbound: refused / evidence-seam-unbound, nothing read, nothing contributed', async () => {
    const hub = await hubWithResults();
    const { intakeId } = await hub.intake.enqueue(ACTOR, PROJECT, BODY);
    expect(await hub.intake.runDue()).toMatchObject({ attempted: 1 });
    expect(await hub.intake.view(ACTOR, PROJECT, intakeId)).toMatchObject({ state: 'refused', reason: 'evidence-seam-unbound', resolutionIds: [] });
  });

  it('no binding at the gate: not-contributed / no-binding, and the provider is not read', async () => {
    const hub = await hubWithResults();
    const sink = recordingSink({ binding: false });
    hub.evidenceSeam.bind(sink);
    const { intakeId } = await hub.intake.enqueue(ACTOR, PROJECT, BODY);
    await hub.intake.runDue();
    expect(await hub.intake.view(ACTOR, PROJECT, intakeId)).toMatchObject({ state: 'not-contributed', reason: 'no-binding', resolutionIds: [] });
    expect(sink.contributions).toEqual([]);
  });

  it('a final result is contributed as an in-toto Statement with a gitCommit subject and the predicate inline', async () => {
    const hub = await hubWithResults();
    const sink = recordingSink();
    hub.evidenceSeam.bind(sink);
    const { intakeId } = await hub.intake.enqueue(ACTOR, PROJECT, BODY);
    await hub.intake.runDue();
    const row = await hub.intake.view(ACTOR, PROJECT, intakeId);
    expect(row).toMatchObject({ state: 'contributed', reason: null, attestationId: 'att_1', attempts: 1 });
    expect(row.resolutionIds).toHaveLength(1);
    const [c] = sink.contributions;
    expect(c).toMatchObject({ workspaceId: WS, projectId: PROJECT, principalId: OWNER, workRef: BODY.workRef, contractItemId: 'tests-pass', attestedArtifact: BODY.attestedArtifact, source: { uri: 'pmi-adapter:fixture-ci', version: '0.1.0' } });
    expect(c!.attestation).toMatchObject({
      _type: 'https://in-toto.io/Statement/v1',
      subject: [{ digest: { gitCommit: SHA } }],
      predicateType: 'https://in-toto.io/attestation/test-result/v0.1',
      predicate: { result: 'PASSED', warnedTests: [] },
    });
    const predicate = (c!.attestation as { predicate: Record<string, unknown> }).predicate;
    expect(Array.isArray(predicate['passedTests'])).toBe(true);
    expect(Array.isArray(predicate['failedTests'])).toBe(true);
    expect(c).not.toHaveProperty('reference'); // inline, never referenced (DEF-032-004)
  });

  it(`final: false stays pending and is re-read every ${INTAKE_RETRY_SECONDS} s, contributing only once final`, async () => {
    const hub = await hubWithResults({ finalAfterReads: 2 });
    const sink = recordingSink();
    hub.evidenceSeam.bind(sink);
    const { intakeId } = await hub.intake.enqueue(ACTOR, PROJECT, BODY);
    await hub.intake.runDue();
    let row = await hub.intake.view(ACTOR, PROJECT, intakeId);
    expect(row).toMatchObject({ state: 'pending', reason: 'not-final', attempts: 1 });
    expect(new Date(row.nextAttemptAt!).getTime() - hub.clock.now.getTime()).toBe(INTAKE_RETRY_SECONDS * 1000);
    expect(await hub.intake.runDue()).toMatchObject({ attempted: 0 }); // not due yet
    hub.clock.advance(INTAKE_RETRY_SECONDS * 1000);
    await hub.intake.runDue();
    hub.clock.advance(INTAKE_RETRY_SECONDS * 1000);
    await hub.intake.runDue();
    row = await hub.intake.view(ACTOR, PROJECT, intakeId);
    expect(row).toMatchObject({ state: 'contributed', attempts: 3 });
    expect(row.resolutionIds).toHaveLength(3);
    expect(sink.contributions).toHaveLength(1);
  });

  it('gives up at giveUpAt with the reason, having contributed nothing', async () => {
    const hub = await hubWithResults({ invoke: 'non-final' });
    const sink = recordingSink();
    hub.evidenceSeam.bind(sink);
    const { intakeId } = await hub.intake.enqueue(ACTOR, PROJECT, BODY);
    for (let i = 0; i < 20; i++) {
      await hub.health.runDueHealthChecks(); // the health ticker runs alongside, as in production, so health never goes stale
      await hub.intake.runDue();
      hub.clock.advance(INTAKE_RETRY_SECONDS * 1000);
    }
    expect(await hub.intake.view(ACTOR, PROJECT, intakeId)).toMatchObject({ state: 'gave-up', reason: 'bound-exceeded' });
    expect(sink.contributions).toEqual([]);
  });

  it('a refused resolution is recorded refused with its code; nothing contributed (FR-HUB-055)', async () => {
    const hub = await hubWithResults();
    const sink = recordingSink();
    hub.evidenceSeam.bind(sink);
    hub.policy!.set('not-permitted');
    const { intakeId } = await hub.intake.enqueue(ACTOR, PROJECT, BODY);
    await hub.intake.runDue();
    const row = await hub.intake.view(ACTOR, PROJECT, intakeId);
    expect(row).toMatchObject({ state: 'refused', reason: 'resolution-refused:no-eligible-adapter' });
    expect(row.resolutionIds).toHaveLength(1);
    expect(sink.contributions).toEqual([]);
  });

  it('the resolution is made as the evidence-intake caller, in process', async () => {
    const hub = await hubWithResults();
    hub.evidenceSeam.bind(recordingSink());
    const { intakeId } = await hub.intake.enqueue(ACTOR, PROJECT, BODY);
    await hub.intake.runDue();
    const row = await hub.intake.view(ACTOR, PROJECT, intakeId);
    const resolutions = await hub.store.listResolutions(WS, { projectId: PROJECT, limit: 10 });
    expect(resolutions.find((r) => r.id === row.resolutionIds[0])).toMatchObject({ caller: 'evidence-intake', capability: 'ReadTestResults', outcome: 'resolved' });
  });

  it('a store fault is a refusal, never a success', async () => {
    const hub = await hubWithResults();
    hub.evidenceSeam.bind(recordingSink({ fail: true }));
    const { intakeId } = await hub.intake.enqueue(ACTOR, PROJECT, BODY);
    await hub.intake.runDue();
    const row = await hub.intake.view(ACTOR, PROJECT, intakeId);
    expect(row.state).toBe('refused');
    expect(row.reason).toMatch(/^evidence-store-refused/);
    expect(row.attestationId).toBeNull();
  });

  it('ReadBuildStatus contributes the PMI external-output predicate naming capability, contract, adapter and provider', async () => {
    const hub = testHub();
    await configure(hub, 'ReadBuildStatus', ['fixture-ci']);
    const sink = recordingSink();
    hub.evidenceSeam.bind(sink);
    await hub.intake.enqueue(ACTOR, PROJECT, { ...BODY, capability: 'ReadBuildStatus' });
    await hub.intake.runDue();
    expect(sink.contributions[0]!.attestation).toMatchObject({
      predicateType: 'https://pmi.studio/attestation/external-output/v1',
      predicate: { capability: 'ReadBuildStatus', contractVersion: '1.0', adapter: 'fixture-ci', adapterVersion: '0.1.0', provider: 'fixture', output: { revision: SHA, final: true } },
    });
  });
});
