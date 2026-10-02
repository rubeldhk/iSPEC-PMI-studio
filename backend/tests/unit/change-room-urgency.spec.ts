/**
 * `T996c`, `T996d` (EPIC-034) — urgency is recorded and never read.
 *
 * `FR-CHR-021` and `ADR-0025` constraint 2. This is the requirement most likely
 * to be quietly broken, because breaking it always looks like helpfulness: a
 * critical change is waiting, a gate is unsatisfied, and skipping it *this
 * once* is one `if` away.
 *
 * So the guarantee asserted here is stronger than behaviour. It is that the
 * intake source **never branches on urgency at all** — the field is stored and
 * the code that decides anything cannot see it. A rule enforced by a branch
 * that happens to be absent is a rule somebody adds back; a rule enforced by
 * the value never reaching a decision is one they would have to build.
 *
 * `ADR-0025` constraint 2: a skipped gate resolves to a recorded exception or a
 * violation, **never to a pass**.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ChangeIntakeService,
  URGENCY_LEVELS,
} from '../../src/modules/change-room/intake.service.js';
import { InMemoryChangeRoomStore } from '../../src/modules/change-room/change-room.store.js';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(
  join(here, '..', '..', 'src', 'modules', 'change-room', 'intake.service.ts'),
  'utf8',
);
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const service = (): ChangeIntakeService => new ChangeIntakeService(new InMemoryChangeRoomStore());

const input = (urgency: string) => ({
  workspaceId: 'ws_1',
  projectId: 'pr_1',
  roomObjectId: 'ro_1',
  targetBaselineId: 'b_1',
  targetBaselineVersion: 1,
  requestedOutcome: 'ship the fix',
  reason: 'production is down',
  requester: 'u_1',
  urgency,
});

describe('T996c · urgency is recorded', () => {
  it.each([...URGENCY_LEVELS])('records %s exactly as claimed', async (level) => {
    const request = await service().raise(input(level));
    expect(request.urgency).toBe(level);
  });

  it('defaults to normal when nothing is claimed', async () => {
    const request = await service().raise({ ...input('normal'), urgency: undefined });
    expect(request.urgency).toBe('normal');
  });
});

describe('T996c · and changes nothing', () => {
  it('produces the same record whatever the urgency', async () => {
    // Every field except `urgency` and the generated id must match. If urgency
    // altered a single other value, something downstream reads it.
    const normal = await service().raise(input('normal'));
    const critical = await service().raise(input('critical'));

    const strip = (r: Record<string, unknown>): Record<string, unknown> => {
      const { id, urgency, createdAt, ...rest } = r;
      void id;
      void urgency;
      void createdAt;
      return rest;
    };
    expect(strip(critical as never)).toEqual(strip(normal as never));
  });

  it('a critical request is still `open`, not pre-approved', async () => {
    // The shape the shortcut would take: urgency skipping straight past the
    // Room. `ADR-0025` constraint 2 — never a pass.
    const request = await service().raise(input('critical'));
    expect(request.state).toBe('open');
  });

  it('a critical request still requires its baseline', async () => {
    // The most tempting exemption of all, and the one `FR-CHR-010` refuses
    // regardless: production being down does not give a change a target.
    await expect(
      service().raise({ ...input('critical'), targetBaselineId: '' }),
    ).rejects.toThrow(/always against a baseline/i);
  });

  it('a critical request still requires a reason', async () => {
    await expect(service().raise({ ...input('critical'), reason: '  ' })).rejects.toThrow(/reason/);
  });
});

describe('T996c · nothing branches on it', () => {
  /**
   * The one branch urgency is allowed to reach: rejecting a level nobody
   * declared. That is vocabulary, not a gate — it decides whether the *word* is
   * real, never what happens next. Everything else is stripped away before the
   * assertions below, so what they examine is the code that decides things.
   */
  const VOCABULARY = /URGENCY_LEVELS/;
  const DECISION_CODE = CODE.split('\n')
    .filter((line) => !VOCABULARY.test(line))
    .join('\n');

  it('the vocabulary check is the only place urgency is read', () => {
    // Guard on the exclusion itself: if the validation moved or was renamed,
    // the filter above would silently stop excluding anything and the
    // assertions below would weaken without failing.
    const excluded = CODE.split('\n').filter((line) => VOCABULARY.test(line));
    expect(excluded.length).toBeGreaterThan(0);
    expect(excluded.some((line) => line.includes('includes'))).toBe(true);
  });

  it('nothing that decides anything compares urgency to a value', () => {
    // A rule enforced by a branch that happens to be absent is a rule somebody
    // adds back. This one is enforced by urgency never reaching a decision.
    expect(/urgency\s*===/.test(DECISION_CODE), 'a decision compares urgency').toBe(false);
    expect(/urgency\s*!==/.test(DECISION_CODE)).toBe(false);
    expect(/if\s*\([^)]*urgency/.test(DECISION_CODE), 'a decision branches on urgency').toBe(false);
  });

  it('never names a specific level in a condition', () => {
    const conditions = DECISION_CODE.split('\n').filter((line) => /\bif\s*\(/.test(line));
    for (const line of conditions) {
      expect(line.includes('critical'), `a condition names critical: ${line.trim()}`).toBe(false);
      expect(line.includes('high'), `a condition names high: ${line.trim()}`).toBe(false);
    }
  });

  it('the branch check can actually fail', () => {
    // Anti-tautology. Without this the assertions above would pass against a
    // matcher that never matched anything, and the shortcut this file exists to
    // forbid is exactly the line below.
    const shortcut = "if (input.urgency === 'critical') { return skipGate(); }";
    expect(/if\s*\([^)]*urgency/.test(shortcut)).toBe(true);
    expect(/urgency\s*===/.test(shortcut)).toBe(true);
    // And it survives the vocabulary filter, so the exclusion cannot hide it.
    expect(VOCABULARY.test(shortcut)).toBe(false);
  });

  it('urgency IS validated — recorded does not mean unchecked', () => {
    expect(CODE.includes('URGENCY_LEVELS.includes')).toBe(true);
  });
});
