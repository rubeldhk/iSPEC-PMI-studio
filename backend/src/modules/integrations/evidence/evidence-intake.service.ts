/**
 * `T2184` (EPIC-039, `BR-0125`, `FR-HUB-050`–`FR-HUB-055`, `R-039-11`) —
 * evidence intake: an external result read **through a capability** and
 * contributed to `EPIC-032`'s store as typed evidence, or recorded as why not.
 *
 * The order a due intake is worked, each step recorded where it decides:
 *
 * 1. past `giveUpAt` → `gave-up / bound-exceeded`, nothing contributed;
 * 2. `EvidenceSink` unbound → `refused / evidence-seam-unbound`, nothing read
 *    (`FR-HUB-055` — the item stays unmet);
 * 3. no binding at `CompletionGate.evaluate` → `not-contributed / no-binding`,
 *    the provider not read (`DEF-032-002`);
 * 4. the capability resolved **in process as `evidence-intake`** — a refusal
 *    is `refused / resolution-refused:<code>`;
 * 5. `final: false` → `pending / not-final`, re-read every 120 s;
 * 6. final → one in-toto Statement, the predicate **inline** (never
 *    referenced — the `DEF-032-004` residual), contributed through the sink; a
 *    store fault is `refused / evidence-store-refused`, never a success.
 *
 * A missing revision is refused at enqueue and recorded first (`FR-HUB-053`).
 */
import { NotFoundError, ValidationFailedError } from '../../../core/errors.js';
import { bindingFor } from '../adapter-context.js';
import type { Clock, EvidenceSinkSeam } from '../integrations.tokens.js';
import type { IntakeRecord, IntegrationsStore } from '../integrations.store.js';
import type { CapabilityRequests } from '../requests/capability-requests.service.js';

/** Re-read interval for a non-final result (`FR-HUB-054`, `R-039-11`). */
export const INTAKE_RETRY_SECONDS = 120;
/** The bound after which a non-final result is given up (`R-039-11`). */
export const INTAKE_GIVE_UP_SECONDS = 1800;
/** At most this many intakes worked per tick. */
export const INTAKE_BATCH = 25;

export const TEST_RESULT_PREDICATE = 'https://in-toto.io/attestation/test-result/v0.1';
export const EXTERNAL_OUTPUT_PREDICATE = 'https://pmi.studio/attestation/external-output/v1';
export const IN_TOTO_STATEMENT = 'https://in-toto.io/Statement/v1';

const EVIDENCE_CAPABILITIES = ['ReadTestResults', 'ReadBuildStatus'] as const;
type EvidenceCapability = (typeof EVIDENCE_CAPABILITIES)[number];

export interface IntakeView {
  readonly intakeId: string;
  readonly projectId: string;
  readonly workRef: Readonly<Record<string, unknown>>;
  readonly contractItemId: string;
  readonly capability: EvidenceCapability;
  readonly revision: string | null;
  readonly state: IntakeRecord['state'];
  readonly reason: string | null;
  readonly attempts: number;
  readonly resolutionIds: readonly string[];
  readonly attestationId: string | null;
  readonly nextAttemptAt: string | null;
  readonly giveUpAt: string;
}

export interface IntakeDeps {
  readonly store: IntegrationsStore;
  readonly requests: CapabilityRequests;
  readonly evidence: EvidenceSinkSeam;
  readonly clock: Clock;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function view(r: IntakeRecord): IntakeView {
  return {
    intakeId: r.id,
    projectId: r.projectId,
    workRef: r.workRef,
    contractItemId: r.contractItemId,
    capability: r.capability,
    revision: r.revision,
    state: r.state,
    reason: r.reason,
    attempts: r.attempts,
    resolutionIds: r.resolutionIds,
    attestationId: r.attestationId,
    nextAttemptAt: r.nextAttemptAt === null ? null : r.nextAttemptAt.toISOString(),
    giveUpAt: r.giveUpAt.toISOString(),
  };
}

export class EvidenceIntakeService {
  constructor(private readonly deps: IntakeDeps) {}

  async enqueue(actor: { workspaceId: string; userId: string }, projectId: string, body: Record<string, unknown>): Promise<{ intakeId: string }> {
    const fields: { field: string; reason: string }[] = [];
    const capability = body['capability'];
    if (typeof capability !== 'string' || !(EVIDENCE_CAPABILITIES as readonly string[]).includes(capability)) {
      fields.push({ field: 'capability', reason: `one of ${EVIDENCE_CAPABILITIES.join(', ')} — the capabilities that yield evidence` });
    }
    const workRef = body['workRef'];
    if (!isRecord(workRef) || typeof workRef['type'] !== 'string' || typeof workRef['id'] !== 'string') fields.push({ field: 'workRef', reason: '{ type, id }' });
    const contractItemId = body['contractItemId'];
    if (typeof contractItemId !== 'string' || contractItemId.length === 0) fields.push({ field: 'contractItemId', reason: 'required' });
    const attested = body['attestedArtifact'];
    if (attested !== undefined && attested !== null && !isRecord(attested)) fields.push({ field: 'attestedArtifact', reason: '{ id, version }' });
    if (fields.length > 0) throw new ValidationFailedError('The evidence-intake request is malformed.', { fields });

    const revision = typeof body['revision'] === 'string' && body['revision'].length > 0 ? body['revision'] : null;
    const now = this.deps.clock();
    const row = await this.deps.store.createIntake({
      workspaceId: actor.workspaceId,
      projectId,
      workRef: workRef as Record<string, unknown>,
      contractItemId: contractItemId as string,
      capability: capability as EvidenceCapability,
      revision,
      attestedArtifact: isRecord(attested) ? attested : null,
      state: revision === null ? 'not-contributed' : 'pending',
      reason: revision === null ? 'no-revision' : null,
      resolutionIds: [],
      attestationId: null,
      attempts: 0,
      nextAttemptAt: revision === null ? null : now,
      giveUpAt: new Date(now.getTime() + INTAKE_GIVE_UP_SECONDS * 1000),
      requestedBy: actor.userId,
    });
    if (revision === null) {
      throw new ValidationFailedError('revision is required: evidence is about a commit, and without one there is nothing to attest (FR-HUB-053). Recorded as not-contributed / no-revision.', {
        intakeId: row.id,
        fields: [{ field: 'revision', reason: 'required' }],
      });
    }
    return { intakeId: row.id };
  }

  async view(actor: { workspaceId: string }, projectId: string, intakeId: string): Promise<IntakeView> {
    const row = await this.deps.store.findIntake(actor.workspaceId, intakeId);
    if (row === null || row.projectId !== projectId) throw new NotFoundError('No such evidence intake in this project.');
    return view(row);
  }

  /** The `integrations.evidence-intake` job body: work every due intake once. */
  async runDue(): Promise<{ attempted: number }> {
    const due = await this.deps.store.listDueIntakes(this.deps.clock(), INTAKE_BATCH);
    for (const row of due) await this.work(row);
    return { attempted: due.length };
  }

  private async settle(row: IntakeRecord, change: Partial<Pick<IntakeRecord, 'state' | 'reason' | 'resolutionIds' | 'attestationId' | 'nextAttemptAt'>>, attempted: boolean): Promise<void> {
    await this.deps.store.updateIntake(row.workspaceId, row.id, {
      nextAttemptAt: null,
      ...change,
      attempts: row.attempts + (attempted ? 1 : 0),
    });
  }

  private async work(row: IntakeRecord): Promise<void> {
    const now = this.deps.clock();
    if (now.getTime() >= row.giveUpAt.getTime()) {
      await this.settle(row, { state: 'gave-up', reason: 'bound-exceeded' }, false);
      return;
    }
    if (!this.deps.evidence.isBound()) {
      await this.settle(row, { state: 'refused', reason: 'evidence-seam-unbound' }, true);
      return;
    }
    const sink = this.deps.evidence.port();
    let bound: boolean;
    try {
      bound = await sink.bindingExists(row.workspaceId, row.workRef, row.contractItemId);
    } catch (err) {
      await this.settle(row, { state: 'refused', reason: `evidence-store-refused: ${err instanceof Error ? err.message : 'unknown'}` }, true);
      return;
    }
    if (!bound) {
      await this.settle(row, { state: 'not-contributed', reason: 'no-binding' }, true);
      return;
    }

    const response = await this.deps.requests.request(
      { workspaceId: row.workspaceId, userId: row.requestedBy },
      row.projectId,
      { capability: row.capability, major: 1, caller: 'evidence-intake', input: { revision: row.revision } },
      { http: false },
    );
    const resolutionIds = [...row.resolutionIds, response.resolutionId];
    if (response.outcome === 'refused') {
      await this.settle(row, { state: 'refused', reason: `resolution-refused:${response.refusal?.code ?? 'unknown'}`, resolutionIds }, true);
      return;
    }
    if (response.invocation?.outcome !== 'succeeded' || !isRecord(response.result)) {
      await this.settle(row, { state: 'refused', reason: `invocation-failed:${response.invocation?.errorCategory ?? 'unknown'}`, resolutionIds }, true);
      return;
    }
    const output = response.result;
    if (output['final'] !== true) {
      const next = new Date(now.getTime() + INTAKE_RETRY_SECONDS * 1000);
      await this.settle(row, { state: 'pending', reason: 'not-final', resolutionIds, nextAttemptAt: next }, true);
      return;
    }

    const resolution = response.resolution!;
    const repository = await this.repositoryOf(row, resolution.adapterKey);
    const attestation = this.statement(row, output, resolution, repository);
    try {
      const { attestationId } = await sink.contribute({
        workspaceId: row.workspaceId,
        projectId: row.projectId,
        principalId: row.requestedBy,
        workRef: row.workRef,
        contractItemId: row.contractItemId,
        attestedArtifact: row.attestedArtifact,
        attestation,
        source: { uri: `pmi-adapter:${resolution.adapterKey}`, version: resolution.adapterVersion },
      });
      await this.settle(row, { state: 'contributed', reason: null, resolutionIds, attestationId }, true);
    } catch (err) {
      await this.settle(row, { state: 'refused', reason: `evidence-store-refused: ${err instanceof Error ? err.message : 'unknown'}`, resolutionIds, attestationId: null }, true);
    }
  }

  private async repositoryOf(row: IntakeRecord, adapterKey: string): Promise<string | null> {
    const configuration = await this.deps.store.getConfiguration(row.workspaceId, row.projectId, row.capability);
    const entry = await this.deps.store.findEntryByKey(row.workspaceId, adapterKey);
    const repo = entry === null ? undefined : bindingFor(configuration, entry.id)['repository'];
    return typeof repo === 'string' ? repo : null;
  }

  private statement(
    row: IntakeRecord,
    output: Record<string, unknown>,
    resolution: { contractVersion: string; adapterKey: string; adapterVersion: string; provider: string },
    repository: string | null,
  ): Record<string, unknown> {
    const revision = row.revision!;
    const subject = [{ name: `${repository ?? resolution.adapterKey}@${revision}`, digest: { gitCommit: revision } }];
    if (row.capability === 'ReadTestResults') {
      return {
        _type: IN_TOTO_STATEMENT,
        subject,
        predicateType: TEST_RESULT_PREDICATE,
        predicate: {
          result: output['result'],
          passedTests: Array.isArray(output['passedTests']) ? output['passedTests'] : [],
          failedTests: Array.isArray(output['failedTests']) ? output['failedTests'] : [],
          warnedTests: [],
          ...(typeof output['url'] === 'string' ? { url: output['url'] } : {}),
        },
      };
    }
    return {
      _type: IN_TOTO_STATEMENT,
      subject,
      predicateType: EXTERNAL_OUTPUT_PREDICATE,
      predicate: {
        capability: row.capability,
        contractVersion: resolution.contractVersion,
        adapter: resolution.adapterKey,
        adapterVersion: resolution.adapterVersion,
        provider: resolution.provider,
        output,
      },
    };
  }
}
