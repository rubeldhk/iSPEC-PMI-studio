/**
 * `T999p` (EPIC-035) — the five boundary confirmations, in one file.
 *
 * `EPIC-034` spent five task identifiers on these. This Epic has one
 * (`R-035-11`, the identifier ceiling), which changes the bookkeeping and
 * nothing about what has to be true.
 *
 * ## Why these five, and why they are asserted rather than reviewed
 *
 * Each is a claim somebody would otherwise make in a closing report by looking
 * and being satisfied. Looking is how `DEF-034-001` happened: a constant and a
 * test written minutes apart from one misreading, agreeing with each other and
 * with nothing else. **A second recollection is not a second source**, so each
 * claim here is computed from the artifact it is about.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ROOM_REGIONS } from '@pmi/room-contract';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');

const read = (relative: string): string => readFileSync(join(repo, relative), 'utf8');

/** The Epic's own migration — the only place it defines tables. */
const MIGRATIONS = join(repo, 'backend/prisma/migrations');
const epicMigrations = readdirSync(MIGRATIONS)
  .filter((dir) => /epic035/i.test(dir))
  .map((dir) => read(join('backend/prisma/migrations', dir, 'migration.sql')));

describe('T999p · 1 — the Room-load figure is the siblings’ figure', () => {
  it('EPIC-033, EPIC-034 and EPIC-035 all say p95 < 1.2 s', () => {
    // The same shell renders all three Rooms, so a different budget here would
    // be a claim about a component this Epic does not own. Read from the three
    // research records rather than restated, because restating it is how the
    // three would come to disagree the first time one was retuned.
    const figures = [
      '033-requirement-room',
      '034-change-room',
      '035-defect-room',
    ].map((epic) => {
      // Whitespace-normalised first: two of the three state the figure in a
      // table row and the third in prose, and the prose wraps mid-sentence. A
      // matcher sensitive to that would report a figure missing that is there.
      const text = read(`specs/${epic}/research.md`).replace(/\s+/g, ' ');
      const match = /Room load[^.]{0,120}?p95 < \*{0,2}([\d.]+)\s*s/i.exec(text);
      expect(match, `${epic}/research.md states no Room-load p95`).not.toBeNull();
      return match![1];
    });

    expect(figures).toEqual(['1.2', '1.2', '1.2']);
  });

  it('and this Epic says why it is the same rather than restating a number', () => {
    expect(read('specs/035-defect-room/research.md').replace(/\s+/g, ' ')).toMatch(
      /same shell/i,
    );
  });
});

describe('T999p · 2 — no requirement, specification or evidence payload is stored here', () => {
  it('the Epic defines tables', () => {
    // The control. If the migrations moved or the filter stopped matching, the
    // three assertions below would pass over an empty string and prove nothing.
    expect(epicMigrations.length).toBeGreaterThan(0);
    expect(epicMigrations.join('')).toMatch(/CREATE TABLE "defect_records"/);
  });

  it.each(['payload', 'content', 'body', 'attachment', 'blob', 'base64', 'text'])(
    'and no column is called %s',
    (word) => {
      // `R-035-7`, `FR-DFR-032`: evidence lives in `EPIC-032` under the access
      // rules of the artifact it concerns. A copy here would be readable under
      // this Room's rules instead — which is how a reproduction HAR carrying a
      // session token reaches everyone who can see defects.
      //
      // Matched against quoted column names only. `TEXT` as a column TYPE is on
      // nearly every line, and a bare word match would fire on it.
      for (const sql of epicMigrations) {
        const columns = [...sql.matchAll(/^\s*"([A-Za-z]+)"\s+[A-Z]/gm)].map((m) => m[1]!);
        expect(
          columns.some((column) => new RegExp(`^${word}$`, 'i').test(column)),
          `a column is named ${word}`,
        ).toBe(false);
      }
    },
  );

  it('the column check can fire', () => {
    const columns = [...'    "payload"                TEXT NOT NULL,'.matchAll(
      /^\s*"([A-Za-z]+)"\s+[A-Z]/gm,
    )].map((m) => m[1]!);
    expect(columns).toEqual(['payload']);
  });

  it('but evidence IS referenced, so the absence is not the absence of the concept', () => {
    // The positive half. A Room storing no evidence reference at all would pass
    // every assertion above and fail `FR-DFR-032`.
    expect(epicMigrations.join('')).toMatch(/evidenceRefs?/);
  });
});

describe('T999p · 3 — unused loop stages render as omitted, not absent', () => {
  it('the shared progress region keeps them', () => {
    // `FR-GEL-008`. A filtered-out stage and a stage that never existed look
    // identical on a screen, and only one of them is a fact about this Room.
    const source = read('frontend/src/rooms/regions/LoopProgress.tsx');
    expect(source).toMatch(/omitted/);
    // Rendered with a modifier class rather than dropped from the list.
    expect(source).toMatch(/room-progress__stage--omitted/);
    expect(source).not.toMatch(/\.filter\([^)]*omitted/);
  });

  it('the filter check can fire', () => {
    expect(/\.filter\([^)]*omitted/.test('rows.filter(row => !row.omitted)')).toBe(true);
  });

  it('and this Room renders that region rather than its own', () => {
    // Inheriting the behaviour is the point: a Room deciding for itself which
    // stages are worth showing is what `FR-GEL-008` exists to prevent.
    expect(read('frontend/src/pages/DefectRoom.tsx')).toMatch(/LoopProgress/);
  });
});

describe('T999p · 4 — region names match the contract, by comparison', () => {
  it('the page derives no region vocabulary of its own', () => {
    // `FR-DFR-091`, `UX-0035`. `T998y` renders the page and compares the region
    // set against `ROOM_REGIONS`; this asserts the other half — that the page
    // has no list to compare against, so the comparison is worth running.
    const page = read('frontend/src/pages/DefectRoom.tsx');
    for (const region of ROOM_REGIONS) {
      expect(
        new RegExp(`['"\`]${region}['"\`]`).test(page),
        `DefectRoom.tsx contains the literal region name ${region}`,
      ).toBe(false);
    }
  });

  it('and the contract names six', () => {
    // The control: an empty `ROOM_REGIONS` would make the loop above assert
    // nothing at all.
    expect(ROOM_REGIONS.length).toBe(6);
  });

  it('the literal check can fire', () => {
    expect(/['"`]objectState['"`]/.test("const regions = ['objectState'];")).toBe(true);
  });
});

describe('T999p · 5 — this Epic published no package', () => {
  it('every package under packages/ predates it', () => {
    // `FR-DFR-002`. A Room that shipped its own contract package would be
    // offering other Epics a dependency on itself, which is the opposite of
    // consuming `room-contract` and `loop-contract`.
    const names = readdirSync(join(repo, 'packages')).filter((entry) =>
      statSync(join(repo, 'packages', entry)).isDirectory(),
    );
    expect(names).not.toContain('defect-contract');
    expect(names).not.toContain('defect-room-contract');

    let checked = 0;
    for (const name of names) {
      // Not every directory under `packages/` carries a manifest.
      if (!existsSync(join(repo, 'packages', name, 'package.json'))) continue;
      const manifest = JSON.parse(read(join('packages', name, 'package.json'))) as {
        name?: string;
      };
      expect(manifest.name).not.toMatch(/defect/i);
      checked += 1;
    }
    // The control: skipping every directory would assert nothing.
    expect(checked).toBeGreaterThan(0);
  });

  it('and the Room consumes the two shared contracts instead', () => {
    // The positive half, and the reason the absence above is a boundary rather
    // than an omission.
    expect(read('frontend/src/pages/DefectRoom.tsx')).toMatch(/@pmi\/room-contract|RoomShell/);
    expect(read('packages/loop-contract/workflows/defect-room.json')).toMatch(/"stages"/);
  });
});
