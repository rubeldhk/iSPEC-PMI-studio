/**
 * `T2203` (EPIC-039, `FR-HUB-080`–`FR-HUB-087`, `R-039-18` Decision 1) —
 * `HubEmbeddingPort`: `EPIC-038`'s `EmbeddingPort`, filled by the Hub with no
 * change to its shape.
 *
 * - `modelId` and `dimension` are read **synchronously** from the deployment
 *   binding snapshot taken at boot (`DeploymentBindingService`).
 * - Each `embed(texts)` is **one deployment-scope resolution** (no workspace,
 *   caller `context-assembly`) through the same `evaluateCandidates` core,
 *   recorded **before** the adapter is called, with `modelIdentity`. Policy
 *   reads *not applicable*: `EPIC-031` policy is per project, and this binding
 *   is deployment configuration (`FR-HUB-023` — a reason, not a blank).
 * - The contract's limits are refused before anything is sent:
 *   more than 64 texts → `batch-too-large`; a text over 8,000 characters →
 *   `text-too-long` naming its index (`FR-HUB-083`).
 * - Unbound or ineligible → `GovernanceSeamUnboundError` naming
 *   **`EmbeddingPort`**, with the Hub's explanation — `EPIC-038`'s existing
 *   `503`, now saying why (`FR-HUB-085`).
 * - An adapter fault or failure never returns vectors: the output is checked
 *   as `embedChecked` would check it, recorded `adapter-fault`, and raised as
 *   `ProviderUnavailableError`.
 */
import { contractFor, evaluateCandidates, type AdapterResult, type CandidateFacts } from '@pmi/capability-contract';
import { GovernanceSeamUnboundError, ProviderUnavailableError, ValidationFailedError } from '../../../core/errors.js';
import type { EmbeddingPort } from '../../context/retrieval/embedding.port.js';
import { adapterContext, TIMEOUTS_MS, withTimeout } from '../adapter-context.js';
import type { AdapterCatalog } from '../catalog.service.js';
import type { Clock } from '../integrations.tokens.js';
import type { IntegrationsStore, ResolutionInput, ResolutionRecord } from '../integrations.store.js';
import { checkOutput } from '../requests/output-validation.js';
import { candidateViews, storedReasons } from '../resolver/explanation.js';
import type { DeploymentBindingService } from './deployment-binding.service.js';

export const EMBED_MAX_TEXTS = 64;
export const EMBED_MAX_TEXT_LENGTH = 8000;
export const EMBED_CALLER = 'context-assembly';
const ACTOR = 'system:context-assembly';
const POLICY_NOT_APPLICABLE = 'not applicable — deployment-scope binding, set by deployment configuration; EPIC-031 policy is per project';

export interface HubEmbeddingDeps {
  readonly deployment: DeploymentBindingService;
  readonly catalog: AdapterCatalog;
  readonly store: IntegrationsStore;
  readonly clock: Clock;
}

function unbound(explanation: string): GovernanceSeamUnboundError {
  return new GovernanceSeamUnboundError(
    `no embedding provider is available to EmbeddingPort (FR-CTX-013): the Integration Hub's Embed binding is not usable — ${explanation} (EPIC-039 FR-HUB-085). Refusing rather than ranking by a stand-in, because an unranked package would be a different thing rather than a degraded one (FR-CTX-012).`,
    { seam: 'EmbeddingPort' },
  );
}

export class HubEmbeddingPort implements EmbeddingPort {
  constructor(private readonly deps: HubEmbeddingDeps) {}

  get modelId(): string {
    return this.deps.deployment.snapshot().modelId ?? 'unbound';
  }

  get dimension(): number {
    return this.deps.deployment.snapshot().dimension ?? 0;
  }

  private base(over: Partial<ResolutionInput> & Pick<ResolutionInput, 'outcome' | 'reasons'>): ResolutionInput {
    return {
      workspaceId: null,
      scope: 'deployment',
      projectId: null,
      caller: EMBED_CALLER,
      actorPrincipalId: ACTOR,
      executionId: null,
      capability: 'Embed',
      requestedMajor: 1,
      contractVersion: null,
      refusalCode: null,
      registryEntryId: null,
      adapterKey: null,
      adapterVersion: null,
      provider: null,
      modelIdentity: null,
      scopeGranted: null,
      decidedAt: this.deps.clock(),
      ...over,
    };
  }

  private async refuseLimit(code: 'batch-too-large' | 'text-too-long', message: string): Promise<never> {
    await this.deps.store.appendResolution(this.base({ outcome: 'refused', refusalCode: code, reasons: { rule: code, message, candidates: [] } }));
    throw new ValidationFailedError(`EmbeddingPort: ${code} — ${message}`, { refusal: code });
  }

  async embed(texts: readonly string[]): Promise<number[][]> {
    if (texts.length > EMBED_MAX_TEXTS) await this.refuseLimit('batch-too-large', `${texts.length} texts; the Embed contract admits ${EMBED_MAX_TEXTS} (FR-HUB-083)`);
    const long = texts.findIndex((t) => t.length > EMBED_MAX_TEXT_LENGTH);
    if (long >= 0) await this.refuseLimit('text-too-long', `the text at index ${long} has ${texts[long]!.length} characters; the Embed contract admits ${EMBED_MAX_TEXT_LENGTH} (FR-HUB-083)`);

    const snap = this.deps.deployment.snapshot();
    const contract = contractFor('Embed', 1)!;
    const adapter = snap.adapterKey === null ? null : this.deps.catalog.adapter(snap.adapterKey);
    const facts: CandidateFacts[] =
      snap.adapterKey === null
        ? []
        : [
            {
              entryKey: snap.adapterKey,
              direction: 'outbound',
              inBuild: adapter !== null,
              active: true,
              majors: adapter?.descriptor.implements.find((i) => i.capability === 'Embed')?.majors ?? [],
              configured: snap.reason !== 'binding-invalid' && snap.reason !== 'model-not-listed',
              preference: 1,
              credential: 'not-required',
              health: { state: snap.health, ...(snap.reason !== null ? { reason: snap.reason } : {}) },
              permitDegraded: true,
              environmentPermitted: true,
              policy: { status: 'not-applicable', reason: POLICY_NOT_APPLICABLE },
            },
          ];
    const outcome = evaluateCandidates({ capability: 'Embed', major: 1 }, facts);
    if (outcome.outcome === 'refused' || adapter === null || snap.observedModel === null || snap.modelId === null || snap.dimension === null) {
      const explanation = snap.explanation ?? (outcome.outcome === 'refused' ? `${outcome.code}: ${candidateViews(outcome.candidates).map((c) => `${c.entryKey} ${c.ineligibleBecause}`).join('; ')}` : 'the binding is not usable');
      const code = outcome.outcome === 'refused' ? outcome.code : 'no-eligible-adapter';
      await this.deps.store.appendResolution(this.base({ outcome: 'refused', refusalCode: code, reasons: storedReasons(outcome, { message: explanation }) }));
      throw unbound(explanation);
    }

    const modelIdentity = { ...snap.observedModel, modelId: snap.modelId };
    const record: ResolutionRecord = await this.deps.store.appendResolution(
      this.base({
        outcome: 'resolved',
        contractVersion: `${contract.major}.${contract.minor}`,
        adapterKey: snap.adapterKey,
        adapterVersion: adapter.descriptor.version,
        provider: adapter.descriptor.provider,
        modelIdentity,
        scopeGranted: { requested: contract.requiredScope, granted: [...(adapter.descriptor.scopeMapping['model.embed'] ?? [])], narrowing: 'exact' },
        reasons: storedReasons(outcome),
      }),
    );

    const started = Date.now();
    const timed = adapterContext({ workspaceId: null, projectId: null, binding: snap.providerBinding, credential: null, scope: { requested: { access: 'read', resources: ['model.embed'] }, granted: [...(adapter.descriptor.scopeMapping['model.embed'] ?? [])], narrowing: 'exact' }, timeoutMs: TIMEOUTS_MS.Embed });
    const result: AdapterResult = await (async (): Promise<AdapterResult> => {
      try {
        return await withTimeout(
          timed.context.signal,
          adapter.invoke({ ...timed.context, capability: 'Embed', contractVersion: `${contract.major}.${contract.minor}`, input: { texts: [...texts] } }).catch((err: unknown): AdapterResult => ({ ok: false, errorCategory: 'adapter-fault', message: err instanceof Error ? err.message : 'adapter threw' })),
          (): AdapterResult => ({ ok: false, errorCategory: 'timed-out', message: `no answer within ${TIMEOUTS_MS.Embed} ms` }),
        );
      } finally {
        timed.done();
      }
    })();
    const end = { resolutionId: record.id, workspaceId: null, projectId: null, providerRequestId: result.providerRequestId ?? null, durationMs: Date.now() - started, endedAt: this.deps.clock() };

    if (!result.ok) {
      await this.deps.store.appendInvocation({ ...end, outcome: result.errorCategory === 'adapter-fault' ? 'adapter-fault' : 'failed', errorCategory: result.errorCategory, retryAfterSeconds: result.retryAfterSeconds ?? null });
      throw new ProviderUnavailableError(`the embedding provider (${snap.modelId}) failed: ${result.errorCategory} — ${result.message} (EmbeddingPort, FR-HUB-085)`);
    }
    const checked = checkOutput(contract, result.output, { texts: texts.length, dimension: snap.dimension });
    const output = result.output as { model?: { version?: string }; vectors: number[][] };
    const versionChanged = checked.ok && output.model?.version !== snap.observedModel.version;
    if (!checked.ok || versionChanged) {
      const message = !checked.ok ? checked.message : `the model version changed from ${snap.observedModel.version} to ${String(output.model?.version)} since boot (model-version-changed, FR-HUB-082); restart to re-observe and re-index`;
      await this.deps.store.appendInvocation({ ...end, outcome: 'adapter-fault', errorCategory: 'adapter-fault', retryAfterSeconds: null });
      throw new ProviderUnavailableError(`the embedding provider (${snap.modelId}) ${message} (EmbeddingPort)`);
    }
    await this.deps.store.appendInvocation({ ...end, outcome: 'succeeded', errorCategory: null, retryAfterSeconds: null });
    return output.vectors;
  }
}
