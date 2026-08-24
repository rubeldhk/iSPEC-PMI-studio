/**
 * T437b / T440f (EPIC-036) — primary navigation: four groups, one list.
 *
 * **`EPIC-029`'s `Navigation` is consumed, not replaced.** It already carries
 * `<nav>` + `aria-current` (`D-42`, `FR-DS-012`), so the current destination is
 * exposed to assistive technology rather than by colour alone. What it does not
 * have is grouping — `components.md` describes a flat list — so this composes
 * **one labelled navigation landmark per group**, which is how §4.1's grouping
 * reaches a screen reader as grouping (`FR-SHL-053`).
 *
 * That is the clause `prototype-parity.md` reserves for exactly this case: a
 * component the shell needs that `components.md` lacks is built **against that
 * contract**. Nothing here restyles or forks the design system.
 *
 * Unit tests: `frontend/tests/unit/shell/Navigation.spec.tsx` (T437a, T437k),
 * `frontend/tests/unit/shell/shell-a11y.spec.tsx` (T440c, T440e, T440g).
 */
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { Navigation as DsNavigation } from '../design/components/Navigation';
import { navigationModel } from './navigation-model';
import { useCurrentArea } from './shell-context';

export interface ShellNavigationProps {
  /** Called after a selection, so a drawer can close itself. */
  onNavigated?: () => void;
}

export function ShellNavigation({ onNavigated }: ShellNavigationProps): ReactElement {
  const navigate = useNavigate();
  const current = useCurrentArea();
  const groups = navigationModel();

  return (
    <div className="shell-nav">
      {groups.map((group) => (
        <DsNavigation
          key={group.group}
          label={group.label}
          orientation="vertical"
          items={group.areas.map((area) => ({
            id: area.id,
            label: area.label,
            current: area.id === current?.id,
          }))}
          onSelect={(id): void => {
            const target = group.areas.find((area) => area.id === id);
            if (target === undefined) return;
            void navigate(target.path);
            onNavigated?.();
          }}
        />
      ))}
    </div>
  );
}
