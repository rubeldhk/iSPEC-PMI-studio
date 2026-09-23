/**
 * `T1172` — the Requirement Room area landing.
 *
 * A **page**, not a shell adapter, and the distinction is enforced:
 * `shell-boundaries` (`T436m`) forbids `frontend/src/shell/` from calling any
 * `api.*` method, because the shell hosts screens and must not become a place
 * domain data is fetched. The first draft of this put the call in
 * `area-views.tsx` and that test caught it.
 *
 * So the shape matches `SpecificationsArea` → `SpecificationList`: the shell
 * passes `api` and the navigation callbacks; the page turns `api` into a `load`
 * function; `rooms/RoomIndex` renders and knows about neither.
 *
 * That layering is also what keeps `RoomIndex` shareable — `EPIC-034` and
 * `EPIC-035` write their own thin page like this one and reuse the index whole.
 */
import { useCallback, type ReactElement } from 'react';
import { RoomIndex, type RoomKind } from '../rooms/RoomIndex';
import type { ApiClient, RoomSummary } from '../services/api';

/**
 * The Requirement Room's half of the shared index.
 *
 * Exported so a test can assert the other Rooms' kinds differ from it rather
 * than comparing against a literal copied into the test.
 */
export const REQUIREMENT_ROOM_KIND: RoomKind = {
  id: 'requirement-room',
  title: 'Requirement Room',
  routePrefix: '/requirement-room',
  openLabel: 'Start a Requirement Room',
  emptyHint:
    'Bring a page of unstructured intent. The Room extracts candidate requirements, asks what it cannot infer, and freezes an approved set as a baseline.',
};

export interface RequirementRoomsProps {
  readonly api: ApiClient;
  readonly onOpen: (roomObjectId: string) => void;
  readonly onStart: () => void;
}

export function RequirementRooms({ api, onOpen, onStart }: RequirementRoomsProps): ReactElement {
  // `useCallback`, because `RoomIndex` refetches when `load` changes identity.
  // An inline arrow would give it a new function every render and refetch on
  // each one — the kind of defect that shows up as load, not as breakage.
  const load = useCallback((): Promise<readonly RoomSummary[]> => api.listRequirementRooms(), [api]);
  return <RoomIndex kind={REQUIREMENT_ROOM_KIND} load={load} onOpen={onOpen} onStart={onStart} />;
}
