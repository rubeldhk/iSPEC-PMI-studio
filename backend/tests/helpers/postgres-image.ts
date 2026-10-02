/**
 * `T1221` (EPIC-038) — the PostgreSQL image, named once.
 *
 * ## Why every integration test now uses an image with `pgvector` in it
 *
 * `EPIC-038` adds `CREATE EXTENSION vector` to its migration, and **47 test
 * files apply every migration from disk**. On an image without the extension
 * those 47 fail — not for anything they do, but because the image cannot
 * satisfy a migration belonging to a module they never touch.
 *
 * So the image moves for all of them, together, from here. Before this constant
 * the tag was written out at **53 call sites across 44 files**, and moving it
 * meant editing 53 places correctly — where a missed site does not fail loudly,
 * it fails on whichever migration happens to need the extension.
 *
 * `EPIC-026`'s `T864d` recorded the same lesson about the task-identifier
 * pattern: *"widening it meant editing six sites correctly, and a missed site
 * would not fail — it would quietly stop recognising identifiers."* One
 * definition is the fix in both cases.
 *
 * ## The version floor is load-bearing
 *
 * `R-038-2`: **≥ 0.8.0** is the release that added iterative index scans, which
 * is what keeps a workspace-filtered search from silently returning fewer
 * candidates than requested. An older pgvector would pass every test in this
 * repository and quietly under-return in production.
 *
 * ## `shmSize`, and the error it prevents
 *
 * pgvector's documentation is explicit: *"ensure the `--shm-size` parameter is
 * at least as large as your `maintenance_work_mem` setting to prevent errors
 * during parallel HNSW index builds."* The default Docker shared-memory size is
 * 64MB, which is below PostgreSQL's default `maintenance_work_mem`, so an HNSW
 * build can fail on a container that looks correctly configured.
 *
 * `T1231` builds an HNSW index. This is the setting that lets it.
 */

/**
 * The image every integration test starts.
 *
 * `pg16` matches the PostgreSQL major version `docker-compose.yml` runs, so the
 * tests and the development database are the same server with the same
 * extension available.
 */
export const POSTGRES_IMAGE = 'pgvector/pgvector:pg16';

/** The pgvector floor `R-038-2` depends on. Asserted by `T1222`. */
export const PGVECTOR_MIN_VERSION = '0.8.0';

/**
 * Shared memory for a container that builds an HNSW index.
 *
 * 256MB, comfortably above PostgreSQL 16's default `maintenance_work_mem`
 * (64MB). Passed with `.withSharedMemorySize()` where an index is built; tests
 * that only read can omit it, and the constant is here so the number has one
 * definition rather than appearing wherever somebody hit the error.
 */
export const POSTGRES_SHM_BYTES = 256 * 1024 * 1024;
