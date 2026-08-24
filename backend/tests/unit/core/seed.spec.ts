/**
 * T149a — the development seed is idempotent and creates exactly one workspace
 * and one user with a hashed password. `EPIC-014` F-11.1.
 *
 * **Why this exists at all**: `specs/_shared/quickstart.md`'s Setup block runs
 * `pnpm --filter backend seed`, and until now there was no seed and no script.
 * A fresh database has no workspace and no user, so **sign-in is impossible** —
 * which is the first step of every validation scenario and of any UAT. The
 * `EPIC-029` UAT run had to hand-assemble this.
 *
 * **Idempotent is the property that matters.** A seed run twice on a developer
 * machine is not an edge case, it is Tuesday: `migrate dev` re-runs it, and
 * people re-run it when something looks wrong. A seed that appends creates a
 * second workspace, and every workspace-scoped query then silently reads the
 * wrong one — a tenancy bug produced by a convenience script.
 *
 * **Hashed, and asserted against the real hasher.** The seeded user must be
 * signable-in through `EPIC-005`'s real verify path, so the digest is produced
 * by `Argon2PasswordService` and verified with it here. Asserting "not equal to
 * the plaintext" would pass for base64.
 *
 * A unit test, so it drives `seed()` against in-memory delegates rather than a
 * database — the `PrismaRequirementVersionStore` delegate pattern (`T651`).
 */
import { describe, expect, it } from 'vitest';
import { Argon2PasswordService } from '../../../src/modules/auth/password.service.js';
import { seed, type SeedDeps } from '../../../prisma/seed.js';

/** An upsert-by-unique-key table. Two runs must leave one row. */
function table(): { rows: Map<string, Record<string, unknown>>; delegate: SeedDeps['workspace'] } {
  const rows = new Map<string, Record<string, unknown>>();
  const delegate = {
    async upsert(args: {
      where: Record<string, unknown>;
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<{ id: string }> {
      const key = JSON.stringify(args.where);
      const existing = rows.get(key);
      const next = existing ? { ...existing, ...args.update } : { ...args.create };
      rows.set(key, next);
      return { id: String(next['id'] ?? key) };
    },
  };
  return { rows, delegate };
}

function deps(): { d: SeedDeps; organizations: Map<string, Record<string, unknown>>; workspaces: Map<string, Record<string, unknown>>; users: Map<string, Record<string, unknown>> } {
  const organization = table();
  const workspace = table();
  const user = table();
  const hasher = new Argon2PasswordService();
  return {
    d: {
      organization: organization.delegate,
      workspace: workspace.delegate,
      user: user.delegate,
      hash: (plain: string): Promise<string> => hasher.hash(plain),
    },
    organizations: organization.rows,
    workspaces: workspace.rows,
    users: user.rows,
  };
}

const OPTIONS = { email: 'dev@pmi.local', password: 'local-dev-password', displayName: 'Developer' };

describe('T149a · the seed creates exactly one workspace and one user', () => {
  it('creates one workspace', async () => {
    const { d, workspaces } = deps();
    await seed(d, OPTIONS);

    expect(workspaces.size).toBe(1);
  });

  it('creates one user', async () => {
    const { d, users } = deps();
    await seed(d, OPTIONS);

    expect(users.size).toBe(1);
  });

  it('creates the organization the workspace belongs to', async () => {
    const { d, organizations } = deps();
    await seed(d, OPTIONS);

    // `Workspace.organizationId` defaults to `org_default` and the relation is
    // `onDelete: Restrict` — seeding a workspace without its organization
    // fails on the foreign key, on a fresh database, at step one.
    expect(organizations.size).toBe(1);
  });

  it('returns the ids it created, so a caller can report them', async () => {
    const { d } = deps();
    const result = await seed(d, OPTIONS);

    expect(result.workspaceId).toBeTruthy();
    expect(result.userId).toBeTruthy();
    expect(result.organizationId).toBeTruthy();
  });
});

describe('T149a · the seed is idempotent', () => {
  it('leaves exactly one workspace after two runs', async () => {
    const { d, workspaces } = deps();
    await seed(d, OPTIONS);
    await seed(d, OPTIONS);

    // A second workspace is a tenancy bug produced by a convenience script:
    // every workspace-scoped query would then read one of two, silently.
    expect(workspaces.size).toBe(1);
  });

  it('leaves exactly one user after two runs', async () => {
    const { d, users } = deps();
    await seed(d, OPTIONS);
    await seed(d, OPTIONS);

    expect(users.size).toBe(1);
  });

  it('returns the same ids on the second run', async () => {
    const { d } = deps();
    const first = await seed(d, OPTIONS);
    const second = await seed(d, OPTIONS);

    expect(second.workspaceId).toBe(first.workspaceId);
    expect(second.userId).toBe(first.userId);
  });

  it('does not re-hash into a different digest each run, which would look idempotent and not be', async () => {
    const { d, users } = deps();
    await seed(d, OPTIONS);
    const first = [...users.values()][0]?.['passwordHash'];
    await seed(d, OPTIONS);
    const second = [...users.values()][0]?.['passwordHash'];

    // Argon2 salts every call, so a seed that rewrote the hash on every run
    // would still show one row while changing the stored credential underneath
    // a developer who had not asked for that.
    expect(second).toBe(first);
  });
});

describe('T149a · the password is hashed, and by the real hasher', () => {
  it('stores an argon2id digest, not the plaintext', async () => {
    const { d, users } = deps();
    await seed(d, OPTIONS);
    const stored = String([...users.values()][0]?.['passwordHash'] ?? '');

    expect(stored).not.toBe(OPTIONS.password);
    expect(stored.startsWith('$argon2id$')).toBe(true);
  });

  it('produces a digest EPIC-005s verify path accepts', async () => {
    const { d, users } = deps();
    await seed(d, OPTIONS);
    const stored = String([...users.values()][0]?.['passwordHash'] ?? '');

    // The point of the seed is a user who can actually sign in. Asserting the
    // shape of the digest would pass for a string that verify() rejects.
    expect(await new Argon2PasswordService().verify(stored, OPTIONS.password)).toBe(true);
  });

  it('refuses an empty password rather than seeding an unusable user', async () => {
    const { d } = deps();

    await expect(seed(d, { ...OPTIONS, password: '' })).rejects.toThrow(/password/i);
  });
});
