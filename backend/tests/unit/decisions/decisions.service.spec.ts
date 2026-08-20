/**
 * T144a — the ADR service: creation, status change proposed → accepted →
 * superseded, a superseded record staying readable, and linking/unlinking
 * affected specifications. Written to FAIL before T143a exists (Constitution V).
 */
import { describe, expect, it } from 'vitest';
import {
  DecisionsService,
  InMemoryAdrStore,
  InMemoryAdrSpecificationLinkStore,
} from '../../../src/modules/decisions/decisions.service.js';
import { ConflictError, NotFoundError, ValidationFailedError } from '../../../src/core/errors.js';

const CTX = { workspaceId: 'ws_a', userId: 'u1' };

const VALID = {
  title: 'Adopt PostgreSQL',
  context: 'We need a relational store.',
  decision: 'PostgreSQL 16 with Prisma.',
  consequences: 'Migrations are first-class; ops needs a Postgres runbook.',
} as const;

function build(): { svc: DecisionsService; links: InMemoryAdrSpecificationLinkStore } {
  const links = new InMemoryAdrSpecificationLinkStore();
  return { svc: new DecisionsService(new InMemoryAdrStore(), links), links };
}

describe('DecisionsService · create (FR-034)', () => {
  it('creates a proposed ADR with a generated per-project reference', async () => {
    const { svc } = build();
    const adr = await svc.create(CTX, 'p1', VALID);
    expect(adr.reference).toMatch(/^ADR-\d{4}$/);
    expect(adr.status).toBe('proposed');
    expect(adr.workspaceId).toBe('ws_a');
    expect(adr.projectId).toBe('p1');
  });

  it('refuses a record missing context, decision, or consequences — ALL named', async () => {
    const { svc } = build();
    const err = await svc.create(CTX, 'p1', { title: 'T' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationFailedError);
    const fields = ((err as ValidationFailedError).details as { fields: { field: string }[] }).fields.map(
      (f) => f.field,
    );
    expect(fields).toContain('context');
    expect(fields).toContain('decision');
    expect(fields).toContain('consequences');
  });

  it('two projects may each hold ADR-0001; one project may not hold it twice', async () => {
    const { svc } = build();
    const first = await svc.create(CTX, 'p1', VALID);
    const other = await svc.create(CTX, 'p2', VALID);
    expect(first.reference).toBe('ADR-0001');
    expect(other.reference).toBe('ADR-0001');
    await expect(
      svc.create(CTX, 'p1', { ...VALID, reference: 'ADR-0001' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('DecisionsService · status (a three-value enum, not a lifecycle)', () => {
  it('moves proposed → accepted → superseded', async () => {
    const { svc } = build();
    const adr = await svc.create(CTX, 'p1', VALID);
    const accepted = await svc.update('ws_a', adr.id, { status: 'accepted' });
    expect(accepted.status).toBe('accepted');
    const superseded = await svc.update('ws_a', adr.id, { status: 'superseded' });
    expect(superseded.status).toBe('superseded');
  });

  it('a superseded record stays READABLE — status, never deletion (FR-006 family)', async () => {
    const { svc } = build();
    const adr = await svc.create(CTX, 'p1', VALID);
    await svc.update('ws_a', adr.id, { status: 'superseded' });
    const read = await svc.get('ws_a', adr.id);
    expect(read.status).toBe('superseded');
    expect(read.decision).toBe(VALID.decision);
  });

  it('refuses an unknown status, naming the field', async () => {
    const { svc } = build();
    const adr = await svc.create(CTX, 'p1', VALID);
    const err = await svc.update('ws_a', adr.id, { status: 'rejected' as never }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationFailedError);
  });
});

describe('DecisionsService · specification links (FR-034)', () => {
  it('links an ADR to the specifications it affects', async () => {
    const { svc, links } = build();
    const adr = await svc.create(CTX, 'p1', VALID);
    await svc.linkSpecifications('ws_a', adr.id, ['s1', 's2']);
    expect((await links.linkedSpecificationIds(adr.id)).sort()).toEqual(['s1', 's2']);
  });

  it('linking again is additive and idempotent — no duplicates', async () => {
    const { svc, links } = build();
    const adr = await svc.create(CTX, 'p1', VALID);
    await svc.linkSpecifications('ws_a', adr.id, ['s1']);
    await svc.linkSpecifications('ws_a', adr.id, ['s1', 's2']);
    expect((await links.linkedSpecificationIds(adr.id)).sort()).toEqual(['s1', 's2']);
  });

  it('unlinks without touching the specification or the ADR', async () => {
    const { svc, links } = build();
    const adr = await svc.create(CTX, 'p1', VALID);
    await svc.linkSpecifications('ws_a', adr.id, ['s1', 's2']);
    await svc.unlinkSpecifications('ws_a', adr.id, ['s1']);
    expect(await links.linkedSpecificationIds(adr.id)).toEqual(['s2']);
    await expect(svc.get('ws_a', adr.id)).resolves.toBeDefined();
  });
});

describe('DecisionsService · tenancy (FR-002)', () => {
  it('cross-workspace access is indistinguishable from absence', async () => {
    const { svc } = build();
    const adr = await svc.create(CTX, 'p1', VALID);
    await expect(svc.get('ws_b', adr.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(svc.update('ws_b', adr.id, { title: 'x' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lists are project-scoped within the workspace (FR-003)', async () => {
    const { svc } = build();
    await svc.create(CTX, 'p1', VALID);
    await svc.create(CTX, 'p2', { ...VALID, title: 'Other' });
    const listed = await svc.list('ws_a', 'p1');
    expect(listed).toHaveLength(1);
    expect(listed[0]?.title).toBe('Adopt PostgreSQL');
  });
});
