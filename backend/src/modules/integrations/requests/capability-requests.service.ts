/**
 * `T2148`, `T2243` (EPIC-039, `BR-0120`, `BR-0121`) — `CapabilityRequests`: the
 * one entry point every platform caller shares, in-process or through the route.
 *
 * In order, and each step recorded where it decides something:
 *
 * 1. a body that **pins a provider** — an `adapter`/`provider`/`transport`/
 *    `registryEntryId` key, or any value equal to a catalog key — is refused
 *    `provider-pinned` (`FR-HUB-001`, `US1` AS3);
 * 2. the **caller** must be a platform caller, and over HTTP a `room:*` one
 *    (analysis U1);
 * 3. `Embed` is refused with 400 — it is resolved at deployment scope;
 * 4. the **input** is validated against the contract (400 when malformed) and
 *    refused `credential-material-in-content` when it holds a secret
 *    (`FR-HUB-045`);
 * 5. the resolver decides and records **before** the provider is called;
 * 6. the resolved adapter is invoked **once**, with a timeout, its output
 *    checked against the contract (`FR-HUB-016`), and exactly one invocation row
 *    written — never re-resolved after a failure (`FR-HUB-039`);
 * 7. with `executionId`, `capability-resolved` is appended to that execution
 *    (`FR-HUB-038`).
 */
import { CAPABILITY_SCOPES, acceptsOverHttp, contractFor, findSecret, isCapabilityName, isPlatformCaller, validate, type AdapterResult } from '@pmi/capability-contract';
import { ValidationFailedError } from '../../../core/errors.js';
import { adapterContext, bindingFor, TIMEOUTS_MS, withTimeout } from '../adapter-context.js';
import type { AdapterCatalog } from '../catalog.service.js';
import type { CredentialVault } from '../credentials/credential.vault.js';
import type { HealthService } from '../health/health.service.js';
import type { Clock, ExecutionEventsPort } from '../integrations.tokens.js';
import type { IntegrationsStore, InvocationRecord, ResolutionRecord } from '../integrations.store.js';
import type { RefusalView } from '../resolver/explanation.js';
import type { ResolveRequest, ResolverService } from '../resolver/resolver.service.js';
import { checkOutput } from './output-validation.js';

export interface RequestBody {
  readonly capability?: unknown;
  readonly major?: unknown;
  readonly caller?: unknown;
  readonly executionId?: unknown;
  readonly input?: unknown;
  readonly [key: string]: unknown;
}

export interface CapabilityResponse {
  readonly resolutionId: string;
  readonly outcome: 'resolved' | 'refused';
  readonly refusal?: RefusalView;
  readonly resolution?: {
    readonly contractVersion: string;
    readonly adapterKey: string;
    readonly adapterVersion: string;
    readonly provider: string;
    readonly eligibleBecause: readonly string[];
    readonly scope: Readonly<Record<string, unknown>>;
  };
  readonly invocation?: { readonly outcome: InvocationRecord['outcome']; readonly errorCategory?: string; readonly retryAfterSeconds?: number };
  readonly result?: unknown;
}

export interface RequestsDeps {
  readonly store: IntegrationsStore;
  readonly catalog: AdapterCatalog;
  readonly resolver: ResolverService;
  readonly vault: CredentialVault;
  readonly health: HealthService;
  readonly events: ExecutionEventsPort;
  readonly executions: { exists(workspaceId: string, executionId: string): Promise<boolean> };
  readonly clock: Clock;
}

const PINNING_KEYS = ['adapter', 'adapterKey', 'provider', 'transport', 'registryEntryId'] as const;

function* strings(value: unknown): Generator<string> {
  if (typeof value === 'string') yield value;
  else if (Array.isArray(value)) for (const v of value) yield* strings(v);
  else if (value !== null && typeof value === 'object') for (const v of Object.values(value as Record<string, unknown>)) yield* strings(v);
}

function hasKeyDeep(value: unknown, keys: readonly string[]): string | null {
  if (Array.isArray(value)) {
    for (const v of value) {
      const hit = hasKeyDeep(v, keys);
      if (hit !== null) return hit;
    }
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (keys.includes(k)) return k;
      const hit = hasKeyDeep(v, keys);
      if (hit !== null) return hit;
    }
  }
  return null;
}

export class CapabilityRequests {
  constructor(private readonly deps: RequestsDeps) {}

  async request(actor: { workspaceId: string; userId: string }, projectId: string, body: RequestBody, options: { http: boolean }): Promise<CapabilityResponse> {
    const capability = typeof body.capability === 'string' ? body.capability : String(body.capability ?? '');
    const major = Number.isInteger(body.major) ? (body.major as number) : NaN;
    if (Number.isNaN(major)) throw new ValidationFailedError('major is required: the capability major version the caller expects (FR-HUB-033).', { fields: [{ field: 'major', reason: 'integer ≥ 1' }] });
    const executionId = typeof body.executionId === 'string' ? body.executionId : null;
    if (executionId !== null && !(await this.deps.executions.exists(actor.workspaceId, executionId))) {
      throw new ValidationFailedError('executionId names no execution in this workspace.', { fields: [{ field: 'executionId', reason: 'unknown execution' }] });
    }
    const req: ResolveRequest = { workspaceId: actor.workspaceId, projectId, capability, major, caller: typeof body.caller === 'string' ? body.caller : '(none)', actorPrincipalId: actor.userId, executionId };

    // 1 · a pinned provider
    const pinnedKey = hasKeyDeep(body, PINNING_KEYS);
    const catalogKeys = new Set(this.deps.catalog.keys());
    const pinnedValue = [...strings(body)].find((s) => catalogKeys.has(s));
    if (pinnedKey !== null || pinnedValue !== undefined) {
      return this.finish(req, await this.deps.resolver.refuse(req, 'provider-pinned', `A request names a capability, never a provider, adapter or transport (FR-HUB-001); the body carried ${pinnedKey !== null ? `"${pinnedKey}"` : `the adapter key "${pinnedValue}"`}.`));
    }
    // 2 · the caller
    if (!isPlatformCaller(req.caller) || (options.http && !acceptsOverHttp(req.caller))) {
      const why = !isPlatformCaller(req.caller)
        ? `${req.caller} is not a platform caller; the Hub serves Rooms, the loop, context assembly, evidence intake and notification dispatch only (FR-HUB-004).`
        : `${req.caller} is an in-process caller and cannot be declared over HTTP; only room:* callers can (analysis U1).`;
      return this.finish(req, await this.deps.resolver.refuse(req, 'caller-not-platform', why));
    }
    // 3 · deployment scope
    if (isCapabilityName(capability) && CAPABILITY_SCOPES[capability] === 'deployment') {
      throw new ValidationFailedError(`${capability} is resolved at deployment scope through EmbeddingPort, not requested per project (FR-HUB-084).`, { fields: [{ field: 'capability', reason: 'deployment scope' }] });
    }
    // 4 · the input
    if (isCapabilityName(capability)) {
      const contract = contractFor(capability, major);
      if (contract !== null) {
        const v = validate(contract.inputSchema, body.input);
        if (!v.ok) throw new ValidationFailedError(`The input does not satisfy ${capability} ${major}.x: ${v.errors.map((e) => `${e.path} ${e.message}`).join('; ')}.`, { fields: v.errors.map((e) => ({ field: `input.${e.path}`, reason: e.message })) });
      }
      const secret = findSecret(body.input);
      if (secret !== null) {
        return this.finish(req, await this.deps.resolver.refuse(req, 'credential-material-in-content', `The input carries credential-shaped material at ${secret}; it is refused, not redacted and sent (FR-HUB-045).`));
      }
    }
    // 5 · resolve, recorded first
    const decided = await this.deps.resolver.resolve(req);
    if (decided.resolved === undefined) return this.finish(req, decided);

    // 6 · invoke once
    const { adapter, entry, configuration, contract, scope } = decided.resolved;
    const started = Date.now();
    const result: AdapterResult = await this.deps.vault.withCredential({ workspaceId: actor.workspaceId, projectId, registryEntryId: entry.id }, async (credential) => {
      const timed = adapterContext({ workspaceId: actor.workspaceId, projectId, binding: bindingFor(configuration, entry.id), credential, scope, timeoutMs: TIMEOUTS_MS[contract.name] });
      try {
        return await withTimeout(
          timed.context.signal,
          adapter.invoke({ ...timed.context, capability: contract.name, contractVersion: `${contract.major}.${contract.minor}`, input: body.input }).catch((err: unknown): AdapterResult => ({ ok: false, errorCategory: 'adapter-fault', message: err instanceof Error ? err.message : 'adapter threw' })),
          (): AdapterResult => ({ ok: false, errorCategory: 'timed-out', message: `no answer within ${timed.context.timeoutMs} ms` }),
        );
      } finally {
        timed.done();
      }
    });
    const durationMs = Date.now() - started;
    let invocation: InvocationRecord;
    let output: unknown;
    if (result.ok) {
      const checked = checkOutput(contract, result.output);
      if (checked.ok) {
        output = result.output;
        invocation = { resolutionId: decided.record.id, workspaceId: actor.workspaceId, projectId, outcome: 'succeeded', errorCategory: null, providerRequestId: result.providerRequestId ?? null, retryAfterSeconds: null, durationMs, endedAt: this.deps.clock() };
      } else {
        invocation = { resolutionId: decided.record.id, workspaceId: actor.workspaceId, projectId, outcome: 'adapter-fault', errorCategory: 'adapter-fault', providerRequestId: result.providerRequestId ?? null, retryAfterSeconds: null, durationMs, endedAt: this.deps.clock() };
      }
    } else {
      invocation = {
        resolutionId: decided.record.id,
        workspaceId: actor.workspaceId,
        projectId,
        outcome: result.errorCategory === 'adapter-fault' ? 'adapter-fault' : 'failed',
        errorCategory: result.errorCategory,
        providerRequestId: result.providerRequestId ?? null,
        retryAfterSeconds: result.retryAfterSeconds ?? null,
        durationMs,
        endedAt: this.deps.clock(),
      };
      await this.deps.health.observeOutcome(actor.workspaceId, projectId, entry, adapter.descriptor.version, result);
    }
    await this.deps.store.appendInvocation(invocation);
    return this.finish(req, decided, invocation, output);
  }

  private async appendEvent(req: ResolveRequest, record: ResolutionRecord): Promise<void> {
    if (req.executionId === null) return;
    await this.deps.events.appendCapabilityResolved({
      workspaceId: req.workspaceId,
      executionId: req.executionId,
      emittedBy: req.actorPrincipalId,
      resolutionId: record.id,
      payload: {
        resolutionId: record.id,
        capability: record.capability,
        outcome: record.outcome,
        ...(record.contractVersion ? { contractVersion: record.contractVersion } : {}),
        ...(record.refusalCode ? { refusalCode: record.refusalCode } : {}),
        ...(record.adapterKey ? { adapterKey: record.adapterKey } : {}),
        ...(record.adapterVersion ? { adapterVersion: record.adapterVersion } : {}),
        ...(record.provider ? { provider: record.provider } : {}),
      },
    });
  }

  private async finish(req: ResolveRequest, decided: { record: ResolutionRecord; refusal?: RefusalView }, invocation?: InvocationRecord, output?: unknown): Promise<CapabilityResponse> {
    const r = decided.record;
    const response: CapabilityResponse = {
      resolutionId: r.id,
      outcome: r.outcome,
      ...(decided.refusal ? { refusal: decided.refusal } : {}),
      ...(r.outcome === 'resolved'
        ? {
            resolution: {
              contractVersion: r.contractVersion!,
              adapterKey: r.adapterKey!,
              adapterVersion: r.adapterVersion!,
              provider: r.provider!,
              eligibleBecause: ((r.reasons as { eligibleBecause?: string[] }).eligibleBecause ?? []) as string[],
              scope: r.scopeGranted ?? {},
            },
          }
        : {}),
      ...(invocation
        ? { invocation: { outcome: invocation.outcome, ...(invocation.errorCategory ? { errorCategory: invocation.errorCategory } : {}), ...(invocation.retryAfterSeconds !== null ? { retryAfterSeconds: invocation.retryAfterSeconds } : {}) } }
        : {}),
      ...(invocation?.outcome === 'succeeded' ? { result: output } : {}),
    };
    // The event is appended with the decision, so the execution shows it even when nothing more happens.
    await this.appendEvent(req, r);
    return response;
  }
}
