/**
 * `T995e`, `T995f` (EPIC-034 Phase N) — the `R-034-8` targets, measured.
 *
 *   Impact view assembly   p95 < 3 s    at depth 25 over a 500-artifact project
 *   Baseline delta         p95 < 500 ms at 200 members
 *   Room load, six regions p95 < 1.2 s  — `EPIC-033`'s figure, deliberately
 *   Change closure         p95 < 200 ms excluding the `EPIC-032` call
 *
 * **Against in-memory stores and stubbed ports, and that is stated rather than
 * hidden.** `EPIC-020`'s traversal, `EPIC-028`'s provider and `EPIC-032`'s
 * Contract evaluation are all unbound in this Epic, so what is measured here is
 * this Room's own composition, diffing and validation work — not PostgreSQL and
 * not the dependencies' latency. `EPIC-033` recorded its numbers on the same
 * basis and said so; a figure presented as production latency when it is not is
 * worse than none, because it becomes the number people quote.
 *
 * The closure target says *excluding the `EPIC-032` call* in as many words, so
 * for that one the stub is what the requirement asks for rather than a
 * limitation.
 *
 * **`T995f` — the Room-load figure is `EPIC-033`'s, not a second one.** A shared
 * shell with two different performance targets would be two shells. What is
 * asserted here is that the target is the same number; the shell's render cost
 * is measured once, in `EPIC-033`, and this Room inherits both the component
 * and its budget.
 */
import { describe, expect, it } from 'vitest';
import { InMemoryChangeRoomStore } from '../../src/modules/change-room/change-room.store.js';
import {
  ImpactComposer,
  type ArchitectureDecisionPort,
  type ImpactFinding,
  type ImpactPort,
  type TraversalPort,
} from '../../src/modules/change-room/impact.composer.js';
import { IMPACT_AREAS, type ImpactAreaName } from '../../src/modules/change-room/impact.types.js';
import { computeBaselineDelta } from '../../src/modules/change-room/delta.service.js';
import { ClosureService } from '../../src/modules/change-room/closure.service.js';
import { DEFAULT_IMPACT_DEPTH } from '../../src/modules/dependencies/impact.service.js';

/** p95 as `loop-performance.spec.ts` computes it, so the figures are comparable. */
function p95(samples: readonly number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
}

async function measure(runs: number, body: () => Promise<unknown> | unknown): Promise<number> {
  const samples: number[] = [];
  for (let i = 0; i < runs; i += 1) {
    const started = performance.now();
    await body();
    samples.push(performance.now() - started);
  }
  return p95(samples);
}

/** A 500-artifact project's worth of findings, spread over the eight areas. */
function findingsFor(artifacts: number): ReadonlyMap<ImpactAreaName, ImpactFinding> {
  const per = Math.floor(artifacts / IMPACT_AREAS.length);
  return new Map(
    IMPACT_AREAS.map((area, index) => [
      area,
      index % 7 === 0
        ? ({ undeterminable: true, reason: `no source for ${area}` } as ImpactFinding)
        : ({ count: per, detail: `${per} artifacts in ${area}` } as ImpactFinding),
    ]),
  );
}

const ARTIFACTS = 500;
const reachable = Array.from({ length: ARTIFACTS }, (_, i) => `art_${i}`);

const impact: ImpactPort = { async impactFor() { return findingsFor(ARTIFACTS); } };
const traversal: TraversalPort = { async reachableFrom() { return reachable; } };
const decisions: ArchitectureDecisionPort = {
  async decisionsTouchedBy() {
    return Array.from({ length: 20 }, (_, i) => ({
      id: `adr_${i}`,
      reference: `ADR-${String(i).padStart(4, '0')}`,
      title: `Decision ${i}`,
      status: 'accepted',
    }));
  },
};

describe('T995e · R-034-8, measured', () => {
  it('impact view assembly: p95 < 3 s at depth 25 over 500 artifacts', async () => {
    const composer = new ImpactComposer(impact, traversal, decisions);
    const measured = await measure(30, () =>
      composer.compose({
        workspaceId: 'ws_perf',
        changeRequestId: 'cr_perf',
        changedArtifactId: 'b_perf',
        traversalDepth: DEFAULT_IMPACT_DEPTH,
        now: new Date('2026-08-31T00:00:00Z'),
        id: 'iv_perf',
      }),
    );
    // eslint-disable-next-line no-console
    console.log(`R-034-8 impact view assembly p95: ${measured.toFixed(3)} ms (30 samples)`);
    expect(measured).toBeLessThan(3000);
  });

  it('and the depth it records is the adopted one', () => {
    // `R-034-1`, `T995g`. Measuring at a depth nobody uses would report a
    // number for a run that never happens.
    expect(DEFAULT_IMPACT_DEPTH).toBe(25);
  });

  it('baseline delta: p95 < 500 ms at 200 members', async () => {
    // A realistic move: 20 requirements version-changed, 10 added, 10 removed.
    // The first 20 requirements move forward, so their v1 must LEAVE — a `to`
    // set that kept them would make each v2 a plain addition and the delta
    // would do less work than the target describes. The anti-vacuity case
    // below caught exactly that in the first draft of this fixture.
    const from = Array.from({ length: 200 }, (_, i) => `rv_${i}_v1`);
    const to = [
      ...from.slice(20, 190),
      ...Array.from({ length: 20 }, (_, i) => `rv_${i}_v2`),
      ...Array.from({ length: 10 }, (_, i) => `rv_new_${i}_v1`),
    ];
    const owner = (versionId: string): string | null => {
      const match = /^rv_(\d+|new_\d+)_v\d$/.exec(versionId);
      return match ? `req_${match[1]}` : null;
    };

    const measured = await measure(30, () =>
      computeBaselineDelta({
        fromBaselineVersion: 1,
        toBaselineVersion: 2,
        from,
        to,
        requirementOf: owner,
      }),
    );
    // eslint-disable-next-line no-console
    console.log(`R-034-8 baseline delta p95: ${measured.toFixed(3)} ms (30 samples, 200 members)`);
    expect(measured).toBeLessThan(500);
  });

  it('and the delta it computed is the real one, not an empty answer', () => {
    // Anti-vacuity for the measurement: timing a function that returned
    // immediately would report a very good number for no work.
    const from = Array.from({ length: 200 }, (_, i) => `rv_${i}_v1`);
    const to = [...from.slice(20, 190), ...Array.from({ length: 20 }, (_, i) => `rv_${i}_v2`)];
    const delta = computeBaselineDelta({
      fromBaselineVersion: 1,
      toBaselineVersion: 2,
      from,
      to,
      requirementOf: (id) => {
        const match = /^rv_(\d+)_v\d$/.exec(id);
        return match ? `req_${match[1]}` : null;
      },
    });
    // 20 requirements moved forward; the last 10 left entirely.
    expect(delta.versionChanged.length).toBe(20);
    expect(delta.removed.length).toBe(10);
    expect(delta.added.length).toBe(0);
  });

  it('change closure: p95 < 200 ms excluding the EPIC-032 call', async () => {
    // The exclusion is the requirement's own wording, so the stub here is what
    // `R-034-8` asks for rather than a limitation of the measurement.
    const measured = await measure(30, async () => {
      const service = new ClosureService(new InMemoryChangeRoomStore(), {
        async isSatisfied() {
          return { satisfied: true, unmet: [] };
        },
      });
      await service.close({
        workspaceId: 'ws_perf',
        projectId: 'pr_perf',
        changeRequestId: 'cr_perf',
        evidenceContractRef: 'ec_perf',
        whatChanged: 'the notification window shortened from 24 hours to one hour',
        why: 'the regulator shortened the statutory window',
        validatedBy: Array.from({ length: 40 }, (_, i) => `ev_${i}`),
        supersedingBaselineId: 'b_2',
        supersedingBaselineVersion: 2,
        closedBy: 'u_perf',
        now: new Date('2026-08-31T00:00:00Z'),
      });
    });
    // eslint-disable-next-line no-console
    console.log(`R-034-8 change closure p95: ${measured.toFixed(3)} ms (30 samples)`);
    expect(measured).toBeLessThan(200);
  });
});

describe('T995f · the Room-load figure is EPIC-033’s', () => {
  it('the target is the same number, not a second one', () => {
    // `R-034-8` records 1.2 s and says why: *"the same figure `EPIC-033` set,
    // because it is the same shell"*. A shared shell with two different
    // performance targets would be two shells.
    //
    // Read from `EPIC-033`'s research rather than restated — the same discipline
    // `DEF-034-001` produced for vocabularies.
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const { dirname, resolve } = require('node:path') as typeof import('node:path');
    const { fileURLToPath } = require('node:url') as typeof import('node:url');
    const here = dirname(fileURLToPath(import.meta.url));
    const specs = resolve(here, '..', '..', '..', 'specs');

    const ours = readFileSync(resolve(specs, '034-change-room', 'research.md'), 'utf8');
    const theirs = readFileSync(resolve(specs, '033-requirement-room', 'research.md'), 'utf8');

    const roomLoad = /Room load[^|]*\|\s*\*\*p95 < ([\d.]+) s\*\*/;
    const oursFigure = roomLoad.exec(ours)?.[1];
    const theirsFigure = roomLoad.exec(theirs)?.[1];

    expect(oursFigure, 'R-034-8 states no Room-load target').toBeDefined();
    expect(theirsFigure, 'R-033-7 states no Room-load target').toBeDefined();
    expect(oursFigure).toBe(theirsFigure);
  });

  it('and the shell itself is imported, not re-implemented', () => {
    // The reason the figures may be shared at all. `T994t` asserts this from
    // the page's side; repeated here because it is what makes `T995f`'s claim
    // more than a coincidence of two numbers.
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const { dirname, resolve } = require('node:path') as typeof import('node:path');
    const { fileURLToPath } = require('node:url') as typeof import('node:url');
    const here = dirname(fileURLToPath(import.meta.url));
    const page = readFileSync(
      resolve(here, '..', '..', '..', 'frontend', 'src', 'pages', 'ChangeRoom.tsx'),
      'utf8',
    );
    expect(page).toMatch(/import\s*\{\s*RoomShell\s*\}\s*from\s*'\.\.\/rooms\/RoomShell'/);
  });
});
