/**
 * `T1482` (EPIC-042, `FR-EXT-040`, `FR-EXT-051`, `D-4`, `BR-0202`) — one policy
 * per project: one specification per Epic, a task ceiling, whether a split
 * needs a person, and the offline mode — strict unless an owner says otherwise.
 * Created with the defaults on first read; versioned on every change.
 */
import { randomUUID } from 'node:crypto';
import { ValidationFailedError } from '../../core/errors.js';
import type { DecompositionPolicyRecord, DecompositionPolicyStore, PolicyValues } from './decomposition-policy.store.js';

export interface PolicyContext {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly userId?: string | undefined;
}

export interface DecompositionPolicyDeps {
  readonly store: DecompositionPolicyStore;
  readonly audit: { record(row: Record<string, unknown>): Promise<void> };
  readonly now?: () => Date;
  readonly newId?: () => string;
}

export const POLICY_DEFAULTS: PolicyValues = Object.freeze({ oneSpecPerEpic: true, taskCeiling: 50, splitRequiresConfirmation: true, offlineMode: 'strict' });
const CEILING_MIN = 1;
const CEILING_MAX = 500;
const OFFLINE_MODES = ['strict', 'provisional'] as const;

function validate(input: Record<string, unknown>): PolicyValues {
  const fields: { field: string; message: string }[] = [];
  if (typeof input['oneSpecPerEpic'] !== 'boolean') fields.push({ field: 'oneSpecPerEpic', message: 'true or false' });
  const ceiling = input['taskCeiling'];
  if (typeof ceiling !== 'number' || !Number.isInteger(ceiling) || ceiling < CEILING_MIN || ceiling > CEILING_MAX) fields.push({ field: 'taskCeiling', message: `an integer from ${CEILING_MIN} to ${CEILING_MAX}` });
  if (typeof input['splitRequiresConfirmation'] !== 'boolean') fields.push({ field: 'splitRequiresConfirmation', message: 'true or false' });
  if (!(OFFLINE_MODES as readonly unknown[]).includes(input['offlineMode'])) fields.push({ field: 'offlineMode', message: `one of ${OFFLINE_MODES.join(', ')}` });
  if (fields.length > 0) throw new ValidationFailedError('The policy is not valid.', { fields });
  return {
    oneSpecPerEpic: input['oneSpecPerEpic'] as boolean,
    taskCeiling: ceiling as number,
    splitRequiresConfirmation: input['splitRequiresConfirmation'] as boolean,
    offlineMode: input['offlineMode'] as PolicyValues['offlineMode'],
  };
}

export class DecompositionPolicyService {
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(private readonly deps: DecompositionPolicyDeps) {
    this.now = deps.now ?? ((): Date => new Date());
    this.newId = deps.newId ?? ((): string => randomUUID());
  }

  /** The project's policy, created with the defaults on first read (`D-4`). */
  async get(ctx: PolicyContext): Promise<DecompositionPolicyRecord> {
    const existing = await this.deps.store.findByProject(ctx.projectId);
    if (existing) return existing;
    const at = this.now();
    return this.deps.store.create({
      id: this.newId(),
      workspaceId: ctx.workspaceId,
      projectId: ctx.projectId,
      ...POLICY_DEFAULTS,
      version: 1,
      updatedById: null,
      createdAt: at,
      updatedAt: at,
    });
  }

  async put(ctx: PolicyContext & { userId: string }, input: Record<string, unknown>): Promise<DecompositionPolicyRecord> {
    const values = validate(input);
    const current = await this.get(ctx);
    const row = await this.deps.store.update(ctx.projectId, { ...values, version: current.version + 1, updatedById: ctx.userId, updatedAt: this.now() });
    await this.deps.audit.record({
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: 'update',
      targetType: 'decomposition_policy',
      targetId: row.id,
      outcome: 'success',
      detail: { projectId: ctx.projectId, operation: 'policy.update', version: row.version, ...values },
    });
    return row;
  }
}
