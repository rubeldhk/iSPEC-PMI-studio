/**
 * T893 (EPIC-029) — Navigation, built on `<nav>` + `aria-current` (D-42):
 * the current location is exposed to assistive tech, never by colour alone
 * (FR-DS-012). A held destination is disabled, visible, and announced —
 * hiding it would make the product's shape depend on state.
 * Unit tests: tests/unit/design/structure.spec.tsx (T889).
 */
import type { ReactElement } from 'react';

export interface NavigationItem {
  id: string;
  label: string;
  current?: boolean;
  disabled?: boolean;
}

export interface NavigationProps {
  /** Accessible name for the landmark — pages may carry several navs. */
  label: string;
  items: NavigationItem[];
  onSelect: (id: string) => void;
}

export function Navigation({ label, items, onSelect }: NavigationProps): ReactElement {
  return (
    <nav className="ds-nav" aria-label={label}>
      <ul className="ds-nav__list">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="ds-nav__item"
              aria-current={item.current ? 'page' : undefined}
              disabled={item.disabled}
              onClick={() => onSelect(item.id)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
