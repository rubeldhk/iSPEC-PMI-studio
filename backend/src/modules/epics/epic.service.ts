/**
 * `T1565` / `T1569` (EPIC-044, `FR-EPB-020`–`FR-EPB-029`, `FR-EPB-064`,
 * `R-044-5`, `R-044-6`) — the Epic entity: created with a platform-allocated
 * number and a slug derived from the title, edited without ever changing the
 * number, closed rather than deleted; requirements and specifications belong to
 * at most one Epic; a recorded decomposition decision creates child Epics once.
 * Every write passes the owner gate and is audited with before and after.
 *
 * There is no stage anywhere in this file. A stage is derived from executions
 * by `EpicStageService`, never stored (`FR-EPB-001`).
 */
import { randomUUID } from 'node:crypto';
import { validateDecompositionDecision } from '@pmi/workspace-bundle';
import { ConflictError, NotFoundError, ValidationFailedError } from '../../core/errors.js';
import type { OwnerGate } from '../governance/owner-gate.js';
import type { AssignableRequirement, AssignableSpecification, DecisionCommentReader, RequirementAssignmentPort, SpecificationAssignmentPort } from './assignment.ports.js';
import type { EpicFilters, EpicRecord, EpicStatus, EpicStore } from './epic.store.js';

export interface EpicContext {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly userId: string;
}

export interface CreateEpicInput {
  readonly title: string;
  readonly description?: string | undefined;
}

export interface EditEpicInput {
  readonly title?: string | undefined;
  readonly description?: string | undefined;
}

export interface EpicView extends EpicRecord {
  readonly requirementCount: number;
  readonly specificationCount: number;
}

export interface EpicList {
  readonly epics: EpicView[];
  /** Requirements with no Epic — listed, never omitted (`FR-EPB-024`). */
  readonly unassigned: AssignableRequirement[];
}

export interface EpicDetail extends EpicView {
  readonly requirements: AssignableRequirement[];
  readonly specifications: AssignableSpecification[];
  readonly parent: EpicRecord | null;
  readonly children: EpicRecord[];
  /** Decisions that touched this Epic: the one that created it, the last one processed for it. */
  readonly decisions: { createdBy: string | null; lastProcessed: string | null };
}

export interface ReconcileOutcome {
  readonly created: EpicRecord[];
  /** Human-readable problems: unreadable bodies, unknown Epics, unknown requirement references. */
  readonly findings: string[];
}

export interface EpicServiceDeps {
  readonly store: EpicStore;
  readonly requirements: RequirementAssignmentPort;
  readonly specifications: SpecificationAssignmentPort;
  readonly decisions: DecisionCommentReader;
  readonly gate: OwnerGate;
  readonly audit: { record(row: Record<string, unknown>): Promise<void> };
  readonly now?: () => Date;
  readonly newId?: () => string;
}

const TITLE_MAX = 120;
const SLUG_MAX = 40;

/** `kebab-case`, ASCII letters, digits and hyphens, at most 40 characters (`FR-EPB-020`). */
export function slugify(title: string): string {
  const ascii = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const cut = ascii.slice(0, SLUG_MAX).replace(/-+$/g, '');
  return cut || 'epic';
}

function validateTitle(title: unknown): void {
  if (typeof title !== 'string' || title.trim().length === 0 || title.length > TITLE_MAX) {
    throw new ValidationFailedError('The Epic is not valid.', { fields: [{ field: 'title', message: `1–${TITLE_MAX} characters` }] });
  }
}

interface DecisionChild {
  readonly suffix: string;
  readonly slug: string;
  readonly estimate: number;
  readonly requirements: string[];
}

interface DecisionBody {
  readonly policyVersion: number;
  readonly epic: { number: number; slug: string; name: string };
  readonly decision: 'confirmed' | 'edited' | 'rejected';
  readonly children: DecisionChild[];
  readonly decidedBy: string;
}

export class EpicService {
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(readonly deps: EpicServiceDeps) {
    this.now = deps.now ?? ((): Date => new Date());
    this.newId = deps.newId ?? ((): string => randomUUID());
  }

  // ------------------------------------------------------------------ writes

  async create(ctx: EpicContext, input: CreateEpicInput): Promise<EpicRecord> {
    validateTitle(input.title);
    await this.deps.gate.requireOwner(ctx, ctx.projectId, 'create an Epic');
    const row = await this.deps.store.create({
      id: this.newId(),
      workspaceId: ctx.workspaceId,
      projectId: ctx.projectId,
      slug: slugify(input.title),
      title: input.title,
      description: input.description ?? '',
      status: 'active',
      parentEpicId: null,
      splitSuffix: null,
      decisionCommentId: null,
      lastDecisionCommentId: null,
      createdById: ctx.userId,
      closedAt: null,
    });
    await this.audited(ctx, 'create', 'epic', row.id, { operation: 'epic.create', projectId: ctx.projectId, number: row.number, slug: row.slug });
    return row;
  }

  async edit(ctx: EpicContext, id: string, input: EditEpicInput): Promise<EpicRecord> {
    if (input.title !== undefined) validateTitle(input.title);
    const existing = await this.requireOwn(ctx, id);
    await this.deps.gate.requireOwner(ctx, ctx.projectId, 'edit an Epic');
    const row = await this.deps.store.update(id, {
      ...(input.title !== undefined ? { title: input.title, slug: slugify(input.title) } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      updatedAt: this.now(),
    });
    await this.audited(ctx, 'update', 'epic', row.id, {
      operation: 'epic.update',
      projectId: ctx.projectId,
      before: { title: existing.title, slug: existing.slug, description: existing.description },
      after: { title: row.title, slug: row.slug, description: row.description },
    });
    return row;
  }

  async close(ctx: EpicContext, id: string): Promise<EpicRecord> {
    const existing = await this.requireOwn(ctx, id);
    await this.deps.gate.requireOwner(ctx, ctx.projectId, 'close an Epic');
    this.requireActive(existing, 'close');
    const at = this.now();
    const row = await this.deps.store.update(id, { status: 'closed', closedAt: at, updatedAt: at });
    await this.audited(ctx, 'update', 'epic', row.id, { operation: 'epic.close', projectId: ctx.projectId, before: { status: existing.status }, after: { status: 'closed' } });
    return row;
  }

  async assignRequirement(ctx: EpicContext, requirementId: string, epicId: string | null): Promise<AssignableRequirement> {
    const requirement = await this.deps.requirements.find(ctx.workspaceId, requirementId);
    if (!requirement || requirement.projectId !== ctx.projectId) throw new NotFoundError('The requirement does not exist.');
    await this.deps.gate.requireOwner(ctx, ctx.projectId, 'assign a requirement to an Epic');
    if (epicId !== null) this.requireActive(await this.requireOwn(ctx, epicId), 'assign to');
    await this.deps.requirements.setEpic(ctx.workspaceId, requirementId, epicId);
    await this.audited(ctx, 'update', 'requirement', requirementId, { operation: 'requirement.assign_epic', projectId: ctx.projectId, before: { epicId: requirement.epicId }, after: { epicId } });
    return { ...requirement, epicId };
  }

  async assignSpecification(ctx: EpicContext, specificationId: string, epicId: string | null): Promise<AssignableSpecification> {
    const specification = await this.deps.specifications.find(ctx.workspaceId, specificationId);
    if (!specification || specification.projectId !== ctx.projectId) throw new NotFoundError('The specification does not exist.');
    await this.deps.gate.requireOwner(ctx, ctx.projectId, 'assign a specification to an Epic');
    if (epicId !== null) this.requireActive(await this.requireOwn(ctx, epicId), 'assign to');
    await this.deps.specifications.setEpic(ctx.workspaceId, specificationId, epicId);
    await this.audited(ctx, 'update', 'specification', specificationId, { operation: 'specification.assign_epic', projectId: ctx.projectId, before: { epicId: specification.epicId }, after: { epicId } });
    return { ...specification, epicId };
  }

  // ------------------------------------------------------------------- reads

  async list(ctx: EpicContext, filters: EpicFilters = {}): Promise<EpicList> {
    await this.deps.gate.requireMember(ctx.workspaceId, ctx.projectId);
    const [epics, requirements, specifications] = await Promise.all([
      this.deps.store.list(ctx.workspaceId, ctx.projectId, filters),
      this.deps.requirements.listForProject(ctx.workspaceId, ctx.projectId),
      this.deps.specifications.listForProject(ctx.workspaceId, ctx.projectId),
    ]);
    return {
      epics: epics.map((e) => ({
        ...e,
        requirementCount: requirements.filter((r) => r.epicId === e.id).length,
        specificationCount: specifications.filter((s) => s.epicId === e.id).length,
      })),
      unassigned: requirements.filter((r) => r.epicId === null).sort((a, b) => a.reference.localeCompare(b.reference)),
    };
  }

  /** The Epic by id within the workspace — what the `/epics/{eid}` routes resolve a project from. */
  async locate(workspaceId: string, id: string): Promise<EpicRecord> {
    const row = await this.deps.store.find(id);
    if (!row || row.workspaceId !== workspaceId) throw new NotFoundError('The Epic does not exist.');
    await this.deps.gate.requireMember(workspaceId, row.projectId);
    return row;
  }

  async get(ctx: EpicContext, id: string): Promise<EpicDetail> {
    const row = await this.requireOwn(ctx, id);
    await this.deps.gate.requireMember(ctx.workspaceId, ctx.projectId);
    const [requirements, specifications, siblings] = await Promise.all([
      this.deps.requirements.listForProject(ctx.workspaceId, ctx.projectId),
      this.deps.specifications.listForProject(ctx.workspaceId, ctx.projectId),
      this.deps.store.list(ctx.workspaceId, ctx.projectId),
    ]);
    const mine = requirements.filter((r) => r.epicId === row.id).sort((a, b) => a.reference.localeCompare(b.reference));
    const specs = specifications.filter((s) => s.epicId === row.id);
    return {
      ...row,
      requirementCount: mine.length,
      specificationCount: specs.length,
      requirements: mine,
      specifications: specs,
      parent: row.parentEpicId ? (siblings.find((e) => e.id === row.parentEpicId) ?? null) : null,
      children: siblings.filter((e) => e.parentEpicId === row.id),
      decisions: { createdBy: row.decisionCommentId, lastProcessed: row.lastDecisionCommentId },
    };
  }

  // ------------------------------------------------------------ decisions

  /**
   * `R-044-6` — every `decomposition-decision` comment on the project's
   * executions that no Epic references yet is processed once, in one pass,
   * before a list, board or stage read answers. Idempotent by construction.
   */
  async reconcileDecisions(ctx: Pick<EpicContext, 'workspaceId' | 'projectId'> & { userId?: string }): Promise<ReconcileOutcome> {
    const created: EpicRecord[] = [];
    const findings: string[] = [];
    const comments = await this.deps.decisions.decisionsForProject(ctx.workspaceId, ctx.projectId);
    if (comments.length === 0) return { created, findings };
    const epics = await this.deps.store.list(ctx.workspaceId, ctx.projectId);
    const processed = new Set(epics.flatMap((e) => [e.decisionCommentId, e.lastDecisionCommentId]).filter((id): id is string => id !== null));

    for (const comment of comments) {
      if (processed.has(comment.commentId)) continue;
      let body: DecisionBody;
      try {
        const parsed: unknown = JSON.parse(comment.body);
        const result = validateDecompositionDecision(parsed) as { ok: boolean; errors?: string[] };
        if (!result.ok) {
          findings.push(`decision unreadable (${comment.commentId}): ${(result.errors ?? []).join('; ')}`);
          continue;
        }
        body = parsed as DecisionBody;
      } catch (err) {
        findings.push(`decision unreadable (${comment.commentId}): ${(err as Error).message}`);
        continue;
      }
      const parent = await this.deps.store.findByNumber(ctx.projectId, body.epic.number);
      if (!parent) {
        findings.push(`decision ${comment.commentId} names no Epic ${body.epic.number} of this project`);
        continue;
      }
      const at = this.now();
      if (body.decision === 'rejected') {
        await this.deps.store.update(parent.id, { lastDecisionCommentId: comment.commentId, updatedAt: at });
        await this.audited({ ...ctx, userId: ctx.userId ?? body.decidedBy }, 'update', 'epic', parent.id, { operation: 'decomposition.reconcile', projectId: ctx.projectId, decisionCommentId: comment.commentId, decision: 'rejected', children: 0 });
        processed.add(comment.commentId);
        continue;
      }
      const known = new Set((await this.deps.store.list(ctx.workspaceId, ctx.projectId)).map((e) => e.slug));
      const children: EpicRecord[] = [];
      for (const child of [...body.children].sort((a, b) => a.suffix.localeCompare(b.suffix))) {
        let row = await this.deps.store.create({
          id: this.newId(),
          workspaceId: ctx.workspaceId,
          projectId: ctx.projectId,
          slug: child.slug,
          title: `${parent.title} (${child.suffix})`,
          description: `Split from Epic ${parent.number} by ${body.decidedBy} (decomposition policy v${body.policyVersion}); estimate ${child.estimate}.`,
          status: 'active',
          parentEpicId: parent.id,
          splitSuffix: child.suffix,
          decisionCommentId: comment.commentId,
          lastDecisionCommentId: null,
          createdById: body.decidedBy,
          closedAt: null,
        });
        if (known.has(child.slug)) {
          // The recorded slug collides with an existing Epic's: suffix it by the child's number (edge case).
          row = await this.deps.store.update(row.id, { slug: `${child.slug}-${row.number}`, updatedAt: at });
        }
        known.add(row.slug);
        for (const reference of child.requirements) {
          const requirement = await this.deps.requirements.findByReference(ctx.workspaceId, ctx.projectId, reference);
          if (!requirement) {
            findings.push(`decision ${comment.commentId}: ${reference} is not a requirement of this project; child ${row.number} created without it`);
            continue;
          }
          await this.deps.requirements.setEpic(ctx.workspaceId, requirement.id, row.id);
        }
        children.push(row);
        created.push(row);
      }
      await this.deps.store.update(parent.id, { status: 'split', lastDecisionCommentId: comment.commentId, updatedAt: at });
      const actor = { ...ctx, userId: ctx.userId ?? body.decidedBy };
      await this.audited(actor, 'update', 'epic', parent.id, { operation: 'epic.split', projectId: ctx.projectId, decisionCommentId: comment.commentId, children: children.map((c) => c.number) });
      await this.audited(actor, 'create', 'epic', parent.id, { operation: 'decomposition.reconcile', projectId: ctx.projectId, decisionCommentId: comment.commentId, decision: body.decision, children: children.length });
      processed.add(comment.commentId);
    }
    return { created, findings };
  }

  // ----------------------------------------------------------------- helpers

  private async requireOwn(ctx: Pick<EpicContext, 'workspaceId' | 'projectId'>, id: string): Promise<EpicRecord> {
    const row = await this.deps.store.find(id);
    if (!row || row.workspaceId !== ctx.workspaceId || row.projectId !== ctx.projectId) throw new NotFoundError('The Epic does not exist.');
    return row;
  }

  private requireActive(row: EpicRecord, verb: string): void {
    const status: EpicStatus = row.status;
    if (status !== 'active') throw new ConflictError(`Epic ${row.number} is ${status}; only an active Epic can be ${verb === 'close' ? 'closed' : 'assigned to'}.`, { code: 'epic_not_active' });
  }

  private async audited(ctx: Pick<EpicContext, 'workspaceId' | 'userId'>, action: 'create' | 'update', targetType: string, targetId: string, detail: Record<string, unknown>): Promise<void> {
    await this.deps.audit.record({ workspaceId: ctx.workspaceId, actorId: ctx.userId, action, targetType, targetId, outcome: 'success', detail });
  }
}
