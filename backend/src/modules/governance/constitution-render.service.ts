/**
 * `T1484` (EPIC-042, `FR-EXT-020`–`FR-EXT-027`, `R-042-4`, `R-042-5`) — the
 * deterministic render of a project's constitution and the one rule that
 * classifies a file on disk.
 *
 * The render is plain string assembly in the `contracts/governance-api.md` §4
 * order. The text that names the toolkit — the header, the Decomposition
 * Policy bullets, the invariant Governed Execution section — is imported from
 * `@pmi/workspace-bundle` as functions; this file contains none of those words
 * (`engine-independence.spec.ts`). The digest is SHA-256 of the exact bytes
 * with the header's digest field zeroed, so the file can carry its own digest.
 * A render whose digest equals the latest row's is not inserted (`FR-EXT-024`).
 */
import { createHash, randomUUID } from 'node:crypto';
import { SCOPE_ORDER } from '../steering/scope-resolver.js';
import { constitutionHeader, decompositionPolicySection, governedExecutionSection } from '@pmi/workspace-bundle';
import type { ConstitutionRenderRecord, ConstitutionRenderStore } from './constitution-render.store.js';
import type { DecompositionPolicyService } from './decomposition-policy.service.js';
import type { ProjectConstraintService } from './project-constraint.service.js';

export type ConstitutionState = 'current' | 'stale' | 'drift' | 'missing';

export interface RenderContext {
  readonly workspaceId: string;
  readonly projectId: string;
  /** The person whose write caused the render; recorded as renderedById. */
  readonly userId?: string | undefined;
  /** The audit actor when no person is acting — a connector principal reading through the server. */
  readonly actorId?: string | undefined;
}

export interface ResolvedSteeringForRender {
  readonly id: string;
  readonly subject: string;
  readonly scopeType: string;
  readonly content: string;
  readonly version: number;
}

export interface ConstitutionRenderDeps {
  readonly store: ConstitutionRenderStore;
  readonly constraints: Pick<ProjectConstraintService, 'list' | 'maxVersion'>;
  readonly policy: Pick<DecompositionPolicyService, 'get'>;
  readonly projects: { get(workspaceId: string, projectId: string): Promise<{ id: string; name: string }> };
  /** `EPIC-019`'s resolution for the project scope, broadest first (`FR-EXT-023`). */
  readonly steering: { resolvedForProject(workspaceId: string, projectId: string): Promise<ResolvedSteeringForRender[]> };
  readonly audit: { record(row: Record<string, unknown>): Promise<void> };
  readonly now?: () => Date;
  readonly newId?: () => string;
}

const ZERO_DIGEST = '0'.repeat(64);
const NONE = '_None recorded._\n';

function section(title: string, body: string): string {
  return `\n## ${title}\n\n${body}`;
}

function entries(rows: { title: string; body: string }[]): string {
  if (rows.length === 0) return NONE;
  return rows.map((r) => (r.body.trim().length > 0 ? `### ${r.title}\n\n${r.body.replace(/\r\n/g, '\n').replace(/\n+$/, '')}\n` : `### ${r.title}\n`)).join('\n');
}

/** Broadest scope first (contract rule S3); the resolver already orders, this keeps the render honest when a caller does not. */
function broadestFirst(rows: ResolvedSteeringForRender[]): ResolvedSteeringForRender[] {
  const depth = (s: string): number => (SCOPE_ORDER as readonly string[]).indexOf(s);
  return [...rows].sort((a, b) => depth(a.scopeType) - depth(b.scopeType) || a.subject.localeCompare(b.subject));
}

export function digestOfRender(content: string): string {
  const zeroed = content.replace(/digest [0-9a-f]{64}/, `digest ${ZERO_DIGEST}`);
  return createHash('sha256').update(zeroed, 'utf8').digest('hex');
}

export class ConstitutionRenderService {
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(private readonly deps: ConstitutionRenderDeps) {
    this.now = deps.now ?? ((): Date => new Date());
    this.newId = deps.newId ?? ((): string => randomUUID());
  }

  /**
   * The current render: recomputed from the inputs; returned unchanged when its
   * digest equals the latest row's, appended as version + 1 otherwise.
   */
  async current(ctx: RenderContext): Promise<ConstitutionRenderRecord> {
    const project = await this.deps.projects.get(ctx.workspaceId, ctx.projectId);
    const [rows, policy, steering, constraintsMaxVersion] = await Promise.all([
      this.deps.constraints.list(ctx, { status: 'active' }),
      this.deps.policy.get(ctx),
      this.deps.steering.resolvedForProject(ctx.workspaceId, ctx.projectId),
      this.deps.constraints.maxVersion(ctx),
    ]);
    const latest = await this.deps.store.latest(ctx.projectId);
    const version = (latest?.version ?? 0) + 1;

    const byKind = (kind: string): { title: string; body: string }[] => rows.filter((r) => r.kind === kind);
    const body =
      `\n# ${project.name} Constitution\n` +
      section('Core Principles', entries(byKind('principle'))) +
      section('Constraints', entries(byKind('constraint'))) +
      section('Non-goals', entries(byKind('non_goal'))) +
      section('Decomposition Policy', decompositionPolicySection(policy)) +
      section('Governed Execution', governedExecutionSection(policy.offlineMode)) +
      section('Steering', steering.length === 0 ? NONE : broadestFirst(steering).map((s) => `### ${s.subject}\n\n${s.content.replace(/\r\n/g, '\n').replace(/\n+$/, '')}\n`).join('\n'));

    const render = (v: number, digest: string): string => constitutionHeader({ projectId: project.id, version: v, digest }) + body;
    // The digest is over the content with the header digest zeroed, so a file can carry its own.
    const candidate = render(latest?.version ?? version, ZERO_DIGEST);
    const digest = digestOfRender(candidate);
    if (latest && latest.digest === digest) return latest;

    const inputs = { policyVersion: policy.version, constraintsMaxVersion, steeringDocumentIds: steering.map((s) => s.id) };
    const content = render(version, digestOfRender(render(version, ZERO_DIGEST)));
    const row = await this.deps.store.append({
      id: this.newId(),
      workspaceId: ctx.workspaceId,
      projectId: ctx.projectId,
      version,
      digest: digestOfRender(content),
      content,
      inputs,
      renderedById: ctx.userId ?? null,
      renderedAt: this.now(),
    });
    await this.deps.audit.record({
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId ?? ctx.actorId ?? null,
      action: 'create',
      targetType: 'constitution_render',
      targetId: row.id,
      outcome: 'success',
      detail: { projectId: ctx.projectId, operation: 'constitution.render', version, digest: row.digest, ...inputs },
    });
    return row;
  }

  /** data-model.md §3 — one rule for `pmi.health`, `pmi.constitution.get` and the screens. Never renders. */
  async classify(ctx: Pick<RenderContext, 'projectId'>, onDiskDigest: string | null | undefined): Promise<ConstitutionState> {
    return classifyOnDiskDigest(this.deps.store, ctx.projectId, onDiskDigest);
  }
}

/**
 * The classification rule as a function over the store, so `ConnectorModule`'s
 * health route applies the same rule without importing the render service.
 */
export async function classifyOnDiskDigest(
  store: Pick<ConstitutionRenderStore, 'latest' | 'findByDigest'>,
  projectId: string,
  onDiskDigest: string | null | undefined,
): Promise<ConstitutionState> {
  if (onDiskDigest === null || onDiskDigest === undefined || onDiskDigest === '') return 'missing';
  const latest = await store.latest(projectId);
  if (!latest) return 'drift';
  if (latest.digest === onDiskDigest) return 'current';
  const earlier = await store.findByDigest(projectId, onDiskDigest);
  return earlier ? 'stale' : 'drift';
}
