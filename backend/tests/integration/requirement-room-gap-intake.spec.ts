/**
 * T338u — a Requirement Gap routed from the Defect Room arrives as new intent.
 * `EPIC-035` `FR-DFR-076`, `FR-DFR-077`, `SC-DFR-010`.
 *
 * **This Room is a destination, and did not know it.** `ADR-0016` names three
 * classification outcomes; `EPIC-035`'s specification routed two — Confirmed
 * Defect to repair, Change Request to the Change Room — and the third had no
 * destination at all. A Requirement Gap cannot go to the Change Room, because
 * there is no approved baseline to change; that absence is precisely what makes
 * it a gap. `FR-DFR-076` was added by a clarification *after this Epic was
 * planned*, so nothing here received it. `EPIC-035`'s Exit Criterion 5 cannot
 * hold until this route exists, and its `T997d` checks for it at Phase 1.
 *
 * **Driven through the composed application, not the service.** The point of
 * these two tasks is that `EPIC-035` has somewhere to send a gap. A test that
 * called `IntakeService.gapIntake` directly would pass with the route
 * unregistered, which is the exact state this test exists to rule out.
 *
 * **Reproduction context and evidence are carried BY REFERENCE.** The candidate
 * stores `defect-room:<defectId>` as its `sourceRef` and nothing else from
 * `EPIC-035`. `FR-DFR-076` requires the defect record be *retained and marked
 * reclassified, never deleted* — so it is still there, and it is where the
 * reproduction steps and the evidence live. Copying them here would create a
 * second copy that drifts from the record `EPIC-035` maintains, which is
 * `D-33`'s reasoning applied to another Epic's data.
 *
 * **A gap that cannot be admitted is refused, never silently dropped.**
 * `SC-DFR-010` requires *zero* items resting in a classified state with no
 * destination. An empty `200` would be exactly that: `EPIC-035` marks the
 * defect reclassified, this Room recorded nothing, and the item is gone with
 * both sides believing the other has it.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { ErrorFilter } from '../../src/core/error.filter.js';
import { defectOriginOf } from '../../src/modules/requirement-room/intake.service.js';

/** Mirrors `main.ts`, as `T337x` does and for the same reason. */
const PREFIX = 'v1';
const ROUTE = `/${PREFIX}/rooms/requirement/gap-intake`;

const GAP = {
  workspaceId: 'ws_1',
  projectId: 'pr_1',
  roomObjectId: 'ro_1',
  defectId: 'def_4821',
  text: 'There is no defined behaviour for a session that expires mid-review.',
};

describe('T338u · a Requirement Gap reaches the Requirement Room', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    app.useGlobalFilters(new ErrorFilter());
    app.setGlobalPrefix(PREFIX);
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('accepts the routed gap and returns the candidate it became', async () => {
    const response = await request(app.getHttpServer()).post(ROUTE).send(GAP);

    expect(response.status).toBeLessThan(300);
    expect(response.body).toHaveLength(1);
  });

  it('records it as new intent — a candidate, not a decided requirement', async () => {
    const response = await request(app.getHttpServer()).post(ROUTE).send(GAP);
    const [candidate] = response.body as Array<Record<string, unknown>>;

    // A gap needs a requirement WRITTEN, not a baseline amended. It enters at
    // the same place raw intent does, and is decided the same way.
    expect(candidate?.promotedTo).toBeNull();
    expect(candidate?.normalizedText).toBe(GAP.text);
    expect(candidate?.roomObjectId).toBe('ro_1');
  });

  it('labels it like any other recorded intent, with no gap-specific kind', async () => {
    const response = await request(app.getHttpServer()).post(ROUTE).send(GAP);
    const [candidate] = response.body as Array<Record<string, unknown>>;

    // `EPISTEMIC_KINDS` has four members and no fifth (R-033-4). A gap arriving
    // with a label of its own would be the fifth kind by another name.
    expect(candidate?.epistemic).toBe('fact');
  });

  it('makes the Defect Room origin visible from the candidate', async () => {
    const response = await request(app.getHttpServer()).post(ROUTE).send(GAP);
    const [candidate] = response.body as Array<{ sourceRef: string }>;

    expect(candidate?.sourceRef).toBe('defect-room:def_4821');
    expect(defectOriginOf(candidate!.sourceRef)).toBe('def_4821');
  });

  it('carries the defect by reference and copies nothing else from EPIC-035', async () => {
    const response = await request(app.getHttpServer()).post(ROUTE).send({
      ...GAP,
      // A caller sending more than the route asks for. The reproduction steps
      // and evidence live on the retained defect record; a copy here would be a
      // second one that drifts.
      reproductionSteps: 'Sign in, wait for the session to lapse, submit the review.',
      evidence: ['ev_1', 'ev_2'],
    });
    const [candidate] = response.body as Array<Record<string, unknown>>;

    expect(Object.keys(candidate ?? {}).sort()).toEqual([
      'acceptanceCriteria',
      'aiAnalysis',
      'createdAt',
      'epistemic',
      'id',
      'intendedForImplementation',
      'normalizedText',
      'projectId',
      'promotedTo',
      'roomObjectId',
      'sourceRef',
      'workspaceId',
    ]);
  });

  it('distinguishes a routed gap from directly entered intent', async () => {
    const direct = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/requirement/intake`)
      .send({
        workspaceId: 'ws_1',
        projectId: 'pr_1',
        roomObjectId: 'ro_1',
        sourceRef: 'direct:2026-08-23',
        text: 'Intent somebody typed.',
      });
    const [candidate] = direct.body as Array<{ sourceRef: string }>;

    // Anti-vacuity: if every candidate looked like a gap, the origin assertion
    // above would hold over a route that ignored its input.
    expect(defectOriginOf(candidate!.sourceRef)).toBeNull();
  });
});

describe('T338u · a gap that cannot be admitted is refused, never dropped', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    app.useGlobalFilters(new ErrorFilter());
    app.setGlobalPrefix(PREFIX);
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it.each(['workspaceId', 'projectId', 'roomObjectId', 'defectId', 'text'] as const)(
    'refuses a gap missing %s, naming it',
    async (field) => {
      const response = await request(app.getHttpServer())
        .post(ROUTE)
        .send({ ...GAP, [field]: '' });

      expect(response.status).toBe(400);
      const body = response.body as { error?: { code?: string; message?: string } };
      expect(body.error?.code).toBe('validation_failed');
      expect(body.error?.message).toMatch(new RegExp(field));
    },
  );

  it('refuses intent that normalizes to nothing rather than answering 200 with []', async () => {
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .send({ ...GAP, text: '   \t \n ' });

    // SC-DFR-010: zero items rest in a classified state with no destination. An
    // empty 200 is exactly that state, with both Epics believing the other has
    // the item.
    expect(response.status).toBe(400);
  });

  it('names the Defect Room in the refusal, so the caller knows which side to fix', async () => {
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .send({ ...GAP, defectId: '' });

    expect((response.body as { error?: { message?: string } }).error?.message).toMatch(/defectId/);
  });
});
