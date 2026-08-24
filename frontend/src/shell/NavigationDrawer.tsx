/**
 * T440b (EPIC-036) — navigation below the narrow breakpoint.
 *
 * `FR-SHL-054`, settled at clarification on 2026-08-24: primary navigation
 * collapses into a **drawer** opened by a persistent control, carrying the
 * **full grouped list**. One navigation model at every width, so there is one
 * thing to build, test and describe rather than two — and the grouping that
 * makes eighteen areas legible survives the narrow case, which an icon rail
 * would not.
 *
 * The drawer renders `ShellNavigation` itself. Not a copy of it: two lists that
 * must agree is the shape `DEF-010-001` took, and a drawer that had drifted
 * from the sidebar would be that defect at one viewport width.
 *
 * Unit tests: `frontend/tests/unit/shell/NavigationDrawer.spec.tsx` (T440a).
 */
import { useEffect, useState, type ReactElement } from 'react';
import { useLocation } from 'react-router';
import { Button } from '../design/components/Button';
import { ShellNavigation } from './Navigation';

/** `UX-0040`'s floor is 360px; the shell narrows below the tablet breakpoint. */
export const NARROW_BREAKPOINT_PX = 768;

/**
 * Is the viewport narrow?
 *
 * Guarded, because `matchMedia` is not universally present in test
 * environments. A missing `matchMedia` means *"assume wide"*: the sidebar is
 * the fuller surface, so an environment that cannot answer gets the one that
 * shows everything rather than the one hidden behind a control.
 */
export function useIsNarrow(breakpointPx: number = NARROW_BREAKPOINT_PX): boolean {
  const query = `(max-width: ${breakpointPx - 1}px)`;
  const [narrow, setNarrow] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(query);
    const update = (): void => {
      setNarrow(media.matches);
    };
    update();
    media.addEventListener?.('change', update);
    return (): void => {
      media.removeEventListener?.('change', update);
    };
  }, [query]);

  return narrow;
}

export function NavigationDrawer(): ReactElement {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // Close on navigation. A drawer left open over the area it just opened hides
  // the thing the user asked for, at the width where there is least room.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="shell-drawer">
      <Button
        variant="secondary"
        aria-expanded={open}
        aria-controls="shell-drawer-panel"
        onClick={(): void => {
          setOpen((wasOpen) => !wasOpen);
        }}
      >
        {open ? 'Close menu' : 'Menu'}
      </Button>
      {/* Unmounted when closed rather than hidden with CSS: a closed drawer
          must not leave every area in the tab order behind an invisible
          surface (`FR-SHL-052`). */}
      {open && (
        <div id="shell-drawer-panel" className="shell-drawer__panel">
          <ShellNavigation
            onNavigated={(): void => {
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
