/**
 * `T2323` (EPIC-048, `R-048-3`) — the learning policy, read from `EPIC-019`
 * steering (subject `learning_policy`, workspace scope).
 *
 * One document holds the categories (`FR-LRN-003`), each one's explicit
 * low-risk flag (`FR-LRN-022`, `FR-LRN-026`), the reuse policy (`FR-LRN-040`,
 * `FR-LRN-047`) and the three settings of spec Assumption 8. Versioning, actor
 * and instant are `SteeringService`'s: an edit appends a version, so
 * `FR-LRN-047` holds by construction.
 *
 * **Never read permissively.** A malformed document refuses; an absent one means
 * no categories, so every submission is refused naming the missing policy.
 *
 * Framework-free (PC-1).
 */
import { ValidationFailedError } from '../../core/errors.js';
import type { SteeringService } from '../steering/steering.service.js';
import type { LearningPolicyDocument, LearningPolicySourcePort } from './learning.tokens.js';

export const LEARNING_POLICY_SUBJECT = 'learning_policy' as const;

export const LEARNING_POLICY_DEFAULTS = Object.freeze({
  gracePeriodHours: 24,
  reviewWindowDays: 30,
  maxCandidatesPerExecution: 20,
});

export interface LearningCategory {
  readonly key: string;
  readonly description: string;
  /** Explicit, never inferred: absent reads `false` (`FR-LRN-026`). */
  readonly lowRisk: boolean;
  readonly defaultClassification?: string;
}

export interface ReusePolicy {
  readonly workspaceScopeAllowed: boolean;
  readonly namedSetsAllowed: boolean;
  readonly permittedClassifications: {
    readonly default: readonly string[];
    readonly byProject?: Readonly<Record<string, readonly string[]>>;
  };
}

export interface LearningPolicyContent {
  readonly categories: readonly LearningCategory[];
  readonly reuse: ReusePolicy;
  readonly gracePeriodHours: number;
  readonly reviewWindowDays: number;
  readonly maxCandidatesPerExecution: number;
}

export type ParsedPolicy = { readonly ok: true; readonly content: LearningPolicyContent } | { readonly ok: false; readonly problems: readonly string[] };

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function stringList(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === 'string' && s.trim() !== '');
}

/** Parse the steering content. Never throws; lists every problem. */
export function parseLearningPolicy(content: string): ParsedPolicy {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return { ok: false, problems: ['the document is not JSON'] };
  }
  if (!isObject(raw)) return { ok: false, problems: ['the document is not an object'] };
  const problems: string[] = [];

  const categories: LearningCategory[] = [];
  if (!Array.isArray(raw['categories']) || raw['categories'].length === 0) {
    problems.push('categories must be a non-empty list');
  } else {
    const seen = new Set<string>();
    raw['categories'].forEach((c: unknown, i) => {
      if (!isObject(c) || typeof c['key'] !== 'string' || c['key'].trim() === '') {
        problems.push(`categories[${i}] needs a key`);
        return;
      }
      const key = c['key'];
      if (seen.has(key)) problems.push(`category "${key}" is declared twice`);
      seen.add(key);
      if (c['lowRisk'] !== undefined && typeof c['lowRisk'] !== 'boolean') problems.push(`category "${key}": lowRisk must be true or false`);
      if (c['defaultClassification'] !== undefined && (typeof c['defaultClassification'] !== 'string' || c['defaultClassification'].trim() === '')) {
        problems.push(`category "${key}": defaultClassification must be a non-empty string`);
      }
      categories.push({
        key,
        description: typeof c['description'] === 'string' ? c['description'] : '',
        lowRisk: c['lowRisk'] === true,
        ...(typeof c['defaultClassification'] === 'string' && c['defaultClassification'].trim() !== '' ? { defaultClassification: c['defaultClassification'] } : {}),
      });
    });
  }

  let reuse: ReusePolicy = { workspaceScopeAllowed: false, namedSetsAllowed: false, permittedClassifications: { default: [] } };
  if (raw['reuse'] !== undefined) {
    const r = raw['reuse'];
    if (!isObject(r)) {
      problems.push('reuse must be an object');
    } else {
      for (const flag of ['workspaceScopeAllowed', 'namedSetsAllowed'] as const) {
        if (r[flag] !== undefined && typeof r[flag] !== 'boolean') problems.push(`reuse.${flag} must be true or false`);
      }
      const pc = r['permittedClassifications'];
      let permitted: ReusePolicy['permittedClassifications'] = { default: [] };
      if (pc !== undefined) {
        if (!isObject(pc) || (pc['default'] !== undefined && !stringList(pc['default']))) {
          problems.push('reuse.permittedClassifications.default must be a list of classifications');
        } else {
          const byProject: Record<string, string[]> = {};
          if (pc['byProject'] !== undefined) {
            if (!isObject(pc['byProject'])) problems.push('reuse.permittedClassifications.byProject must map project ids to lists');
            else
              for (const [project, list] of Object.entries(pc['byProject'])) {
                if (!stringList(list)) problems.push(`reuse.permittedClassifications.byProject.${project} must be a list`);
                else byProject[project] = list;
              }
          }
          permitted = {
            default: stringList(pc['default']) ? pc['default'] : [],
            ...(Object.keys(byProject).length > 0 ? { byProject } : {}),
          };
        }
      }
      reuse = {
        workspaceScopeAllowed: r['workspaceScopeAllowed'] === true,
        namedSetsAllowed: r['namedSetsAllowed'] === true,
        permittedClassifications: permitted,
      };
    }
  }

  const setting = (name: keyof typeof LEARNING_POLICY_DEFAULTS): number => {
    const v = raw as Record<string, unknown>;
    if (v[name] === undefined) return LEARNING_POLICY_DEFAULTS[name];
    if (typeof v[name] !== 'number' || !Number.isInteger(v[name]) || (v[name] as number) < 1) {
      problems.push(`${name} must be a positive whole number`);
      return LEARNING_POLICY_DEFAULTS[name];
    }
    return v[name] as number;
  };
  const gracePeriodHours = setting('gracePeriodHours');
  const reviewWindowDays = setting('reviewWindowDays');
  const maxCandidatesPerExecution = setting('maxCandidatesPerExecution');

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, content: { categories, reuse, gracePeriodHours, reviewWindowDays, maxCandidatesPerExecution } };
}

/** A parsed policy at one steering version — what every service decides against. */
export class LearningPolicy implements LearningPolicyContent {
  readonly categories: readonly LearningCategory[];
  readonly reuse: ReusePolicy;
  readonly gracePeriodHours: number;
  readonly reviewWindowDays: number;
  readonly maxCandidatesPerExecution: number;

  constructor(
    readonly documentId: string,
    readonly version: number,
    readonly actorId: string,
    readonly at: Date,
    content: LearningPolicyContent,
  ) {
    this.categories = content.categories;
    this.reuse = content.reuse;
    this.gracePeriodHours = content.gracePeriodHours;
    this.reviewWindowDays = content.reviewWindowDays;
    this.maxCandidatesPerExecution = content.maxCandidatesPerExecution;
  }

  category(key: string): LearningCategory | null {
    return this.categories.find((c) => c.key === key) ?? null;
  }

  /** The classifications a receiving project permits (`FR-LRN-040`). */
  permittedClassificationsFor(projectId: string): readonly string[] {
    return this.reuse.permittedClassifications.byProject?.[projectId] ?? this.reuse.permittedClassifications.default;
  }
}

export type PolicyState =
  | { readonly state: 'none' }
  | { readonly state: 'malformed'; readonly version: number; readonly problems: readonly string[] }
  | { readonly state: 'ok'; readonly policy: LearningPolicy };

export class LearningPolicyReader {
  constructor(private readonly source: LearningPolicySourcePort) {}

  async current(workspaceId: string): Promise<PolicyState> {
    const doc = await this.source.current(workspaceId);
    if (doc === null) return { state: 'none' };
    const parsed = parseLearningPolicy(doc.content);
    if (!parsed.ok) return { state: 'malformed', version: doc.version, problems: parsed.problems };
    return { state: 'ok', policy: new LearningPolicy(doc.documentId, doc.version, doc.actorId, new Date(doc.at), parsed.content) };
  }

  /** The policy, or a refusal naming why there is none (`FR-LRN-003`). */
  async require(workspaceId: string): Promise<LearningPolicy> {
    const current = await this.current(workspaceId);
    if (current.state === 'none') {
      throw new ValidationFailedError(
        'No learning policy is declared for this workspace, so no category exists to submit under (FR-LRN-003). ' +
          `Declare one as a steering document with subject "${LEARNING_POLICY_SUBJECT}".`,
        { policy: 'missing' },
      );
    }
    if (current.state === 'malformed') {
      throw new ValidationFailedError(`The learning policy v${current.version} is malformed and is not read permissively: ${current.problems.join('; ')}.`, {
        policyVersion: current.version,
        problems: current.problems,
      });
    }
    return current.policy;
  }
}

/**
 * The `LearningPolicySource` adapter over `EPIC-019`'s `SteeringService`: the
 * active, workspace-scoped `learning_policy` document of this workspace.
 */
export function steeringPolicySource(steering: Pick<SteeringService, 'list'>): LearningPolicySourcePort {
  return {
    async current(workspaceId: string): Promise<LearningPolicyDocument | null> {
      const docs = await steering.list(workspaceId);
      const mine = docs
        .filter((d) => d.subject === LEARNING_POLICY_SUBJECT && d.status === 'active' && d.scope.scopeType === 'workspace' && d.scope.scopeRef === workspaceId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const head = mine[0];
      if (head === undefined) return null;
      return { documentId: head.lineageId, version: head.version, content: head.content, actorId: head.createdById, at: head.createdAt.toISOString() };
    },
  };
}
