/**
 * `T1636` (EPIC-045, `R-045-4`) — the specifications module's implementation of
 * `SpecificationSyncPort`.
 *
 * The artifacts module declares the interface and never touches a
 * specification table; this file is the only place a synced `spec.md` becomes
 * rows, and it lives here because these are this module's tables and this
 * module's invariants.
 *
 * ## The create is one transaction
 *
 * A specification whose first version failed to write is a row that renders as
 * an empty document forever. The specification, its first version and the
 * `currentVersionId` pointer go together or not at all.
 *
 * ## Later versions go through `appendIfChanged`'s rule
 *
 * `FR-ART-031`. Identical content adds nothing — the same judgement
 * `SpecificationVersionService` already makes for every other author, restated
 * here against raw SQL rather than duplicated as a second policy.
 */
import { randomUUID } from 'node:crypto';
import { isUniqueViolation } from '../artifacts/artifact.store.js';
import type {
  AppendVersionInput,
  AppendVersionOutcome,
  SpecificationSyncInput,
  SpecificationSyncPort,
  SyncedSpecification,
  SyncedSpecificationVersion,
} from '../artifacts/specification-sync.port.js';

export interface SpecificationSyncDb {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $transaction<T>(fn: (tx: SpecificationSyncDb) => Promise<T>): Promise<T>;
}

interface SpecificationRow {
  id: string;
  workspaceId: string;
  projectId: string;
  epicId: string | null;
  sourcePath: string | null;
  title: string;
  lifecycleState: string;
  engineName: string;
  engineVersion: string;
  createdById: string;
}

interface VersionRow {
  id: string;
  specificationId: string;
  versionNumber: number;
  contentRaw: string;
  contentParsed: Record<string, unknown>;
  authoredById: string;
}

export class PrismaSpecificationSyncService implements SpecificationSyncPort {
  constructor(private readonly db: SpecificationSyncDb) {}

  async findByEpicSource(workspaceId: string, epicId: string, sourcePath: string): Promise<SyncedSpecification | null> {
    const rows = await this.db.$queryRawUnsafe<SpecificationRow[]>(
      `SELECT "id","workspaceId","projectId","epicId","sourcePath","title","lifecycleState"::text AS "lifecycleState","engineName","engineVersion","createdById"
         FROM "specifications" WHERE "workspaceId" = $1 AND "epicId" = $2 AND "sourcePath" = $3`,
      workspaceId,
      epicId,
      sourcePath,
    );
    const row = rows[0];
    // The row carries no owner column; the creator is the execution's initiator,
    // not the project owner, so it is not relabelled as one (review finding 7).
    return row === undefined ? null : { ...row, ownerUserId: null };
  }

  async createFromSync(input: SpecificationSyncInput): Promise<SyncedSpecification> {
    const id = randomUUID();
    const versionId = randomUUID();
    await this.db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `INSERT INTO "specifications"
           ("id","workspaceId","projectId","epicId","sourcePath","title","lifecycleState","engineName","engineVersion",
            "generatedAt","createdById","updatedById","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,$8, now(), $9, $9, now())`,
        id,
        input.workspaceId,
        input.projectId,
        input.epicId,
        input.sourcePath,
        input.title,
        input.provenance.engineName,
        input.provenance.engineVersion,
        input.createdById,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "specification_versions"
           ("id","workspaceId","specificationId","versionNumber","contentRaw","contentParsed","lifecycleStateAtCreation","authoredById")
         VALUES ($1,$2,$3,1,$4,$5::jsonb,'draft',$6)`,
        versionId,
        input.workspaceId,
        id,
        input.contentRaw,
        JSON.stringify(input.contentParsed ?? { parsed: false }),
        input.createdById,
      );
      // The pointer, in the same transaction: a specification whose current
      // version is null renders as an empty document.
      await tx.$executeRawUnsafe(`UPDATE "specifications" SET "currentVersionId" = $1 WHERE "id" = $2`, versionId, id);
    });
    return {
      id,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      epicId: input.epicId,
      sourcePath: input.sourcePath,
      title: input.title,
      lifecycleState: 'draft',
      engineName: input.provenance.engineName,
      engineVersion: input.provenance.engineVersion,
      createdById: input.createdById,
      ownerUserId: input.ownerUserId,
    };
  }

  async appendVersionIfChanged(input: AppendVersionInput): Promise<AppendVersionOutcome> {
    // DEF-045-002: two syncs appending at once both read the same head and both
    // compute the same next number; the unique (specificationId, versionNumber)
    // index refuses the second. Re-read the head and try again — bounded — so
    // the loser appends after the winner rather than failing the sync.
    for (let attempt = 1; ; attempt += 1) {
      const latest = await this.db.$queryRawUnsafe<VersionRow[]>(
        `SELECT "id","specificationId","versionNumber","contentRaw","contentParsed","authoredById"
           FROM "specification_versions" WHERE "workspaceId" = $1 AND "specificationId" = $2
          ORDER BY "versionNumber" DESC LIMIT 1`,
        input.workspaceId,
        input.specificationId,
      );
      const head = latest[0];
      if (head !== undefined && head.contentRaw === input.contentRaw) {
        return { appended: false, version: toVersion(head) };
      }
      const id = randomUUID();
      const versionNumber = (head?.versionNumber ?? 0) + 1;
      try {
        await this.db.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `INSERT INTO "specification_versions"
               ("id","workspaceId","specificationId","versionNumber","contentRaw","contentParsed","lifecycleStateAtCreation","authoredById")
             SELECT $1,$2,$3,$4,$5,$6::jsonb, s."lifecycleState", $7 FROM "specifications" s WHERE s."id" = $3`,
            id,
            input.workspaceId,
            input.specificationId,
            versionNumber,
            input.contentRaw,
            JSON.stringify(input.contentParsed ?? { parsed: false }),
            input.authoredById,
          );
          await tx.$executeRawUnsafe(`UPDATE "specifications" SET "currentVersionId" = $1, "updatedAt" = now(), "updatedById" = $2 WHERE "id" = $3`, id, input.authoredById, input.specificationId);
        });
      } catch (err) {
        if (!isUniqueViolation(err, 'versionNumber') || attempt >= 3) throw err;
        continue;
      }
      return {
        appended: true,
        version: { id, specificationId: input.specificationId, versionNumber, contentRaw: input.contentRaw, contentParsed: input.contentParsed ?? { parsed: false }, authoredById: input.authoredById },
      };
    }
  }
}

function toVersion(row: VersionRow): SyncedSpecificationVersion {
  return {
    id: row.id,
    specificationId: row.specificationId,
    versionNumber: row.versionNumber,
    contentRaw: row.contentRaw,
    contentParsed: (row.contentParsed ?? { parsed: false }) as Record<string, unknown>,
    authoredById: row.authoredById,
  };
}
