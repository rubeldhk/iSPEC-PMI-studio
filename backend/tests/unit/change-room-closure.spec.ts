/**
 * `T994o`, `T994p` (EPIC-034) — closure. `BR-0048`'s four questions.
 *
 * `FR-CHR-070`: what changed, why, which tests and evidence validate it, and
 * which baseline supersedes the old state. `FR-CHR-073`: answerable **from the
 * record alone, without reconstruction** — which is the clause that decides the
 * design, because three of the four could otherwise be "derivable if you still
 * have the other tables and know how they join".
 *
 * `SC-CHR-006` measures 100% of closed changes answering all four. So the four
 * are a `Record` over a frozen question set: a closure missing one does not
 * compile, and the questions are read from `FR-CHR-070`'s own sentence rather
 * than restated here (`DEF-034-001`, where a constant and the test that checked
 * it were written from one misreading and agreed with each other).
 *
 * ## FR-CHR-072 is the one that looks like helpfulness
 *
 * *"A declaration of completion MUST NOT substitute for the validating
 * evidence"* (`BR-0144`). The shortcut is a boolean — `complete: true`,
 * `verified: true`, `signedOff: true` — and it always arrives for a good
 * reason: the evidence system is down, the change is urgent, somebody senior
 * has looked. So there is **no such field**, and closure refuses when the
 * Evidence Contract is unmet no matter what else is supplied.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { InMemoryChangeRoomStore } from '../../src/modules/change-room/change-room.store.js';
import {
  ClosureService,
  CLOSURE_QUESTIONS,
  type EvidenceContractPort,
} from '../../src/modules/change-room/closure.service.js';

const here = dirname(fileURLToPath(import.meta.url));
const SPEC = readFileSync(
  resolve(here, '..', '..', '..', 'specs', '034-change-room', 'spec.md'),
  'utf8',
);
const FR_CHR_070 = SPEC.split('\n').find((line) => line.includes('**FR-CHR-070**')) ?? '';
const SOURCE = readFileSync(
  join(here, '..', '..', 'src', 'modules', 'change-room', 'closure.service.ts'),
  'utf8',
);
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const satisfied: EvidenceContractPort = {
  async isSatisfied() {
    return { satisfied: true, unmet: [] };
  },
};

const unmet: EvidenceContractPort = {
  async isSatisfied() {
    return { satisfied: false, unmet: ['EC-ITEM-3 integration test run', 'EC-ITEM-7 sign-off'] };
  },
};

const service = (evidence: EvidenceContractPort | undefined) =>
  new ClosureService(new InMemoryChangeRoomStore(), evidence);

const input = (over: Record<string, unknown> = {}) => ({
  workspaceId: 'ws_1',
  projectId: 'pr_1',
  changeRequestId: 'cr_1',
  evidenceContractRef: 'ec_1',
  whatChanged: 'the notification window shortened from 24 hours to one hour',
  why: 'the regulator shortened the statutory window',
  validatedBy: ['ev_test_run_9', 'ev_attestation_3'],
  supersedingBaselineId: 'b_2',
  supersedingBaselineVersion: 2,
  closedBy: 'u_2',
  now: new Date('2026-08-30T15:00:00Z'),
  ...over,
});

describe('T994o · the four questions come from FR-CHR-070', () => {
  it('finds the requirement in spec.md', () => {
    expect(FR_CHR_070).toContain('Closure MUST identify');
    expect(FR_CHR_070.length).toBeGreaterThan(100);
  });

  it('there are four of them', () => {
    expect(CLOSURE_QUESTIONS).toHaveLength(4);
  });

  it('and each is spoken for in the requirement', () => {
    // `DEF-034-001`'s lesson: a constant that claims to enumerate a numbered
    // requirement's list must be checked against the requirement, not against
    // somebody's recollection of it.
    const spoken: Record<string, string> = {
      'what-changed': 'what changed',
      why: 'why',
      'validated-by': 'validate',
      'superseding-baseline': 'supersedes the old state',
    };
    for (const question of CLOSURE_QUESTIONS) {
      expect(
        FR_CHR_070.toLowerCase().includes(spoken[question]!),
        `FR-CHR-070 does not mention "${spoken[question]}"`,
      ).toBe(true);
    }
  });

  it('the mapping check can fail', () => {
    expect('closure must identify what changed and why'.includes('supersedes the old state')).toBe(
      false,
    );
  });
});

describe('T994o · a closed change answers all four from its own record', () => {
  it('what changed', async () => {
    const closure = await service(satisfied).close(input());
    expect(closure.answers['what-changed']).toContain('24 hours to one hour');
  });

  it('why', async () => {
    const closure = await service(satisfied).close(input());
    expect(closure.answers['why']).toContain('statutory window');
  });

  it('which tests and evidence validate it', async () => {
    const closure = await service(satisfied).close(input());
    expect(closure.answers['validated-by']).toContain('ev_test_run_9');
    expect(closure.answers['validated-by']).toContain('ev_attestation_3');
  });

  it('and which baseline supersedes the old state', async () => {
    // The fourth. `change_closures` had no column for it until `T994p`, which
    // would have left `SC-CHR-006` unmeetable — 100% of closures answering four
    // questions from a record that could hold three.
    const closure = await service(satisfied).close(input());
    expect(closure.answers['superseding-baseline']).toContain('b_2');
    expect(closure.supersedingBaselineVersion).toBe(2);
  });

  it('all four, with nothing blank', async () => {
    // `FR-CHR-073` — without reconstruction. An empty answer is a question the
    // record does not answer, however present the key is.
    const closure = await service(satisfied).close(input());
    for (const question of CLOSURE_QUESTIONS) {
      expect(closure.answers[question].trim().length, `${question} is blank`).toBeGreaterThan(0);
    }
  });

  it('and the answers are stored, not recomputed on read', async () => {
    const store = new InMemoryChangeRoomStore();
    await new ClosureService(store, satisfied).close(input());
    const stored = await store.findClosure('ws_1', 'cr_1');
    expect(stored?.whatChanged).toContain('24 hours to one hour');
    expect(stored?.supersedingBaselineVersion).toBe(2);
  });
});

describe('T994o · FR-CHR-071 — refused while the contract is unmet', () => {
  it('refuses, naming the unmet items', async () => {
    // Naming them is the requirement. "Evidence incomplete" sends somebody
    // hunting through a contract to find which two of nine are missing.
    await expect(service(unmet).close(input())).rejects.toThrow(/EC-ITEM-3/);
    await expect(service(unmet).close(input())).rejects.toThrow(/EC-ITEM-7/);
  });

  it('and writes nothing', async () => {
    // `SC-CHR-005` — zero changes close with an unmet contract.
    const store = new InMemoryChangeRoomStore();
    await expect(new ClosureService(store, unmet).close(input())).rejects.toThrow();
    expect(await store.findClosure('ws_1', 'cr_1')).toBeNull();
  });

  it('refuses when no evidence source is bound at all', async () => {
    // `CHANGE_ROOM_PORTS` — `EvidenceContractSource` absent ⇒ refuse. An
    // unbound source means nothing proved the change, and closing anyway would
    // record that something did.
    await expect(service(undefined).close(input())).rejects.toThrow(/EPIC-032/);
  });

  it('closes when the contract is met — or every refusal above is vacuous', async () => {
    const store = new InMemoryChangeRoomStore();
    await new ClosureService(store, satisfied).close(input());
    expect(await store.findClosure('ws_1', 'cr_1')).not.toBeNull();
  });
});

describe('T994o · FR-CHR-072 — a declaration is not evidence', () => {
  it('refuses a closure with no validating evidence', async () => {
    // The prose fields are all present and the contract is met; what is missing
    // is the thing that validates the change. `BR-0144`.
    await expect(service(satisfied).close(input({ validatedBy: [] }))).rejects.toThrow(
      /validat/i,
    );
  });

  it('offers no field in which to declare completion instead', () => {
    // Structural, and the one that holds. A boolean here would arrive for a
    // good reason — the evidence system is down, the change is urgent,
    // somebody senior has looked — and it would satisfy `FR-CHR-070` on the
    // screen while `BR-0144` was broken underneath it.
    for (const word of ['declaredComplete', 'signedOff', 'verified', 'complete', 'attested']) {
      expect(
        new RegExp(`\\breadonly\\s+${word}\\b`).test(CODE),
        `closure.service.ts declares a ${word} field`,
      ).toBe(false);
    }
  });

  it('the declaration check can fire', () => {
    expect(/\breadonly\s+declaredComplete\b/.test('  readonly declaredComplete: boolean;')).toBe(
      true,
    );
    // And the comment stripping actually stripped something, or the assertions
    // above would pass for the wrong reason.
    expect(CODE.length).toBeLessThan(SOURCE.length);
  });

  it('an unmet contract is not overridden by anything the caller supplies', async () => {
    // There is no parameter that could carry an override, so this asserts the
    // behaviour a caller would reach for: a fully-populated closure, refused.
    await expect(
      service(unmet).close(
        input({ validatedBy: ['ev_1', 'ev_2', 'ev_3'], whatChanged: 'everything, thoroughly' }),
      ),
    ).rejects.toThrow(/EC-ITEM-3/);
  });
});

describe('T994o · what else closure refuses', () => {
  it.each(['whatChanged', 'why'])('a blank %s', async (field) => {
    await expect(service(satisfied).close(input({ [field]: '   ' }))).rejects.toThrow(
      new RegExp(field),
    );
  });

  it('a closure naming no superseding baseline', async () => {
    // `BR-0048`'s fourth question. A closure that cannot say which baseline now
    // holds is a closure that cannot say what the change achieved.
    await expect(
      service(satisfied).close(input({ supersedingBaselineId: '' })),
    ).rejects.toThrow(/superseding baseline/i);
  });

  it('closing the same change twice', async () => {
    // A second closure would give the record two answers to each of the four
    // questions, and nothing to say which one holds.
    const store = new InMemoryChangeRoomStore();
    const closure = new ClosureService(store, satisfied);
    await closure.close(input());
    await expect(closure.close(input())).rejects.toThrow(/already closed/i);
  });
});
