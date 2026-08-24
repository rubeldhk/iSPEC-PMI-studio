/**
 * T149 (EPIC-014 F-11.1) — the development seed. Unit test: `T149a`.
 *
 * `specs/_shared/quickstart.md`'s Setup block runs `pnpm --filter backend seed`
 * and until now there was neither a seed nor a script. A fresh database holds
 * no workspace and no user, so **sign-in is impossible** — which is step one of
 * every validation scenario and of any UAT. The `EPIC-029` UAT run had to
 * hand-assemble this.
 *
 * **Idempotent by upsert on a fixed key, not by "check then insert".** A seed
 * run twice is not an edge case: `prisma migrate dev` re-runs it, and people
 * re-run it when something looks wrong. A seed that appends creates a second
 * workspace, and every workspace-scoped query then reads one of two, silently —
 * a tenancy bug produced by a convenience script. The password is **not** in
 * the update branch, so re-running does not rewrite a credential underneath a
 * developer who did not ask for that.
 *
 * **The organization is seeded first and is not optional.**
 * `Workspace.organizationId` defaults to `org_default` with an `onDelete:
 * Restrict` relation, so seeding a workspace without it fails on the foreign
 * key — on a fresh database, at the first step.
 *
 * **The logic takes delegates rather than a `PrismaClient`**, which is the
 * `T651` pattern, so `T149a` can drive it without a database.
 *
 * Framework-free (PC-1).
 */
import { Argon2PasswordService } from '../src/modules/auth/password.service.js';

/** Fixed so the seed is idempotent and so a developer can predict what it made. */
export const SEED_ORGANIZATION_ID = 'org_default';
export const SEED_WORKSPACE_ID = 'ws_default';

interface UpsertDelegate {
  upsert(args: {
    where: Record<string, unknown>;
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }): Promise<{ id: string }>;
}

export interface SeedDeps {
  organization: UpsertDelegate;
  workspace: UpsertDelegate;
  user: UpsertDelegate;
  hash(plain: string): Promise<string>;
}

export interface SeedOptions {
  email: string;
  password: string;
  displayName: string;
}

export interface SeedResult {
  organizationId: string;
  workspaceId: string;
  userId: string;
}

export async function seed(deps: SeedDeps, options: SeedOptions): Promise<SeedResult> {
  if (!options.password || options.password.trim() === '') {
    // A user with no usable password is a user who cannot sign in, which is
    // the one thing the seed exists to provide.
    throw new Error('seed requires a password — set SEED_USER_PASSWORD');
  }

  const organization = await deps.organization.upsert({
    where: { id: SEED_ORGANIZATION_ID },
    create: { id: SEED_ORGANIZATION_ID, name: 'Default Organization' },
    update: {},
  });

  const workspace = await deps.workspace.upsert({
    where: { id: SEED_WORKSPACE_ID },
    create: {
      id: SEED_WORKSPACE_ID,
      name: 'Default Workspace',
      organizationId: SEED_ORGANIZATION_ID,
    },
    update: {},
  });

  const user = await deps.user.upsert({
    where: { email: options.email },
    create: {
      workspaceId: SEED_WORKSPACE_ID,
      email: options.email,
      displayName: options.displayName,
      passwordHash: await deps.hash(options.password),
    },
    // Deliberately NOT the password. Re-running the seed must not silently
    // replace a credential a developer is already using — and Argon2 salts
    // every call, so rewriting it would change the digest on every run while
    // still looking idempotent by row count.
    update: { displayName: options.displayName },
  });

  return {
    organizationId: organization.id,
    workspaceId: workspace.id,
    userId: user.id,
  };
}

/**
 * The real wiring. Kept below the logic and behind an entry-point guard so
 * importing this module — as `T149a` does — never opens a database connection.
 *
 * **Refuses to run in production.** A seed creates a known account with a known
 * password; that is right for a developer machine and is a backdoor anywhere
 * else.
 */
export async function main(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('the development seed refuses to run with NODE_ENV=production');
  }
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const hasher = new Argon2PasswordService();
  try {
    const result = await seed(
      {
        organization: prisma.organization as unknown as UpsertDelegate,
        workspace: prisma.workspace as unknown as UpsertDelegate,
        user: prisma.user as unknown as UpsertDelegate,
        hash: (plain: string) => hasher.hash(plain),
      },
      {
        email: process.env['SEED_USER_EMAIL'] ?? 'dev@pmi.local',
        // No default. An unset password fails loudly rather than creating a
        // predictable account nobody chose.
        password: process.env['SEED_USER_PASSWORD'] ?? '',
        displayName: process.env['SEED_USER_NAME'] ?? 'Developer',
      },
    );
    // The email is echoed so a developer knows what to sign in with. The
    // password never is (PC-3).
    process.stdout.write(
      `seeded workspace ${result.workspaceId} and user ${process.env['SEED_USER_EMAIL'] ?? 'dev@pmi.local'}\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

// `tsx prisma/seed.ts` runs this; `import` from a test does not.
if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  main().catch((err: unknown) => {
    process.stderr.write(`${String(err)}\n`);
    process.exitCode = 1;
  });
}
