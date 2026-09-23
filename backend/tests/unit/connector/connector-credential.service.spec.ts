/**
 * `T1357` (EPIC-041) — the credential service.
 *
 * Mint registers a `Principal` of kind `connector` with the minting owner as
 * sponsor through `PrincipalRegistryService`'s port; mint without the owner
 * grant is refused and audited; a project that is `not_provisioned` cannot
 * mint; revoke is immediate, audited once, idempotent (`FR-LPW-020`,
 * `FR-LPW-021`, `FR-LPW-023`, `FR-LPW-027`).
 *
 * Written to FAIL before `T1358` exists.
 */
import { describe, expect, it, vi } from 'vitest';
import { AuditService, type AuditWriter } from '../../../src/modules/audit/audit.service.js';
import { ForbiddenError, NotFoundError, ValidationFailedError } from '../../../src/core/errors.js';
import { InMemoryConnectorCredentialStore } from '../../../src/modules/connector/connector-credential.store.js';
import { ConnectorCredentialService } from '../../../src/modules/connector/connector-credential.service.js';
import { InMemoryProjectStore, ProjectsService } from '../../../src/modules/projects/projects.service.js';

const OWNER = { workspaceId: 'ws_a', userId: 'u_owner' };
const MEMBER = { workspaceId: 'ws_a', userId: 'u_member' };

async function harness(over: { provisioningState?: string; grants?: string[] } = {}) {
  const projects = new InMemoryProjectStore();
  const projectsApi = new ProjectsService(projects);
  const project = await projectsApi.create(OWNER, { name: 'Alpha' });
  await projects.update('ws_a', project.id, { provisioningState: over.provisioningState ?? 'provisioned' } as never);
  const audits: Record<string, unknown>[] = [];
  const writer: AuditWriter = { create: async (row) => void audits.push(row) };
  const register = vi.fn(async (input: { workspaceId: string }) => ({ principalId: `pr_${input.workspaceId}` }));
  const credentials = new InMemoryConnectorCredentialStore();
  const service = new ConnectorCredentialService({
    credentials,
    projects: projectsApi,
    principals: { register },
    grants: {
      activeForArtifact: async () =>
        (over.grants ?? []).map((userId) => ({ userId, level: 'edit' as const })),
    },
    audit: new AuditService(writer),
    now: () => new Date('2026-09-04T12:00:00Z'),
  });
  return { service, project, audits, register, credentials };
}

describe('T1357 · mint', () => {
  it('returns the value once, stores only prefix and digest, and registers a connector principal sponsored by the owner', async () => {
    const { service, project, register, credentials, audits } = await harness();
    const minted = await service.mint(OWNER, project.id, { label: 'laptop' });
    expect(minted.value).toMatch(/^pmi_ct_/);
    expect(minted.record).not.toHaveProperty('tokenHash');
    expect(minted.record).not.toHaveProperty('value');
    expect(minted.record.label).toBe('laptop');
    expect(minted.record.projectId).toBe(project.id);
    const [stored] = await credentials.findByPrefix(minted.record.tokenPrefix);
    expect(JSON.stringify(stored)).not.toContain(minted.value);
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws_a', kind: 'connector', sponsorUserId: 'u_owner', registeredByUserId: 'u_owner' }),
    );
    expect(stored?.principalId).toBe('pr_ws_a');
    expect(audits).toEqual([
      expect.objectContaining({ action: 'create', targetType: 'connector_credential', outcome: 'success', actorId: 'u_owner' }),
    ]);
  });

  it('refuses a caller without the owner grant with 403 and audits the refusal naming actor and project (FR-LPW-027)', async () => {
    const { service, project, audits, register } = await harness();
    await expect(service.mint(MEMBER, project.id, { label: 'x' })).rejects.toBeInstanceOf(ForbiddenError);
    expect(register).not.toHaveBeenCalled();
    expect(audits).toEqual([
      expect.objectContaining({ action: 'access_refused', outcome: 'refused', actorId: 'u_member', targetType: 'project', targetId: project.id }),
    ]);
  });

  it('accepts an edit grant on the project as the owner grant (EPIC-024)', async () => {
    const { service, project } = await harness({ grants: ['u_member'] });
    await expect(service.mint(MEMBER, project.id, { label: 'x' })).resolves.toMatchObject({ record: { createdById: 'u_member' } });
  });

  it('refuses to mint for a project that is not provisioned (400)', async () => {
    const { service, project, register } = await harness({ provisioningState: 'not_provisioned' });
    await expect(service.mint(OWNER, project.id, { label: 'x' })).rejects.toBeInstanceOf(ValidationFailedError);
    expect(register).not.toHaveBeenCalled();
  });

  it('requires a label', async () => {
    const { service, project } = await harness();
    await expect(service.mint(OWNER, project.id, { label: '' })).rejects.toBeInstanceOf(ValidationFailedError);
  });

  it('is an opaque 404 for a project of another workspace', async () => {
    const { service, project } = await harness();
    await expect(service.mint({ workspaceId: 'ws_other', userId: 'u_owner' }, project.id, { label: 'x' })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('T1357 · list', () => {
  it('never includes tokenHash, and filters', async () => {
    const { service, project } = await harness();
    await service.mint(OWNER, project.id, { label: 'laptop' });
    const second = await service.mint(OWNER, project.id, { label: 'ci' });
    await service.revoke(OWNER, second.record.id);
    const all = await service.list('ws_a', project.id);
    expect(all).toHaveLength(2);
    for (const r of all) expect(r).not.toHaveProperty('tokenHash');
    expect((await service.list('ws_a', project.id, { revoked: true })).map((r) => r.label)).toEqual(['ci']);
    expect((await service.list('ws_a', project.id, { label: 'laptop' })).map((r) => r.label)).toEqual(['laptop']);
  });
});

describe('T1357 · revoke', () => {
  it('is immediate, audited once, and idempotent', async () => {
    const { service, project, audits, credentials } = await harness();
    const minted = await service.mint(OWNER, project.id, { label: 'laptop' });
    const first = await service.revoke(OWNER, minted.record.id);
    expect(first.changed).toBe(true);
    expect(first.record.revokedAt).toEqual(new Date('2026-09-04T12:00:00Z'));
    expect(first.record.revokedById).toBe('u_owner');
    const [stored] = await credentials.findByPrefix(minted.record.tokenPrefix);
    expect(stored?.revokedAt).not.toBeNull();
    const second = await service.revoke(OWNER, minted.record.id);
    expect(second.changed).toBe(false);
    expect(audits.filter((a) => (a['detail'] as { kind?: string } | undefined)?.kind === 'revoke')).toHaveLength(1);
  });

  it('refuses a caller without the owner grant, audited', async () => {
    const { service, project, audits } = await harness();
    const minted = await service.mint(OWNER, project.id, { label: 'laptop' });
    await expect(service.revoke(MEMBER, minted.record.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(audits.at(-1)).toMatchObject({ action: 'access_refused', actorId: 'u_member' });
  });

  it('is an opaque 404 for an unknown or other-workspace credential', async () => {
    const { service } = await harness();
    await expect(service.revoke(OWNER, 'nope')).rejects.toBeInstanceOf(NotFoundError);
  });
});
