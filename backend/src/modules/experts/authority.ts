/**
 * `T1930` (EPIC-047) — what a run may do.
 *
 * `FR-EXP-012`, `FR-EXP-013`, `FR-EXP-014`. Two questions, kept apart because
 * they fail for different reasons and send a reader to different fixes:
 *
 * - **Does the contract allow it?** Capabilities and tools inside the contract;
 *   no prohibited action — and a prohibition wins over any allowance.
 * - **May the requester do it?** Every target is checked against the contract's
 *   permissions **and** against `EPIC-024` for the requesting actor. An Expert
 *   is never a route to authority its requester lacks.
 *
 * Both return a reason or `null`. A fault in the access check propagates: it
 * never reads as permission.
 */
import type { EffectiveAuthority, ExpertContract, PermissionGrant } from './expert.types.js';
import type { ActorAccess } from './experts.tokens.js';

export interface DispatchTarget {
  readonly artifactType: string;
  readonly artifactId: string;
  readonly action: 'read' | 'edit';
}

export interface Ask {
  readonly capabilities: readonly string[];
  readonly tools: readonly string[];
  readonly actions: readonly string[];
}

/** The authority a contract grants, before any chain is intersected (`T1950` narrows it). */
export function authorityOf(contract: ExpertContract): EffectiveAuthority {
  return {
    capabilities: [...contract.capabilities],
    tools: [...contract.allowedTools],
    permissions: contract.permissions.map((p) => ({ ...p })),
    prohibitedActions: [...contract.prohibitedActions],
  };
}

/** `FR-EXP-012`, `FR-EXP-013` — against a contract, or an already-intersected authority. */
export function contractRefusal(contract: ExpertContract | EffectiveAuthority, ask: Ask): string | null {
  const authority = 'rolePurpose' in contract ? authorityOf(contract) : contract;
  // Prohibitions first: they take precedence over every allowance.
  const prohibited = [...ask.actions, ...ask.tools].filter((a) => authority.prohibitedActions.includes(a));
  if (prohibited.length > 0) {
    return `prohibited by the contract: ${[...new Set(prohibited)].join(', ')} — a prohibition wins over any allowance (FR-EXP-013)`;
  }
  const capabilities = ask.capabilities.filter((c) => !authority.capabilities.includes(c));
  if (capabilities.length > 0) {
    return `the contract does not allow the capability ${capabilities.join(', ')} (FR-EXP-012)`;
  }
  const tools = ask.tools.filter((t) => !authority.tools.includes(t));
  if (tools.length > 0) return `the contract does not allow the tool ${tools.join(', ')} (FR-EXP-012)`;
  return null;
}

const covers = (permissions: readonly PermissionGrant[], target: DispatchTarget): boolean =>
  permissions.some(
    (p) => p.artifactType === target.artifactType && (p.action === target.action || (p.action === 'edit' && target.action === 'read')),
  );

/** `FR-EXP-014` — the contract's permissions ∩ the actor's grants, per target. */
export async function targetRefusal(
  workspaceId: string,
  actorId: string,
  contract: ExpertContract | EffectiveAuthority,
  targets: readonly DispatchTarget[],
  access: ActorAccess,
): Promise<string | null> {
  const permissions = 'rolePurpose' in contract ? contract.permissions : contract.permissions;
  for (const target of targets) {
    if (!covers(permissions, target)) {
      return `the contract does not permit ${target.action} on ${target.artifactType} ${target.artifactId} (FR-EXP-014)`;
    }
    const ref = { artifactType: target.artifactType, artifactId: target.artifactId };
    const allowed =
      target.action === 'edit'
        ? await access.mayEdit(workspaceId, actorId, ref)
        : await access.mayRead(workspaceId, actorId, ref);
    if (!allowed) {
      return (
        `${actorId} may not ${target.action} ${target.artifactType} ${target.artifactId}, and an Expert is ` +
        'never a route to authority its requester lacks (FR-EXP-014)'
      );
    }
  }
  return null;
}

const RANK = { read: 0, edit: 1 } as const;

/**
 * `T1950`, `FR-EXP-034`, `SC-EXP-004` — a delegate's authority is the
 * intersection of its own contract and its parent's **effective** authority
 * (itself already intersected up the chain). Capabilities and tools are
 * intersected; a permission survives only where the parent covers its artifact
 * type, at the narrower action; prohibitions accumulate. Delegation never
 * widens what the originating request was allowed to do.
 */
export function intersect(parent: EffectiveAuthority, child: ExpertContract): EffectiveAuthority {
  const permissions: PermissionGrant[] = [];
  for (const grant of child.permissions) {
    const held = parent.permissions.filter((p) => p.artifactType === grant.artifactType);
    if (held.length === 0) continue;
    const ceiling = held.reduce((max, p) => (RANK[p.action] > RANK[max] ? p.action : max), 'read' as PermissionGrant['action']);
    const action = RANK[grant.action] <= RANK[ceiling] ? grant.action : ceiling;
    if (!permissions.some((p) => p.artifactType === grant.artifactType && p.action === action)) {
      permissions.push({ artifactType: grant.artifactType, action });
    }
  }
  return {
    capabilities: child.capabilities.filter((c) => parent.capabilities.includes(c)),
    tools: child.allowedTools.filter((t) => parent.tools.includes(t)),
    permissions,
    prohibitedActions: [...new Set([...parent.prohibitedActions, ...child.prohibitedActions])],
  };
}
