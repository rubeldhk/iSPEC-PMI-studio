/**
 * T437d (EPIC-036) — the frame: navigation, and whatever the address resolves
 * to.
 *
 * `BR-0190` — *"core lifecycle capabilities MUST be navigable as one coherent
 * application"* — is a MUST that no Epic owned. Every screen Epic built its
 * page correctly and nothing owned assembling them; the consequence was
 * `DEF-010-001`, nine pages of which four were reachable, for five months, with
 * every gate green. **This file is the composition.**
 *
 * It renders the frame and **no area's content** (`FR-SHL-003`). The area
 * arrives through `<Outlet />` and the shell never looks inside it.
 *
 * **The outer frame is `EPIC-029`'s and is not restated here.** `.ds-shell`,
 * `.ds-topbar` and `.ds-content` are that Epic's adopted prototype row 10, held
 * by `T924` and scanned by `T930`; `main.tsx` renders them and this component
 * lives inside `.ds-content`. Building a second top bar would be the fork
 * `prototype-parity.md` exists to prevent.
 *
 * **The Room regions are not restated either** (`FR-SHL-040`–`FR-SHL-043`).
 * `packages/room-contract` owns that vocabulary; the shell supplies the frame
 * and a Room supplies its six regions. Declaring a seventh here would make
 * `EPIC-034` `T994t` and `EPIC-035` `T998y` compare against a vocabulary that
 * had quietly grown.
 *
 * Unit tests: `frontend/tests/unit/shell/AppShell.spec.tsx` (T437c).
 */
import type { ReactElement, ReactNode } from 'react';
import { Outlet } from 'react-router';
import type { RoomShellProps } from '@pmi/room-contract';
import { RoomShell } from '../rooms/RoomShell';
import { ShellNavigation } from './Navigation';
import { NavigationDrawer, useIsNarrow } from './NavigationDrawer';

/**
 * How a Room area is hosted — `T441s`, from the convergence finding `F2`.
 *
 * **The seam is typed by the contract, not by the shell.** `RoomShellProps`
 * comes from `@pmi/room-contract` and the rendering is `EPIC-033`'s `RoomShell`.
 * Nothing here restates the six regions, decides an order, or adds a prop —
 * `FR-SHL-040`–`FR-SHL-043` and `UX-0035` all turn on there being exactly one
 * definition, and `EPIC-034` `T994t` and `EPIC-035` `T998y` compare against it.
 *
 * **Why this exists at all**, given it is nearly a re-export. `T441e` claimed
 * the contract was adopted and the shell did not import it anywhere; `T441d`
 * only ever asserted the shell does not *re-derive* the types, which is equally
 * true of a shell that has never heard of them. So *"adopted"* was a sentence in
 * a document, and the first Room to arrive would have found no seam and invented
 * one. This is the seam, and `T441t` is the assertion that it is real.
 *
 * A Room area's element calls this with its six regions. The shell supplies the
 * frame around it and looks inside none of them (`FR-SHL-003`).
 */
export function hostRoom(regions: RoomShellProps<ReactNode>): ReactElement {
  return <RoomShell {...regions} />;
}

export function AppShell(): ReactElement {
  const narrow = useIsNarrow();

  return (
    <div className="shell">
      {/* One navigation model at every width (`FR-SHL-054`): the drawer renders
          the same component the sidebar does, so the two cannot drift. */}
      {narrow ? (
        <NavigationDrawer />
      ) : (
        <div className="shell__sidebar">
          <ShellNavigation />
        </div>
      )}

      {/* A plain div, NOT a second `<main>`. Six of the delivered pages render
          their own landmark and four do not; `area-views.tsx` supplies the
          missing ones and `T440e` asserts there is exactly one at every
          address. Nesting a landmark here would break the six that are
          already right. */}
      <div className="shell__main">
        <Outlet />
      </div>
    </div>
  );
}
