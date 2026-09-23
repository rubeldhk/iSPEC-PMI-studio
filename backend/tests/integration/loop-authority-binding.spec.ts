/**
 * `T1160`–`T1163` — the loop's authorities come from the policy, not the caller.
 *
 * `DEF-030-003`. `TransitionBody` used to declare `actorAuthorities`, and
 * `evaluateAuthority` decided on it — so the authority gate asked whether the
 * list the caller sent contained the authority it required. The Room's defect
 * let a caller assert an *identity*; this one let a caller assert an
 * *authorisation*, on the governed lifecycle transition.
 *
 * The defect was **latent**: no workflow type could be declared, the store was
 * in-memory, and the `AuthorityMap` was `{}`, which refuses every transition
 * before the caller's list is read. These tests therefore have to do something
 * the assessment could not — build a service that is genuinely configured, so
 * the authority gate is actually reached. A test against the inert production
 * wiring would pass on the strength of the inertness and prove nothing.
 *
 * So there are two halves:
 *
 * - the **service** half, configured to the point where authorities decide, run
 *   against the two resolvers;
 * - the **HTTP** half, against the composed application, proving the field is
 *   gone from the wire and the routes resolve their caller.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { LoopService } from '../../src/modules/loop/loop.service.js';
import { LoopConfigRegistry } from '../../src/modules/loop/config-registry.js';
import { InMemoryLoopStore } from '../../src/modules/loop/loop.store.js';
import { loadLoopConfig } from '../../src/modules/loop/loop-config.loader.js';
import { StageRegistry } from '../../src/modules/loop/stage-registry.js';
import { LOOP_STAGES } from '@pmi/loop-contract';
import { authoritiesOf, directoryOf } from '../helpers/loop-principals.js';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';

const here = dirname(fileURLToPath(import.meta.url));
const PREFIX = 'v1';
const WS = 'ws_auth_bind';
const OTHER_WS = 'ws_auth_other';

/** A workflow with a real authority requirement, so the gate is reached. */
const CONFIG = loadLoopConfig(
  {
    schemaVersion: 1,
    workflowType: 'authority-probe',
    stages: ['Event', 'Context', 'Decide', 'Outcome'],
    transitions: [
      { from: 'Event', to: 'Context', requiredGates: [], trigger: null },
      { from: 'Context', to: 'Decide', requiredGates: [], trigger: null },
      { from: 'Decide', to: 'Outcome', requiredGates: [], trigger: null },
    ],
    approvedBy: 'test',
    approvalRef: 'T1160',
  } as never,
  { registeredStages: new StageRegistry(LOOP_STAGES.map((s) => ({ stage: s }) as never)).registeredStages },
);

/** The tenant half — `Context->Decide` needs `lead`, and nothing else does. */
const AUTHORITIES = {
  'Event->Context': ['analyst', 'lead'],
  'Context->Decide': ['lead'],
  'Decide->Outcome': ['lead'],
};

const ACTORS = {
  u_analyst: { workspaceId: WS, authorities: ['analyst'] },
  u_lead: { workspaceId: WS, authorities: ['lead'] },
  u_outsider: { workspaceId: OTHER_WS, authorities: ['lead'] },
  p_agent: { workspaceId: WS, kind: 'agent' as const, authorities: ['lead'] },
  /** Holds nothing at all — the sharpest subject for a smuggling attempt. */
  u_nothing: { workspaceId: WS, authorities: [] },
} as const;

const ANALYST = { workspaceId: WS, userId: 'u_analyst' };
const LEAD = { workspaceId: WS, userId: 'u_lead' };

function configured(): LoopService {
  return new LoopService(
    new InMemoryLoopStore(),
    new LoopConfigRegistry([CONFIG]),
    AUTHORITIES,
    undefined,
    directoryOf(ACTORS),
    authoritiesOf(ACTORS),
  );
}

async function objectFor(loop: LoopService, principal = LEAD): Promise<string> {
  const ref = await loop.declareObject(principal, {
    projectId: 'p_1',
    workflowType: 'authority-probe',
    subjectType: 'opaque',
    subjectId: 's_1',
  });
  return ref.objectId;
}

describe('T1160 · the authority gate reads the policy, never the request', () => {
  it('refuses an actor the policy says does not hold the authority', async () => {
    const loop = configured();
    const id = await objectFor(loop);
    await loop.transition(ANALYST, { objectId: id, toStage: 'Context', expectedVersion: 0 });

    // `Context->Decide` requires `lead`; the directory says the analyst holds
    // only `analyst`. Before the fix, sending `actorAuthorities: ['lead']`
    // would have carried this.
    const refused = await loop.transition(ANALYST, {
      objectId: id,
      toStage: 'Decide',
      expectedVersion: 1,
    });
    expect(refused.outcome).toBe('refused');
    expect(String(refused.detail)).toMatch(/lead/);
  });

  it('permits the actor the policy says DOES hold it — or the refusal proves nothing', async () => {
    // The control. Without it, a gate that refused everybody would look like
    // proof that authorities are resolved.
    const loop = configured();
    const id = await objectFor(loop);
    await loop.transition(LEAD, { objectId: id, toStage: 'Context', expectedVersion: 0 });
    const accepted = await loop.transition(LEAD, {
      objectId: id,
      toStage: 'Decide',
      expectedVersion: 1,
    });
    expect(accepted.outcome).toBe('accepted');
  });

  it('a caller that smuggles actorAuthorities through gains nothing', async () => {
    // The type forbids it (`?: never`), so this is what a JavaScript caller or
    // an untyped HTTP body would do. The service must ignore it.
    //
    // Deliberately the FIRST transition, by an actor the directory says holds
    // NOTHING. An attempt later in a chain depends on earlier transitions
    // having succeeded and reports `conflict` for the wrong reason — the first
    // draft of this test did that, and survived a mutation restoring the defect.
    const loop = configured();
    const id = await objectFor(loop);

    const smuggled = await loop.transition(
      { workspaceId: WS, userId: 'u_nothing' },
      {
        objectId: id,
        toStage: 'Context',
        expectedVersion: 0,
        actorAuthorities: ['analyst', 'lead'],
        actor: { kind: 'human', id: 'u_lead' },
      } as never,
    );

    expect(smuggled.outcome, 'a self-granted authority was honoured').toBe('refused');
    // `authority.ts` renders an empty hand as `[none]`. Asserting the rendered
    // text is the point: it is what an auditor reads, and it must say the actor
    // held nothing rather than echoing what they sent.
    expect(String(smuggled.detail), 'the refusal did not read an empty hand').toMatch(
      /holds \[none\]/,
    );
  });

  it('and the same actor IS permitted once the POLICY grants it', async () => {
    // The other half of the detector: an identical request, one change — the
    // directory now says they hold it.
    const grantedActors = { ...ACTORS, u_nothing: { workspaceId: WS, authorities: ['analyst'] } };
    const granted = new LoopService(
      new InMemoryLoopStore(),
      new LoopConfigRegistry([CONFIG]),
      AUTHORITIES,
      undefined,
      directoryOf(grantedActors),
      authoritiesOf(grantedActors),
    );
    const id = await objectFor(granted);
    const accepted = await granted.transition(
      { workspaceId: WS, userId: 'u_nothing' },
      { objectId: id, toStage: 'Context', expectedVersion: 0 },
    );
    expect(accepted.outcome).toBe('accepted');
  });

  it('records the actor the DIRECTORY named, not the one the body named', async () => {
    const loop = configured();
    const id = await objectFor(loop);
    await loop.transition(ANALYST, {
      objectId: id,
      toStage: 'Context',
      expectedVersion: 0,
      actor: { kind: 'human', id: 'u_lead' },
    } as never);

    const [row] = await loop.history(ANALYST, id);
    expect(row?.actorId, 'the body chose who the history says acted').toBe('u_analyst');
  });

  it('records a non-human principal as automation, whatever the body claims', async () => {
    // `FR-GEL-032` records two kinds. The kind is the directory's now, so an
    // agent cannot be written into the history as a person.
    const loop = configured();
    const id = await objectFor(loop);
    await loop.transition(
      { workspaceId: WS, userId: 'p_agent' },
      { objectId: id, toStage: 'Context', expectedVersion: 0, actor: { kind: 'human', id: 'p_agent' } } as never,
    );
    const [row] = await loop.history(LEAD, id);
    expect(row?.actorKind).toBe('automation');
  });
});

describe('T1161 · the loop refuses a caller it cannot resolve', () => {
  it('refuses with no principal at all', async () => {
    const loop = configured();
    await expect(
      loop.declareObject(undefined as never, {
        projectId: 'p_1',
        workflowType: 'authority-probe',
        subjectType: 'o',
        subjectId: 's',
      }),
    ).rejects.toThrow(/session/i);
  });

  it('refuses when no directory is wired, rather than falling through', async () => {
    // The `DEF-033-001` lesson: a service that authenticates only when it
    // happens to have been given the means does not authenticate.
    const unwired = new LoopService(new InMemoryLoopStore(), new LoopConfigRegistry([CONFIG]), AUTHORITIES);
    await expect(
      unwired.declareObject(LEAD, {
        projectId: 'p_1',
        workflowType: 'authority-probe',
        subjectType: 'o',
        subjectId: 's',
      }),
    ).rejects.toThrow(/directory|session/i);
  });

  it('refuses an actor the directory does not know', async () => {
    const loop = configured();
    await expect(
      loop.declareObject(
        { workspaceId: WS, userId: 'u_nobody' },
        { projectId: 'p_1', workflowType: 'authority-probe', subjectType: 'o', subjectId: 's' },
      ),
    ).rejects.toThrow();
  });
});

describe('T1162 · an object belongs to a workspace, and the reads say so', () => {
  it('refuses a cross-workspace read with the opaque 404', async () => {
    const loop = configured();
    const id = await objectFor(loop);
    // The outsider is a real, active principal holding `lead` — in another
    // workspace. Everything about them is fine except where they are.
    const outsider = { workspaceId: OTHER_WS, userId: 'u_outsider' };
    await expect(loop.history(outsider, id)).rejects.toThrow(/not found/i);
    await expect(loop.progressOf(outsider, id)).rejects.toThrow(/not found/i);
    await expect(loop.exceptions(outsider, id)).rejects.toThrow(/not found/i);
  });

  it('refuses a cross-workspace transition the same way', async () => {
    const loop = configured();
    const id = await objectFor(loop);
    await expect(
      loop.transition(
        { workspaceId: OTHER_WS, userId: 'u_outsider' },
        { objectId: id, toStage: 'Context', expectedVersion: 0 },
      ),
    ).rejects.toThrow(/not found/i);
  });

  it('the owner reads it fine — or the refusals above prove nothing', async () => {
    const loop = configured();
    const id = await objectFor(loop);
    await expect(loop.history(LEAD, id)).resolves.toEqual([]);
    await expect(loop.progressOf(LEAD, id)).resolves.toBeInstanceOf(Array);
  });

  it('declares into the SESSION workspace, whatever the body says', async () => {
    const loop = configured();
    const ref = await loop.declareObject(LEAD, {
      workspaceId: OTHER_WS,
      projectId: 'p_1',
      workflowType: 'authority-probe',
      subjectType: 'o',
      subjectId: 's',
    } as never);
    // Readable by the session's workspace, which is the proof it landed there.
    await expect(loop.history(LEAD, ref.objectId)).resolves.toEqual([]);
  });
});

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const live = noRuntime ? describe.skip : describe;

live('T1163 · over HTTP, against the composed application', () => {
  let harness: AuthenticatedApp;
  let app: INestApplication;
  let cookie = '';

  beforeAll(async () => {
    harness = await startAuthenticatedApp({ prefix: PREFIX, workspaceId: WS });
    app = harness.app;
    cookie = harness.cookie;
  }, 300_000);

  afterAll(async () => {
    await harness?.close();
  }, 120_000);

  it.each([
    ['post', 'loop/objects'],
    ['post', 'loop/objects/probe/transitions'],
    ['get', 'loop/objects/probe/history'],
    ['get', 'loop/objects/probe/progress'],
    ['get', 'loop/objects/probe/exceptions'],
  ] as const)('refuses unauthenticated %s /%s', async (method, route) => {
    const response = await request(app.getHttpServer())[method](`/${PREFIX}/${route}`).send({});
    expect(response.status, `${method.toUpperCase()} /${route} answered ${response.status}`).toBe(
      401,
    );
  });

  it('with a session the route is reached — or the refusals prove nothing', async () => {
    const response = await request(app.getHttpServer())
      .get(`/${PREFIX}/loop/objects/probe/history`)
      .set('Cookie', cookie);
    // 404: the handler ran and looked. Not 401, which would mean it never did.
    expect(response.status).toBe(404);
  });

  it('the contract no longer names actorAuthorities anywhere', () => {
    // An absence, so it is read as text. The field was the defect; a body type
    // that reintroduces it reintroduces the hole.
    const controller = readFileSync(
      resolve(here, '../../src/modules/loop/loop.controller.ts'),
      'utf8',
    );
    const body = controller.slice(
      controller.indexOf('export interface TransitionBody'),
      controller.indexOf('@Controller'),
    );
    expect(body.length, 'TransitionBody was not found — this check is vacuous').toBeGreaterThan(50);
    expect(body.includes('actorAuthorities'), 'the transition body accepts authorities').toBe(false);
    expect(body.includes('actor'), 'the transition body accepts an actor').toBe(false);
  });
});
