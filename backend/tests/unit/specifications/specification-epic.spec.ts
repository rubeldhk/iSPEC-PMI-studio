/**
 * `T1597` (EPIC-044, `FR-EPB-025`, `FR-EPB-050`) — specifications carry their
 * Epic: the list rows gain `epicId`, `epicNumber`, `epicTitle` (null when
 * unbound) through the same decoration the requirement list uses, and an owner
 * assigns or unassigns a specification through the Epic service. Written to
 * FAIL before `T1598`.
 */
import { describe, expect, it } from 'vitest';
import { withEpicColumns } from '../../../src/modules/epics/epic-columns.js';
import { harness } from '../epics/epic.service.spec.js';

const OWNER = { workspaceId: 'ws_a', projectId: 'p_a', userId: 'u_owner' };

describe('T1597 · withEpicColumns', () => {
  it('names the Epic of a bound row and nulls the three columns of an unbound one', () => {
    const rows = [
      { id: 's1', title: 'Intake spec', epicId: 'e2' },
      { id: 's2', title: 'Orphan spec', epicId: null },
      { id: 's3', title: 'Older row', epicId: undefined },
      { id: 's4', title: 'Points at a deleted Epic', epicId: 'e_gone' },
    ];
    const epics = [{ id: 'e2', number: 2, title: 'Review' }];
    expect(withEpicColumns(rows, epics)).toEqual([
      { id: 's1', title: 'Intake spec', epicId: 'e2', epicNumber: 2, epicTitle: 'Review' },
      { id: 's2', title: 'Orphan spec', epicId: null, epicNumber: null, epicTitle: null },
      { id: 's3', title: 'Older row', epicId: null, epicNumber: null, epicTitle: null },
      { id: 's4', title: 'Points at a deleted Epic', epicId: 'e_gone', epicNumber: null, epicTitle: null },
    ]);
  });

  it('is the same decoration for requirements and specifications (one function, two lists)', () => {
    const epics = [{ id: 'e1', number: 1, title: 'Intake' }];
    expect(withEpicColumns([{ reference: 'REQ-001', epicId: 'e1' }], epics)[0]).toMatchObject({ epicNumber: 1, epicTitle: 'Intake' });
    expect(withEpicColumns([{ lifecycleState: 'draft', epicId: 'e1' }], epics)[0]).toMatchObject({ epicNumber: 1, epicTitle: 'Intake' });
  });
});

describe('T1597 · assigning a specification to an Epic (FR-EPB-025)', () => {
  it('assigns, unassigns, refuses a closed Epic and audits; the Epic detail lists the specification', async () => {
    const { service, specifications } = harness();
    const epic = await service.create(OWNER, { title: 'Intake' });
    await service.assignSpecification(OWNER, 's1', epic.id);
    expect((await specifications.find('ws_a', 's1'))?.epicId).toBe(epic.id);
    expect((await service.get(OWNER, epic.id)).specifications.map((s) => s.id)).toEqual(['s1']);
    await service.assignSpecification(OWNER, 's1', null);
    expect((await specifications.find('ws_a', 's1'))?.epicId).toBeNull();
    await service.close(OWNER, epic.id);
    await expect(service.assignSpecification(OWNER, 's1', epic.id)).rejects.toMatchObject({ details: { code: 'epic_not_active' } });
  });
});
