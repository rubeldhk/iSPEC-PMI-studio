/**
 * `T2112` (EPIC-039) — capability contract documents and the versioning rule
 * (`FR-HUB-002`, `FR-HUB-011`, `FR-HUB-014`).
 *
 * `compareContractVersions` is the one place the minor-version rule lives, so
 * the conformance check over the JSON files and any later API that accepts a
 * contract apply the same rule.
 */
import { unsupportedKeywords, type JsonSchema } from './schema.js';
import { CAPABILITY_SCOPES, isCapabilityName, isScopeResource, type CapabilityName, type CapabilityScope, type ScopeResource } from './vocabulary.js';

export interface ScopeRequirement {
  readonly access: 'read' | 'write';
  readonly resources: readonly ScopeResource[];
}

export interface CapabilityContractDocument {
  name: CapabilityName;
  major: number;
  minor: number;
  scope: CapabilityScope;
  changesState: boolean;
  description: string;
  requiredScope: ScopeRequirement;
  errorCategories: string[];
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  /** Stated limits (`FR-HUB-083`) — checked by the Hub before resolution, never left to an adapter. */
  limits?: Readonly<Record<string, number>>;
}

export function contractVersionLabel(doc: { major: number; minor: number }): string {
  return `${doc.major}.${doc.minor}`;
}

/** Problems with one document on its own; empty when it is well formed. */
export function contractDocumentErrors(input: unknown): string[] {
  const errors: string[] = [];
  if (input === null || typeof input !== 'object') return ['a contract document must be an object'];
  const doc = input as Record<string, unknown>;
  const name = doc['name'];
  if (!isCapabilityName(name)) errors.push(`name ${String(name)} is not in the vocabulary`);
  if (!Number.isInteger(doc['major']) || (doc['major'] as number) < 1) errors.push('major must be an integer ≥ 1');
  if (!Number.isInteger(doc['minor']) || (doc['minor'] as number) < 0) errors.push('minor must be an integer ≥ 0');
  if (doc['scope'] !== 'project' && doc['scope'] !== 'deployment') errors.push('scope must be project or deployment');
  else if (isCapabilityName(name) && CAPABILITY_SCOPES[name] !== doc['scope']) errors.push(`scope ${String(doc['scope'])} disagrees with the vocabulary (${CAPABILITY_SCOPES[name]})`);
  if (typeof doc['changesState'] !== 'boolean') errors.push('changesState must be declared true or false');
  if (typeof doc['description'] !== 'string' || doc['description'].trim() === '') errors.push('description is required');
  const scope = doc['requiredScope'] as Record<string, unknown> | undefined;
  if (scope === undefined || (scope['access'] !== 'read' && scope['access'] !== 'write')) errors.push('requiredScope.access must be read or write');
  const resources = (scope?.['resources'] ?? []) as unknown[];
  if (!Array.isArray(resources) || resources.length === 0) errors.push('requiredScope.resources must name at least one resource');
  else for (const r of resources) if (!isScopeResource(r)) errors.push(`requiredScope.resources: ${String(r)} is not a provider-neutral scope resource`);
  if (!Array.isArray(doc['errorCategories']) || (doc['errorCategories'] as unknown[]).some((c) => typeof c !== 'string')) errors.push('errorCategories must be a list of names');
  for (const key of ['inputSchema', 'outputSchema'] as const) {
    const schema = doc[key];
    if (schema === null || typeof schema !== 'object') {
      errors.push(`${key} is required`);
      continue;
    }
    for (const bad of unsupportedKeywords(schema as JsonSchema)) errors.push(`${key}: ${bad}`);
  }
  return errors;
}

export interface VersionComparison {
  readonly compatible: boolean;
  readonly differences: string[];
}

type Side = 'input' | 'output';

function compareSchemas(side: Side, prev: JsonSchema, next: JsonSchema | undefined, path: string, out: string[]): void {
  const label = `${side}${path === '' ? '' : `.${path}`}`;
  if (next === undefined) {
    out.push(`${label} removed`);
    return;
  }
  if (prev.type !== next.type) {
    out.push(`${label} retyped ${prev.type ?? 'any'} → ${next.type ?? 'any'}`);
    return;
  }
  if (prev.enum !== undefined) {
    for (const v of prev.enum) if (!(next.enum ?? []).includes(v)) out.push(`${label} enum value ${String(v)} removed`);
  }
  if (side === 'output' && next.enum !== undefined && prev.enum !== undefined) {
    for (const v of next.enum) if (!prev.enum.includes(v)) out.push(`${label} enum value ${String(v)} added — a consumer switching on it would not know it`);
  }
  for (const [name, child] of Object.entries(prev.properties ?? {})) {
    compareSchemas(side, child, next.properties?.[name], path === '' ? name : `${path}.${name}`, out);
  }
  if (side === 'input') {
    const before = new Set(prev.required ?? []);
    for (const name of next.required ?? []) if (!before.has(name)) out.push(`${side}.${path === '' ? '' : `${path}.`}${name} added as required`);
  }
  if (side === 'output') {
    const after = new Set(next.required ?? []);
    for (const name of prev.required ?? []) if (!after.has(name) && next.properties?.[name] !== undefined) out.push(`${label === side ? side : label}.${name} no longer guaranteed`);
  }
  if (prev.items !== undefined) compareSchemas(side, prev.items, next.items, path === '' ? '[]' : `${path}[]`, out);
}

/**
 * Is `next` an acceptable **minor** of `prev`? A minor must be a superset:
 * every input, output and error category of `prev` still present with the same
 * type, no new required input, no changed `changesState` (`FR-HUB-011`).
 */
export function compareContractVersions(prev: CapabilityContractDocument, next: CapabilityContractDocument): VersionComparison {
  const differences: string[] = [];
  if (prev.name !== next.name) differences.push(`name changed ${prev.name} → ${next.name}`);
  if (next.major !== prev.major) {
    differences.push(`${contractVersionLabel(next)} is a different major — a new major is not compared as a minor`);
    return { compatible: false, differences };
  }
  if (next.minor <= prev.minor) differences.push(`${contractVersionLabel(next)} is not a later minor of ${contractVersionLabel(prev)}`);
  if (prev.changesState !== next.changesState) differences.push(`changesState changed ${prev.changesState} → ${next.changesState}`);
  if (prev.scope !== next.scope) differences.push(`scope changed ${prev.scope} → ${next.scope}`);
  compareSchemas('input', prev.inputSchema, next.inputSchema, '', differences);
  compareSchemas('output', prev.outputSchema, next.outputSchema, '', differences);
  for (const c of prev.errorCategories) if (!next.errorCategories.includes(c)) differences.push(`error category ${c} removed`);
  return { compatible: differences.length === 0, differences };
}
