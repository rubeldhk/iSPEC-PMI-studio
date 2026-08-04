/**
 * T017 — API error shape and code mapping.
 * Written to FAIL before T018 exists (Constitution V).
 *
 * Contract: specs/_shared/contracts/platform-api.md
 *   { error: { code, message, details } }
 */
import { describe, expect, it } from 'vitest';
import {
  ConflictError,
  InvalidLifecycleTransitionError,
  NotFoundError,
  PlatformError,
  UnauthenticatedError,
  ValidationFailedError,
  toErrorBody,
  toHttpStatus,
} from '../../../src/core/errors.js';

describe('error shape', () => {
  it('serialises to { error: { code, message } }', () => {
    const body = toErrorBody(new NotFoundError('Project not found.'));
    expect(body).toEqual({ error: { code: 'not_found', message: 'Project not found.' } });
  });

  it('includes details only when present', () => {
    const withDetails = toErrorBody(
      new ValidationFailedError('Requirement cannot be saved.', {
        fields: [{ field: 'description', reason: 'required' }],
      }),
    );
    expect(withDetails.error.details).toEqual({
      fields: [{ field: 'description', reason: 'required' }],
    });
    expect(toErrorBody(new NotFoundError('x')).error).not.toHaveProperty('details');
  });

  it('names the missing field on a validation failure (FR-007)', () => {
    const body = toErrorBody(
      new ValidationFailedError('Requirement cannot be saved.', {
        fields: [{ field: 'description', reason: 'required' }],
      }),
    );
    const fields = (body.error.details as { fields: { field: string }[] }).fields;
    expect(fields.map((f) => f.field)).toContain('description');
  });

  it('names the permitted set on an invalid lifecycle transition (FR-011)', () => {
    const body = toErrorBody(
      new InvalidLifecycleTransitionError('approved', 'draft', ['baselined', 'archived']),
    );
    expect(body.error.code).toBe('invalid_lifecycle_transition');
    expect(body.error.details).toEqual({
      from: 'approved',
      to: 'draft',
      permitted: ['baselined', 'archived'],
    });
  });
});

describe('status mapping', () => {
  it.each([
    [new ValidationFailedError('x'), 400],
    [new UnauthenticatedError('x'), 401],
    [new NotFoundError('x'), 404],
    [new ConflictError('x'), 409],
    [new InvalidLifecycleTransitionError('a', 'b', []), 422],
  ])('maps %s to %i', (err, status) => {
    expect(toHttpStatus(err as PlatformError)).toBe(status);
  });

  it('returns 404 — never 403 — so existence is not disclosed (FR-002, SC-004)', () => {
    // A resource in another workspace must be indistinguishable from one that
    // does not exist. There is deliberately no ForbiddenError in the taxonomy.
    expect(toHttpStatus(new NotFoundError('x'))).toBe(404);
    const codes = [
      new ValidationFailedError('x'),
      new UnauthenticatedError('x'),
      new NotFoundError('x'),
      new ConflictError('x'),
    ].map((e) => e.code);
    expect(codes).not.toContain('forbidden');
  });
});

describe('unknown errors', () => {
  it('never leaks an internal message to the caller', () => {
    const body = toErrorBody(new Error('connection string: postgres://user:hunter2@db'));
    expect(body.error.code).toBe('internal_error');
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });
});
