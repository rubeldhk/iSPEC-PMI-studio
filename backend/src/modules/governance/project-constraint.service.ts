/**
 * `T1480` (EPIC-042, `FR-EXT-021`, `FR-EXT-063`, `FR-EXT-064`) — owner-authored
 * entries of kind principle, constraint or non-goal: created with an order,
 * versioned on every edit, retired rather than deleted, listed by kind and
 * status, and scoped by workspace and project so a cross-project id is absence.
 */
import { randomUUID } from 'node:crypto';
import { NotFoundError, ValidationFailedError } from '../../core/errors.js';
import {
  type ConstraintFilters,
  type ConstraintKind,
  type ProjectConstraintRecord,
  type ProjectConstraintStore,
} from './project-constraint.store.js';

export interface GovernanceContext {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly userId: string;
}

export interface CreateConstraintInput {
  readonly kind: ConstraintKind;
  readonly title: string;
  readonly body: string;
  readonly order?: number | undefined;
}

export interface EditConstraintInput {
  readonly title?: string | undefined;
  readonly body?: string | undefined;
  readonly order?: number | undefined;
}

export interface ProjectConstraintDeps {
  readonly store: ProjectConstraintStore;
  readonly audit: { record(row: Record<string, unknown>): Promise<void> };
  readonly now?: () => Date;
  readonly newId?: () => string;
}

const KINDS: readonly ConstraintKind[] = ['principle', 'constraint', 'non_goal'];
const TITLE_MAX = 120;
const BODY_MAX = 20_000;

function validate(input: { kind?: unknown; title?: unknown; body?: unknown; order?: unknown }, partial: boolean): void {
  const fields: { field: string; message: string }[] = [];
  if (!partial || input.kind !== undefined) {
    if (typeof input.kind !== 'string' || !(KINDS as readonly string[]).includes(input.kind)) fields.push({ field: 'kind', message: `one of ${KINDS.join(', ')}` });
  }
  if (!partial || input.title !== undefined) {
    if (typeof input.title !== 'string' || input.title.trim().length === 0 || input.title.length > TITLE_MAX) fields.push({ field: 'title', message: `1–${TITLE_MAX} characters` });
  }
  if (!partial || input.body !== undefined) {
    if (typeof input.body !== 'string' || input.body.length > BODY_MAX) fields.push({ field: 'body', message: `at most ${BODY_MAX} characters` });
  }
  if (input.order !== undefined && (typeof input.order !== 'number' || !Number.isInteger(input.order) || input.order < 1)) {
    fields.push({ field: 'order', message: 'a positive integer' });
  }
  if (fields.length > 0) throw new ValidationFailedError('The constraint is not valid.', { fields });
}

export class ProjectConstraintService {
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(private readonly deps: ProjectConstraintDeps) {
    this.now = deps.now ?? ((): Date => new Date());
    this.newId = deps.newId ?? ((): string => randomUUID());
  }

  async create(ctx: GovernanceContext, input: CreateConstraintInput): Promise<ProjectConstraintRecord> {
    validate(input, false);
    const siblings = await this.deps.store.list(ctx.workspaceId, ctx.projectId, { kind: input.kind });
    const order = input.order ?? siblings.reduce((max, r) => Math.max(max, r.order), 0) + 1;
    const at = this.now();
    const row = await this.deps.store.create({
      id: this.newId(),
      workspaceId: ctx.workspaceId,
      projectId: ctx.projectId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      order,
      version: 1,
      status: 'active',
      createdById: ctx.userId,
      createdAt: at,
      updatedAt: at,
    });
    await this.audited(ctx, 'create', 'constraint.create', row);
    return row;
  }

  async edit(ctx: GovernanceContext, id: string, input: EditConstraintInput): Promise<ProjectConstraintRecord> {
    validate(input, true);
    const existing = await this.requireOwn(ctx, id);
    const row = await this.deps.store.update(id, {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
      version: existing.version + 1,
      updatedAt: this.now(),
    });
    await this.audited(ctx, 'update', input.order !== undefined && input.title === undefined && input.body === undefined ? 'constraint.reorder' : 'constraint.update', row);
    return row;
  }

  async retire(ctx: GovernanceContext, id: string): Promise<ProjectConstraintRecord> {
    const existing = await this.requireOwn(ctx, id);
    const row = await this.deps.store.update(id, { status: 'retired', version: existing.version + 1, updatedAt: this.now() });
    await this.audited(ctx, 'update', 'constraint.retire', row);
    return row;
  }

  async list(ctx: Pick<GovernanceContext, 'workspaceId' | 'projectId'>, filters: ConstraintFilters): Promise<ProjectConstraintRecord[]> {
    return this.deps.store.list(ctx.workspaceId, ctx.projectId, filters);
  }

  /** The highest version among the project's entries, retired included — an input of the render. */
  async maxVersion(ctx: Pick<GovernanceContext, 'workspaceId' | 'projectId'>): Promise<number> {
    const rows = await this.deps.store.list(ctx.workspaceId, ctx.projectId, {});
    return rows.reduce((max, r) => Math.max(max, r.version), 0);
  }

  private async requireOwn(ctx: GovernanceContext, id: string): Promise<ProjectConstraintRecord> {
    const row = await this.deps.store.find(id);
    if (!row || row.workspaceId !== ctx.workspaceId || row.projectId !== ctx.projectId) {
      throw new NotFoundError('The constraint does not exist.');
    }
    return row;
  }

  private async audited(ctx: GovernanceContext, action: 'create' | 'update', operation: string, row: ProjectConstraintRecord): Promise<void> {
    await this.deps.audit.record({
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action,
      targetType: 'project_constraint',
      targetId: row.id,
      outcome: 'success',
      detail: { projectId: ctx.projectId, operation, kind: row.kind, version: row.version, status: row.status },
    });
  }
}
