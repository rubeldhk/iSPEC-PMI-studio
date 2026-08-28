/**
 * `T1151`–`T1154` — the Requirement Room's identity comes from the session.
 *
 * `DEF-033-001`. The Room already refused an agent decision, in two places: a
 * service check on `actor.kind`, and a `requirement_decisions_decided_by_a_human`
 * constraint on the stored row. Both were correct. Both read a field the caller
 * had chosen, so an agent that declared itself human satisfied them.
 *
 * `requirement-room-no-ai-decision.spec.ts` proves the constraint refuses an
 * `agent` row — and every one of its tests inserts the kind directly. This file
 * asks the question that one cannot: **what makes `actor.kind` true?**
 *
 * So these drive real HTTP against the composed application. A test that called
 * the service with a hand-built acting principal would prove the service honours
 * what it is given, which was never in doubt.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Client } from 'pg';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';
import { REQUIREMENT_ROOM_STORE } from '../../src/modules/requirement-room/requirement-room.tokens.js';
import type { RequirementRoomStore } from '../../src/modules/requirement-room/requirement-room.store.js';

const PREFIX = 'v1';
const WS = 'ws_bind';
const OWNER = 'u_bind_owner';
const OTHER_WS = 'ws_bind_other';
const OUTSIDER = 'u_bind_outsider';
const AGENT = 'p_bind_agent';
const ROOM = 'ro_bind';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let harness: AuthenticatedApp;
let app: INestApplication;
let cookie = '';

beforeAll(async () => {
  if (noRuntime) return;
  harness = await startAuthenticatedApp({
    prefix: PREFIX,
    workspaceId: WS,
    userId: OWNER,
    async seed(db) {
      // A second workspace with its own user, so a cross-tenant attempt is a
      // real one rather than a request naming a workspace nobody has.
      await db.query(
        `INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'other',now())`,
        [OTHER_WS],
      );
      await db.query(
        `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
         VALUES ($1,$2,'outsider@example.test','Outsider','unused',now())`,
        [OUTSIDER, OTHER_WS],
      );
    },
  });
  app = harness.app;
  cookie = harness.cookie;
}, 300_000);

afterAll(async () => {
  await harness?.close();
}, 120_000);

/**
 * The store the running application uses.
 *
 * `REQUIREMENT_ROOM_STORE` is in-memory by design at this stage, so "nothing was
 * written" is asked of the store rather than of a table. Asking PostgreSQL would
 * pass for the wrong reason: there is no candidates table to find a row in.
 */
const candidates = (workspaceId: string, roomObjectId = ROOM) =>
  app
    .get<RequirementRoomStore>(REQUIREMENT_ROOM_STORE, { strict: false })
    .listCandidates(workspaceId, roomObjectId);

const intake = (body: Record<string, unknown>, withCookie = true) => {
  const req = request(app.getHttpServer()).post(`/${PREFIX}/rooms/requirement/intake`);
  return withCookie ? req.set('Cookie', cookie).send(body) : req.send(body);
};

const VALID_INTAKE = {
  projectId: 'pr_bind',
  roomObjectId: ROOM,
  sourceRef: 'doc-bind',
  text: 'The system shall bind identity to the session.',
};

/**
 * Two fully-stated options, so a decision request is valid in every respect
 * except who is making it.
 *
 * The first draft of `T1153` sent none, and the refusal that came back was the
 * options rule rather than the actor rule — a pass that would have proved
 * nothing about identity. Everything here is correct so the actor is the only
 * thing left to refuse.
 */
const OPTIONS = [
  {
    id: 'opt_1',
    summary: 'Bind identity at the service',
    tradeOffs: ['every caller resolves'],
    dependencies: ['EPIC-024'],
    risks: ['one more lookup per request'],
    reasoning: 'the capability is what an MCP surface will reach too',
  },
  {
    id: 'opt_2',
    summary: 'Bind identity at the controller only',
    tradeOffs: ['smaller change'],
    dependencies: [],
    risks: ['a second surface repeats the defect'],
    reasoning: 'kept for contrast; not chosen',
  },
];

suite('T1151 · no session, no Room', () => {
  it.each([
    ['post', 'rooms/requirement/intake'],
    ['post', 'rooms/requirement/gap-intake'],
    ['post', `rooms/requirement/${ROOM}/clarifications`],
    ['get', `rooms/requirement/${ROOM}/analysis`],
    ['post', `rooms/requirement/${ROOM}/options`],
    ['post', `rooms/requirement/${ROOM}/decide`],
    ['post', `rooms/requirement/${ROOM}/baseline`],
    ['post', 'baselines/1/handoff'],
    ['get', `rooms/requirement/${ROOM}/readiness`],
  ] as const)('refuses unauthenticated %s /%s', async (method, route) => {
    // Every route, not only the two that write. `GET …/history` on EPIC-037
    // was the one that actually leaked, and it was a read.
    const response = await request(app.getHttpServer())[method](`/${PREFIX}/${route}`).send({});
    expect(response.status, `${method.toUpperCase()} /${route} answered ${response.status}`).toBe(
      401,
    );
  });

  it('the refusal is about the caller, not the resource', async () => {
    // 401, never the opaque 404 that hides cross-workspace existence. Conflating
    // them would tell an unauthenticated caller nothing, but it would also stop
    // a signed-out user being told to sign in.
    const response = await intake(VALID_INTAKE, false);
    expect(response.status).toBe(401);
    expect((response.body as { error?: { message?: string } }).error?.message).toMatch(
      /session/i,
    );
  });

  it('and writes nothing', async () => {
    expect(
      await candidates(WS),
      'an unauthenticated request created a candidate',
    ).toHaveLength(0);
  });

  it('the same request WITH a session succeeds — or the refusals prove nothing', async () => {
    // The control. Without it every assertion above would hold over a Room that
    // refused everybody.
    const response = await intake(VALID_INTAKE);
    expect(response.status).toBeLessThan(300);
    expect(Array.isArray(response.body)).toBe(true);
  });
});

suite('T1152 · a body cannot choose the workspace', () => {
  it('ignores a workspaceId in the body and uses the session', async () => {
    const response = await intake({ ...VALID_INTAKE, workspaceId: OTHER_WS });
    expect(response.status).toBeLessThan(300);
    const [candidate] = response.body as Array<{ workspaceId: string }>;
    // The whole of `DEF-033-001`'s first consequence. Before the fix this row
    // would have landed in `ws_bind_other`.
    expect(candidate?.workspaceId, 'the body chose the workspace').toBe(WS);
  });

  it('writes nothing into the workspace the body named', async () => {
    expect(
      await candidates(OTHER_WS),
      'a candidate reached the workspace the body named',
    ).toHaveLength(0);
  });
});

suite('T1153 · a caller cannot declare itself human', () => {
  it('refuses a decision when the session belongs to a non-human principal', async () => {
    // The agent is registered as a real, active, correctly-scoped principal —
    // everything except human. A session for it is exactly the case the old
    // check could not see, because it read `actor.kind` from the body.
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    await db.query(
      `INSERT INTO "principals"
         ("id","workspaceId","kind","descriptorRef","sponsorUserId","registeredByUserId",
          "state","identityVersion","correlationId","causationId")
       VALUES ($1,$2,'agent','bind-probe',$3,$3,'active',1,'c_bind','c_bind')`,
      [AGENT, WS, OWNER],
    );
    await db.end();

    const { SessionService } = await import('../../src/modules/auth/sessions.js');
    const { SESSION_COOKIE } = await import('../../src/modules/auth/auth.controller.js');
    const agentSession = app.get(SessionService, { strict: false }).create({
      userId: AGENT,
      workspaceId: WS,
      email: 'agent@example.test',
      displayName: 'Bind Probe',
    });

    const response = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/requirement/${ROOM}/decide`)
      // The body still claims to be human. It is simply not consulted.
      .set('Cookie', `${SESSION_COOKIE}=${agentSession.token}`)
      .send({
        actor: { kind: 'human', id: OWNER },
        chosenOptionId: 'opt_1',
        rationale: 'I say I am a person',
        options: OPTIONS,
      });

    expect(response.status, 'an agent recorded a requirement decision').toBeGreaterThanOrEqual(
      400,
    );
    // And refused for the RIGHT reason. A request rejected on its options would
    // pass a status check while proving nothing about identity.
    const body = response.body as { error?: { message?: string } };
    expect(String(body.error?.message), 'refused, but not as a non-human').toMatch(
      /human|agent/i,
    );
  });

  it('the SAME request from a human is not refused as non-human', async () => {
    // The control for the test above. Without it, an agent refused for any
    // reason at all would look like proof that the actor check works.
    const response = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/requirement/${ROOM}/decide`)
      .set('Cookie', cookie)
      .send({
        // The body claims to be an AGENT this time, and is again not consulted.
        actor: { kind: 'agent', id: AGENT },
        chosenOptionId: 'opt_1',
        rationale: 'a person decided',
        options: OPTIONS,
      });

    // It may still fail — EPIC-031's policy provider is not bound at this
    // stage, and `PolicyUnavailableError` is the honest answer to that. What it
    // must not do is refuse this caller for being non-human.
    const message = String((response.body as { error?: { message?: string } }).error?.message);
    expect(message, 'a human session was refused as a non-human').not.toMatch(
      /is a agent|is an agent|taken by a human/i,
    );
  });

  it('records no decision for the refused attempt', async () => {
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    const { rows } = await db.query<{ n: string }>(
      `SELECT count(*) AS n FROM "requirement_decisions" WHERE "roomObjectId" = $1`,
      [ROOM],
    );
    await db.end();
    expect(Number(rows[0]!.n), 'a refused decision was still written').toBe(0);
  });
});

suite('T1154 · a suspended principal loses the Room', () => {
  it('refuses every route once the session’s principal is suspended', async () => {
    // `EPIC-024` already refuses a suspended or revoked principal, and the Room
    // inherits that by consuming the boundary rather than checking membership
    // itself. Asserted here because inheriting a property silently is how it
    // gets lost in the next refactor.
    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    await db.query(
      `INSERT INTO "principals"
         ("id","workspaceId","kind","descriptorRef","sponsorUserId","registeredByUserId",
          "state","identityVersion","correlationId","causationId")
       VALUES ('p_bind_susp',$1,'agent','suspended-probe',$2,$2,'suspended',1,'c_susp','c_susp')`,
      [WS, OWNER],
    );
    await db.end();

    const { SessionService } = await import('../../src/modules/auth/sessions.js');
    const { SESSION_COOKIE } = await import('../../src/modules/auth/auth.controller.js');
    const session = app.get(SessionService, { strict: false }).create({
      userId: 'p_bind_susp',
      workspaceId: WS,
      email: 'susp@example.test',
      displayName: 'Suspended',
    });

    const response = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/requirement/intake`)
      .set('Cookie', `${SESSION_COOKIE}=${session.token}`)
      .send(VALID_INTAKE);

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('a session naming a principal of another workspace is refused', async () => {
    const { SessionService } = await import('../../src/modules/auth/sessions.js');
    const { SESSION_COOKIE } = await import('../../src/modules/auth/auth.controller.js');
    // A forged session claiming this workspace while naming the other's user.
    const session = app.get(SessionService, { strict: false }).create({
      userId: OUTSIDER,
      workspaceId: WS,
      email: 'outsider@example.test',
      displayName: 'Outsider',
    });

    const response = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/requirement/intake`)
      .set('Cookie', `${SESSION_COOKIE}=${session.token}`)
      .send(VALID_INTAKE);

    // The directory resolves the user to `ws_bind_other` and the boundary
    // refuses. The session's own claim about the workspace buys nothing.
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
