/**
 * `T1946`, `T1948`, `T1952`, `T1956`, `T1987` (EPIC-047) — delegation.
 *
 * `FR-EXP-030`…`FR-EXP-037`, `ADR-0027` rule 2. An Expert may delegate only
 * where its contract names the delegate **and** the workspace policy permits
 * the pair. No policy means no delegation — the absence of a rule is not a
 * permission. Depth and fan-out are bounded, a cycle is refused, and the
 * delegate's authority is intersected down the chain (`authority.ts`).
 *
 * Every refusal names the session that asked, so it can be recorded there
 * (`FR-EXP-032`) as well as on the attempt.
 */
import { NotFoundError, ValidationFailedError } from '../../core/errors.js';
import { intersect } from './authority.js';
import {
  RISK_BANDS,
  type DelegationPolicy,
  type EffectiveAuthority,
  type EngineeringExpert,
  type ExpertContract,
  type ExpertSession,
  type RiskBand,
} from './expert.types.js';
import type { ExpertsStore } from './experts.store.js';

/** A delegation refused; `parentExecutionId` is where it is recorded, when known. */
export class DelegationRefusal extends Error {
  constructor(
    message: string,
    readonly parentExecutionId: string | null,
  ) {
    super(message);
  }
}

export interface Admitted {
  readonly parent: ExpertSession;
  readonly depth: number;
  readonly authority: EffectiveAuthority;
}

/** `FR-EXP-030`, `FR-EXP-033`, `FR-EXP-034`, `FR-EXP-035`. */
export async function admitDelegation(
  store: ExpertsStore,
  workspaceId: string,
  parentExecutionId: string,
  child: EngineeringExpert,
  childContract: ExpertContract,
): Promise<Admitted> {
  const parent = await store.findSession(workspaceId, parentExecutionId);
  if (parent === null) {
    throw new DelegationRefusal(`there is no Expert session ${parentExecutionId} in this workspace to delegate from`, null);
  }
  const refuse = (why: string): never => {
    throw new DelegationRefusal(why, parent.executionId);
  };
  if (parent.outcome !== null) {
    refuse(`session ${parent.executionId} has ended (${parent.outcome}); a finished session delegates nothing (FR-EXP-037)`);
  }
  const policy = await store.policyFor(workspaceId);
  if (policy === null) {
    refuse('there is no delegation policy in this workspace, and no policy means no delegation (FR-EXP-030)');
  }
  const parentExpert = await store.findExpert(workspaceId, parent.expertId);
  const parentVersion = (await store.versionsFor(workspaceId, parent.expertId)).find((v) => v.id === parent.contractVersionId);
  if (parentExpert === null || parentVersion === undefined) {
    refuse(`session ${parent.executionId} names an Expert or contract version that cannot be read`);
  }
  const from = parentExpert!.key;
  if (!parentVersion!.contract.delegatesTo.includes(child.key)) {
    refuse(`the contract of ${from} does not name ${child.key} among the Experts it may delegate to (FR-EXP-030)`);
  }
  if (!policy!.allowedPairs.some((p) => p.from === from && (p.to === child.key || p.to === '*'))) {
    refuse(`the workspace's delegation policy does not permit ${from} → ${child.key} (FR-EXP-030)`);
  }

  // `FR-EXP-035` — no Expert twice on one chain.
  const chain = await ancestorsOf(store, workspaceId, parent);
  if ([parent, ...chain].some((s) => s.expertId === child.id)) {
    refuse(`delegation to ${child.key} would form a cycle: ${child.key} is already on this chain (FR-EXP-035)`);
  }

  const depth = parent.depth + 1;
  if (depth > policy!.maxDepth) {
    refuse(`depth ${depth} exceeds the policy's maximum of ${policy!.maxDepth} (FR-EXP-033)`);
  }
  const siblings = (await store.childrenOf(workspaceId, parent.executionId)).length;
  if (siblings >= policy!.maxFanOut) {
    refuse(
      `fan-out: session ${parent.executionId} already has ${siblings} delegate(s), the policy's maximum of ${policy!.maxFanOut} (FR-EXP-033)`,
    );
  }
  return { parent, depth, authority: intersect(parent.effectiveAuthority, childContract) };
}

/** From the parent of `session` up to the root, nearest first. */
async function ancestorsOf(store: ExpertsStore, workspaceId: string, session: ExpertSession): Promise<ExpertSession[]> {
  const out: ExpertSession[] = [];
  const seen = new Set<string>([session.executionId]);
  let walk = session.delegatedFromExecutionId;
  while (walk !== null && !seen.has(walk)) {
    seen.add(walk);
    const next = await store.findSession(workspaceId, walk);
    if (next === null) break;
    out.push(next);
    walk = next.delegatedFromExecutionId;
  }
  return out;
}

export interface TreeNode {
  readonly executionId: string;
  readonly expertId: string;
  readonly expertKey: string;
  readonly contractVersion: number | null;
  readonly depth: number;
  readonly model: string;
  readonly outcome: ExpertSession['outcome'];
  readonly startedAt: string;
}

/** A node and everything delegated beneath it. */
export interface Branch extends TreeNode {
  readonly children: readonly Branch[];
}

export interface DelegationTree {
  /** Root first. */
  readonly ancestors: readonly TreeNode[];
  readonly node: Branch;
}

/** `T1956`, `SC-EXP-005` — reconstructed from the record alone, within one workspace. */
export async function delegationTree(store: ExpertsStore, workspaceId: string, executionId: string): Promise<DelegationTree> {
  const session = await store.findSession(workspaceId, executionId);
  if (session === null) throw new NotFoundError('Not found.');
  const names = new Map<string, { key: string; versions: Map<string, number> }>();
  const describe = async (s: ExpertSession): Promise<TreeNode> => {
    let known = names.get(s.expertId);
    if (!known) {
      const expert = await store.findExpert(workspaceId, s.expertId);
      const versions = await store.versionsFor(workspaceId, s.expertId);
      known = { key: expert?.key ?? s.expertId, versions: new Map(versions.map((v) => [v.id, v.version])) };
      names.set(s.expertId, known);
    }
    return {
      executionId: s.executionId,
      expertId: s.expertId,
      expertKey: known.key,
      contractVersion: known.versions.get(s.contractVersionId) ?? null,
      depth: s.depth,
      model: s.model,
      outcome: s.outcome,
      startedAt: s.startedAt,
    };
  };
  const grow = async (s: ExpertSession): Promise<Branch> => {
    const children = await store.childrenOf(workspaceId, s.executionId);
    return { ...(await describe(s)), children: await Promise.all(children.map(grow)) };
  };
  const ancestors = (await ancestorsOf(store, workspaceId, session)).reverse();
  return {
    ancestors: await Promise.all(ancestors.map(describe)),
    node: await grow(session),
  };
}

/** `T1987`, `FR-EXP-033` — the workspace's delegation policy, validated whole. */
export function validatePolicy(
  workspaceId: string,
  body: unknown,
  by: string,
  at: string,
): DelegationPolicy {
  const b = (body ?? {}) as Record<string, unknown>;
  const problems: string[] = [];
  const int = (name: string): number => {
    const v = b[name];
    if (!Number.isInteger(v) || (v as number) < 1) problems.push(`${name} must be a whole number ≥ 1`);
    return v as number;
  };
  const maxDepth = int('maxDepth');
  const maxFanOut = int('maxFanOut');
  const pairs = b['allowedPairs'];
  if (
    !Array.isArray(pairs) ||
    !pairs.every(
      (p) =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as Record<string, unknown>)['from'] === 'string' &&
        typeof (p as Record<string, unknown>)['to'] === 'string',
    )
  ) {
    problems.push('allowedPairs must be a list of {from, to} Expert keys (to may be *)');
  }
  const band = b['maxUnattendedBand'];
  if (!(RISK_BANDS as readonly unknown[]).includes(band)) {
    problems.push(`maxUnattendedBand must be one of ${RISK_BANDS.join(', ')}`);
  }
  if (problems.length > 0) {
    throw new ValidationFailedError(`the delegation policy is invalid — ${problems.join('; ')}`, { problems });
  }
  return {
    workspaceId,
    maxDepth,
    maxFanOut,
    allowedPairs: (pairs as { from: string; to: string }[]).map(({ from, to }) => ({ from, to })),
    maxUnattendedBand: band as RiskBand,
    updatedBy: by,
    updatedAt: at,
  };
}
