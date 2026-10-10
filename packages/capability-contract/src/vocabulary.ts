/**
 * `T2108` (EPIC-039) — the capability vocabulary, held as a document
 * (`FR-HUB-003`, `FR-HUB-010`).
 *
 * Closed lists, frozen. A caller asks for one of these names or is refused
 * naming the unknown one; nothing in the platform spells a capability any other
 * way. Provider-neutral throughout — no name here says who serves it.
 */

/** The five v1 capabilities (`FR-HUB-010`, amended 2026-10-09 to add `Embed`). */
export const CAPABILITY_NAMES = Object.freeze(['ReadRepository', 'ReadBuildStatus', 'ReadTestResults', 'SendNotification', 'Embed'] as const);
export type CapabilityName = (typeof CAPABILITY_NAMES)[number];

export function isCapabilityName(value: unknown): value is CapabilityName {
  return typeof value === 'string' && (CAPABILITY_NAMES as readonly string[]).includes(value);
}

export type CapabilityScope = 'project' | 'deployment';

/**
 * Where each capability is resolved. `Embed` alone is deployment-scoped
 * (`FR-HUB-084`): `EmbeddingPort` carries no project, and one model must serve
 * every workspace's index.
 */
export const CAPABILITY_SCOPES: Readonly<Record<CapabilityName, CapabilityScope>> = Object.freeze({
  ReadRepository: 'project',
  ReadBuildStatus: 'project',
  ReadTestResults: 'project',
  SendNotification: 'project',
  Embed: 'deployment',
});

/**
 * The platform-side callers (`FR-HUB-004`, `R-039-12`). No connector, no agent,
 * no surface: the developer's local agent keeps its own tools.
 */
export const PLATFORM_CALLERS = Object.freeze([
  'room:requirement',
  'room:change',
  'room:defect',
  'loop',
  'context-assembly',
  'evidence-intake',
  'notification-dispatch',
] as const);
export type PlatformCaller = (typeof PLATFORM_CALLERS)[number];

export function isPlatformCaller(value: unknown): value is PlatformCaller {
  return typeof value === 'string' && (PLATFORM_CALLERS as readonly string[]).includes(value);
}

/**
 * Analysis U1 (2026-10-10) — the callers a body may **declare** over HTTP.
 *
 * `caller` arrives from the client, so only the Rooms, which run in the
 * browser, may name themselves. The others are in-process modules and are set
 * by the code that owns them; a session claiming to be evidence intake is
 * refused `caller-not-platform`.
 */
export const HTTP_CALLERS = Object.freeze(['room:requirement', 'room:change', 'room:defect'] as const);

export function acceptsOverHttp(caller: unknown): boolean {
  return typeof caller === 'string' && (HTTP_CALLERS as readonly string[]).includes(caller);
}

/** The promotion pipeline (Constitution VII, `R-039-8`). */
export const PLATFORM_ENVIRONMENTS = Object.freeze(['local', 'dev', 'stage', 'prod'] as const);
export type PlatformEnvironment = (typeof PLATFORM_ENVIRONMENTS)[number];

export function isPlatformEnvironment(value: unknown): value is PlatformEnvironment {
  return typeof value === 'string' && (PLATFORM_ENVIRONMENTS as readonly string[]).includes(value);
}

/** Provider-neutral scope resources; each adapter maps them to its provider's permissions (`R-039-9`). */
export const SCOPE_RESOURCES = Object.freeze(['repository.contents', 'ci.checks', 'ci.artifacts', 'notification.send', 'model.embed'] as const);
export type ScopeResource = (typeof SCOPE_RESOURCES)[number];

export function isScopeResource(value: unknown): value is ScopeResource {
  return typeof value === 'string' && (SCOPE_RESOURCES as readonly string[]).includes(value);
}
