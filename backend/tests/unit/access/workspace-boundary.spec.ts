/**
 * T1126 (EPIC-024, C2E) — the workspace boundary.
 *
 * `X19` had two halves. The obvious one was that an artifact with no grants was
 * open to everybody. The subtler one is here: `workspaceId` arrived from the
 * caller and nothing ever checked it, so the grant lookup was scoped by
 * whatever the request said. Naming another tenant's workspace was a *valid
 * query*.
 *
 * These assert the boundary alone, with no grants involved, so a regression
 * cannot be masked by an artifact happening to be restricted.
 */
import { describe, expect, it } from 'vitest';
import {
  ActorDirectoryUnavailable,
  UnconfiguredActorDirectory,
  WorkspaceBoundaryService,
  WorkspaceBoundaryViolation,
  type ActorDirectory,
} from '../../../src/modules/access/workspace-boundary.service.js';
import { FixtureActorDirectory } from '../../support/ownership.js';

const WS = 'ws_a';
const OTHER = 'ws_b';

function boundary(): WorkspaceBoundaryService {
  return new WorkspaceBoundaryService(
    new FixtureActorDirectory([
      { id: 'u_alice', workspaceId: WS },
      { id: 'u_bob', workspaceId: OTHER },
    ]),
  );
}

describe('T1126 · an actor inside the workspace passes', () => {
  it('returns the AUTHORITATIVE record, not what the caller supplied', async () => {
    // The returned record is the point: a caller that lies about its workspace
    // gets refused, and a caller that does not still has its claim replaced by
    // the stored one, so nothing downstream reads the request's version.
    const actor = await boundary().requireWithinWorkspace(WS, 'u_alice');
    expect(actor).toEqual({ id: 'u_alice', workspaceId: WS });
  });
});

describe('T1126 · everything else is refused', () => {
  it('refuses an actor belonging to another workspace', async () => {
    await expect(boundary().requireWithinWorkspace(WS, 'u_bob')).rejects.toThrow(
      WorkspaceBoundaryViolation,
    );
  });

  it('refuses an actor that does not exist at all', async () => {
    await expect(boundary().requireWithinWorkspace(WS, 'u_ghost')).rejects.toThrow(
      WorkspaceBoundaryViolation,
    );
  });

  it('naming another workspace does not grant access to it', async () => {
    // BOB really is in OTHER, so this succeeds — and that is the control. What
    // must not happen is ALICE reaching OTHER by asking for it.
    await expect(boundary().requireWithinWorkspace(OTHER, 'u_bob')).resolves.toBeTruthy();
    await expect(boundary().requireWithinWorkspace(OTHER, 'u_alice')).rejects.toThrow(
      WorkspaceBoundaryViolation,
    );
  });

  it.each([
    ['empty actor', WS, ''],
    ['blank actor', WS, '   '],
    ['empty workspace', '', 'u_alice'],
  ])('refuses malformed input: %s', async (_label, workspace, actor) => {
    // An empty actor id must never reach a grant lookup, where it could match
    // an empty column and read as a grant.
    await expect(boundary().requireWithinWorkspace(workspace, actor)).rejects.toThrow(
      WorkspaceBoundaryViolation,
    );
  });

  it('refuses everyone when no authoritative directory is composed', async () => {
    const unconfigured = new WorkspaceBoundaryService(new UnconfiguredActorDirectory());
    await expect(unconfigured.requireWithinWorkspace(WS, 'u_alice')).rejects.toThrow(
      WorkspaceBoundaryViolation,
    );
  });
});

describe('T1126 · an unreadable directory is not a decision about the actor', () => {
  it('fails closed, and distinguishably', async () => {
    // Both refuse. But an operator told "this actor is not in your workspace"
    // when the identity database is down will look in entirely the wrong
    // place, so the operational failure keeps its own type.
    const broken: ActorDirectory = {
      find: async () => {
        throw new Error('connection reset');
      },
    };
    const svc = new WorkspaceBoundaryService(broken);
    await expect(svc.requireWithinWorkspace(WS, 'u_alice')).rejects.toThrow(
      ActorDirectoryUnavailable,
    );
  });

  it('carries the cause, so the reason is diagnosable', async () => {
    const broken: ActorDirectory = {
      find: async () => {
        throw Object.assign(new Error('connection reset'), { name: 'PrismaClientKnownRequestError' });
      },
    };
    const failure = await new WorkspaceBoundaryService(broken)
      .requireWithinWorkspace(WS, 'u_alice')
      .catch((e: unknown) => e as Error);
    expect((failure as Error).message).toMatch(/PrismaClientKnownRequestError: connection reset/);
  });

  it('never resolves on a fault — a broken directory cannot vouch for anyone', async () => {
    for (const thrown of [new Error('x'), 'not-an-error', null]) {
      const svc = new WorkspaceBoundaryService({
        find: async () => {
          throw thrown;
        },
      });
      await expect(svc.requireWithinWorkspace(WS, 'u_alice')).rejects.toThrow();
    }
  });
});
