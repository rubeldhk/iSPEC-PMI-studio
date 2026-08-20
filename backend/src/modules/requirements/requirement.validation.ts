/**
 * T065 — requirement validation rules (FR-005, FR-007).
 *
 * A refusal NAMES what is missing or invalid — "requirement cannot be saved"
 * with no field named is the generic error the contract calls a defect.
 *
 * Framework-free (PC-1). The database backs the description rule with a CHECK
 * constraint; this is the layer that turns it into a helpful message.
 */
import { ValidationFailedError } from '../../core/errors.js';

export const REQUIREMENT_TYPES = ['business', 'functional', 'non_functional', 'constraint'] as const;
export const REQUIREMENT_PRIORITIES = ['p1', 'p2', 'p3'] as const;
export const REQUIREMENT_STATUSES = ['active', 'retired'] as const;

export type RequirementType = (typeof REQUIREMENT_TYPES)[number];
export type RequirementPriority = (typeof REQUIREMENT_PRIORITIES)[number];
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export interface FieldError {
  field: string;
  reason: string;
}

export interface CreateRequirementInput {
  reference?: string;
  description?: string;
  type?: string;
  priority?: string;
}

export interface EditRequirementInput {
  description?: string;
  type?: string;
  priority?: string;
}

function memberError(field: string, permitted: readonly string[]): FieldError {
  return { field, reason: `must be one of: ${permitted.join(', ')}` };
}

function refuse(fields: FieldError[]): never {
  throw new ValidationFailedError('Requirement cannot be saved.', { fields });
}

/** Every rule is checked; ALL failures are named in one refusal, not the first. */
export function validateCreate(input: CreateRequirementInput): asserts input is {
  reference?: string;
  description: string;
  type: RequirementType;
  priority: RequirementPriority;
} {
  const fields: FieldError[] = [];
  if (!input.description || input.description.trim() === '') {
    fields.push({ field: 'description', reason: 'required' });
  }
  if (!input.type || !(REQUIREMENT_TYPES as readonly string[]).includes(input.type)) {
    fields.push(memberError('type', REQUIREMENT_TYPES));
  }
  if (!input.priority || !(REQUIREMENT_PRIORITIES as readonly string[]).includes(input.priority)) {
    fields.push(memberError('priority', REQUIREMENT_PRIORITIES));
  }
  if (input.reference !== undefined && input.reference.trim() === '') {
    fields.push({ field: 'reference', reason: 'cannot be empty when supplied' });
  }
  if (fields.length > 0) refuse(fields);
}

/** Only supplied fields are checked — but a supplied field must be valid. */
export function validateEdit(input: EditRequirementInput): void {
  const fields: FieldError[] = [];
  if (input.description !== undefined && input.description.trim() === '') {
    fields.push({ field: 'description', reason: 'required' });
  }
  if (input.type !== undefined && !(REQUIREMENT_TYPES as readonly string[]).includes(input.type)) {
    fields.push(memberError('type', REQUIREMENT_TYPES));
  }
  if (
    input.priority !== undefined &&
    !(REQUIREMENT_PRIORITIES as readonly string[]).includes(input.priority)
  ) {
    fields.push(memberError('priority', REQUIREMENT_PRIORITIES));
  }
  if (fields.length > 0) refuse(fields);
}

export interface ListFilters {
  type?: string;
  priority?: string;
  status?: string;
  sortBy?: string;
  sortDir?: string;
}

const SORTABLE = ['type', 'priority', 'status', 'createdAt', 'reference'] as const;

export interface ValidatedListQuery {
  type?: RequirementType;
  priority?: RequirementPriority;
  status?: RequirementStatus;
  sortBy: (typeof SORTABLE)[number];
  sortDir: 'asc' | 'desc';
}

/** FR-008 — filter values are validated like any other input, fields named. */
export function validateListFilters(filters: ListFilters): ValidatedListQuery {
  const fields: FieldError[] = [];
  if (filters.type !== undefined && !(REQUIREMENT_TYPES as readonly string[]).includes(filters.type)) {
    fields.push(memberError('type', REQUIREMENT_TYPES));
  }
  if (
    filters.priority !== undefined &&
    !(REQUIREMENT_PRIORITIES as readonly string[]).includes(filters.priority)
  ) {
    fields.push(memberError('priority', REQUIREMENT_PRIORITIES));
  }
  if (
    filters.status !== undefined &&
    !(REQUIREMENT_STATUSES as readonly string[]).includes(filters.status)
  ) {
    fields.push(memberError('status', REQUIREMENT_STATUSES));
  }
  if (filters.sortBy !== undefined && !(SORTABLE as readonly string[]).includes(filters.sortBy)) {
    fields.push(memberError('sortBy', SORTABLE));
  }
  if (filters.sortDir !== undefined && !['asc', 'desc'].includes(filters.sortDir)) {
    fields.push(memberError('sortDir', ['asc', 'desc']));
  }
  if (fields.length > 0) refuse(fields);

  return {
    ...(filters.type !== undefined ? { type: filters.type as RequirementType } : {}),
    ...(filters.priority !== undefined ? { priority: filters.priority as RequirementPriority } : {}),
    ...(filters.status !== undefined ? { status: filters.status as RequirementStatus } : {}),
    sortBy: (filters.sortBy as ValidatedListQuery['sortBy']) ?? 'createdAt',
    sortDir: (filters.sortDir as 'asc' | 'desc') ?? 'asc',
  };
}
