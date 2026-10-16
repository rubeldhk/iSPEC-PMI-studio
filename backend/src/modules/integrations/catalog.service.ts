/**
 * `T2136`, `T2227` (EPIC-039, `R-039-4`) — the catalog is code; the registry is
 * data.
 *
 * An adapter's descriptor (provider, transport, version, capabilities, scope
 * mapping) is declared by its package and composed in
 * `composition/integration-adapters.ts`. The registry table only **lists** a
 * catalog key in a workspace. Every read joins the two here, so there is one
 * copy of each fact — and a key the running build no longer contains reads
 * *not applicable — "adapter not present in this build"* and is ineligible,
 * never a crash.
 */
import { assertDescriptor, fact, notApplicable, type AdapterDescriptor, type CapabilityAdapter, type CapabilityName, type Fact } from '@pmi/capability-contract';
import type { RegistryEntryRecord } from './integrations.store.js';
import type { AuditPort } from './integrations.tokens.js';

export class AdapterCatalog {
  private readonly byKey = new Map<string, CapabilityAdapter>();

  constructor(adapters: readonly CapabilityAdapter[]) {
    for (const a of adapters) {
      assertDescriptor(a.descriptor);
      if (this.byKey.has(a.descriptor.key)) throw new Error(`The adapter catalog holds the key ${a.descriptor.key} twice (duplicate keys are refused).`);
      this.byKey.set(a.descriptor.key, a);
    }
  }

  keys(): string[] {
    return [...this.byKey.keys()];
  }

  has(key: string): boolean {
    return this.byKey.has(key);
  }

  adapter(key: string): CapabilityAdapter | null {
    return this.byKey.get(key) ?? null;
  }

  descriptor(key: string): AdapterDescriptor | null {
    return this.byKey.get(key)?.descriptor ?? null;
  }

  implementing(capability: CapabilityName): CapabilityAdapter[] {
    return [...this.byKey.values()].filter((a) => a.descriptor.implements.some((i) => i.capability === capability));
  }
}

const NOT_IN_BUILD = 'adapter not present in this build';

export interface DescribedEntry {
  readonly inBuild: boolean;
  readonly descriptor: AdapterDescriptor | null;
  readonly provider: Fact<string>;
  readonly transport: Fact<string>;
  readonly version: Fact<string>;
  readonly compatibility: Fact<{ capabilities: { name: CapabilityName; majors: readonly number[] }[] }>;
  readonly permissionScope: Fact<{ resources: string[]; access: string }>;
  readonly authorisation: Fact<string>;
}

/** The descriptor facts for one outbound registry row. */
export function describeEntry(catalog: AdapterCatalog, entry: RegistryEntryRecord): DescribedEntry {
  const d = catalog.descriptor(entry.key);
  if (d === null) {
    const na = notApplicable<never>(NOT_IN_BUILD);
    return { inBuild: false, descriptor: null, provider: na, transport: na, version: na, compatibility: na, permissionScope: na, authorisation: na };
  }
  const resources = Object.keys(d.scopeMapping).sort();
  return {
    inBuild: true,
    descriptor: d,
    provider: fact(d.provider),
    transport: fact(d.transport),
    version: fact(d.version),
    compatibility: fact({ capabilities: d.implements.map((i) => ({ name: i.capability, majors: [...i.majors] })) }),
    permissionScope: fact({ resources, access: d.implements.some((i) => i.capability === 'SendNotification') ? 'write' : 'read' }),
    authorisation:
      d.credentialKinds.length === 0
        ? notApplicable('the adapter needs no credential (its provider is reached without one)')
        : fact(d.credentialKinds.map((k) => k.kind).join(' | ')),
  };
}

export type VersionChange = { changed: false; first: boolean } | { changed: true; first: false; before: string; after: string };

/** `FR-HUB-025` — the catalog's version against the last one observed for the entry. */
export function versionChange(lastObserved: string | null, current: string): VersionChange {
  if (lastObserved === null) return { changed: false, first: true };
  if (lastObserved === current) return { changed: false, first: false };
  return { changed: true, first: false, before: lastObserved, after: current };
}

/** `T2227` — who records a version the deployment changed (`FR-HUB-025`). */
export const CATALOG_ACTOR = 'system:catalog';

export interface CatalogVersionDeps {
  /** Every registry entry, across workspaces — only active outbound ones are compared. */
  entries(): Promise<readonly RegistryEntryRecord[]>;
  /** The last version the audit trail recorded for the entry, or `null` when none was. */
  lastObservedVersion(workspaceId: string, entryId: string): Promise<string | null>;
  readonly catalog: { descriptor(key: string): { readonly version: string } | null };
  readonly audit: AuditPort;
}

export interface CatalogVersionChange {
  readonly workspaceId: string;
  readonly entryId: string;
  readonly key: string;
  readonly before: string;
  readonly after: string;
}

/**
 * `T2227` (`FR-HUB-025`, data-model §2) — at boot, compare each active outbound
 * entry's catalog version with the last one the audit trail recorded, and
 * write one `update` by `system:catalog` with before/after for each that
 * differs. A first sighting writes nothing (registration recorded the version).
 * A store that cannot be read is not a reason to stop the application
 * (`DEF-039-001`): nothing is written, and the next boot compares again.
 */
export async function observeCatalogVersions(deps: CatalogVersionDeps): Promise<CatalogVersionChange[]> {
  const changes: CatalogVersionChange[] = [];
  try {
    for (const entry of await deps.entries()) {
      if (entry.status !== 'active' || entry.direction !== 'outbound') continue;
      const descriptor = deps.catalog.descriptor(entry.key);
      if (descriptor === null) continue;
      const change = versionChange(await deps.lastObservedVersion(entry.workspaceId, entry.id), descriptor.version);
      if (!change.changed) continue;
      await deps.audit.record({
        workspaceId: entry.workspaceId,
        actorId: CATALOG_ACTOR,
        action: 'update',
        targetType: 'integration-registry-entry',
        targetId: entry.id,
        outcome: 'success',
        detail: { key: entry.key, before: { version: change.before }, after: { version: change.after } },
      });
      changes.push({ workspaceId: entry.workspaceId, entryId: entry.id, key: entry.key, before: change.before, after: change.after });
    }
  } catch {
    return changes;
  }
  return changes;
}
