/**
 * `T1257` (EPIC-038) — the partition is not the permission.
 *
 * `FR-CTX-054`, `R-038-7`.
 *
 * ## The conflation this file exists to catch
 *
 * Workspace scoping and authorisation look like the same check. They are not:
 *
 * - **Scoping** is a property of the *data* — which rows exist for this query.
 * - **Authorisation** is a property of the *actor* — whether this person may
 *   read this row.
 *
 * A system that treats the partition as the permission grants **every member of
 * a workspace everything in it**. Salary reviews, incident postmortems, a
 * customer's exported data: all of it is inside the tenant boundary, and all of
 * it would be inside every package.
 *
 * ## Why it is worth its own test
 *
 * Because that system passes every other isolation test in the phase. `T1253`
 * checks nothing crosses a tenant boundary — it does not. `T1254` checks an
 * authorised source crosses — it does. `T1255` checks direction — fine. The
 * boundary it *does* enforce is visibly working, which is exactly what makes
 * the missing half invisible.
 *
 * So each assertion here satisfies the boundary and then withholds the
 * permission, and requires the item out anyway.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import {
  allow,
  authorisedCrossing,
  candidates,
  classes,
  denyFor,
  input,
  noAuthorisations,
  retrieval,
} from '../helpers/context-fixtures.js';

describe('T1257 · own-workspace material still needs permission', () => {
  it('is excluded when AccessPolicy refuses, though the boundary permits it', async () => {
    // The partition is satisfied: this material belongs to `ws_1`, the
    // requesting workspace. A system reading the partition as the permission
    // includes it. `FR-CTX-054` requires `EPIC-024` to be asked anyway.
    const store = new InMemoryContextStore();
    const subject = new AssemblyService(store, {
      retrieval: retrieval(candidates(['rq_1', 'rq_2'])),
      access: denyFor('rq_2'),
      sourceClasses: classes(['requirement']),
      authorisations: noAuthorisations(),
    });

    const result = await subject.assemble(input());
    const items = await store.itemsFor('ws_1', result.packageId);
    expect(items.map((i) => i.sourceId)).toEqual(['rq_1']);
  });

  it('and the exclusion says permission, not boundary', async () => {
    // The two reasons send a reader to different people: one to whoever grants
    // access, one to whoever owns the other workspace. Reporting the wrong one
    // wastes both their time.
    const store = new InMemoryContextStore();
    const subject = new AssemblyService(store, {
      retrieval: retrieval(candidates(['rq_1', 'rq_2'])),
      access: denyFor('rq_2'),
      sourceClasses: classes(['requirement']),
      authorisations: noAuthorisations(),
    });

    const result = await subject.assemble(input());
    const exclusions = await store.exclusionsFor('ws_1', result.packageId);
    expect(exclusions[0]?.reason).toBe('permission');
    expect(exclusions[0]?.reason).not.toBe('boundary');
  });
});

describe('T1257 · and an AUTHORISED crossing still needs permission', () => {
  it('is excluded when the actor may not read it', async () => {
    // The sharpest case. The source is authorised to cross — `FR-CTX-051` is
    // satisfied, the boundary says yes — and the actor still may not read it.
    // *Authorised to cross* and *permitted to read* are different grants, made
    // by different people, for different reasons.
    const store = new InMemoryContextStore();
    const subject = new AssemblyService(store, {
      retrieval: retrieval([
        {
          sourceType: 'handbook',
          sourceId: 'hb_1',
          sourceVersion: 'v1',
          relevanceScore: 0.95,
          workspaceId: 'ws_other',
        },
      ]),
      access: denyFor('hb_1'),
      sourceClasses: classes(['handbook']),
      authorisations: authorisedCrossing('hb_1', 'ws_other', 'ws_1'),
    });

    const result = await subject.assemble(input());
    expect(await store.itemsFor('ws_1', result.packageId)).toHaveLength(0);
    const exclusions = await store.exclusionsFor('ws_1', result.packageId);
    expect(exclusions[0]?.reason).toBe('permission');
  });

  it('the control: with permission granted, the authorised crossing IS included', async () => {
    // Without this, a service refusing every cross-boundary item would satisfy
    // the assertion above while making `FR-CTX-051`'s exception dead.
    const store = new InMemoryContextStore();
    const subject = new AssemblyService(store, {
      retrieval: retrieval([
        {
          sourceType: 'handbook',
          sourceId: 'hb_1',
          sourceVersion: 'v1',
          relevanceScore: 0.95,
          workspaceId: 'ws_other',
        },
      ]),
      access: allow(),
      sourceClasses: classes(['handbook']),
      authorisations: authorisedCrossing('hb_1', 'ws_other', 'ws_1'),
    });

    const result = await subject.assemble(input());
    const items = await store.itemsFor('ws_1', result.packageId);
    expect(items).toHaveLength(1);
    expect(items[0]?.crossBoundary).toBe(true);
    expect(items[0]?.authorisationRef).toBe('rka_1');
  });
});

describe('T1257 · and the boundary refuses even when permission is granted', () => {
  it('unauthorised foreign material stays out though the actor may read it', async () => {
    // The mirror of the case above, and the reason both checks exist. A
    // permissive `AccessPolicy` must not be able to grant a crossing nobody
    // authorised — otherwise the actor's permissions become a route around the
    // tenant boundary.
    const store = new InMemoryContextStore();
    const subject = new AssemblyService(store, {
      retrieval: retrieval([
        {
          sourceType: 'handbook',
          sourceId: 'hb_1',
          sourceVersion: 'v1',
          relevanceScore: 0.95,
          workspaceId: 'ws_other',
        },
      ]),
      access: allow(),
      sourceClasses: classes(['handbook']),
      authorisations: noAuthorisations(),
    });

    const result = await subject.assemble(input());
    expect(await store.itemsFor('ws_1', result.packageId)).toHaveLength(0);
    const exclusions = await store.exclusionsFor('ws_1', result.packageId);
    expect(exclusions[0]?.reason).toBe('boundary');
  });

  it('so neither check alone decides — both must say yes', async () => {
    // Stated as one assertion because it is the phase's whole argument: two
    // independent grants, and an item needs both.
    const build = (
      access: ReturnType<typeof allow>,
      authorisations: ReturnType<typeof noAuthorisations>,
    ): AssemblyService =>
      new AssemblyService(new InMemoryContextStore(), {
        retrieval: retrieval([
          {
            sourceType: 'handbook',
            sourceId: 'hb_1',
            sourceVersion: 'v1',
            relevanceScore: 0.95,
            workspaceId: 'ws_other',
          },
        ]),
        access,
        sourceClasses: classes(['handbook']),
        authorisations,
      });

    const both = await build(allow(), authorisedCrossing('hb_1', 'ws_other', 'ws_1')).assemble(
      input(),
    );
    const noPermission = await build(
      denyFor('hb_1'),
      authorisedCrossing('hb_1', 'ws_other', 'ws_1'),
    ).assemble(input());
    const noAuthorisation = await build(allow(), noAuthorisations()).assemble(input());

    expect([both.itemCount, noPermission.itemCount, noAuthorisation.itemCount]).toEqual([1, 0, 0]);
  });
});
