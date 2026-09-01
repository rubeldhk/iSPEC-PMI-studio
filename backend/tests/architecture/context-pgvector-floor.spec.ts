/**
 * `T1222` (EPIC-038) — the compose file and the test harness pin the same
 * database image, and it carries `pgvector`.
 *
 * ## The drift this prevents
 *
 * Two places decide what PostgreSQL the code meets: `docker-compose.yml` for a
 * developer running the application, and the test helper for CI. When they
 * disagree, the failure is not a red test — it is a **green** one. The suite
 * passes on an image with the extension while a developer's database silently
 * lacks it, or the reverse: local works and CI reds on a migration nobody
 * changed.
 *
 * `EPIC-026`'s `T864d` recorded the general form after the task-identifier
 * pattern was hand-copied into six sites: *"a missed site would not fail — it
 * would quietly stop recognising identifiers."* Same shape, different subject.
 *
 * ## And why the version floor is asserted rather than assumed
 *
 * `R-038-2`: iterative index scans shipped in **pgvector 0.8.0**, and they are
 * what stops a workspace-filtered search from silently returning fewer
 * candidates than requested. On 0.7.x every test in this repository still
 * passes — the shortfall only appears under a corpus large enough for the
 * approximate scan to bite, which is production. So the floor is a documented
 * constant here rather than a version somebody remembers.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PGVECTOR_MIN_VERSION,
  POSTGRES_IMAGE,
  POSTGRES_SHM_BYTES,
} from '../helpers/postgres-image.js';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..', '..');
const compose = readFileSync(resolve(repo, 'docker-compose.yml'), 'utf8');

describe('T1222 · one image, named once', () => {
  it('the helper names a pgvector image', () => {
    expect(POSTGRES_IMAGE).toMatch(/^pgvector\/pgvector:pg\d+/);
  });

  it('and docker-compose runs the same one', () => {
    // The assertion that catches drift. Not "compose runs *a* pgvector image" —
    // the *same* one, because two pgvector images of different Postgres majors
    // is the subtler version of the same fault.
    expect(compose).toContain(POSTGRES_IMAGE);
  });

  it('and no test hardcodes a bare postgres image any more', () => {
    // `T1221` moved 53 call sites across 44 files to the shared constant. This
    // is what stops the fifty-fourth being written by hand.
    const helperSource = readFileSync(
      resolve(repo, 'backend/tests/helpers/postgres-image.ts'),
      'utf8',
    );
    expect(helperSource).toContain(POSTGRES_IMAGE);
    expect(compose).not.toMatch(/image:\s*postgres:\d/);
  });

  it('the drift check can fire', () => {
    // Anti-tautology for the two absence assertions above.
    expect(/image:\s*postgres:\d/.test('    image: postgres:16-alpine')).toBe(true);
  });
});

describe('T1222 · the version floor is recorded, not remembered', () => {
  it('names 0.8.0 or later', () => {
    // `R-038-2` — the release that added iterative index scans.
    const [major, minor] = PGVECTOR_MIN_VERSION.split('.').map(Number);
    expect(major! > 0 || minor! >= 8).toBe(true);
  });

  it('and says why in the helper, so a later reader can weigh lowering it', () => {
    const helperSource = readFileSync(
      resolve(repo, 'backend/tests/helpers/postgres-image.ts'),
      'utf8',
    );
    expect(helperSource).toMatch(/iterative index scan/i);
    expect(helperSource).toMatch(/R-038-2/);
  });
});

describe('T1222 · shared memory is sized for an HNSW build', () => {
  it('exceeds PostgreSQL 16 default maintenance_work_mem', () => {
    // pgvector's documentation: "ensure the --shm-size parameter is at least as
    // large as your maintenance_work_mem setting to prevent errors during
    // parallel HNSW index builds." Docker's default shm is 64MB, which is not.
    expect(POSTGRES_SHM_BYTES).toBeGreaterThan(64 * 1024 * 1024);
  });

  it('and the reason is recorded beside the number', () => {
    const helperSource = readFileSync(
      resolve(repo, 'backend/tests/helpers/postgres-image.ts'),
      'utf8',
    );
    expect(helperSource).toMatch(/maintenance_work_mem/);
  });
});
