/**
 * `T994x`, `T994y` (EPIC-034) — a transfer from the Defect Room.
 *
 * `FR-CHR-012`, `BR-0057`, `R-034-6`: context and evidence preserved **by
 * reference**, origin visible, and a refused transfer **returns** with the
 * refusal attached.
 *
 * ## By reference, and why copying would be worse than lossy
 *
 * `R-034-6`: referencing rather than copying keeps `EPIC-032`'s evidence items
 * at a single identity. A copied attestation is a second artifact with the same
 * digest and a different id — which is exactly the provenance ambiguity
 * `FR-EVS-013` exists to prevent. Two rows attesting one fact, and no way to
 * tell which one an auditor was shown.
 *
 * ## And why a refusal returns rather than stopping
 *
 * A transfer this Room refuses has left the Defect Room. If it simply failed
 * here, the defect would sit in a state saying "transferred" with nothing at
 * the other end — the worst of both, because the Defect Room believes it is
 * somebody else's problem and nobody else has it. `EPIC-035`'s `FR-DFR-074`
 * specifies the return path from its side; both halves are specified in the
 * same Wave so neither is built against a guess.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { POSTGRES_IMAGE } from '../helpers/postgres-image.js';
import { Client } from 'pg';
import {
  PrismaChangeRoomStore,
  type ChangeRoomPrismaClient,
} from '../../src/modules/change-room/change-room.store.prisma.js';
import { InMemoryChangeRoomStore } from '../../src/modules/change-room/change-room.store.js';
import { ChangeIntakeService } from '../../src/modules/change-room/intake.service.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_transfer';

const transfer = (over: Record<string, unknown> = {}) => ({
  workspaceId: WS,
  projectId: 'pr_transfer',
  roomObjectId: 'ro_transfer',
  targetBaselineId: 'b_1',
  targetBaselineVersion: 1,
  requestedOutcome: 'stop the duplicate notification',
  reason: 'the defect reproduces whenever two approvers act within a second',
  requester: 'u_1',
  // `BR-0057` — where it came from.
  originDefectRef: 'DEF-035-014',
  // `R-034-6` — by reference. Ids into `EPIC-032`, never copies.
  evidenceRefs: ['ev_repro_9', 'ev_log_22'],
  contextRefs: ['defect-note-3'],
  ...over,
});

describe('T994x · a transfer arrives with its origin visible', () => {
  const intake = (): ChangeIntakeService => new ChangeIntakeService(new InMemoryChangeRoomStore());

  it('records the defect it came from', async () => {
    const request = await intake().fromDefectTransfer(transfer());
    expect(request.origin).toBe('defect-transfer');
    expect(request.originDefectRef).toBe('DEF-035-014');
  });

  it('refuses a transfer that does not name its defect', async () => {
    // Losing where a change came from is worse than refusing the transfer: the
    // change would look raised from nowhere, and the defect would look handled.
    await expect(
      intake().fromDefectTransfer(transfer({ originDefectRef: '' })),
    ).rejects.toThrow(/names the defect/i);
  });

  it('and one that names no baseline', async () => {
    // `FR-CHR-010` applies to a transferred change exactly as to a raised one.
    await expect(
      intake().fromDefectTransfer(transfer({ targetBaselineId: '' })),
    ).rejects.toThrow(/always against a baseline/i);
  });
});

describe('T994x · evidence and context are preserved by reference', () => {
  const intake = (): ChangeIntakeService => new ChangeIntakeService(new InMemoryChangeRoomStore());

  it('carries the evidence ids it was given', async () => {
    const request = await intake().fromDefectTransfer(transfer());
    expect(request.transferredEvidenceRefs).toEqual(['ev_repro_9', 'ev_log_22']);
  });

  it('and the context ids', async () => {
    const request = await intake().fromDefectTransfer(transfer());
    expect(request.transferredContextRefs).toEqual(['defect-note-3']);
  });

  it('copying nothing — the references carry no payload', async () => {
    // `FR-EVS-013`. A copied attestation is a second artifact with the same
    // digest and a different id, and no way to tell which one an auditor saw.
    const request = await intake().fromDefectTransfer(transfer());
    for (const ref of request.transferredEvidenceRefs) {
      expect(typeof ref).toBe('string');
    }
    // Nothing on the request holds evidence content.
    expect(JSON.stringify(request)).not.toMatch(/digest|content|payload|base64/i);
  });

  it('an empty reference set is recorded as empty, not as absent', async () => {
    // A defect with no evidence yet is a real case. `[]` says nobody attached
    // any; a missing field would leave a reader unable to tell that from a
    // transfer that lost them.
    const request = await intake().fromDefectTransfer(
      transfer({ evidenceRefs: [], contextRefs: [] }),
    );
    expect(request.transferredEvidenceRefs).toEqual([]);
    expect(request.transferredContextRefs).toEqual([]);
  });

  it('refuses a blank reference rather than storing one', async () => {
    await expect(
      intake().fromDefectTransfer(transfer({ evidenceRefs: ['ev_1', '  '] })),
    ).rejects.toThrow(/reference/i);
  });
});

describe('T994x · a refused transfer returns with its refusal', () => {
  const intake = (): ChangeIntakeService => new ChangeIntakeService(new InMemoryChangeRoomStore());

  it('the refusal carries the defect it must return to', async () => {
    // `R-034-6`, `EPIC-035` `FR-DFR-074`. Without this the defect sits saying
    // "transferred" with nothing at the other end.
    try {
      await intake().fromDefectTransfer(transfer({ targetBaselineId: '' }));
      throw new Error('the transfer was accepted');
    } catch (error) {
      const details = (error as { details?: { returnTo?: string; originDefectRef?: string } })
        .details;
      expect(details?.originDefectRef).toBe('DEF-035-014');
      expect(details?.returnTo).toBe('EPIC-035');
    }
  });

  it('and states why, so the Defect Room can attach it', async () => {
    try {
      await intake().fromDefectTransfer(transfer({ targetBaselineId: '' }));
      throw new Error('the transfer was accepted');
    } catch (error) {
      const details = (error as { details?: { refusal?: string } }).details;
      expect(details?.refusal).toMatch(/baseline/i);
    }
  });

  it('a transfer with no defect ref has nowhere to return, and says so', async () => {
    // The one refusal that cannot carry a return address. It must not claim to.
    try {
      await intake().fromDefectTransfer(transfer({ originDefectRef: '' }));
      throw new Error('the transfer was accepted');
    } catch (error) {
      const details = (error as { details?: { returnTo?: string } }).details;
      expect(details?.returnTo).toBeUndefined();
    }
  });

  it('and nothing is written by a refused transfer', async () => {
    const store = new InMemoryChangeRoomStore();
    const service = new ChangeIntakeService(store);
    await expect(
      service.fromDefectTransfer(transfer({ targetBaselineId: '' })),
    ).rejects.toThrow();
    expect(await store.listForBaseline(WS, 'b_1')).toHaveLength(0);
  });
});

suite('T994x · and it survives the process', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;

  beforeAll(async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$1,now())`, [WS]);
  }, 300_000);

  afterAll(async () => {
    await db?.end();
    await container?.stop();
  }, 120_000);

  it('the origin and its references are in PostgreSQL', async () => {
    const store = new PrismaChangeRoomStore({
      changeRequest: {
        create: async ({ data }: never) => {
          const row = data as Record<string, unknown>;
          const cols = Object.keys(row)
            .map((c) => `"${c}"`)
            .join(',');
          const params = Object.keys(row)
            .map((_, i) => `$${i + 1}`)
            .join(',');
          await db.query(
            `INSERT INTO "change_requests" (${cols}) VALUES (${params})`,
            Object.values(row).map((v) => (Array.isArray(v) ? JSON.stringify(v) : v)),
          );
          return row;
        },
      },
    } as unknown as ChangeRoomPrismaClient);

    await new ChangeIntakeService(store).fromDefectTransfer(transfer());

    const rows = await db.query(
      'SELECT "origin","originDefectRef" FROM "change_requests" WHERE "workspaceId" = $1',
      [WS],
    );
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0]?.origin).toBe('defect-transfer');
    expect(rows.rows[0]?.originDefectRef).toBe('DEF-035-014');
  });

  it('and the database refuses a defect-transfer with no defect', async () => {
    // `change_requests_origin_names_its_defect` — the belt beside the service's
    // brace, holding when a caller reaches past it.
    await expect(
      db.query(
        `INSERT INTO "change_requests"
           ("id","workspaceId","projectId","roomObjectId","targetBaselineId",
            "targetBaselineVersion","requestedOutcome","reason","requester","origin")
         VALUES ('cr_bad',$1,'pr_1','ro_1','b_1',1,'x','y','u_1','defect-transfer')`,
        [WS],
      ),
    ).rejects.toThrow();
  });
});
