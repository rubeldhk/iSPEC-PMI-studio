/**
 * `T742`, `T780d` — the tenant policy, and the fences it cannot cross.
 * `FR-DPE-011`, `FR-DPE-012`, `FR-DPE-031`.
 *
 * The approval burden is tunable per tenant (`FR-DPE-011`) — within limits
 * enforced **when the policy is read**, so a bad policy fails in CI instead of
 * on the first high-risk action in production:
 *
 * - the **high** band is human-approved under every policy (`FR-DPE-012`);
 * - the **medium** band requires gates (`FR-DPE-010`) — it may be tightened to
 *   human approval, never loosened to auto-execution;
 * - an **automated action** must cite the rule that fires it (`FR-DPE-031`), and
 *   may not cover an irreducibly-high action, since automation never takes one.
 *
 * Tightening is always allowed. Every refusal names what it refused.
 */
import { IRREDUCIBLY_HIGH } from './classifier.js';

export const TREATMENTS = Object.freeze(['auto-execute', 'gates-required', 'human-approval'] as const);
export type Treatment = (typeof TREATMENTS)[number];

export interface AutomatedAction {
  /** An action type, or a dotted prefix ending in `.*`. */
  readonly actionPattern: string;
  /** `FR-DPE-031` — the visible rule that fires it. */
  readonly ruleId: string;
}

export interface TenantPolicyDocument {
  /** Monotonic per workspace. `0` is the platform default — no tenant policy issued yet. */
  readonly version: number;
  readonly bandTreatment: { readonly low: Treatment; readonly medium: Treatment; readonly high: Treatment };
  /** `FR-DPE-015` — action patterns where a requester may approve their own request. */
  readonly selfApprovalAllowed: readonly string[];
  /** `FR-DPE-030` — automated actions the tenant permits. */
  readonly automatedActions: readonly AutomatedAction[];
  readonly approvedBy: string;
}

/** What a workspace that never issued a policy is governed by. Tightest that still works. */
export const PLATFORM_DEFAULT_POLICY: TenantPolicyDocument = Object.freeze({
  version: 0,
  bandTreatment: Object.freeze({ low: 'auto-execute', medium: 'gates-required', high: 'human-approval' }),
  selfApprovalAllowed: Object.freeze([]) as readonly string[],
  automatedActions: Object.freeze([]) as readonly AutomatedAction[],
  approvedBy: 'platform',
}) as TenantPolicyDocument;

/** The current policy for a workspace. Throwing is an outage, and the engine refuses (`FR-DPE-050`). */
export interface PolicySource {
  current(workspaceId: string): Promise<TenantPolicyDocument>;
}

export type PolicyRefusal =
  | 'malformed'
  | 'lowers-high-band'
  | 'lowers-medium-band'
  | 'automates-high-band'
  | 'uncited-automation';

export type PolicyLoad =
  | { readonly ok: true; readonly policy: TenantPolicyDocument }
  | { readonly ok: false; readonly reason: PolicyRefusal; readonly message: string };

/** Does an action pattern cover an action type? Exact, or a dotted prefix ending `.*`. */
export function patternCovers(pattern: string, actionType: string): boolean {
  if (pattern === actionType) return true;
  return pattern.endsWith('.*') && actionType.startsWith(pattern.slice(0, -1));
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const refuse = (reason: PolicyRefusal, message: string): PolicyLoad => ({ ok: false, reason, message });

export function loadPolicy(candidate: unknown): PolicyLoad {
  if (!isRecord(candidate)) return refuse('malformed', 'a tenant policy is a JSON object');
  const { version, bandTreatment, selfApprovalAllowed, automatedActions, approvedBy } = candidate;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    return refuse('malformed', 'a tenant policy carries a version');
  }
  if (typeof approvedBy !== 'string' || approvedBy.trim() === '') {
    return refuse('malformed', 'a tenant policy names who approved it — a policy change is itself governed');
  }
  if (!isRecord(bandTreatment)) return refuse('malformed', 'a tenant policy states a treatment for each band');
  for (const band of ['low', 'medium', 'high']) {
    if (!(TREATMENTS as readonly unknown[]).includes(bandTreatment[band])) {
      return refuse('malformed', `the ${band} band's treatment is one of ${TREATMENTS.join(', ')}`);
    }
  }
  if (!Array.isArray(selfApprovalAllowed) || !selfApprovalAllowed.every((p) => typeof p === 'string')) {
    return refuse('malformed', 'selfApprovalAllowed is a list of action patterns');
  }
  if (!Array.isArray(automatedActions)) return refuse('malformed', 'automatedActions is a list');

  // FR-DPE-012 — the high band is human-approved under every tenant policy.
  if (bandTreatment['high'] !== 'human-approval') {
    return refuse(
      'lowers-high-band',
      `the high band cannot be treated as ${String(bandTreatment['high'])}: ${IRREDUCIBLY_HIGH.join(', ')} ` +
        'and every other high-band action remain human-approved under every tenant policy (FR-DPE-012)',
    );
  }
  // FR-DPE-010 — medium requires gates; it may be tightened, never loosened.
  if (bandTreatment['medium'] === 'auto-execute') {
    return refuse('lowers-medium-band', 'the medium band requires policy and evidence gates and cannot auto-execute (FR-DPE-010)');
  }

  const automated: AutomatedAction[] = [];
  for (const raw of automatedActions) {
    if (!isRecord(raw) || typeof raw['actionPattern'] !== 'string' || raw['actionPattern'] === '') {
      return refuse('malformed', 'each automated action names an action pattern');
    }
    const actionPattern = raw['actionPattern'];
    if (typeof raw['ruleId'] !== 'string' || raw['ruleId'].trim() === '') {
      return refuse(
        'uncited-automation',
        `the automated action ${actionPattern} cites no rule; an automated action must be explainable from a ` +
          'visible rule, and one that cannot be cited is not loadable (FR-DPE-031)',
      );
    }
    const covered = IRREDUCIBLY_HIGH.filter((a) => patternCovers(actionPattern, a));
    if (covered.length > 0) {
      return refuse(
        'automates-high-band',
        `the automated action ${actionPattern} covers ${covered.join(', ')}, which only an authorized human may take (FR-DPE-012)`,
      );
    }
    automated.push({ actionPattern, ruleId: raw['ruleId'] });
  }

  return {
    ok: true,
    policy: {
      version,
      approvedBy,
      bandTreatment: {
        low: bandTreatment['low'] as Treatment,
        medium: bandTreatment['medium'] as Treatment,
        high: 'human-approval',
      },
      selfApprovalAllowed: selfApprovalAllowed as string[],
      automatedActions: automated,
    },
  };
}
