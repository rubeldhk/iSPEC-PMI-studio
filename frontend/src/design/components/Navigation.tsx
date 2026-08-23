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
  /**
   * How many things wait at this destination (T922, parity row 9 — the
   * prototype's `.nav-item .n`). Announced as part of the item's name, not
   * left as a bare number a screen reader would read out of context.
   */
  count?: number;
}

export interface NavigationProps {
  /** Accessible name for the landmark — pages may carry several navs. */
  label: string;
  items: NavigationItem[];
  onSelect: (id: string) => void;
  /**
   * T922, parity row 9. The prototype's primary navigation is a vertical
   * rail; a page's secondary navigation is a horizontal row. Both are this
   * component — orientation is presentation, and the markup, semantics and
   * `aria-current` are identical either way.
   */
  orientation?: 'horizontal' | 'vertical';
}

export function Navigation({
  label,
  items,
  onSelect,
  orientation = 'horizontal',
}: NavigationProps): ReactElement {
  return (
    <nav className="ds-nav" aria-label={label}>
      <ul className={`ds-nav__list ds-nav__list--${orientation}`}>
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="ds-nav__item"
              aria-current={item.current ? 'page' : undefined}
              disabled={item.disabled}
              onClick={() => onSelect(item.id)}
            >
              <span className="ds-nav__label">{item.label}</span>
              {item.count !== undefined && (
                // The count is inside the button, so it is part of the
                // accessible name: "Requirements 12 waiting", never a
                // disembodied "12" the reader has to attach to something.
                <span className="ds-nav__count">
                  {item.count}
                  <span className="ds-visually-hidden"> waiting</span>
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
