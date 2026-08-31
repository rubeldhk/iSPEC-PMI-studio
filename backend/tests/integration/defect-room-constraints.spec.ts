/**
 * `T997u` (EPIC-035) — every constraint, proved against PostgreSQL.
 *
 * ## Why these live in hand-edited SQL and are tested here
 *
 * **Prisma's schema language cannot express `CHECK`.** A generated migration
 * would produce eight tables and silently omit every rule that makes them worth
 * having — and the omission would be invisible, because the tables would exist
 * and the services would pass their unit tests.
 *
 * So the migration is hand-written (`R-035-8`), and hand-written SQL needs a
 * test that the constraints are actually there. `EPIC-034` learned the same
 * lesson from the other side: its `change_impact_areas` CHECK enumerated an
 * area `BR-0044` never named, and nothing noticed until a test read the
 * requirement.
 *
 * ## Each refusal is paired with an acceptance
 *
 * A constraint that rejects everything satisfies *"no bad row was stored"*
 * perfectly. Every case below has a control showing the check can tell the two
 * apart — without them this file would pass against a database that refused
 * every insert.
 *
 * ## Why the trigger, and not a CHECK
 *
 * `FR-DFR-041` spans three tables: the defect's state, its reproduction's
 * automatability, and whether a test exists. A `CHECK` cannot see beyond its own
 * row. Putting it in the service alone would leave it holding only where
 * somebody remembered to call it, which is the check most worth skipping.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_defect';

suite('T997u · the Defect Room refuses at the database', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;
  let seq = 0;

  const id = (prefix: string): string => `${prefix}_${(seq += 1)}`;

  /** A defect in a state the trigger does not examine. */
  const defect = async (over: Record<string, unknown> = {}): Promise<string> => {
    const row = {
      id: id('df'),
      workspaceId: WS,
      projectId: 'pr_1',
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

  const classify = async (defectId: string, over: Record<string, unknown> = {}): Promise<void> => {
    const row = {
      id: id('cl'),
      workspaceId: WS,
      defectId,
      outcome: 'confirmed-defect',
      destination: 'repair',
      approvedBehaviourRef: 'rv_1',
      classifiedBy: 'u_1',
      classifiedByKind: 'human',
      rationale: 'the baseline says one hour and it sends two',
      ...over,
    };
    const cols = Object.keys(row).map((c) => `"${c}"`).join(',');
    const params = Object.keys(row).map((_, i) => `$${i + 1}`).join(',');
    await db.query(
      `INSERT INTO "defect_classifications" (${cols}) VALUES (${params})`,
      Object.values(row),
    );
  };

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
  }, 300_000);

  afterAll(async () => {
    await db?.end();
    await container?.stop();
  }, 120_000);

  it('accepts a well-formed defect — or every refusal below is vacuous', async () => {
    await expect(defect()).resolves.toBeTruthy();
  });

  describe('FR-DFR-077 · a classification cannot exist without its destination', () => {
    it('refuses a requirement gap routed to the Change Room', async () => {
      // The specific failure: not a missing destination, but the WRONG one. A
      // NOT NULL alone would let this row through looking well-formed.
      const d = await defect();
      await expect(
        classify(d, {
          outcome: 'requirement-gap',
          destination: 'change-room',
          approvedBehaviourRef: null,
          absenceRecorded: true,
        }),
      ).rejects.toThrow(/destination_matches_outcome/);
    });

    it('refuses a confirmed defect routed away from repair', async () => {
      const d = await defect();
      await expect(classify(d, { destination: 'requirement-room' })).rejects.toThrow(
        /destination_matches_outcome/,
      );
    });

    it('and refuses a NULL destination outright', async () => {
      // The hole `T999n(a)`'s mutation found. The two cases above prove a WRONG
      // destination is refused; neither tried an absent one, so relaxing the
      // column to nullable passed the whole file. A classification resting with
      // nowhere to go is exactly what `FR-DFR-077` forbids, and it looks
      // complete from every direction except this one.
      const d = await defect();
      await expect(classify(d, { destination: null })).rejects.toThrow(
        /destination|not-null|violates/i,
      );
    });

    it('accepts each outcome with its own destination', async () => {
      // All three, so the constraint is shown admitting the whole mapping
      // rather than one row of it.
      const a = await defect();
      await expect(classify(a)).resolves.toBeUndefined();

      const b = await defect();
      await expect(
        classify(b, { outcome: 'change-request', destination: 'change-room' }),
      ).resolves.toBeUndefined();

      const c = await defect();
      await expect(
        classify(c, {
          outcome: 'requirement-gap',
          destination: 'requirement-room',
          approvedBehaviourRef: null,
          absenceRecorded: true,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('FR-DFR-023 · an agent may propose, never confirm', () => {
    it('refuses a confirmed defect classified by an agent', async () => {
      const d = await defect();
      await expect(classify(d, { classifiedByKind: 'agent' })).rejects.toThrow(
        /confirmed_by_a_human/,
      );
    });

    it('but an agent may classify it a change request', async () => {
      // The control that makes the refusal specific. An agent is not barred
      // from triage — it is barred from confirming a defect.
      const d = await defect();
      await expect(
        classify(d, {
          outcome: 'change-request',
          destination: 'change-room',
          classifiedByKind: 'agent',
          proposedByAgent: true,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('FR-DFR-021 · judged against behaviour, or the absence recorded', () => {
    it('refuses a classification with neither', async () => {
      const d = await defect();
      await expect(
        classify(d, {
          outcome: 'change-request',
          destination: 'change-room',
          approvedBehaviourRef: null,
        }),
      ).rejects.toThrow(/absence_is_recorded/);
    });

    it('accepts a requirement gap that records the absence', async () => {
      const d = await defect();
      await expect(
        classify(d, {
          outcome: 'requirement-gap',
          destination: 'requirement-room',
          approvedBehaviourRef: null,
          absenceRecorded: true,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('FR-DFR-012 · an unlinkable defect is held for triage', () => {
    it('refuses an Epic-less defect in any other state', async () => {
      // Nullable is not laxity. A defect with no Epic that is not held for
      // triage is one nobody can find.
      await expect(defect({ epicId: null, state: 'confirmed' })).rejects.toThrow(
        /unlinked_are_held_for_triage/,
      );
    });

    it('accepts one that is held for triage', async () => {
      await expect(defect({ epicId: null, state: 'held-for-triage' })).resolves.toBeTruthy();
    });
  });

  describe('FR-DFR-043 · the not-automatable exception is enumerable', () => {
    const reproduce = async (defectId: string, over: Record<string, unknown> = {}) => {
      const row = {
        id: id('rp'),
        workspaceId: WS,
        defectId,
        reproducible: 'always',
        environment: 'stage',
        steps: 'submit twice',
        affectedBehaviour: 'two notifications arrive',
        ...over,
      };
      const cols = Object.keys(row).map((c) => `"${c}"`).join(',');
      const params = Object.keys(row).map((_, i) => `$${i + 1}`).join(',');
      await db.query(
        `INSERT INTO "defect_reproductions" (${cols}) VALUES (${params})`,
        Object.values(row),
      );
    };

    it('refuses a not-automatable reproduction with no reason', async () => {
      const d = await defect();
      await expect(reproduce(d, { reproducible: 'not-automatable' })).rejects.toThrow(
        /exceptions_say_why/,
      );
    });

    it('and one with a blank reason', async () => {
      // Enumerable means countable, which means it cannot be whitespace.
      const d = await defect();
      await expect(
        reproduce(d, { reproducible: 'not-automatable', notAutomatableReason: '   ' }),
      ).rejects.toThrow(/exceptions_say_why/);
    });

    it('accepts one that states it', async () => {
      const d = await defect();
      await expect(
        reproduce(d, {
          reproducible: 'not-automatable',
          notAutomatableReason: 'needs a card reader present at the till',
        }),
      ).resolves.toBeUndefined();
    });

    it('and intermittent is a value the column accepts', async () => {
      // `FR-DFR-031`. If the vocabulary rejected it, the requirement would be
      // unrepresentable rather than enforced.
      const d = await defect();
      await expect(reproduce(d, { reproducible: 'intermittent' })).resolves.toBeUndefined();
    });
  });

  describe('FR-DFR-041 · a fix needs a failing test', () => {
    it('refuses moving an automatable defect to verifying with no test', async () => {
      // The trigger. This is the rule the whole Epic rests on, and the one a
      // service-only check would leave holding wherever somebody remembered.
      const d = await defect();
      await expect(
        db.query('UPDATE "defect_records" SET "state" = $1 WHERE "id" = $2', ['verifying', d]),
      ).rejects.toThrow(/fix_needs_a_failing_test/);
    });

    it('and refuses closing it', async () => {
      const d = await defect();
      await expect(
        db.query('UPDATE "defect_records" SET "state" = $1 WHERE "id" = $2', ['closed', d]),
      ).rejects.toThrow(/fix_needs_a_failing_test/);
    });

    it('accepts it once a failing test is on record', async () => {
      const d = await defect();
      await db.query(
        `INSERT INTO "defect_tests"
           ("id","workspaceId","defectId","testRef","contestedBehaviourRef","firstObservedFailingAt")
         VALUES ($1,$2,$3,'regression.spec.ts::one hour','rv_1',now())`,
        [id('dt'), WS, d],
      );
      await expect(
        db.query('UPDATE "defect_records" SET "state" = $1 WHERE "id" = $2', ['verifying', d]),
      ).resolves.toBeTruthy();
    });

    it('and accepts a not-automatable defect that stated its reason', async () => {
      // `FR-DFR-043`'s exception, honoured by the trigger. Without this the
      // rule would block every defect that cannot be automated, which is not
      // what `BR-0054`'s "where automatable" says.
      const d = await defect();
      await db.query(
        `INSERT INTO "defect_reproductions"
           ("id","workspaceId","defectId","reproducible","environment","steps",
            "affectedBehaviour","notAutomatableReason")
         VALUES ($1,$2,$3,'not-automatable','till','tap a card','two receipts','needs a card reader')`,
        [id('rp'), WS, d],
      );
      await expect(
        db.query('UPDATE "defect_records" SET "state" = $1 WHERE "id" = $2', ['closed', d]),
      ).resolves.toBeTruthy();
    });

    it('but an absent reproduction is treated as automatable, not as an exception', async () => {
      // Assuming the exception would grant it by default — `FR-GEL-062`'s
      // objection arriving through a missing row.
      const d = await defect();
      await expect(
        db.query('UPDATE "defect_records" SET "state" = $1 WHERE "id" = $2', ['closed', d]),
      ).rejects.toThrow(/fix_needs_a_failing_test/);
    });
  });

  describe('R-035-6 · an evidence-check path is one of three', () => {
    it('refuses a fourth', async () => {
      const d = await defect();
      const t = id('dt');
      await db.query(
        `INSERT INTO "defect_tests"
           ("id","workspaceId","defectId","testRef","contestedBehaviourRef","firstObservedFailingAt")
         VALUES ($1,$2,$3,'t','rv_1',now())`,
        [t, WS, d],
      );
      await expect(
        db.query(
          `INSERT INTO "defect_evidence_checks"
             ("id","workspaceId","defectId","defectTestId","path","resolvedBy","rationale")
           VALUES ($1,$2,$3,$4,'close-it','u_1','it passed')`,
          [id('ec'), WS, d, t],
        ),
      ).rejects.toThrow(/path_is_one_of_three/);
    });

    it('accepts each of the three', async () => {
      const d = await defect();
      const t = id('dt');
      await db.query(
        `INSERT INTO "defect_tests"
           ("id","workspaceId","defectId","testRef","contestedBehaviourRef","firstObservedFailingAt")
         VALUES ($1,$2,$3,'t','rv_1',now())`,
        [t, WS, d],
      );
      for (const path of ['refine-test', 'investigate', 'reclassify']) {
        await expect(
          db.query(
            `INSERT INTO "defect_evidence_checks"
               ("id","workspaceId","defectId","defectTestId","path","resolvedBy","rationale")
             VALUES ($1,$2,$3,$4,$5,'u_1','weighed')`,
            [id('ec'), WS, d, t, path],
          ),
        ).resolves.toBeTruthy();
      }
    });
  });

  describe('SC-DFR-010 · an accepted routing has a target', () => {
    const route = async (defectId: string, over: Record<string, unknown> = {}) => {
      const row = {
        id: id('rt'),
        workspaceId: WS,
        defectId,
        classificationId: 'cl_x',
        destination: 'change-room',
        offeredReason: 'the baseline says otherwise; this is a change',
        state: 'offered',
        ...over,
      };
      const cols = Object.keys(row).map((c) => `"${c}"`).join(',');
      const params = Object.keys(row).map((_, i) => `$${i + 1}`).join(',');
      await db.query(
        `INSERT INTO "defect_routings" (${cols}) VALUES (${params})`,
        Object.values(row),
      );
    };

    it('refuses accepted with no target reference', async () => {
      // The state where this Room believes somebody else has it and nobody
      // does.
      const d = await defect();
      await expect(route(d, { state: 'accepted' })).rejects.toThrow(/accepted_have_a_target/);
    });

    it('accepts one that names what was created', async () => {
      const d = await defect();
      await expect(
        route(d, { state: 'accepted', targetRef: 'cr_9' }),
      ).resolves.toBeUndefined();
    });

    it('refuses a decline with no reason', async () => {
      // `FR-DFR-073` — the offer and the decline are both retained.
      const d = await defect();
      await expect(route(d, { state: 'declined', declinedAt: new Date() })).rejects.toThrow(
        /declines_say_why/,
      );
    });

    it('refuses a refusal carrying no detail', async () => {
      const d = await defect();
      await expect(route(d, { state: 'refused' })).rejects.toThrow(/refusals_carry_detail/);
    });

    it('and refuses a routing to `repair`, which never leaves this Room', async () => {
      const d = await defect();
      await expect(route(d, { destination: 'repair' })).rejects.toThrow(
        /destination_leaves_this_room/,
      );
    });
  });

  describe('FR-DFR-025 · a supersession is never half-written', () => {
    it('accepts a classification that supersedes nothing — the control', async () => {
      const d = await defect();
      await expect(classify(d)).resolves.toBeUndefined();
    });

    it('accepts one superseded, with both halves present', async () => {
      const d = await defect();
      await expect(
        classify(d, { supersededByClassificationId: 'cl_later', reclassifiedAt: new Date() }),
      ).resolves.toBeUndefined();
    });

    it('refuses a pointer to a successor with no date', async () => {
      // The row cannot say when it stopped standing. `ADR-0016`'s never-delete
      // rule is about being able to read the history back, and a supersession
      // with no date is a fact whose position in the history is unknown.
      const d = await defect();
      await expect(classify(d, { supersededByClassificationId: 'cl_later' })).rejects.toThrow(
        /supersession_says_when/,
      );
    });

    it('and refuses a date with no successor', async () => {
      // Worse than the other half: this row claims it was replaced by nothing,
      // so a reader looking for what supersedes it finds an absence that looks
      // like the end of the story.
      const d = await defect();
      await expect(classify(d, { reclassifiedAt: new Date() })).rejects.toThrow(
        /supersession_says_when/,
      );
    });
  });

  describe('FR-DFR-024 · a re-evaluation names the version it judged', () => {
    it('accepts NULL, which means the version reported on the defect', async () => {
      // NULL is not "unknown" here — it is a specific answer that lives on the
      // defect row, and the control that keeps the refusal below from being a
      // rule against absence.
      const d = await defect();
      await expect(classify(d, { evaluatedAgainstVersion: null })).resolves.toBeUndefined();
    });

    it('accepts a later version', async () => {
      const d = await defect();
      await expect(classify(d, { evaluatedAgainstVersion: 'v7' })).resolves.toBeUndefined();
    });

    it('refuses a blank one', async () => {
      // Worse than NULL, which at least says exactly which version it means.
      // An empty string reads as "some other version, unspecified".
      const d = await defect();
      await expect(classify(d, { evaluatedAgainstVersion: '  ' })).rejects.toThrow(
        /reevaluation_names_its_version/,
      );
    });
  });
});
