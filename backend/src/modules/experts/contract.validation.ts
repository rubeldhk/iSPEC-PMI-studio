/**
 * `T1918`, `T1920` (EPIC-047) — a contract is complete and points at real
 * things, or it is refused naming every gap.
 *
 * `FR-EXP-010`, `FR-EXP-011`, `FR-EXP-020`, `FR-EXP-022`. Two passes, because
 * they fail for different reasons: `validateContract` is about the document
 * alone and needs nothing; `checkReferences` asks `EPIC-032` and the registry
 * whether what it names exists — and refuses `503` when it cannot ask, rather
 * than accepting a reference nobody checked.
 */
import { AGENT_CAPABILITIES } from '@pmi/agent-contract';
import { ValidationFailedError } from '../../core/errors.js';
import {
  CONTRACT_ELEMENTS,
  LIMIT_KINDS,
  MEMORY_POLICIES,
  RISK_BANDS,
  UNENFORCEABLE_POSTURES,
  type ExpertContract,
} from './expert.types.js';
import type { ExpertsStore } from './experts.store.js';
import type { EvidenceContracts } from './experts.tokens.js';

type Loose = Record<string, unknown>;

const isObject = (v: unknown): v is Loose => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const isTextList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** The document alone. Returns the contract exactly as given when it is valid. */
export function validateContract(input: unknown): ExpertContract {
  if (!isObject(input)) {
    throw new ValidationFailedError('an Expert contract must be an object defining all twelve BR-0102 elements', {
      missing: CONTRACT_ELEMENTS.map((e) => e.element),
      problems: [],
    });
  }
  const c = input;

  // `FR-EXP-011` — every missing element, named by its BR-0102 name.
  const missing = CONTRACT_ELEMENTS.filter((e) => e.fields.some((f) => c[f] === undefined || c[f] === null)).map(
    (e) => e.element,
  );

  const problems: string[] = [];
  const present = (field: keyof ExpertContract): boolean => c[field] !== undefined && c[field] !== null;

  if (present('rolePurpose') && !isText(c['rolePurpose'])) problems.push('role and purpose must be non-empty text');

  if (present('models')) {
    const m = c['models'];
    if (!isObject(m) || !isText(m['preferred']) || !isTextList(m['fallbacks'])) {
      problems.push('models must name a preferred model and a list of fallbacks');
    } else if ((m['fallbacks'] as string[]).includes(m['preferred'] as string)) {
      problems.push(`the preferred model '${String(m['preferred'])}' is repeated as a fallback`);
    }
  }

  if (present('capabilities')) {
    const caps = c['capabilities'];
    if (!isTextList(caps) || caps.length === 0) {
      problems.push('capabilities must be a non-empty list');
    } else {
      const unknown = caps.filter((x) => !(AGENT_CAPABILITIES as readonly string[]).includes(x));
      if (unknown.length > 0) {
        problems.push(
          `capabilities outside the agent seam's vocabulary (${AGENT_CAPABILITIES.join(', ')}): ${unknown.join(', ')}`,
        );
      }
    }
  }
  if (present('allowedTools') && !isTextList(c['allowedTools'])) problems.push('allowed tools must be a list');
  if (present('prohibitedActions') && !isTextList(c['prohibitedActions'])) {
    problems.push('prohibited actions must be a list');
  }
  if (present('delegatesTo') && !isTextList(c['delegatesTo'])) {
    problems.push('delegatesTo must be a list of Expert keys');
  }

  if (present('contextPolicy')) {
    const p = c['contextPolicy'];
    if (
      !isObject(p) ||
      typeof p['budgetTokens'] !== 'number' ||
      !(p['budgetTokens'] > 0) ||
      typeof p['budgetCost'] !== 'number' ||
      !(p['budgetCost'] >= 0) ||
      typeof p['includeLiveState'] !== 'boolean'
    ) {
      problems.push('the context policy must give budgetTokens (> 0), budgetCost (≥ 0) and includeLiveState');
    }
  }

  if (present('workspaceRequirements') && !isObject(c['workspaceRequirements'])) {
    problems.push('workspace requirements must be an object');
  }

  if (present('permissions')) {
    const perms = c['permissions'];
    if (
      !Array.isArray(perms) ||
      !perms.every((g) => isObject(g) && isText(g['artifactType']) && (g['action'] === 'read' || g['action'] === 'edit'))
    ) {
      problems.push('permissions must be a list of {artifactType, action: read | edit}');
    }
  }

  if (present('riskClass') && !(RISK_BANDS as readonly unknown[]).includes(c['riskClass'])) {
    problems.push(`risk class must be one of ${RISK_BANDS.join(', ')}`);
  }

  if (present('budget')) problems.push(...budgetProblems(c['budget']));

  // `FR-EXP-020`, clarified 2026-10-09 and amended by `A-047-1` the same day.
  if (present('memoryPolicy') && !(MEMORY_POLICIES as readonly unknown[]).includes(c['memoryPolicy'])) {
    problems.push(
      `the memory policy must be 'none' or 'governed-knowledge' — a session retains nothing beyond itself, ` +
        'and memory across sessions is decided by Governed Learning (EPIC-048), which grants no private memory (FR-EXP-020)',
    );
  }

  if (present('expectedOutputs')) {
    const outs = c['expectedOutputs'];
    if (!Array.isArray(outs) || !outs.every((o) => isObject(o) && isText(o['kind']) && typeof o['required'] === 'boolean')) {
      problems.push('expected outputs must be a list of {kind, required}');
    }
  }

  if (present('evidenceContract')) {
    const ref = c['evidenceContract'];
    if (
      !isObject(ref) ||
      !isText(ref['workClass']) ||
      !Number.isInteger(ref['contractVersion']) ||
      (ref['contractVersion'] as number) < 1
    ) {
      problems.push("the Evidence Contract must be referenced as {workClass, contractVersion ≥ 1} (EPIC-032's identity)");
    }
  }

  if (missing.length > 0 || problems.length > 0) {
    const parts = [
      ...(missing.length > 0 ? [`missing: ${missing.join(', ')}`] : []),
      ...problems,
    ];
    throw new ValidationFailedError(`the Expert contract is incomplete or invalid — ${parts.join('; ')} (FR-EXP-011)`, {
      missing,
      problems,
    });
  }
  return input as unknown as ExpertContract;
}

function budgetProblems(budget: unknown): string[] {
  if (!isObject(budget)) return ['the budget must be an object with at least a time limit'];
  const problems: string[] = [];
  const time = budget['time'];
  if (!isObject(time) || typeof time['value'] !== 'number' || !(time['value'] > 0)) {
    problems.push('the budget must set a positive time limit — every session has one (FR-EXP-040)');
  }
  for (const kind of LIMIT_KINDS) {
    const setting = budget[kind];
    if (setting === undefined) continue;
    if (!isObject(setting) || typeof setting['value'] !== 'number' || !(setting['value'] > 0)) {
      if (kind !== 'time') problems.push(`the ${kind} limit must have a positive value`);
      continue;
    }
    const posture = setting['onUnenforceable'];
    if (posture !== undefined && !(UNENFORCEABLE_POSTURES as readonly unknown[]).includes(posture)) {
      problems.push(
        `the ${kind} limit's posture for an unenforceable limit must be ${UNENFORCEABLE_POSTURES.join(' or ')} (FR-EXP-043)`,
      );
    }
  }
  return problems;
}

/** `FR-EXP-022` — what the contract names must exist. A port that cannot answer propagates. */
export async function checkReferences(
  workspaceId: string,
  contract: ExpertContract,
  deps: { readonly evidence: EvidenceContracts; readonly store: ExpertsStore },
): Promise<void> {
  const dangling: string[] = [];
  const ref = contract.evidenceContract;
  if (!(await deps.evidence.exists(ref))) {
    dangling.push(`Evidence Contract ${ref.workClass}@${ref.contractVersion} does not exist in EPIC-032`);
  }
  for (const key of contract.delegatesTo) {
    if ((await deps.store.findExpertByKey(workspaceId, key)) === null) {
      dangling.push(`delegate '${key}' is not an Expert in this workspace`);
    }
  }
  if (dangling.length > 0) {
    throw new ValidationFailedError(`the Expert contract names what does not exist — ${dangling.join('; ')} (FR-EXP-022)`, {
      dangling,
    });
  }
}
