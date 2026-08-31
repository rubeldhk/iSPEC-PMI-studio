/**
 * `T998i` (EPIC-035) — three guards, each refusing on its own.
 *
 * `FR-DFR-041`, `SC-DFR-001`. A fix with no failing test on record is refused
 * by **the type**, by **the loop configuration** and by **the database**, and
 * this file goes around the service to prove each one separately.
 *
 * ## Why three, when one would pass the acceptance criteria
 *
 * They fail differently, and they are bypassed differently.
 *
 * The **type** refuses at compile time and cannot be reached at all — but only
 * inside TypeScript that the build actually compiles. The **loop gate** refuses
 * a governed transition, and is bypassed by anything that writes state without
 * going through the loop. The **database** refuses whatever wrote the row, and
 * is the only one still standing when a script, a migration or a future service
 * reaches past every layer above it.
 *
 * `SC-DFR-001` is *zero* fixes accepted without a failing test. A single guard
 * makes that a claim about one code path; three make it a claim about the
 * system. And `R-035-8` records the specific hazard for the third: Prisma's
 * destructive migration planning treats a hand-written constraint as an extra
 * and **generates a drop for it**, so a later `migrate dev` on an unrelated
 * Epic could remove this trigger silently. The test below is what turns that
 * into a red suite.
 */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '../../..');
const MIGRATIONS = resolve(here, '../../prisma/migrations');
const TYPES = resolve(here, '../../src/modules/defect-room/test-first.types.ts');
const WORKFLOW = join(REPO, 'packages/loop-contract/workflows/defect-room.json');

const require_ = createRequire(import.meta.url);

/**
 * Compile one fixture and report what TypeScript said.
 *
 * Run through `typescript/bin/tsc` on `process.execPath` rather than through a
 * shell: the `.bin` shim differs by platform, and a spawn that fails to start
 * would look exactly like a compile that found no errors.
 */
function compile(source: string): { code: number; output: string } {
  const dir = mkdtempSync(join(tmpdir(), 'pmi-t998i-'));
  try {
    const importPath = relative(dir, TYPES).replace(/\\/g, '/').replace(/\.ts$/, '.js');
    const file = join(dir, 'fixture.ts');
    writeFileSync(file, source.replace('@types', importPath), 'utf8');
    const run = spawnSync(
      process.execPath,
      [
        require_.resolve('typescript/bin/tsc'),
        '--noEmit',
        '--strict',
        '--target',
        'es2022',
        '--module',
        'nodenext',
        '--moduleResolution',
        'nodenext',
        file,
      ],
      { encoding: 'utf8' },
    );
    return { code: run.status ?? -1, output: `${run.stdout ?? ''}${run.stderr ?? ''}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const A_TEST =
  "{ id: 't', defectId: 'd', contestedBehaviourRef: 'rv_1', reference: 'x', " +
  'firstObservedFailingAt: new Date() }';

describe('T998i · guard 1 — the type refuses, at compile time', () => {
  it('an acceptance with no test does not compile', () => {
    // Going around the service entirely: this never calls `acceptFix`. It
    // constructs the acceptance by hand, which is what a future caller in a
    // hurry would do.
    const { code, output } = compile(
      "import type { FixAcceptance } from '@types';\n" +
        "export const a: FixAcceptance = { accepted: true, acceptedBy: 'u_1' };\n",
    );
    expect(code).not.toBe(0);
    expect(output).toMatch(/Property 'test' is missing/);
  });

  it('and neither does one that sets it to null', () => {
    // The shape somebody reaches for when the compiler complains. `test: null`
    // is how the null becomes "not recorded yet" instead of "this never
    // happened".
    const { code, output } = compile(
      "import type { FixAcceptance } from '@types';\n" +
        "export const a: FixAcceptance = { accepted: true, acceptedBy: 'u_1', test: null };\n",
    );
    expect(code).not.toBe(0);
    expect(output).toMatch(/null/);
  });

  it('but one carrying the test compiles cleanly', () => {
    // The control, and it is not optional here: a fixture that failed for an
    // unrelated reason — a typo, a bad import path — would satisfy both
    // assertions above while proving nothing about the type at all.
    const { code, output } = compile(
      "import type { FixAcceptance } from '@types';\n" +
        `export const a: FixAcceptance = { accepted: true, acceptedBy: 'u_1', test: ${A_TEST} };\n`,
    );
    expect(output).toBe('');
    expect(code).toBe(0);
  });
}, 120_000);

describe('T998i · guard 2 — the loop configuration refuses the transition', () => {
  const workflow = JSON.parse(readFileSync(WORKFLOW, 'utf8')) as {
    transitions: { from: string; to: string; requiredGates: string[] }[];
  };

  it('Decide → Execute requires a failing test on record', () => {
    // Read out of the contract rather than restated here. `DEF-034-001` was two
    // artifacts written minutes apart from one misreading, agreeing with each
    // other — a second recollection is not a second source.
    const transition = workflow.transitions.find((t) => t.from === 'Decide' && t.to === 'Execute');
    expect(transition?.requiredGates).toContain('defect-room.failing-test-on-record');
  });

  it('and no path from Decide reaches Execute without it', () => {
    // The assertion that survives somebody adding a second edge. One
    // ungated route into Execute is the whole gate, gone.
    const intoExecute = workflow.transitions.filter((t) => t.to === 'Execute');
    expect(intoExecute.length).toBeGreaterThan(0);
    for (const transition of intoExecute) {
      expect(transition.requiredGates).toContain('defect-room.failing-test-on-record');
    }
  });

  it('while the routing exit carries no such gate — so the check is not vacuous', () => {
    // `Decide → Outcome` is the transfer path: a defect that turns out to be a
    // change request never needed a failing test. If every transition carried
    // every gate, the assertions above would pass without meaning anything.
    const routed = workflow.transitions.find((t) => t.from === 'Decide' && t.to === 'Outcome');
    expect(routed?.requiredGates).not.toContain('defect-room.failing-test-on-record');
  });
});

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const dbSuite = noRuntime ? describe.skip : describe;

dbSuite('T998i · guard 3 — the database refuses whatever wrote the row', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;

  const id = (p: string): string => `${p}_${Math.random().toString(36).slice(2, 10)}`;

  const defect = async (over: Record<string, unknown> = {}): Promise<string> => {
    const row = {
      id: id('df'),
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      // `FR-DFR-012` — an unlinked defect is held for triage, and the CHECK
      // says so. A row that is `triaged` therefore has to name an Epic.
      epicId: 'EPIC-999',
      state: 'triaged',
      origin: 'manual-report',
      contestedArtifactRef: 'spec_1',
      contestedArtifactVersion: 'v3',
      severity: 'high',
      reportedBy: 'u_1',
      ...over,
    };
    const cols = Object.keys(row).map((c) => `"${c}"`).join(',');
    const params = Object.keys(row).map((_, i) => `$${i + 1}`).join(',');
    await db.query(`INSERT INTO "defect_records" (${cols}) VALUES (${params})`, Object.values(row));
    return String(row.id);
  };

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    // No workspace or project row is seeded, and none is needed: the defect
    // tables carry foreign keys among themselves and none out to `projects`.
    // Seeding one meant seeding a workspace, then a user — a chain of rows that
    // has nothing to do with what this file asserts, and whose absence failed
    // in `beforeAll`, which vitest reports as SEVEN SKIPPED TESTS and exit 0.
  }, 300_000);

  afterAll(async () => {
    await db?.end();
    await container?.stop();
  }, 120_000);

  it('refuses a move to verifying with no failing test on record', async () => {
    // No service involved. This is the guard that is still standing when a
    // script, a migration or a service written next year reaches past every
    // layer above it.
    const d = await defect();
    await expect(
      db.query(`UPDATE "defect_records" SET "state" = 'verifying' WHERE "id" = $1`, [d]),
    ).rejects.toThrow(/fix_needs_a_failing_test/);
  });

  it('and a move to closed', async () => {
    const d = await defect();
    await expect(
      db.query(`UPDATE "defect_records" SET "state" = 'closed' WHERE "id" = $1`, [d]),
    ).rejects.toThrow(/fix_needs_a_failing_test/);
  });

  it('and an INSERT that arrives already closed', async () => {
    // The route around an UPDATE trigger: write the row in its final state. A
    // BEFORE INSERT OR UPDATE trigger is what closes it.
    await expect(defect({ state: 'closed' })).rejects.toThrow(/fix_needs_a_failing_test/);
  });

  it('but allows it once a test that was seen failing is on record', async () => {
    // The control. Without it, a trigger that refused every state change would
    // satisfy all three assertions above.
    const d = await defect();
    await db.query(
      `INSERT INTO "defect_tests"
         ("id","workspaceId","defectId","testRef","contestedBehaviourRef","firstObservedFailingAt")
       VALUES ($1,'ws_1',$2,'spec.ts::sends one','rv_1', now())`,
      [id('dt'), d],
    );
    await expect(
      db.query(`UPDATE "defect_records" SET "state" = 'verifying' WHERE "id" = $1`, [d]),
    ).resolves.toBeTruthy();
  });

  it('and allows the stated not-automatable exception', async () => {
    // `FR-DFR-043`. The exception is real, and the trigger honours it — but
    // only where it was recorded, which is why the reason column cannot be
    // blank.
    const d = await defect();
    await db.query(
      `INSERT INTO "defect_reproductions"
         ("id","workspaceId","defectId","reproducible","environment","steps",
          "affectedBehaviour","notAutomatableReason")
       VALUES ($1,'ws_1',$2,'not-automatable','sandbox','open the sandbox','rv_1',
               'the third-party sandbox has no runner')`,
      [id('rp'), d],
    );
    await expect(
      db.query(`UPDATE "defect_records" SET "state" = 'verifying' WHERE "id" = $1`, [d]),
    ).resolves.toBeTruthy();
  });

  it('while a merely intermittent reproduction is not the exception', async () => {
    // `intermittent` is a member of the vocabulary, not a synonym for
    // not-automatable — and treating it as one would make the exception the
    // easiest state to reach rather than the rarest.
    const d = await defect();
    await db.query(
      `INSERT INTO "defect_reproductions"
         ("id","workspaceId","defectId","reproducible","environment","steps","affectedBehaviour")
       VALUES ($1,'ws_1',$2,'intermittent','staging','retry until it fails','rv_1')`,
      [id('rp'), d],
    );
    await expect(
      db.query(`UPDATE "defect_records" SET "state" = 'verifying' WHERE "id" = $1`, [d]),
    ).rejects.toThrow(/fix_needs_a_failing_test/);
  });

  it('and the trigger is still attached — R-035-8’s silent regression', async () => {
    // Prisma's destructive migration planning treats a hand-written trigger as
    // an extra and generates a drop for it. A later `migrate dev` on an
    // unrelated Epic could remove this one, and every test above would keep
    // passing except this one.
    const rows = await db.query(
      `SELECT tgname FROM pg_trigger WHERE tgname = 'defect_records_fix_needs_a_failing_test'`,
    );
    expect(rows.rowCount).toBe(1);
  });
});
