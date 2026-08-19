/**
 * T582, T583, T584 — the refusals that make the policy real.
 *
 * Native §19 states both halves, and the second is the one that gets forgotten:
 * *"Re-evaluate the existing 'AI provider endpoint only' egress policy … **Do
 * NOT simply open general internet access.**"*
 *
 * Every rule here is a refusal with a named reason, not a boolean — an operator
 * who is told "invalid profile" learns nothing.
 */
import type {
  EgressProfile,
  ExecutionEnvironmentDescriptor,
  ExecutionRequest,
  ScopedCredentialRef,
  WorkspaceBinding,
} from './index.js';

export class PolicyRefusedError extends Error {
  constructor(readonly detail: string) {
    super(detail);
    this.name = 'PolicyRefusedError';
  }
}

/**
 * Forms that mean "everything".
 *
 * Enumerated rather than pattern-matched: a regex for "looks like a wildcard"
 * would either miss `::/0` or reject a legitimate hostname, and being wrong in
 * the permissive direction is how general internet access arrives by accident.
 */
const GENERAL_INTERNET = new Set(['*', '**', '0.0.0.0/0', '::/0', 'any', 'all', '0/0']);

export function assertEgressProfile(profile: EgressProfile): void {
  if (profile.allowedDestinations.length === 0) {
    // An empty list reads as "no restriction" to a careless implementation.
    throw new PolicyRefusedError(
      `Egress profile "${profile.name}" lists no destinations. An empty allow-list is not the same as a closed one — state the destinations explicitly (FR-AGT-011).`,
    );
  }

  const wild = profile.allowedDestinations.filter((d) =>
    GENERAL_INTERNET.has(d.trim().toLowerCase()),
  );
  if (wild.length > 0) {
    throw new PolicyRefusedError(
      `Egress profile "${profile.name}" permits general internet access via ${wild.join(', ')}. Native §19 forbids this: enumerate destinations (FR-AGT-011).`,
    );
  }
}

/**
 * A provider that cannot enforce a policy must not accept one.
 *
 * Otherwise a security control silently does nothing — the precise failure
 * `ADR-0002` exists to prevent.
 */
export function assertProviderCanEnforce(
  descriptor: ExecutionEnvironmentDescriptor,
  profile: EgressProfile,
): void {
  if (!descriptor.supportsNetworkPolicy) {
    throw new PolicyRefusedError(
      `Provider "${descriptor.provider}" declares no network-policy support and cannot accept egress profile "${profile.name}". A profile it cannot enforce is a control that silently does nothing (ADR-0002).`,
    );
  }
}

export function assertLifecycleSupported(
  descriptor: ExecutionEnvironmentDescriptor,
  binding: WorkspaceBinding,
): void {
  if (!descriptor.supportedLifecycles.includes(binding.kind)) {
    throw new PolicyRefusedError(
      `Provider "${descriptor.provider}" does not support a ${binding.kind} workspace. Supported: ${descriptor.supportedLifecycles.join(', ')}.`,
    );
  }
}

export function assertCredentialRef(ref: ScopedCredentialRef): void {
  if (!ref.expiresAt) {
    throw new PolicyRefusedError(
      `Credential "${ref.id}" carries no expiry. Nothing long-lived enters a sandbox (decision D-27).`,
    );
  }
  if (Number.isNaN(Date.parse(ref.expiresAt))) {
    throw new PolicyRefusedError(`Credential "${ref.id}" has an unparseable expiry: ${ref.expiresAt}.`);
  }
  if (!ref.scope) {
    throw new PolicyRefusedError(
      `Credential "${ref.id}" is unscoped. A credential valid for everything is not scoped delegation.`,
    );
  }
}

/**
 * No environment variable may carry a credential value.
 *
 * A ref that gets flattened into an env var defeats the whole type: the point
 * of `ScopedCredentialRef` is that the secret never travels in the request.
 */
export function assertNoSecretsInEnv(
  env: Record<string, string>,
  refs: readonly ScopedCredentialRef[],
): void {
  const ids = new Set(refs.map((r) => r.id));
  const leaked = Object.entries(env).filter(([, v]) => ids.has(v));
  if (leaked.length > 0) {
    throw new PolicyRefusedError(
      `Environment ${leaked.map(([k]) => k).join(', ')} carries a credential value. Pass refs; the provider resolves them at container start (decision D-27).`,
    );
  }
}

/** Every rule, in one call, before a provider does any work. */
export function assertExecutionRequest(
  descriptor: ExecutionEnvironmentDescriptor,
  request: ExecutionRequest,
): void {
  assertEgressProfile(request.egressProfile);
  assertProviderCanEnforce(descriptor, request.egressProfile);
  assertLifecycleSupported(descriptor, request.workspace);
  request.credentials.forEach(assertCredentialRef);
  assertNoSecretsInEnv(request.env, request.credentials);
}
