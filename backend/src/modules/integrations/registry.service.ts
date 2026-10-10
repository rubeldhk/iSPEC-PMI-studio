/**
 * `T2164`, `T2166` (EPIC-039, `FR-HUB-020`–`FR-HUB-029`, `R-039-4`, `R-039-5`) —
 * one registry, both directions.
 *
 * - **Outbound adapters** are *registered*: a catalog key listed in a workspace
 *   (deployment makes an adapter available; registration lists it).
 * - **Inbound connectors** are *seeded*, idempotently, on first use:
 *   `pmi-studio` first, then the four `EPIC-037` surfaces. They are never
 *   registered through the API and never resolution candidates.
 *
 * Every field of every entry is a value or *not applicable* with a reason
 * (`FR-HUB-023`, `SC-HUB-003`). Every lifecycle act is an audit entry with actor,
 * instant, before and after (`FR-HUB-025`). Reading requires `EPIC-024` read on
 * the workspace's `integration-registry` artifact, changing it requires edit
 * (`FR-HUB-029`); because access is deny-by-default, the seed grants edit to the
 * workspace's creator (`R-039-10`).
 */
import { fact, notApplicable, type Fact } from '@pmi/capability-contract';
import { ConflictError, NotFoundError, ValidationFailedError } from '../../core/errors.js';
import { describeEntry, type AdapterCatalog } from './catalog.service.js';
import { CONNECTOR_KEYS, OMITTED_CONNECTORS, isConnectorKey, type ProjectConnectorFacts, type StaticConnectorFacts } from './connector-facts.js';
import type { HealthService } from './health/health.service.js';
import type { AuditPort, Clock } from './integrations.tokens.js';
import type { IntegrationsStore, RegistryEntryRecord, ResolutionRecord } from './integrations.store.js';
import { candidateViews, type RefusalView } from './resolver/explanation.js';

export const SEED_ACTOR = 'system:epic-039-seed';
/** Seeded connectors take listed orders 1–5; registered adapters follow from here. */
const FIRST_REGISTERED_ORDER = 10;

export interface RegistryAccessPort {
  requireReadable(workspaceId: string, userId: string): Promise<void>;
  requireEditable(workspaceId: string, userId: string): Promise<void>;
  grantEdit(workspaceId: string, userId: string, grantedBy: string): Promise<void>;
}

export interface WorkspaceDirectoryPort {
  /** The workspace's creator — its earliest user. */
  creatorOf(workspaceId: string): Promise<string | null>;
}

export interface RegistryDeps {
  readonly store: IntegrationsStore;
  readonly catalog: AdapterCatalog;
  readonly health: HealthService;
  readonly audit: AuditPort;
  readonly access: RegistryAccessPort;
  readonly workspaces: WorkspaceDirectoryPort;
  readonly connectors: StaticConnectorFacts;
  readonly projectConnectors: ProjectConnectorFacts;
  readonly projects: { exists(workspaceId: string, projectId: string): Promise<boolean> };
  readonly clock: Clock;
}

export interface EntryView {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly direction: 'outbound' | 'inbound';
  readonly status: 'active' | 'retired';
  readonly listedOrder: number;
  readonly provider: Fact<string>;
  readonly transport: Fact<string>;
  readonly version: Fact<string>;
  readonly compatibility: Fact<unknown>;
  readonly permissionScope: Fact<unknown>;
  readonly authorisation: Fact<string>;
  readonly configuration: Fact<{ state: 'configured' | 'not-configured'; setBy?: string; setAt?: string }>;
  readonly health: Fact<{ state: string; reason?: string; checkedAt?: string }>;
  readonly audit: { registeredBy: string; registeredAt: string; retiredBy?: string; retiredAt?: string; lastChangeAt: string };
}

export interface ResolutionView {
  readonly id: string;
  readonly capability: string;
  readonly caller: string;
  readonly outcome: 'resolved' | 'refused';
  readonly decidedAt: string;
  readonly adapterKey: string | null;
  readonly contractVersion: string | null;
  readonly eligibleBecause?: readonly string[];
  readonly refusal?: RefusalView;
}

export interface EntryDetail {
  readonly entry: EntryView;
  readonly healthHistory: { state: string; reason: string | null; checkedAt: string; source: string; retryAfterSeconds: number | null }[];
  readonly resolutions: ResolutionView[];
}

const SURFACE_NAMES: Readonly<Record<string, string>> = {
  'pmi-studio': 'pmi-studio (MCP server)',
  'surface:ide-extension': 'IDE extension',
  'surface:local-cli': 'Local CLI',
  'surface:ci-cd': 'CI/CD',
  'surface:managed-sandbox': 'Managed sandbox',
};

export function resolutionView(r: ResolutionRecord): ResolutionView {
  const reasons = r.reasons as { candidates?: Parameters<typeof candidateViews>[0]; message?: string; eligibleBecause?: string[] };
  return {
    id: r.id,
    capability: r.capability,
    caller: r.caller,
    outcome: r.outcome,
    decidedAt: r.decidedAt.toISOString(),
    adapterKey: r.adapterKey,
    contractVersion: r.contractVersion,
    ...(r.outcome === 'resolved' ? { eligibleBecause: reasons.eligibleBecause ?? [] } : {}),
    ...(r.outcome === 'refused' ? { refusal: { code: r.refusalCode ?? 'refused', message: reasons.message ?? '', candidates: candidateViews(reasons.candidates ?? []) } } : {}),
  };
}

export class RegistryService {
  constructor(private readonly deps: RegistryDeps) {}

  /** `R-039-5` — the five inbound entries and the creator's grant, once per workspace. */
  async ensureSeeded(workspaceId: string): Promise<void> {
    if ((await this.deps.store.findEntryByKey(workspaceId, 'pmi-studio')) !== null) return;
    const at = this.deps.clock();
    for (const [i, key] of CONNECTOR_KEYS.entries()) {
      if ((await this.deps.store.findEntryByKey(workspaceId, key)) !== null) continue;
      let row: RegistryEntryRecord;
      try {
        row = await this.deps.store.createEntry({ workspaceId, key, direction: 'inbound', listedOrder: i + 1, registeredBy: SEED_ACTOR, registeredAt: at });
      } catch {
        continue; // a concurrent first read seeded it; the unique key is the arbiter
      }
      await this.deps.audit.record({ workspaceId, actorId: SEED_ACTOR, action: 'create', targetType: 'integration-registry-entry', targetId: row.id, outcome: 'success', detail: { before: null, after: { key, direction: 'inbound', status: 'active', listedOrder: row.listedOrder } } });
    }
    const creator = await this.deps.workspaces.creatorOf(workspaceId);
    if (creator !== null) await this.deps.access.grantEdit(workspaceId, creator, SEED_ACTOR);
  }

  private async requireProject(workspaceId: string, projectId: string | undefined): Promise<void> {
    if (projectId !== undefined && !(await this.deps.projects.exists(workspaceId, projectId))) throw new NotFoundError('The project does not exist.');
  }

  async list(ctx: { workspaceId: string; userId: string }, projectId?: string): Promise<{ entries: EntryView[]; omitted: typeof OMITTED_CONNECTORS }> {
    await this.ensureSeeded(ctx.workspaceId);
    await this.deps.access.requireReadable(ctx.workspaceId, ctx.userId);
    await this.requireProject(ctx.workspaceId, projectId);
    const rows = await this.deps.store.listEntries(ctx.workspaceId);
    const entries = await Promise.all(rows.map((r) => this.view(r, projectId)));
    return { entries, omitted: OMITTED_CONNECTORS };
  }

  async detail(ctx: { workspaceId: string; userId: string }, entryId: string, projectId?: string): Promise<EntryDetail> {
    await this.ensureSeeded(ctx.workspaceId);
    await this.deps.access.requireReadable(ctx.workspaceId, ctx.userId);
    await this.requireProject(ctx.workspaceId, projectId);
    const row = await this.deps.store.findEntry(ctx.workspaceId, entryId);
    if (row === null) throw new NotFoundError('Not found.');
    const checks = row.direction === 'outbound' ? await this.deps.store.listChecks(ctx.workspaceId, row.id, { ...(projectId !== undefined ? { projectId } : {}), limit: 100 }) : [];
    const resolutions = row.direction === 'outbound' ? await this.deps.store.listResolutions(ctx.workspaceId, { registryEntryId: row.id, ...(projectId !== undefined ? { projectId } : {}), limit: 50 }) : [];
    return {
      entry: await this.view(row, projectId),
      healthHistory: checks.map((c) => ({ state: c.state, reason: c.reason, checkedAt: c.checkedAt.toISOString(), source: c.source, retryAfterSeconds: c.retryAfterSeconds })),
      resolutions: resolutions.map(resolutionView),
    };
  }

  async register(ctx: { workspaceId: string; userId: string }, key: unknown): Promise<EntryView> {
    await this.ensureSeeded(ctx.workspaceId);
    await this.deps.access.requireEditable(ctx.workspaceId, ctx.userId);
    if (typeof key !== 'string' || key.trim() === '') throw new ValidationFailedError('A registration names a catalog key.', { fields: [{ field: 'key', reason: 'required' }] });
    if (isConnectorKey(key)) throw new ValidationFailedError('connectors are listed by the platform, not registered (R-039-5).', { fields: [{ field: 'key', reason: 'connector' }] });
    if (!this.deps.catalog.has(key)) throw new ValidationFailedError(`${key} is not an adapter this build contains; deployment makes an adapter available, registration only lists it (R-039-4).`, { fields: [{ field: 'key', reason: 'not in the catalog' }] });
    if ((await this.deps.store.findEntryByKey(ctx.workspaceId, key)) !== null) throw new ConflictError(`${key} is already listed in this workspace.`);
    const existing = await this.deps.store.listEntries(ctx.workspaceId);
    const order = Math.max(FIRST_REGISTERED_ORDER - 1, ...existing.map((e) => e.listedOrder)) + 1;
    const row = await this.deps.store.createEntry({ workspaceId: ctx.workspaceId, key, direction: 'outbound', listedOrder: order, registeredBy: ctx.userId, registeredAt: this.deps.clock() });
    await this.deps.audit.record({
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: 'create',
      targetType: 'integration-registry-entry',
      targetId: row.id,
      outcome: 'success',
      detail: { before: null, after: { key, direction: 'outbound', status: 'active', listedOrder: order, version: this.deps.catalog.descriptor(key)!.version } },
    });
    return this.view(row);
  }

  async retire(ctx: { workspaceId: string; userId: string }, entryId: string): Promise<EntryView> {
    await this.ensureSeeded(ctx.workspaceId);
    await this.deps.access.requireEditable(ctx.workspaceId, ctx.userId);
    const row = await this.deps.store.findEntry(ctx.workspaceId, entryId);
    if (row === null) throw new NotFoundError('Not found.');
    if (row.direction === 'inbound') throw new ValidationFailedError('connectors are listed by the platform, not retired through the registry.', { fields: [{ field: 'entryId', reason: 'connector' }] });
    if (row.status === 'retired') return this.view(row);
    const retired = await this.deps.store.retireEntry(ctx.workspaceId, entryId, ctx.userId, this.deps.clock());
    await this.deps.audit.record({ workspaceId: ctx.workspaceId, actorId: ctx.userId, action: 'lifecycle_transition', targetType: 'integration-registry-entry', targetId: row.id, outcome: 'success', detail: { before: { status: 'active' }, after: { status: 'retired' }, key: row.key } });
    return this.view(retired);
  }

  async capabilities(ctx: { workspaceId: string; userId: string }): Promise<{ name: string; scope: string; version: string; status: string; changesState: boolean }[]> {
    await this.ensureSeeded(ctx.workspaceId);
    await this.deps.access.requireReadable(ctx.workspaceId, ctx.userId);
    return (await this.deps.store.listContracts()).map((c) => ({ name: c.name, scope: c.scope, version: `${c.major}.${c.minor}`, status: c.status, changesState: c.changesState }));
  }

  async capabilityVersion(ctx: { workspaceId: string; userId: string }, name: string, version: string): Promise<Record<string, unknown>> {
    await this.deps.access.requireReadable(ctx.workspaceId, ctx.userId);
    const found = (await this.deps.store.listContracts()).find((c) => c.name === name && `${c.major}.${c.minor}` === version);
    if (found === undefined) throw new NotFoundError('Not found.');
    return { status: found.status, ...found.document };
  }

  private async view(row: RegistryEntryRecord, projectId?: string): Promise<EntryView> {
    const audit = {
      registeredBy: row.registeredBy,
      registeredAt: row.registeredAt.toISOString(),
      ...(row.retiredBy ? { retiredBy: row.retiredBy } : {}),
      ...(row.retiredAt ? { retiredAt: row.retiredAt.toISOString() } : {}),
      lastChangeAt: (row.retiredAt ?? row.registeredAt).toISOString(),
    };
    const common = { id: row.id, key: row.key, direction: row.direction, status: row.status, listedOrder: row.listedOrder, audit };
    if (row.direction === 'inbound') return { ...common, name: SURFACE_NAMES[row.key] ?? row.key, ...(await this.connectorFacts(row, projectId)) };

    const d = describeEntry(this.deps.catalog, row);
    let configuration: EntryView['configuration'];
    let health: EntryView['health'];
    if (projectId === undefined) {
      configuration = notApplicable('no project selected');
      health = notApplicable('no project selected');
    } else {
      const configs = await this.deps.store.listConfigurations(row.workspaceId, projectId);
      const naming = configs.filter((c) => c.adapters.some((a) => a.registryEntryId === row.id));
      const credential = await this.deps.store.credentialStatus(row.workspaceId, projectId, row.id);
      const needsCredential = d.descriptor?.credentialRequired ?? false;
      const configured = naming.length > 0 && (!needsCredential || credential !== null);
      configuration = fact({
        state: configured ? 'configured' : 'not-configured',
        ...(credential ? { setBy: credential.setBy, setAt: credential.setAt.toISOString() } : naming[0] ? { setBy: naming[0].updatedBy, setAt: naming[0].updatedAt.toISOString() } : {}),
      });
      if (naming.length === 0) health = notApplicable('not configured for this project — not checked');
      else {
        const h = await this.deps.health.derive(row.workspaceId, projectId, row.id);
        health = fact({ state: h.state, ...(h.reason ? { reason: h.reason } : {}), ...(h.checkedAt ? { checkedAt: h.checkedAt.toISOString() } : {}) });
      }
    }
    return { ...common, name: d.descriptor?.name ?? row.key, provider: d.provider, transport: d.transport, version: d.version, compatibility: d.compatibility, permissionScope: d.permissionScope, authorisation: d.authorisation, configuration, health };
  }

  private async connectorFacts(row: RegistryEntryRecord, projectId?: string): Promise<Omit<EntryView, 'id' | 'key' | 'name' | 'direction' | 'status' | 'listedOrder' | 'audit'>> {
    const f = this.deps.connectors;
    const isPmi = row.key === 'pmi-studio';
    const sandbox = row.key === 'surface:managed-sandbox';
    let configuration: EntryView['configuration'];
    if (projectId === undefined) configuration = notApplicable('no project selected');
    else if (sandbox) configuration = notApplicable('issued by the platform per execution; there is nothing for a project to configure');
    else {
      const cred = await this.deps.projectConnectors.activeCredential(row.workspaceId, projectId);
      configuration = fact(cred === null ? { state: 'not-configured' as const } : { state: 'configured' as const, setBy: cred.createdById, setAt: cred.createdAt.toISOString() });
    }
    const last = projectId === undefined ? null : await this.deps.projectConnectors.lastConnection(row.workspaceId, projectId);
    return {
      provider: fact(isPmi ? 'PMI Studio (this platform)' : `PMI Studio connector binding (EPIC-037 ${row.key.slice('surface:'.length)})`),
      transport: fact(isPmi ? 'mcp' : 'rest'),
      version: isPmi ? fact(f.pmiStudioVersion) : notApplicable('a connector binding has no version of its own; it serves the integration contract'),
      compatibility: fact({ integrationContract: f.integrationContract }),
      permissionScope: fact({ operations: isPmi ? [...f.pmiStudioTools] : [...f.surfaceOperations] }),
      authorisation: fact(sandbox ? 'platform-issued-execution-identity' : 'project-connector-credential'),
      configuration,
      health: notApplicable(`inbound; liveness is observed by the client, last connection: ${last ?? (projectId === undefined ? 'no project selected' : 'never')}`),
    };
  }
}
