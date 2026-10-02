/**
 * `T1410` (EPIC-043, `R-043-3`) — a credential completes the registry's identity
 * at mint: a snapshot of its principal, a connector registration per workspace
 * per surface kind, and the four delegable actions on the project. Revoking
 * revokes the delegations. A credential minted before this Epic is completed
 * lazily, once, by the same path.
 *
 * Written to FAIL before `T1411`.
 */
import { describe, expect, it, vi } from 'vitest';
import { AuditService, type AuditWriter } from '../../../src/modules/audit/audit.service.js';
import { InMemoryConnectorCredentialStore } from '../../../src/modules/connector/connector-credential.store.js';
import { ConnectorCredentialService, type ConnectorIdentityPort } from '../../../src/modules/connector/connector-credential.service.js';
import { InMemoryProjectStore, ProjectsService } from '../../../src/modules/projects/projects.service.js';

const OWNER = { workspaceId: 'ws_a', userId: 'u_owner' };

function identityPort() {
  const registrations = new Map<string, string>();
  let snapshots = 0;
  const delegations: Record<string, unknown>[] = [];
  const revoked: Record<string, unknown>[] = [];
  const attached: Record<string, unknown>[] = [];
  const port: ConnectorIdentityPort = {
    captureSnapshot: vi.fn(async (_workspaceId: string, principalId: string) => ({ snapshotId: `snap_${principalId}_${(snapshots += 1)}`, identityVersion: 1 })),
    ensureRegistration: vi.fn(async (workspaceId: string, kind: string, _by: string) => {
      const key = `${workspaceId}:${kind}`;
      if (!registrations.has(key)) registrations.set(key, `reg_${kind}`);
      return { registrationId: registrations.get(key) as string };
    }),
    attachRegistration: vi.fn(async (input: Record<string, unknown>) => void attached.push(input)),
    delegate: vi.fn(async (input: Record<string, unknown>) => {
      delegations.push(input);
      return { id: `del_${delegations.length}` };
    }),
    revokeDelegations: vi.fn(async (input: Record<string, unknown>) => {
      revoked.push(input);
      return delegations.length;
    }),
  };
  return { port, delegations, revoked, attached, registrations };
}

async function harness() {
  const projects = new InMemoryProjectStore();
  const projectsApi = new ProjectsService(projects);
  const project = await projectsApi.create(OWNER, { name: 'Alpha' });
  await projects.update('ws_a', project.id, { provisioningState: 'provisioned' } as never);
  const writer: AuditWriter = { create: async () => undefined };
  const credentials = new InMemoryConnectorCredentialStore();
  const id = identityPort();
  const service = new ConnectorCredentialService({
    credentials,
    projects: projectsApi,
    principals: { register: async () => ({ principalId: 'pr_1' }) },
    grants: { activeForArtifact: async () => [] },
    audit: new AuditService(writer),
    identity: id.port,
    now: () => new Date('2026-09-04T12:00:00Z'),
  });
  return { service, project, credentials, ...id };
}

describe('T1410 · identity at mint (R-043-3)', () => {
  it('captures a snapshot and stores its id on the credential', async () => {
    const { service, project, credentials, port } = await harness();
    const minted = await service.mint(OWNER, project.id, { label: 'laptop' });
    expect(port.captureSnapshot).toHaveBeenCalledWith('ws_a', 'pr_1');
    const stored = await credentials.find('ws_a', minted.record.id);
    expect(stored?.snapshotId).toBe('snap_pr_1_1');
  });

  it('ensures the two connector registrations once per workspace and attaches the mcp-client one to the principal', async () => {
    const { service, project, port, attached, registrations } = await harness();
    await service.mint(OWNER, project.id, { label: 'one' });
    await service.mint(OWNER, project.id, { label: 'two' });
    expect(port.ensureRegistration).toHaveBeenCalledWith('ws_a', 'mcp-client', 'u_owner');
    expect(port.ensureRegistration).toHaveBeenCalledWith('ws_a', 'local-cli', 'u_owner');
    expect(registrations.size).toBe(2);
    expect(attached[0]).toMatchObject({ workspaceId: 'ws_a', principalId: 'pr_1', registrationId: 'reg_mcp-client' });
  });

  it('delegates the four delegable actions from the sponsor to the principal on the project', async () => {
    const { service, project, delegations } = await harness();
    await service.mint(OWNER, project.id, { label: 'laptop' });
    expect(delegations).toHaveLength(1);
    expect(delegations[0]).toMatchObject({
      workspaceId: 'ws_a',
      principalId: 'pr_1',
      sponsorUserId: 'u_owner',
      artifact: { artifactType: 'project', artifactId: project.id },
      identityVersion: 1,
    });
    expect([...((delegations[0] as { actions: string[] }).actions)].sort()).toEqual(
      ['execution.attach-evidence', 'execution.register', 'execution.report', 'transition.propose'],
    );
  });

  it('revoking the credential revokes its delegations on the project', async () => {
    const { service, project, revoked } = await harness();
    const minted = await service.mint(OWNER, project.id, { label: 'laptop' });
    await service.revoke(OWNER, minted.record.id);
    expect(revoked[0]).toMatchObject({ workspaceId: 'ws_a', principalId: 'pr_1', artifact: { artifactType: 'project', artifactId: project.id } });
  });

  it('completes a credential minted before this Epic lazily, once', async () => {
    const { service, project, credentials, port, delegations } = await harness();
    const minted = await service.mint(OWNER, project.id, { label: 'old' });
    // Simulate a pre-EPIC-043 row: no snapshot recorded.
    await credentials.setSnapshot(minted.record.id, null);
    const callsBefore = (port.captureSnapshot as ReturnType<typeof vi.fn>).mock.calls.length;
    const first = await service.completeIdentity('ws_a', minted.record.id);
    const second = await service.completeIdentity('ws_a', minted.record.id);
    expect(first.snapshotId).toMatch(/^snap_pr_1_/);
    expect(second.snapshotId).toBe(first.snapshotId);
    expect((port.captureSnapshot as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBefore + 1);
    // Delegations are re-asserted at most once more; never duplicated per call.
    expect(delegations.length).toBeLessThanOrEqual(2);
  });
});
