/**
 * T059 — requirement validation: an empty description is refused, naming the field.
 * Written to FAIL before T064/T065/T066 exist (Constitution V).
 *
 * FR-007: refused, not silently saved as a draft. FR-005: every requirement
 * carries a unique identifier, description, type, and priority.
 */
import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, ValidationFailedError } from '../../../src/core/errors.js';
import { buildService } from './helpers.js';

const CTX = { workspaceId: 'ws_a', userId: 'u1' };
const PROJECT = 'p1';

const VALID = { description: 'The system shall sign users in.', type: 'functional', priority: 'p1' } as const;

describe('RequirementsService · create validation (FR-007)', () => {
  it('creates a requirement with identifier, description, type, priority (FR-005)', async () => {
    const { svc } = buildService();
    const req = await svc.create(CTX, PROJECT, VALID);
    expect(req.reference).toMatch(/^REQ-\d{3,}$/);
    expect(req.description).toBe(VALID.description);
    expect(req.type).toBe('functional');
    expect(req.priority).toBe('p1');
    expect(req.status).toBe('active');
    expect(req.workspaceId).toBe('ws_a');
    expect(req.projectId).toBe(PROJECT);
    expect(req.contentHash).toBeTruthy();
  });

  it.each(['', '   ', undefined])(
    'refuses description %j, NAMING the field',
    async (description) => {
      const { svc } = buildService();
      const err = await svc
        .create(CTX, PROJECT, { ...VALID, description: description as string })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ValidationFailedError);
      const details = (err as ValidationFailedError).details as {
        fields: { field: string; reason: string }[];
      };
      expect(details.fields.some((f) => f.field === 'description')).toBe(true);
    },
  );

  it('refuses an unknown type and an unknown priority, naming each field', async () => {
    const { svc } = buildService();
    const err = await svc
      .create(CTX, PROJECT, { description: 'd', type: 'wish', priority: 'p9' } as never)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationFailedError);
    const fields = ((err as ValidationFailedError).details as { fields: { field: string }[] }).fields.map(
      (f) => f.field,
    );
    expect(fields).toContain('type');
    expect(fields).toContain('priority');
  });

  it('generates references unique within the project, and refuses a duplicate explicit one', async () => {
    const { svc } = buildService();
    const a = await svc.create(CTX, PROJECT, VALID);
    const b = await svc.create(CTX, PROJECT, { ...VALID, description: 'Another.' });
    expect(a.reference).not.toBe(b.reference);
    await expect(
      svc.create(CTX, PROJECT, { ...VALID, reference: a.reference }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('RequirementsService · edit validation', () => {
  it('refuses emptying the description on edit, naming the field', async () => {
    const { svc } = buildService();
    const req = await svc.create(CTX, PROJECT, VALID);
    const err = await svc.edit(CTX, req.id, { description: '  ' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationFailedError);
    const details = (err as ValidationFailedError).details as { fields: { field: string }[] };
    expect(details.fields[0]?.field).toBe('description');
  });

  it('a requirement in another workspace is indistinguishable from absence (FR-002)', async () => {
    const { svc } = buildService();
    const req = await svc.create(CTX, PROJECT, VALID);
    await expect(
      svc.edit({ workspaceId: 'ws_b', userId: 'u9' }, req.id, { description: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(svc.get('ws_b', req.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('editing a retired requirement is refused as a conflict (FR-006)', async () => {
    const { svc, store } = buildService();
    const req = await svc.create(CTX, PROJECT, VALID);
    await store.update('ws_a', req.id, { status: 'retired', retiredAt: new Date() });
    await expect(svc.edit(CTX, req.id, { description: 'x' })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});
