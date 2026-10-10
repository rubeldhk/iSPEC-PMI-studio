/**
 * `T2340` (EPIC-048, `FR-LRN-015`, `FR-LRN-016`, US2-3, US2-4) — each citation
 * with its live state, and withheld from a reader who may not see it.
 *
 * - `verified` — resolved, integrity valid, cited digest equals stored digest;
 * - `integrity-failed` — integrity failed **or** the cited digest differs (a
 *   substituted item is a tampered citation);
 * - `unresolvable` — absent, another workspace's, or storage unresolvable;
 * - `withheld` — for a reader `AccessControlEvidencePolicy` refuses: no id, no
 *   digest, and the candidate carries `withheldEvidenceCount`.
 *
 * Eligibility reads the **unfiltered** state (`R-048-9`): a citation withheld
 * from one reviewer is not thereby healthy. `retired` is never produced
 * (`R-048-8`, `RK-6`).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { EvidenceView } from '../../src/modules/learning/evidence.view.js';
import { refusingPorts } from '../../src/modules/learning/learning.tokens.js';
import { candidateRecord, citationFor, DIGEST, OTHER_DIGEST } from '../helpers/learning-fixtures.js';
import { learningWorld, verified, type LearningTestWorld } from '../helpers/learning-ports.js';

const READER = { workspaceId: 'ws_a', userId: 'u_h' };
let world: LearningTestWorld;

beforeEach(() => {
  world = learningWorld();
});

const c = candidateRecord();
const cite = (evidenceId: string, digest = DIGEST) => citationFor(c, { evidenceId, digest });

describe('T2340 · the state of each citation (FR-LRN-015)', () => {
  it('verified when resolved, valid, and the digest matches', async () => {
    const view = await new EvidenceView(world.ports).unfiltered('ws_a', [cite('ev_1')]);
    expect(view.map((v) => v.state)).toEqual(['verified']);
  });

  it('integrity-failed when the store says so', async () => {
    world.evidence.set('ev_bad', verified('ev_bad', { integrity: 'failed' }));
    const view = await new EvidenceView(world.ports).unfiltered('ws_a', [cite('ev_bad')]);
    expect(view[0]!.state).toBe('integrity-failed');
  });

  it('integrity-failed when the cited digest differs from the stored one — a substituted item', async () => {
    const view = await new EvidenceView(world.ports).unfiltered('ws_a', [cite('ev_1', OTHER_DIGEST)]);
    expect(view[0]!.state).toBe('integrity-failed');
  });

  it('unresolvable when absent, storage-unresolvable, or another workspace’s', async () => {
    world.evidence.set('ev_gone', verified('ev_gone', { resolution: 'unresolvable' }));
    const here = await new EvidenceView(world.ports).unfiltered('ws_a', [cite('ev_missing'), cite('ev_gone')]);
    expect(here.map((v) => v.state)).toEqual(['unresolvable', 'unresolvable']);
    const elsewhere = await new EvidenceView(world.ports).unfiltered('ws_b', [cite('ev_1')]);
    expect(elsewhere[0]!.state).toBe('unresolvable');
  });

  it('retired is never produced (R-048-8)', async () => {
    world.evidence.set('ev_bad', verified('ev_bad', { integrity: 'failed' }));
    const all = await new EvidenceView(world.ports).unfiltered('ws_a', [cite('ev_1'), cite('ev_bad'), cite('ev_none')]);
    expect(all.map((v) => v.state)).not.toContain('retired');
  });

  it('EvidenceReads unbound reads every citation unresolvable — never verified', async () => {
    const ports = { ...world.ports, evidence: refusingPorts().evidence };
    const view = await new EvidenceView(ports).unfiltered('ws_a', [cite('ev_1')]);
    expect(view[0]!.state).toBe('unresolvable');
  });
});

describe('T2340 · withheld per reader (FR-LRN-016, US2-4)', () => {
  it('withholds a citation the reader may not see — no id, no digest — and counts it', async () => {
    world.readable.delete('ev_2');
    world.evidence.set('ev_2', verified('ev_2', { attestedTarget: { type: 'specification', id: 'spec_secret' } }));
    const view = await new EvidenceView(world.ports).forReader('ws_a', READER, [cite('ev_1'), cite('ev_2')]);
    expect(view.withheldEvidenceCount).toBe(1);
    expect(view.citations[1]).toEqual({ state: 'withheld' });
    expect(view.citations[0]).toMatchObject({ state: 'verified', evidenceId: 'ev_1', digest: DIGEST, predicateType: expect.any(String) });
  });

  it('asks the access policy about the attested target, not the evidence item', async () => {
    world.readable.delete('ev_2');
    world.readable.add('target:specification:spec_open');
    world.evidence.set('ev_2', verified('ev_2', { attestedTarget: { type: 'specification', id: 'spec_open' } }));
    const view = await new EvidenceView(world.ports).forReader('ws_a', READER, [cite('ev_2')]);
    expect(view.withheldEvidenceCount).toBe(0);
  });

  it('ReaderAccess unbound withholds everything (the safe reading)', async () => {
    const ports = { ...world.ports, readerAccess: refusingPorts().readerAccess };
    const view = await new EvidenceView(ports).forReader('ws_a', READER, [cite('ev_1'), cite('ev_2')]);
    expect(view.withheldEvidenceCount).toBe(2);
  });

  it('eligibility reads the unfiltered state — withheld from one reader is not healthy (R-048-9)', async () => {
    world.readable.clear();
    world.evidence.set('ev_bad', verified('ev_bad', { integrity: 'failed' }));
    const v = new EvidenceView(world.ports);
    expect((await v.forReader('ws_a', READER, [cite('ev_bad')])).citations[0]).toEqual({ state: 'withheld' });
    expect((await v.unfiltered('ws_a', [cite('ev_bad')]))[0]!.state).toBe('integrity-failed');
  });
});
