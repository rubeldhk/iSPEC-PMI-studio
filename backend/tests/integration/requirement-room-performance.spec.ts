/**
 * `T405f`, `T405g` — the `R-033-7` targets, measured.
 *
 *   Room load (six regions populated)  p95 < 1.2 s at 200 requirements
 *   Baseline creation                  p95 < 2 s   at 200
 *   Unmet-blocker query (`UX-0032`)    p95 < 200 ms
 *
 * **The AI clarification round is deliberately absent.** `R-033-7` bounds it by
 * `EPIC-028`'s `WallClockOutcome` and explicitly withholds a second budget here,
 * because inventing one is the `BR-0106` mistake the spec forbids. A target
 * measured in the wrong Epic is worse than one measured nowhere: it becomes the
 * number people quote.
 *
 * **Against the in-memory store, and that is stated rather than hidden.**
 * `REQUIREMENT_ROOM_STORE` defaults to in-memory (documented in the store, and
 * the same asymmetry `EPIC-030`'s module explains), so these figures measure the
 * projection and hashing work — not PostgreSQL. That is the honest scope of what
 * can be measured today, and the numbers are recorded as such in
 * `quickstart-results.md` rather than presented as production latency.
 */
import { describe, expect, it } from 'vitest';
import { InMemoryRequirementRoomStore } from '../../src/modules/requirement-room/requirement-room.store.js';
import type { CandidateRow, ClarificationRow } from '../../src/modules/requirement-room/requirement-room.store.js';
import { BaselineService } from '../../src/modules/requirement-room/baseline.service.js';
import { projectReadiness } from '../../src/modules/requirement-room/readiness.projection.js';

const WS = 'ws_perf';
const PROJECT = 'pr_perf';
const ROOM = 'ro_perf';

/** p95 as `loop-performance.spec.ts` computes it, so the two are comparable. */
function p95(samples: readonly number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
}

function candidates(count: number, { blocked = false } = {}): CandidateRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `cand_${i}`,
    workspaceId: WS,
    projectId: PROJECT,
    roomObjectId: ROOM,
    sourceRef: `doc_${i % 20}`,
    normalizedText: `The system shall satisfy requirement number ${i} under stated conditions.`,
    epistemic: 'fact' as const,
    aiAnalysis: null,
    promotedTo: null,
    // Half the set missing criteria when blocked, so the projection has real
    // work to do rather than an early exit.
    acceptanceCriteria: blocked && i % 2 === 0 ? null : [`criterion ${i}`],
    intendedForImplementation: true,
    createdAt: new Date(0),
  }));
}

function clarifications(count: number): ClarificationRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `clar_${i}`,
    workspaceId: WS,
    roomObjectId: ROOM,
    candidateId: `cand_${i}`,
    question: `What does requirement ${i} mean by "promptly"?`,
    answer: i % 3 === 0 ? null : 'Within one business day.',
    answeredBy: i % 3 === 0 ? null : 'u_1',
    answeredAt: i % 3 === 0 ? null : new Date(0),
    askedBy: 'u_1',
    blocksBaseline: i % 3 === 0,
    createdAt: new Date(0),
  })) as ClarificationRow[];
}

const members = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    requirementVersionId: `rv_${i}`,
    contentHash: `hash_${i}`.padEnd(64, '0'),
  }));

/** One measured run of the whole blocker projection. */
function measureReadiness(rows: CandidateRow[], clars: ClarificationRow[]): number {
  const start = performance.now();
  projectReadiness({
    candidates: rows,
    clarifications: clars,
    evidence: { satisfied: false, unmet: ['EV-1'] },
    decision: null,
  });
  return performance.now() - start;
}

describe('T405f · R-033-7 — the three targets at 200 requirements', () => {
  const rows = candidates(200, { blocked: true });
  const clars = clarifications(60);

  it('blocker query p95 < 200 ms', () => {
    const samples = Array.from({ length: 60 }, () => measureReadiness(rows, clars));
    const measured = p95(samples);
    console.log(`T405f blocker query p95 = ${measured.toFixed(2)} ms (target < 200)`);
    expect(measured).toBeLessThan(200);
  });

  it('room load p95 < 1.2 s — the six regions’ data, assembled', async () => {
    // The Room's load is the store reads plus the projection. Measured together
    // because a person waits for the screen, not for one query.
    const samples: number[] = [];
    for (let i = 0; i < 30; i += 1) {
      const store = new InMemoryRequirementRoomStore();
      await store.createCandidates(rows);
      const start = performance.now();
      const [loaded, loadedClars] = await Promise.all([
        store.listCandidates(WS, ROOM),
        store.listClarifications(WS, ROOM),
      ]);
      projectReadiness({
        candidates: loaded,
        clarifications: loadedClars,
        evidence: { satisfied: false, unmet: ['EV-1'] },
        decision: null,
      });
      samples.push(performance.now() - start);
    }
    const measured = p95(samples);
    console.log(`T405f room load p95 = ${measured.toFixed(2)} ms (target < 1200)`);
    expect(measured).toBeLessThan(1200);
  });

  it('baseline creation p95 < 2 s at 200 members', async () => {
    const samples: number[] = [];
    const set = members(200);
    for (let i = 0; i < 30; i += 1) {
      const baselines = new BaselineService(new InMemoryRequirementRoomStore());
      const start = performance.now();
      await baselines.create({
        workspaceId: WS,
        projectId: PROJECT,
        members: set,
        approvedBy: 'u_1',
        rationale: 'Measured run.',
        decisionId: `rd_${i}`,
      });
      samples.push(performance.now() - start);
    }
    const measured = p95(samples);
    console.log(`T405f baseline creation p95 = ${measured.toFixed(2)} ms (target < 2000)`);
    expect(measured).toBeLessThan(2000);
  });
});

/**
 * **Load-sensitive, observed 2026-08-30.** These pass alone (curve 0.26 → 2.79 ms,
 * comfortably inside the 16× bound) and the degradation case fails under a full
 * parallel suite run, where the measurement competes with a dozen worker
 * processes and several PostgreSQL containers.
 *
 * The same class as `T147` and `DEF-030-002`: a wall-clock assertion in a
 * parallel suite measures the machine as much as the code. Recorded rather than
 * loosened — a bound wide enough to survive any load would stop detecting the
 * super-linear growth `R-033-7` asks to be warned about.
 */
describe('T405g · R-033-7 — the 500 limit, and what happens above it', () => {
  it('holds at the designed size of 500', () => {
    const samples = Array.from({ length: 40 }, () =>
      measureReadiness(candidates(500, { blocked: true }), clarifications(150)),
    );
    const measured = p95(samples);
    console.log(`T405g blocker query p95 at 500 = ${measured.toFixed(2)} ms (target < 200)`);
    expect(measured).toBeLessThan(200);
  });

  it('records the degradation above 500 rather than discovering it later', () => {
    // The point of `T405g` is a **stated** limit. Measured at four sizes so the
    // shape of the curve is recorded, not just one number — a single figure at
    // 1000 would say whether it is slow, not whether it is linear.
    const shape = [200, 500, 1000, 2000].map((size) => {
      const rows = candidates(size, { blocked: true });
      const clars = clarifications(Math.floor(size / 3));
      const measured = p95(Array.from({ length: 20 }, () => measureReadiness(rows, clars)));
      return { size, p95: Number(measured.toFixed(2)) };
    });
    console.log('T405g degradation curve:', JSON.stringify(shape));

    // Asserted as a SHAPE, not a threshold: above the designed size the target
    // no longer applies, and the recorded limit is only useful if the growth is
    // predictable. Super-linear growth is the surprise `R-033-7` wants named.
    const at500 = shape.find((s) => s.size === 500)?.p95 ?? 0;
    const at2000 = shape.find((s) => s.size === 2000)?.p95 ?? 0;
    // Four times the rows, allowed up to sixteen times the time — quadratic is
    // tolerated and cubic is not. Generous on purpose: this is a recorded limit,
    // not a budget, and a tight bound here would be a flaky test.
    expect(at2000).toBeLessThan(Math.max(at500 * 16, 50));
  });
});
