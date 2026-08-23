/**
 * T337l — `@pmi/room-contract`.
 *
 * **The shared Room pattern, and this Epic's most consequential output.**
 * `EPIC-034` `T406b` and `EPIC-035` `T997a` both stop if this package is not
 * built — their first tasks say so in those words — because a second derivation
 * of the pattern is exactly how `UX-0035` would stop being true.
 *
 * Three things, and nothing else:
 *
 *   - `RoomShellProps` — six required named regions, no `children`;
 *   - `Epistemic` / `Labelled<T>` — the required label, four kinds, no default;
 *   - `RoomObjectRef` — an open `workflowType`, so the contract does not know
 *     its consumers.
 *
 * **What is deliberately absent** (`FR-RQR-002`, `FR-RQR-003`, asserted by
 * `backend/tests/architecture/room-contract-independence.spec.ts`): no
 * requirement-storage type — `EPIC-007` owns the register and `D-33` says so —
 * no Change or Defect Room vocabulary, no loop stage names, no risk band, no
 * evidence type.
 *
 * The contract is also **framework-free**: no React import, so a Room's tests
 * can construct these props without a renderer and `packages/` keeps no
 * framework dependency. `frontend/src/rooms/RoomShell.tsx` is the
 * user-interface half.
 */

export { ROOM_REGIONS, isRoomRegion, type RoomRegion, type RoomShellProps } from './regions.js';
export {
  EPISTEMIC_KINDS,
  isEpistemic,
  labelled,
  type Epistemic,
  type Labelled,
} from './epistemic.js';
export type { RoomObjectRef } from './object-ref.js';
export {
  ROOM_PORTS,
  absentBehaviourOf,
  type AbsentBehaviour,
  type RoomPort,
  type RoomPortName,
} from './ports.js';
