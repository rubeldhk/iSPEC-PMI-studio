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
import type { ReactElement } from 'react';
import { Outlet } from 'react-router';
import { ShellNavigation } from './Navigation';
import { NavigationDrawer, useIsNarrow } from './NavigationDrawer';

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
