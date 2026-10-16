/**
 * EPIC-039 — the Integration Hub's services composed for unit tests, through the
 * same `createHub` the Nest module uses, over the in-memory store.
 *
 * Not a `.spec.ts`: imported, never collected. Every port that refuses in the
 * module is bound HERE, visibly, by the test that needs it — never by a
 * permissive default (`R-039-13`).
 */
import { CAPABILITY_CONTRACTS } from '@pmi/capability-contract';
import { FixtureCiAdapter } from '@pmi/capability-adapter-fixture';
import type { AdapterDescriptor } from '@pmi/capability-contract';
import { createAdapterCatalog } from '../../src/composition/integration-adapters.js';
import { AdapterCatalog } from '../../src/modules/integrations/catalog.service.js';
import { createHub, type Hub } from '../../src/modules/integrations/hub.js';
import { CapabilityPolicySeam, CredentialKeyringSeam, EvidenceSinkSeam, type CapabilityPolicy, type PolicyStatusView } from '../../src/modules/integrations/integrations.tokens.js';
import { InMemoryIntegrationsStore, type RegistryEntryRecord } from '../../src/modules/integrations/integrations.store.js';

export const WS = 'ws_hub';
export const PROJECT = 'pr_alpha';
export const OTHER_PROJECT = 'pr_beta';
export const OWNER = 'u_owner';
export const SHA = 'c'.repeat(40);
export const TEST_KEY = Buffer.alloc(32, 9).toString('base64');

/**
 * A second CI fixture under another key, so preference and ambiguity can be
 * exercised among two adapters of one capability before a real one exists.
 */
export class SecondCiAdapter extends FixtureCiAdapter {
  override readonly descriptor: AdapterDescriptor = { ...new FixtureCiAdapter().descriptor, key: 'fixture-ci-2', name: 'Fixture CI (second)' };
}

export function catalogWithSecondCi(): AdapterCatalog {
  const base = createAdapterCatalog();
  return new AdapterCatalog([...base.keys().map((k) => base.adapter(k)!), new SecondCiAdapter()]);
}

export interface RecordingPolicy extends CapabilityPolicy {
  readonly calls: { method: string; args: unknown }[];
  set(status: PolicyStatusView['status'], explanation?: unknown): void;
}

export function recordingPolicy(initial: PolicyStatusView['status'] = 'permitted'): RecordingPolicy {
  let status = initial;
  let explanation: unknown = { policyVersion: 'test', matchedRule: 'in-test binding', riskClass: 'low', authorityApplied: 'auto-execute' };
  const calls: { method: string; args: unknown }[] = [];
  let n = 0;
  return {
    calls,
    set(s, e) {
      status = s;
      if (e !== undefined) explanation = e;
    },
    async requestDecision(args) {
      calls.push({ method: 'requestDecision', args });
      n += 1;
      return { decisionId: `dec_${n}` };
    },
    async statusOf(workspaceId, decisionId) {
      calls.push({ method: 'statusOf', args: { workspaceId, decisionId } });
      return { status, explanation };
    },
  };
}

export interface TestHub extends Hub {
  readonly store: InMemoryIntegrationsStore;
  readonly catalog: AdapterCatalog;
  readonly policySeam: CapabilityPolicySeam;
  readonly evidenceSeam: EvidenceSinkSeam;
  readonly keyringSeam: CredentialKeyringSeam;
  readonly audit: { rows: Record<string, unknown>[] };
  readonly events: { rows: Record<string, unknown>[] };
  readonly clock: { now: Date; advance(ms: number): void };
  readonly owners: Set<string>;
  readonly access: FakeRegistryAccess;
  entry(key: string, direction?: 'outbound' | 'inbound'): Promise<RegistryEntryRecord>;
}

/** `EPIC-024` access on `integration-registry`, deny-by-default like the real one. */
export interface FakeRegistryAccess {
  readonly grants: { workspaceId: string; userId: string; level: 'read' | 'edit'; by: string }[];
  grant(workspaceId: string, userId: string, level: 'read' | 'edit'): void;
  requireReadable(workspaceId: string, userId: string): Promise<void>;
  requireEditable(workspaceId: string, userId: string): Promise<void>;
  grantEdit(workspaceId: string, userId: string, grantedBy: string): Promise<void>;
}

export function fakeAccess(): FakeRegistryAccess {
  const grants: FakeRegistryAccess['grants'] = [];
  const refuse = async (): Promise<never> => {
    const { NotFoundError } = await import('../../src/core/errors.js');
    throw new NotFoundError('Not found.');
  };
  return {
    grants,
    grant: (workspaceId, userId, level) => {
      grants.push({ workspaceId, userId, level, by: 'test' });
    },
    requireReadable: async (ws, user) => {
      if (!grants.some((g) => g.workspaceId === ws && g.userId === user)) await refuse();
    },
    requireEditable: async (ws, user) => {
      if (!grants.some((g) => g.workspaceId === ws && g.userId === user && g.level === 'edit')) await refuse();
    },
    grantEdit: async (workspaceId, userId, by) => {
      if (!grants.some((g) => g.workspaceId === workspaceId && g.userId === userId && g.level === 'edit')) grants.push({ workspaceId, userId, level: 'edit', by });
    },
  };
}

export interface TestHubOptions {
  readonly environment?: 'local' | 'dev' | 'stage' | 'prod';
  readonly keyring?: boolean;
  readonly policy?: RecordingPolicy | null;
  readonly catalog?: AdapterCatalog;
  readonly executions?: Set<string>;
}

export function testHub(options: TestHubOptions = {}): TestHub & { policy: RecordingPolicy | null } {
  const store = new InMemoryIntegrationsStore(
    CAPABILITY_CONTRACTS.map((d, i) => ({ id: `cv_${i}`, name: d.name, scope: d.scope, major: d.major, minor: d.minor, status: 'approved' as const, document: d as unknown as Record<string, unknown>, changesState: d.changesState })),
  );
  const catalog = options.catalog ?? createAdapterCatalog();
  const policySeam = new CapabilityPolicySeam();
  const policy = options.policy === undefined ? recordingPolicy() : options.policy;
  if (policy !== null) policySeam.bind(policy);
  const evidenceSeam = new EvidenceSinkSeam();
  const keyringSeam = new CredentialKeyringSeam();
  if (options.keyring !== false) {
    const key = Buffer.from(TEST_KEY, 'base64');
    keyringSeam.bind({ activeKey: () => ({ keyId: 'k1', key }), key: (id) => (id === 'k1' ? key : null) });
  }
  const audit = { rows: [] as Record<string, unknown>[] };
  const events = { rows: [] as Record<string, unknown>[] };
  const clock = {
    now: new Date('2026-10-10T12:00:00Z'),
    advance(ms: number) {
      this.now = new Date(this.now.getTime() + ms);
    },
  };
  const owners = new Set([OWNER]);
  const executions = options.executions ?? new Set<string>(['ex_1']);
  const access = fakeAccess();
  const hub = createHub({
    access,
    workspaces: { creatorOf: async (ws) => (ws === WS ? OWNER : null) },
    projectConnectors: { activeCredential: async () => null, lastConnection: async () => null },
    store,
    catalog,
    policy: policySeam,
    evidence: evidenceSeam,
    keyring: keyringSeam,
    clock: () => clock.now,
    environment: options.environment ?? 'local',
    audit: {
      record: async (row) => {
        audit.rows.push({ ...(row as unknown as Record<string, unknown>), occurredAt: clock.now });
      },
    },
    // `T2628` — the audit trail, read back from the rows above.
    auditTrail: {
      latestAt: async (ws, targetType, targetId) => {
        const at = audit.rows
          .filter((r) => r['workspaceId'] === ws && r['targetType'] === targetType && r['targetId'] === targetId && r['occurredAt'] instanceof Date)
          .map((r) => (r['occurredAt'] as Date).getTime());
        return at.length === 0 ? null : new Date(Math.max(...at));
      },
    },
    events: {
      appendCapabilityResolved: async (row) => {
        events.rows.push(row as unknown as Record<string, unknown>);
      },
    },
    executions: { exists: async (_ws, id) => executions.has(id) },
    projects: { exists: async (ws, id) => ws === WS && (id === PROJECT || id === OTHER_PROJECT) },
    ownerGate: {
      requireOwner: async (ctx, _projectId, operation) => {
        if (!owners.has(ctx.userId)) {
          audit.rows.push({ action: 'access_refused', actorId: ctx.userId, detail: { operation } });
          const { ForbiddenError } = await import('../../src/core/errors.js');
          throw new ForbiddenError(`Only the project's owner may ${operation}.`);
        }
      },
    },
  });
  let order = 100;
  return {
    ...hub,
    store,
    catalog,
    policySeam,
    evidenceSeam,
    keyringSeam,
    audit,
    events,
    clock,
    owners,
    access,
    policy,
    entry: async (key, direction = 'outbound') =>
      (await store.findEntryByKey(WS, key)) ?? store.createEntry({ workspaceId: WS, key, direction, listedOrder: (order += 1), registeredBy: OWNER, registeredAt: clock.now }),
  };
}

/** A healthy check now, so health is not `unknown`. */
export async function markHealthy(hub: TestHub, entryId: string, projectId = PROJECT): Promise<void> {
  await hub.store.appendCheck({ workspaceId: WS, projectId, registryEntryId: entryId, state: 'healthy', adapterVersion: '0.1.0', source: 'request', checkedAt: hub.clock.now, durationMs: 1 });
}

/** Configure one capability with the given entries (preference by order) and mark them healthy. */
export async function configure(hub: TestHub, capability: string, keys: string[], extra: Record<string, unknown> = {}, projectId = PROJECT): Promise<void> {
  const entries = await Promise.all(keys.map((k) => hub.entry(k)));
  await hub.configuration.put({ workspaceId: WS, userId: OWNER }, projectId, capability, { adapters: entries.map((e, i) => ({ registryEntryId: e.id, preference: i + 1 })), ...extra });
  for (const e of entries) await markHealthy(hub, e.id, projectId);
}
